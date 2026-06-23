// Server-seitige Foto-ZIP-Generierung.
//
// Pipeline:
//   1. Query: alle nicht-archivierten Fotos eines Projekts (oder Ordners)
//   2. Subset auf [offset .. offset+limit) reduzieren (Default: alles)
//   3. Parallele Storage-Downloads
//   4. JSZip-Build vollstaendig im Memory → einzelne Response mit
//      Content-Length. Kein Streaming (Supabase Edge schneidet grosse
//      Streams ab — ein truncatedZIP ist unbrauchbar). Kein Data
//      Descriptor (macOS Archive Utility schluckt das).
//
// Query-Parameter:
//   projectId  (required)
//   subType    optional, beschraenkt auf einen Foto-Ordner
//   meta=1     gibt nur Metadaten zurueck (JSON), kein ZIP
//   offset=N   Foto-Offset, default 0
//   limit=M    max Anzahl Fotos im Paket, default 25 (≈ 150-200 MB)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers":
    "X-Total-Files, X-Batch-From, X-Batch-To, X-Next-Offset",
};

const BUCKET = "project-photos";
const CONCURRENCY = 4;
// Experimentell ermittelt: Edge Function OOM ueber ~75-80 MB Batch-Input.
// 8 Fotos × ~9 MB ≈ 72 MB ist die sichere Obergrenze. Hoehere Werte gehen
// gelegentlich aber crashen mit WORKER_RESOURCE_LIMIT bei groesseren Fotos.
const DEFAULT_BATCH_LIMIT = 8;
const MAX_BATCH_BYTES = 90 * 1024 * 1024;

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

interface FileEntry {
  name: string;
  storagePath: string;
  created_at: string;
}

interface NamedFile extends FileEntry {
  outName: string;
}

function dedupeNames(files: FileEntry[]): NamedFile[] {
  const seen = new Map<string, number>();
  return files.map((f) => {
    const base = safeNameFor(f.name);
    const c = seen.get(base) || 0;
    seen.set(base, c + 1);
    if (c === 0) return { ...f, outName: base };
    const dot = base.lastIndexOf(".");
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : "";
    return { ...f, outName: `${stem}_${c}${ext}` };
  });
}

async function downloadAllInBatches(
  files: NamedFile[],
): Promise<{ outName: string; blob: Blob; modDate: Date }[]> {
  const out: { outName: string; blob: Blob; modDate: Date }[] = [];
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    const downloaded = await Promise.all(
      batch.map(async (f) => {
        const { data, error } = await supabaseAdmin.storage
          .from(BUCKET)
          .download(f.storagePath);
        if (error || !data) {
          throw new Error(`Foto ${f.outName}: ${error?.message || "leer"}`);
        }
        return {
          outName: f.outName,
          blob: data,
          modDate: new Date(f.created_at),
        };
      }),
    );
    out.push(...downloaded);
  }
  return out;
}

interface RequestBody {
  projectId?: string;
  subType?: string | null;
  offset?: number;
  limit?: number;
  meta?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let projectId = "";
  let subType: string | null = null;
  let offset = 0;
  let limit = DEFAULT_BATCH_LIMIT;
  let metaOnly = false;

  if (req.method === "GET") {
    const u = new URL(req.url);
    projectId = (u.searchParams.get("projectId") || "").trim();
    const s = u.searchParams.get("subType");
    subType = s && s.length > 0 ? s : null;
    offset = Math.max(0, parseInt(u.searchParams.get("offset") || "0") || 0);
    limit = Math.max(1, Math.min(200,
      parseInt(u.searchParams.get("limit") || String(DEFAULT_BATCH_LIMIT)) || DEFAULT_BATCH_LIMIT));
    metaOnly = u.searchParams.get("meta") === "1";
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
    offset = Math.max(0, body.offset || 0);
    limit = Math.max(1, Math.min(200, body.limit || DEFAULT_BATCH_LIMIT));
    metaOnly = !!body.meta;
  } else {
    return jsonError(405, "Methode nicht erlaubt");
  }

  if (!projectId) return jsonError(400, "projectId fehlt");

  const { data: project, error: projErr } = await supabaseAdmin
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  if (projErr) return jsonError(500, `Projekt-Lookup: ${projErr.message}`);
  if (!project) return jsonError(404, "Projekt nicht gefunden");

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

  const allFiles: FileEntry[] = docs
    .map((d) => {
      const storagePath = toStoragePath(
        d.file_url as string | null,
        projectId,
        d.name as string,
      );
      if (!storagePath) return null;
      return {
        name: d.name as string,
        storagePath,
        created_at: (d.created_at as string) || new Date().toISOString(),
      };
    })
    .filter((x): x is FileEntry => !!x);

  if (allFiles.length === 0) return jsonError(404, "Keine Foto-Pfade auflösbar");

  // Meta-Only: nur Anzahl der Fotos zurueck, damit Frontend Batches planen kann.
  if (metaOnly) {
    return new Response(
      JSON.stringify({
        totalFiles: allFiles.length,
        defaultBatchLimit: DEFAULT_BATCH_LIMIT,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Batch-Subset.
  if (offset >= allFiles.length) {
    return jsonError(400, `offset ${offset} >= total ${allFiles.length}`);
  }
  const batchEnd = Math.min(offset + limit, allFiles.length);
  const subset = allFiles.slice(offset, batchEnd);
  const deduped = dedupeNames(subset);

  let downloads: { outName: string; blob: Blob; modDate: Date }[];
  try {
    downloads = await downloadAllInBatches(deduped);
  } catch (err) {
    const e = err as { message?: string };
    return jsonError(502, `Storage-Download: ${e?.message || "Fehler"}`);
  }

  // Falls trotz Limit ueber MAX_BATCH_BYTES: defensive fail (sollte selten
  // sein bei Default-Limit 25, kann bei sehr grossen Fotos passieren).
  const totalBytes = downloads.reduce((sum, d) => sum + d.blob.size, 0);
  if (totalBytes > MAX_BATCH_BYTES) {
    const mb = Math.round(totalBytes / 1024 / 1024);
    return jsonError(413,
      `Paket-Groesse ${mb} MB überschreitet Limit. Bitte mit kleinerem limit (≤ ${Math.max(5, Math.floor(limit / 2))}) anfordern.`,
    );
  }

  const zip = new JSZip();
  for (const d of downloads) {
    zip.file(d.outName, d.blob, { date: d.modDate, binary: true });
  }
  const zipBytes = await zip.generateAsync({
    type: "uint8array",
    compression: "STORE",
  });

  const date = new Date().toISOString().slice(0, 10);
  const safeProject = safeNameFor(project.name as string) || "projekt";
  const suffix = subType ? `_${safeNameFor(subType)}` : "";
  const totalBatches = Math.ceil(allFiles.length / limit);
  const batchIdx = Math.floor(offset / limit) + 1;
  // Im Dateinamen "_teil-2-von-5" wenn aufgeteilt, sonst ohne.
  const batchTag = totalBatches > 1 ? `_teil-${batchIdx}-von-${totalBatches}` : "";
  const zipName = `${safeProject}_fotos${suffix}${batchTag}_${date}.zip`;

  const hasMore = batchEnd < allFiles.length;
  const nextOffset = hasMore ? batchEnd : -1;

  return new Response(zipBytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/zip",
      "Content-Length": String(zipBytes.byteLength),
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "no-store",
      "X-Total-Files": String(allFiles.length),
      "X-Batch-From": String(offset),
      "X-Batch-To": String(batchEnd),
      "X-Next-Offset": String(nextOffset),
    },
  });
});

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toStoragePath(
  fileUrl: string | null,
  projectId: string,
  docName: string,
): string | null {
  if (fileUrl) {
    const m = fileUrl.match(/object\/public\/project-photos\/(.+)$/);
    if (m) return decodeURIComponent(m[1]);
    const m2 = fileUrl.match(/object\/sign\/project-photos\/([^?]+)/);
    if (m2) return decodeURIComponent(m2[1]);
    if (!fileUrl.startsWith("http")) return fileUrl;
  }
  if (docName) return `${projectId}/${docName}`;
  return null;
}
