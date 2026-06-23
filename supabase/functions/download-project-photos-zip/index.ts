// Streamt alle Fotos eines Projekts (optional eines Unter-Ordners) als
// ZIP-Datei zurueck. Lauft server-seitig damit der Client nicht jedes
// Foto einzeln ueber das Internet ziehen muss.
//
// Body: { projectId: string; subType?: string | null }
//   subType=null/undefined  →  alle nicht-archivierten Fotos
//   subType="<ordner>"      →  nur Fotos mit documents.sub_type=<ordner>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { downloadZip } from "https://esm.sh/client-zip@2.5.0";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // Damit der Browser den X-File-Count-Header aus der Response lesen kann.
  "Access-Control-Expose-Headers": "X-File-Count",
};

const BUCKET = "project-photos";
// Hoehere Concurrency = schnellerer Server-seitiger Download aus dem Storage.
// 12 ist ein guter Kompromiss zwischen Durchsatz und Resource-Schonung.
const CONCURRENCY = 12;

// Dateiname-Sanitizer: Sonderzeichen raus, ASCII-Mapping fuer Umlaute,
// damit Browser den ZIP-Namen korrekt setzen.
const asciiize = (s: string): string =>
  s
    .replace(/ä/g, "ae").replace(/Ä/g, "Ae")
    .replace(/ö/g, "oe").replace(/Ö/g, "Oe")
    .replace(/ü/g, "ue").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[/\\:*?"<>|]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 200);

const safeNameFor = (raw: string): string => asciiize(raw || "datei") || "datei";

// Verspricht: ein konsumierender Async-Iterator ueber {name, lastModified,
// input: ReadableStream<Uint8Array>}. Parallele Pre-Fetches mit
// Concurrency-Limit, yielded in Eingabe-Reihenfolge fuer stabile ZIP-Inhalte.
async function* concurrentBlobFetcher(
  files: { name: string; storagePath: string; created_at: string }[],
) {
  // Names entdoppeln (foto.jpg, foto_1.jpg …)
  const seen = new Map<string, number>();
  const named = files.map((f) => {
    const base = safeNameFor(f.name);
    const c = seen.get(base) || 0;
    seen.set(base, c + 1);
    if (c === 0) return { ...f, outName: base };
    const dot = base.lastIndexOf(".");
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : "";
    return { ...f, outName: `${stem}_${c}${ext}` };
  });

  // In Eingabe-Reihenfolge yielden, aber Pre-Fetch im Pool.
  let nextStart = 0;
  const inFlight = new Map<number, Promise<Blob>>();

  const launchNext = () => {
    if (nextStart >= named.length) return;
    const i = nextStart++;
    const f = named[i];
    inFlight.set(
      i,
      (async () => {
        const { data, error } = await supabaseAdmin.storage
          .from(BUCKET)
          .download(f.storagePath);
        if (error || !data) throw new Error(`Storage download ${f.storagePath}: ${error?.message || "leer"}`);
        return data;
      })(),
    );
  };

  for (let i = 0; i < CONCURRENCY && i < named.length; i++) launchNext();

  for (let i = 0; i < named.length; i++) {
    const blob = await inFlight.get(i)!;
    inFlight.delete(i);
    launchNext();
    const f = named[i];
    yield {
      name: f.outName,
      lastModified: new Date(f.created_at),
      input: blob.stream(),
    };
  }
}

interface RequestBody {
  projectId?: string;
  subType?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Sowohl GET (fuer nativen Browser-Download via <a download>) als auch
  // POST (Legacy) akzeptieren. GET ist der bevorzugte Pfad, weil der
  // Browser die ZIP dann nativ entgegennimmt und keinen Blob im RAM hat.
  let projectId = "";
  let subType: string | null = null;

  if (req.method === "GET") {
    const u = new URL(req.url);
    projectId = (u.searchParams.get("projectId") || "").trim();
    const s = u.searchParams.get("subType");
    subType = s && s.length > 0 ? s : null;
  } else if (req.method === "POST") {
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Ungueltiger JSON-Body");
    }
    projectId = (body.projectId || "").trim();
    subType = typeof body.subType === "string" && body.subType.length > 0
      ? body.subType
      : null;
  } else {
    return jsonError(405, "Methode nicht erlaubt");
  }

  if (!projectId) return jsonError(400, "projectId fehlt");

  // Projekt-Name fuer den ZIP-Dateinamen.
  const { data: project, error: projErr } = await supabaseAdmin
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  if (projErr) return jsonError(500, `Projekt-Lookup: ${projErr.message}`);
  if (!project) return jsonError(404, "Projekt nicht gefunden");

  // Foto-Dateien aus documents holen. Storage-Listing ist nicht zuverlaessig
  // (Archive-Flag fehlt dort), deshalb DB-only.
  let query = supabaseAdmin
    .from("documents")
    .select("name, file_url, created_at, sub_type")
    .eq("project_id", projectId)
    .eq("typ", "photos")
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (subType) query = query.eq("sub_type", subType);
  const { data: docs, error: docsErr } = await query;
  if (docsErr) return jsonError(500, `Documents-Query: ${docsErr.message}`);
  if (!docs || docs.length === 0) {
    return jsonError(404, subType
      ? `Keine Fotos im Ordner "${subType}"`
      : "Keine Fotos in diesem Projekt");
  }

  // file_url kann entweder ein voller Public-URL sein (Legacy) oder ein
  // reiner Storage-Pfad. Wir extrahieren den Storage-Pfad fuer den
  // Server-internen Download.
  const files = docs
    .map((d) => {
      const storagePath = toStoragePath(d.file_url as string | null, projectId, d.name as string);
      if (!storagePath) return null;
      return {
        name: d.name as string,
        storagePath,
        created_at: (d.created_at as string) || new Date().toISOString(),
      };
    })
    .filter((x): x is { name: string; storagePath: string; created_at: string } => !!x);

  if (files.length === 0) return jsonError(404, "Keine Foto-Pfade auflösbar");

  // ZIP-Dateiname.
  const date = new Date().toISOString().slice(0, 10);
  const safeProject = safeNameFor(project.name as string) || "projekt";
  const suffix = subType ? `_${safeNameFor(subType)}` : "";
  const zipName = `${safeProject}_fotos${suffix}_${date}.zip`;

  // ZIP-Stream bauen — client-zip akzeptiert async iterables und gibt
  // sofort eine Response zurueck, deren Body live gestreamt wird.
  const zipResponse = downloadZip(concurrentBlobFetcher(files));

  return new Response(zipResponse.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "no-store",
    },
  });
});

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Wandelt einen Documents-file_url-Eintrag in den Storage-Pfad innerhalb
// des project-photos Buckets um. Akzeptiert:
//   - voller Public-URL (".../storage/v1/object/public/project-photos/<projectId>/<file>")
//   - bereits ein reiner Pfad ("<projectId>/<file>")
//   - leer/null → Fallback auf "<projectId>/<documents.name>"
function toStoragePath(
  fileUrl: string | null,
  projectId: string,
  docName: string,
): string | null {
  if (fileUrl) {
    // Public-URL Pattern: .../object/public/project-photos/<rest>
    const m = fileUrl.match(/object\/public\/project-photos\/(.+)$/);
    if (m) return decodeURIComponent(m[1]);
    // Signed-URL Pattern (selten bei photos, aber sicher ist sicher)
    const m2 = fileUrl.match(/object\/sign\/project-photos\/([^?]+)/);
    if (m2) return decodeURIComponent(m2[1]);
    // Schon ein Pfad?
    if (!fileUrl.startsWith("http")) return fileUrl;
  }
  // Letzter Versuch: Konvention "<projectId>/<dateiname>"
  if (docName) return `${projectId}/${docName}`;
  return null;
}
