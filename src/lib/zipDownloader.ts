// Foto-/Datei-ZIP-Download, mobil-tauglich.
//
// Strategie:
//   1) Chromium Desktop mit File System Access API → Stream direkt auf Platte.
//      Der showSaveFilePicker()-Call IST der User-Gesture, danach ist
//      Streamen ohne weitere Gesten erlaubt.
//   2) Alle anderen (Safari, FF, iOS) → ZIP wird zum Blob geladen, dann
//      gibt buildZipDownload einen Blob-URL zurueck. Der AUFRUFER triggert
//      den Anchor-Click aus einem FRISCHEN User-Gesture (z.B. einem
//      "Speichern"-Button im Progress-Dialog). Programmatischer click()
//      nach langem await wird sonst auf iOS Safari stumm ignoriert.

import { downloadZip } from "client-zip";

export type ZipFile = { name: string; url: string };

export type ZipProgress = {
  filesDone: number;
  filesTotal: number;
  currentFile: string;
  phase: "fetching" | "finalizing";
};

export type ZipOptions = {
  onProgress?: (p: ZipProgress) => void;
  signal?: AbortSignal;
  /** Standard true. False = nie File-System-API verwenden (Fallback erzwingen). */
  preferFilesystem?: boolean;
};

export type ZipResult =
  | { mode: "saved" }
  | { mode: "blob-ready"; blobUrl: string; filename: string };

// ASCII-Map fuer typische deutsche Sonderzeichen — Safari interpretiert
// das download-Attribut nicht zuverlaessig als UTF-8.
const asciiize = (s: string): string =>
  s
    .replace(/ä/g, "ae").replace(/Ä/g, "Ae")
    .replace(/ö/g, "oe").replace(/Ö/g, "Oe")
    .replace(/ü/g, "ue").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^\x20-\x7E]/g, "_");

const sanitizeName = (name: string): string => {
  const cleaned = asciiize(name || "datei")
    .replace(/[/\\:*?"<>|]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 200);
  return cleaned || "datei";
};

// Doppelte Dateinamen aufloesen (foto.jpg, foto_1.jpg, foto_2.jpg …)
const dedupeNames = (files: ZipFile[]): ZipFile[] => {
  const seen = new Map<string, number>();
  return files.map((f) => {
    const cleaned = sanitizeName(f.name);
    const count = seen.get(cleaned) || 0;
    seen.set(cleaned, count + 1);
    if (count === 0) return { ...f, name: cleaned };
    const dot = cleaned.lastIndexOf(".");
    const base = dot > 0 ? cleaned.slice(0, dot) : cleaned;
    const ext = dot > 0 ? cleaned.slice(dot) : "";
    return { ...f, name: `${base}_${count}${ext}` };
  });
};

export const isLikelyiOS = (): boolean =>
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !((window as unknown as { MSStream?: unknown }).MSStream);

export const supportsFilesystemSave = (): boolean =>
  typeof window !== "undefined" && "showSaveFilePicker" in window;

/**
 * Triggert ein `<a download>`-Click synchron. Muss aus einem User-Gesture
 * (z.B. Button-onClick) gerufen werden, damit Safari den Download akzeptiert.
 * Revoke des Blob-URL erfolgt verzoegert — sonst kann der Browser den
 * Download bei langsamer Verbindung verlieren.
 */
export const triggerBlobDownload = (
  blobUrl: string,
  filename: string,
  revokeAfterMs = 600_000,
): void => {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = asciiize(filename);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), revokeAfterMs);
};

export async function buildZipDownload(
  files: ZipFile[],
  zipName: string,
  opts: ZipOptions = {},
): Promise<ZipResult> {
  if (files.length === 0) throw new Error("Keine Dateien zum Herunterladen");
  const safeFiles = dedupeNames(files);
  const safeZipName = sanitizeName(zipName);
  const total = safeFiles.length;
  const { signal, onProgress } = opts;
  let done = 0;

  // Sequentielle Fetch-Pipeline — der ZIP-Stream konsumiert pro File einmal.
  // Parallel pre-fetchen wuerde nur RAM kosten (Vorteil = null).
  async function* yieldFiles() {
    for (const f of safeFiles) {
      if (signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
      onProgress?.({
        filesDone: done,
        filesTotal: total,
        currentFile: f.name,
        phase: "fetching",
      });
      const resp = await fetch(f.url, {
        cache: "no-store",
        credentials: "omit",
        signal,
      });
      if (!resp.ok) throw new Error(`${f.name}: HTTP ${resp.status}`);
      done += 1;
      yield { name: f.name, input: resp, lastModified: new Date() };
    }
  }

  const zipResponse = downloadZip(yieldFiles());

  // 1) File System Access API → streamt direkt auf Platte (Chromium Desktop)
  if (supportsFilesystemSave() && opts.preferFilesystem !== false) {
    let writable: WritableStream<Uint8Array> | null = null;
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (o: unknown) => Promise<{
          createWritable: () => Promise<WritableStream<Uint8Array>>;
        }>;
      }).showSaveFilePicker({
        suggestedName: safeZipName,
        types: [
          { description: "ZIP-Archiv", accept: { "application/zip": [".zip"] } },
        ],
      });
      writable = await handle.createWritable();
      if (!zipResponse.body) throw new Error("Kein Body im ZIP-Response");
      try {
        await zipResponse.body.pipeTo(writable, { signal });
        onProgress?.({
          filesDone: total,
          filesTotal: total,
          currentFile: "",
          phase: "finalizing",
        });
        return { mode: "saved" };
      } catch (pipeErr) {
        // Schliesst den Writable explizit, damit File-Handle nicht haengen
        // bleibt. .abort() ist tolerant gegenueber bereits geschlossen.
        try { await writable.abort(); } catch { /* noop */ }
        throw pipeErr;
      }
    } catch (err) {
      const e = err as { name?: string };
      // User hat im "Speichern unter"-Dialog Abbruch geklickt
      if (e?.name === "AbortError") throw err;
      // sonst: Fallback auf Blob unten versuchen
    }
  }

  // 2) Blob-Pfad: ZIP komplett laden, Caller triggert Download via Button-
  // Click aus frischem User-Gesture (Safari/iOS-safe).
  const blob = await zipResponse.blob();
  onProgress?.({
    filesDone: total,
    filesTotal: total,
    currentFile: "",
    phase: "finalizing",
  });
  const blobUrl = URL.createObjectURL(blob);
  return { mode: "blob-ready", blobUrl, filename: safeZipName };
}
