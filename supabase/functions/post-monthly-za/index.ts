// Monatsabschluss-Buchung fuer das ZA-Stundenkonto.
//
// Die eigentliche Logik liegt in der Postgres-RPC `post_za_atomically()`
// — sie macht Advisory-Lock, Storno-Repost, Cutoff-Filter und atomares
// UPSERT. Hier ist nur ein duenner HTTP-Wrapper drumherum.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  userId?: string;
  year?: number;
  month?: number;
  mode?: "post" | "storno_repost";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "Methode nicht erlaubt");
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Ungueltiger JSON-Body");
  }

  const userId = (body.userId || "").trim();
  const year = Number(body.year);
  const month = Number(body.month);
  const mode = body.mode === "storno_repost" ? "storno_repost" : "post";

  if (!userId) return jsonError(400, "userId fehlt");
  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    return jsonError(400, "year ungueltig");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return jsonError(400, "month ungueltig (1..12)");
  }

  const { data, error } = await supabaseAdmin.rpc("post_za_atomically", {
    p_user_id: userId,
    p_year: year,
    p_month: month,
    p_mode: mode,
  });

  if (error) {
    return jsonError(500, `RPC-Fehler: ${error.message}`);
  }

  // RPC liefert ein jsonb-Objekt zurueck. Wenn es ein 'error'-Feld hat,
  // ist es ein anwendungs-fachlicher Fehler (z.B. 409 bereits gebucht).
  if (data && typeof data === "object" && "error" in data) {
    const code = typeof data.code === "number" ? data.code : 400;
    return new Response(JSON.stringify(data), {
      status: code,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
