// Beliebig grosser Foto-ZIP-Download per Service-Worker-Stream-Proxy.
//
// Pattern:
//   1. Client registriert einen Download mit unique-ID beim SW (postMessage)
//   2. Client erzeugt ein hidden <iframe> mit /__stream_download/<id>
//   3. SW antwortet auf diesen Fetch mit ReadableStream der Bytes vom Client
//      via MessagePort empfaengt → Browser triggert nativen Download und
//      schreibt Bytes DIREKT aufs Filesystem (kein Blob im RAM)
//   4. Client pumpt ZIP-Bytes (client-zip Output) Chunk fuer Chunk durch
//      die Pipe; "end"-Marker schliesst den Stream
//
// Wenn SW NICHT verfuegbar/unterstuetzt: Fallback auf den bestehenden
// buildZipDownload-Pfad (Blob im RAM, fuer iOS Safari ohne SW limitiert).

import { downloadZip } from "client-zip";

const SW_DOWNLOAD_PREFIX = "/__stream_download/";

export type StreamZipFile = {
  name: string;
  url: string;
  lastModified?: Date;
};

export type StreamZipProgress = {
  filesDone: number;
  filesTotal: number;
  bytesWritten: number;
  currentFile: string;
  phase: "fetching" | "finalizing";
};

export type StreamZipOptions = {
  signal?: AbortSignal;
  onProgress?: (p: StreamZipProgress) => void;
};

export type StreamZipResult =
  | { mode: "streamed" }
  | { mode: "blob-ready"; blobUrl: string; filename: string };

const asciiize = (s: string): string =>
  s
    .replace(/ä/g, "ae").replace(/Ä/g, "Ae")
    .replace(/ö/g, "oe").replace(/Ö/g, "Oe")
    .replace(/ü/g, "ue").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^\x20-\x7E]/g, "_");

const sanitizeFilename = (name: string): string => {
  const cleaned = asciiize(name || "datei")
    .replace(/[/\\:*?"<>|]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 200);
  return cleaned || "datei";
};

const dedupeNames = (files: StreamZipFile[]): StreamZipFile[] => {
  const seen = new Map<string, number>();
  return files.map((f) => {
    const cleaned = sanitizeFilename(f.name);
    const count = seen.get(cleaned) || 0;
    seen.set(cleaned, count + 1);
    if (count === 0) return { ...f, name: cleaned };
    const dot = cleaned.lastIndexOf(".");
    const base = dot > 0 ? cleaned.slice(0, dot) : cleaned;
    const ext = dot > 0 ? cleaned.slice(dot) : "";
    return { ...f, name: `${base}_${count}${ext}` };
  });
};

export const isStreamingSupported = async (): Promise<boolean> => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!(reg && reg.active);
  } catch {
    return false;
  }
};

/**
 * Beliebig grosser ZIP-Download via Service-Worker-Stream-Proxy.
 * Schreibt Bytes direkt aufs Filesystem ohne RAM-Peak.
 *
 * Falls SW nicht verfuegbar → wirft StreamingUnavailableError, der
 * Aufrufer soll dann buildZipDownload als Fallback nutzen.
 */
export class StreamingUnavailableError extends Error {
  constructor() {
    super("Service Worker nicht verfuegbar fuer Streaming-Download");
    this.name = "StreamingUnavailableError";
  }
}

export async function streamingZipDownload(
  files: StreamZipFile[],
  zipName: string,
  opts: StreamZipOptions = {},
): Promise<StreamZipResult> {
  if (files.length === 0) throw new Error("Keine Dateien zum Herunterladen");

  if (!("serviceWorker" in navigator)) throw new StreamingUnavailableError();
  const reg = await navigator.serviceWorker.ready;
  if (!reg.active) throw new StreamingUnavailableError();

  const safeFiles = dedupeNames(files);
  const safeZipName = sanitizeFilename(zipName);
  const total = safeFiles.length;
  const { signal, onProgress } = opts;

  // 1) SW eine Download-ID registrieren via MessageChannel
  const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const channel = new MessageChannel();

  // Warten, bis der SW "ready" zurueckmeldet (verhindert Race-Condition
  // bei sehr schnellem iframe-Trigger)
  const readyPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("SW antwortet nicht")), 5000);
    channel.port2.addEventListener("message", function onReady(e) {
      if (e.data === "ready") {
        clearTimeout(timeout);
        channel.port2.removeEventListener("message", onReady);
        resolve();
      }
    });
    channel.port2.start();
  });

  reg.active.postMessage(
    {
      type: "stream-download:register",
      id,
      filename: safeZipName,
      mimeType: "application/zip",
    },
    [channel.port1],
  );

  await readyPromise;

  // 2) Iframe triggert nativen Browser-Download. Hidden iframe statt
  //    window.location, damit die Hauptseite nicht navigiert.
  const iframe = document.createElement("iframe");
  iframe.hidden = true;
  iframe.style.display = "none";
  iframe.src = `${SW_DOWNLOAD_PREFIX}${id}`;
  document.body.appendChild(iframe);
  // Iframe nach grosszuegiger Zeit entfernen
  setTimeout(() => { try { iframe.remove(); } catch { /* noop */ } }, 600_000);

  // 3) ZIP-Bytes via client-zip generieren und durch die Pipe pumpen
  let filesDone = 0;
  let bytesWritten = 0;

  async function* yieldFiles() {
    for (const f of safeFiles) {
      if (signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
      onProgress?.({
        filesDone,
        filesTotal: total,
        bytesWritten,
        currentFile: f.name,
        phase: "fetching",
      });
      const resp = await fetch(f.url, {
        cache: "no-store",
        credentials: "omit",
        signal,
      });
      if (!resp.ok) throw new Error(`${f.name}: HTTP ${resp.status}`);
      filesDone += 1;
      yield {
        name: f.name,
        input: resp,
        lastModified: f.lastModified || new Date(),
      };
    }
  }

  const zipResp = downloadZip(yieldFiles());
  if (!zipResp.body) throw new Error("client-zip hat keinen Body geliefert");

  const reader = zipResp.body.getReader();
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
      const { value, done } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        bytesWritten += value.byteLength;
        // Transferable: zero-copy zum SW
        // Vorsicht: nach postMessage ist `value` im Sender unbrauchbar
        channel.port2.postMessage(value, [value.buffer]);
        onProgress?.({
          filesDone,
          filesTotal: total,
          bytesWritten,
          currentFile: "",
          phase: filesDone >= total ? "finalizing" : "fetching",
        });
      }
    }
    channel.port2.postMessage("end");
    onProgress?.({
      filesDone: total,
      filesTotal: total,
      bytesWritten,
      currentFile: "",
      phase: "finalizing",
    });
    return { mode: "streamed" };
  } catch (err) {
    try { channel.port2.postMessage("abort"); } catch { /* noop */ }
    try { reader.cancel(); } catch { /* noop */ }
    throw err;
  } finally {
    try { channel.port2.close(); } catch { /* noop */ }
  }
}
