const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPT = `Du analysierst den Inhalt einer Excel-Datei für eine Sicherheitsunterweisung oder Evaluierung.
Extrahiere alle Prüfpunkte/Fragen als strukturierte Checkliste.
Jeder Prüfpunkt hat: category (optional, z.B. "Brandschutz") und question (der eigentliche Prüfpunkt/die Frage).
Übernimm die Inhalte 1:1 — erfinde nichts, lass nichts weg.
Gib NUR ein JSON-Objekt zurück: {"items":[{"category":"...","question":"..."}]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ok = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  let rows: unknown[] = [];

  try {
    const body = await req.json();
    rows = body?.rows ?? [];
  } catch (e) {
    console.error("Failed to parse request body:", e);
    return ok({ items: [], error: `Request body parse error: ${e}` });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return ok({ items: [], error: "rows array is empty or missing" });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("OPENAI_API_KEY not set");
    return ok({ items: [], error: "OPENAI_API_KEY not configured" });
  }

  // Limit rows to avoid exceeding context window / timeouts
  const limitedRows = rows.slice(0, 200);
  // Compact stringify — avoid large payloads
  const content = JSON.stringify(limitedRows);

  let openAiResponse: Response;
  try {
    openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: `${PROMPT}\n\nExcel-Inhalt:\n${content}`,
          },
        ],
      }),
    });
  } catch (e) {
    console.error("OpenAI fetch error:", e);
    return ok({ items: [], error: `OpenAI network error: ${e}` });
  }

  if (!openAiResponse.ok) {
    const errText = await openAiResponse.text();
    console.error("OpenAI API error:", openAiResponse.status, errText);
    return ok({ items: [], error: `OpenAI error ${openAiResponse.status}: ${errText}` });
  }

  let items: unknown[] = [];
  try {
    const result = await openAiResponse.json();
    const text = result.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    items = Array.isArray(parsed.items) ? parsed.items : [];
  } catch (e) {
    console.error("Response parse error:", e);
    return ok({ items: [], error: `Response parse error: ${e}` });
  }

  return ok({ items });
});
