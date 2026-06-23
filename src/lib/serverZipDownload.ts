// Frontend-Aufruf der Edge Function `download-project-photos-zip`. Der
// Server baut das ZIP — wir streamen es nur noch durch zum Filesystem
// (Chromium) oder als Blob (Safari/iOS).

import { supabase } from "@/integrations/supabase/client";
import {
  triggerBlobDownload,
  isLikelyiOS,
  supportsFilesystemSave,
  type ZipProgress,
  type ZipResult,
} from "@/lib/zipDownloader";

export type ServerZipOptions = {
  projectId: string;
  projectName: string;
  subType?: string | null;
  onProgress?: (p: ZipProgress) => void;
  signal?: AbortSignal;
};

const FUNCTION_NAME = "download-project-photos-zip";

const sanitize = (s: string): string =>
  s
    .replace(/ä/g, "ae").replace(/Ä/g, "Ae")
    .replace(/ö/g, "oe").replace(/Ö/g, "Oe")
    .replace(/ü/g, "ue").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[/\\:*?"<>|]+/g, "_")
    .slice(0, 200);

const buildZipName = (projectName: string, subType?: string | null): string => {
  const date = new Date().toISOString().slice(0, 10);
  const project = sanitize(projectName) || "projekt";
  const suffix = subType ? `_${sanitize(subType)}` : "";
  return `${project}_fotos${suffix}_${date}.zip`;
};

async function callEdgeFunction(
  projectId: string,
  subType: string | null,
  signal?: AbortSignal,
): Promise<Response> {
  const url = `${(supabase as unknown as { supabaseUrl: string }).supabaseUrl}/functions/v1/${FUNCTION_NAME}`;
  const { data: { session } } = await supabase.auth.getSession();
  const apikey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey,
    Authorization: `Bearer ${session?.access_token ?? apikey}`,
  };
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ projectId, subType }),
    signal,
  });
  return resp;
}

export async function downloadProjectPhotosFromServer(
  opts: ServerZipOptions,
): Promise<ZipResult> {
  const { projectId, projectName, subType = null, onProgress, signal } = opts;
  onProgress?.({ filesDone: 0, filesTotal: 0, currentFile: "Server bereitet Paket vor…", phase: "fetching" });

  const resp = await callEdgeFunction(projectId, subType, signal);

  if (!resp.ok) {
    // Edge Function gibt strukturierte JSON-Fehler zurueck.
    let detail = `HTTP ${resp.status}`;
    try {
      const j = await resp.json();
      if (j?.error) detail = j.error;
    } catch {/* ignore */}
    throw new Error(detail);
  }

  const zipName = buildZipName(projectName, subType);

  // Chromium Desktop → direkt aufs Filesystem streamen.
  if (supportsFilesystemSave() && resp.body) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (o: unknown) => Promise<{
          createWritable: () => Promise<WritableStream<Uint8Array>>;
        }>;
      }).showSaveFilePicker({
        suggestedName: zipName,
        types: [{ description: "ZIP-Archiv", accept: { "application/zip": [".zip"] } }],
      });
      const writable = await handle.createWritable();
      try {
        await resp.body.pipeTo(writable, { signal });
        onProgress?.({ filesDone: 1, filesTotal: 1, currentFile: "", phase: "finalizing" });
        return { mode: "saved" };
      } catch (pipeErr) {
        try { await writable.abort(); } catch { /* noop */ }
        throw pipeErr;
      }
    } catch (err) {
      const e = err as { name?: string };
      if (e?.name === "AbortError") throw err;
      // Fallback auf Blob unten.
    }
  }

  // Blob-Pfad (Safari/FF/iOS): User triggert Save-Click aus Dialog.
  // Wir verzichten bewusst auf Byte-Progress, weil Content-Length oft fehlt
  // bei gestreamten ZIPs — Phase "finalizing" reicht.
  const blob = await resp.blob();
  onProgress?.({ filesDone: 1, filesTotal: 1, currentFile: "", phase: "finalizing" });
  const blobUrl = URL.createObjectURL(blob);
  return { mode: "blob-ready", blobUrl, filename: zipName };
}

// Re-exporte fuer Aufrufer.
export { triggerBlobDownload, isLikelyiOS };
export type { ZipProgress, ZipResult };
