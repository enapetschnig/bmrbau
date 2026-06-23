// One-Click Foto-ZIP-Download mit drei Pfaden:
//   1. SW-Streaming (Desktop) — beliebige Groesse, Browser-native Download
//   2. Blob-Fallback (Mac Safari, Firefox) — bis ~600 MB, "Save"-Button
//   3. iOS: IMMER Blob, vorab Groessen-Guard - sonst silent OOM-Crash
//
// Bei SW-Fail (z.B. veraltete SW, Timeout) faellt automatisch auf Blob.

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  streamingZipDownload,
  isStreamingSupported,
  isIosLike,
  StreamingUnavailableError,
  type StreamZipFile,
  type StreamZipProgress,
} from "@/lib/streamingZipDownload";
import {
  buildZipDownload,
  triggerBlobDownload,
  isLikelyiOS,
  type ZipFile,
} from "@/lib/zipDownloader";
import { useToast } from "@/hooks/use-toast";

export type ServerZipParams = {
  projectId: string;
  projectName: string;
  subType?: string | null;
};

// Hard-Limits fuer den Blob-Fallback. iOS Safari blob limit liegt
// realistisch unter 200 MB. Mac Safari/FF kann mehrere GB, aber wir wollen
// nicht riskieren dass ein 1.5 GB Blob den Tab killt.
const BLOB_LIMIT_IOS_MB = 150;
const BLOB_LIMIT_DESKTOP_MB = 800;

const asciiize = (s: string): string =>
  s
    .replace(/ä/g, "ae").replace(/Ä/g, "Ae")
    .replace(/ö/g, "oe").replace(/Ö/g, "Oe")
    .replace(/ü/g, "ue").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[/\\:*?"<>|]+/g, "_")
    .slice(0, 200);

// Schaetzt die Gesamt-Groesse via HEAD-Requests (parallel, mit Concurrency-
// Limit). Wenn ein Foto keine Content-Length liefert, zaehlen wir 5 MB als
// Pessimismus. Frueh-Abbruch wenn Limit ueberschritten.
async function estimateTotalBytes(
  files: StreamZipFile[],
  signal: AbortSignal,
  hardLimitBytes: number,
): Promise<{ totalBytes: number; over: boolean }> {
  const CONCURRENCY = 8;
  let totalBytes = 0;
  let over = false;
  for (let i = 0; i < files.length && !over; i += CONCURRENCY) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    const batch = files.slice(i, i + CONCURRENCY);
    const sizes = await Promise.all(
      batch.map(async (f) => {
        try {
          const r = await fetch(f.url, { method: "HEAD", cache: "no-store", signal });
          const cl = r.headers.get("content-length");
          return cl ? parseInt(cl) : 5 * 1024 * 1024;
        } catch {
          return 5 * 1024 * 1024;
        }
      }),
    );
    for (const s of sizes) {
      totalBytes += s;
      if (totalBytes > hardLimitBytes) {
        over = true;
        break;
      }
    }
  }
  return { totalBytes, over };
}

export function useZipDownload() {
  const { toast } = useToast();
  const [zipProgress, setZipProgress] = useState<StreamZipProgress | null>(null);
  const [zipReady, setZipReady] = useState<{ blobUrl: string; filename: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const dismissReady = useCallback(() => {
    setZipReady((prev) => {
      if (prev) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  }, []);

  const saveReady = useCallback(() => {
    setZipReady((prev) => {
      if (!prev) return null;
      triggerBlobDownload(prev.blobUrl, prev.filename);
      toast({ title: "Download gestartet", description: prev.filename });
      return null;
    });
  }, [toast]);

  const startServerZip = useCallback(async (params: ServerZipParams) => {
    setZipProgress({
      filesDone: 0,
      filesTotal: 0,
      bytesWritten: 0,
      currentFile: "Lade Foto-Liste…",
      phase: "fetching",
    });

    // 1) Foto-Liste aus DB holen
    let query = supabase
      .from("documents")
      .select("name, file_url, created_at")
      .eq("project_id", params.projectId)
      .eq("typ", "photos")
      .eq("archived", false)
      .order("created_at", { ascending: false });
    if (params.subType) query = query.eq("sub_type", params.subType);

    const { data, error } = await query;
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      setZipProgress(null);
      return;
    }
    if (!data || data.length === 0) {
      toast({ variant: "destructive", title: "Keine Fotos in diesem Projekt" });
      setZipProgress(null);
      return;
    }

    // 2) URL-Liste aus dem public bucket
    const files: StreamZipFile[] = data.map((d) => {
      const fu = d.file_url as string | null;
      let url: string;
      if (fu && fu.startsWith("http")) {
        url = fu;
      } else {
        const storagePath = fu || `${params.projectId}/${d.name}`;
        const { data: urlData } = supabase.storage
          .from("project-photos")
          .getPublicUrl(storagePath);
        url = urlData.publicUrl;
      }
      return {
        name: d.name as string,
        url,
        lastModified: d.created_at ? new Date(d.created_at as string) : undefined,
      };
    });

    // 3) ZIP-Name + Pfad waehlen
    const controller = new AbortController();
    abortRef.current = controller;
    const stamp = new Date().toISOString().slice(0, 10);
    const safeProject = asciiize(params.projectName) || "projekt";
    const suffix = params.subType ? `_${asciiize(params.subType)}` : "";
    const zipName = `${safeProject}_fotos${suffix}_${stamp}.zip`;

    // 4) Pfad-Wahl
    const ios = isIosLike();
    const swReady = !ios && (await isStreamingSupported());

    // Helper-Funktion: Blob-Fallback mit Groessen-Vorpruefung
    const runBlobFallback = async () => {
      const limitMb = ios ? BLOB_LIMIT_IOS_MB : BLOB_LIMIT_DESKTOP_MB;
      setZipProgress({
        filesDone: 0,
        filesTotal: files.length,
        bytesWritten: 0,
        currentFile: "Pruefe Gesamtgroesse…",
        phase: "fetching",
      });
      const { totalBytes, over } = await estimateTotalBytes(
        files,
        controller.signal,
        limitMb * 1024 * 1024,
      );
      if (over) {
        toast({
          variant: "destructive",
          title: "Projekt zu groß für diesen Browser",
          description: ios
            ? `Geschätzt > ${limitMb} MB. iOS Safari kann nicht so große ZIPs bauen — bitte vom Computer/Mac herunterladen.`
            : `Geschätzt > ${limitMb} MB. Bitte einzelne Ordner herunterladen oder den Browser-Tab schließen und neu öffnen, dann mit Service-Worker-Streaming probieren.`,
        });
        return;
      }
      const blobFiles: ZipFile[] = files.map((f) => ({ name: f.name, url: f.url }));
      const result = await buildZipDownload(blobFiles, zipName, {
        signal: controller.signal,
        onProgress: (p) => setZipProgress({
          filesDone: p.filesDone,
          filesTotal: p.filesTotal,
          bytesWritten: 0, // bewusst 0 — wir tracken keinen Byte-Fortschritt im Blob-Pfad
          currentFile: p.currentFile,
          phase: p.phase,
        }),
      });
      if (result.mode === "saved") {
        toast({ title: "ZIP gespeichert", description: zipName });
      } else {
        setZipReady({ blobUrl: result.blobUrl, filename: result.filename });
      }
    };

    try {
      if (swReady) {
        try {
          await streamingZipDownload(files, zipName, {
            signal: controller.signal,
            onProgress: setZipProgress,
          });
          toast({ title: "Download abgeschlossen", description: zipName });
        } catch (err) {
          // SW-Pfad ist gescheitert — automatisch auf Blob umschalten,
          // anstatt den User mit einem technischen Fehler abzuwerfen.
          if (err instanceof StreamingUnavailableError) {
            await runBlobFallback();
          } else {
            throw err;
          }
        }
      } else {
        await runBlobFallback();
      }
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e?.name === "AbortError") {
        toast({ title: "Download abgebrochen" });
      } else {
        toast({
          variant: "destructive",
          title: "Download fehlgeschlagen",
          description: e?.message || "Unbekannter Fehler",
        });
      }
    } finally {
      abortRef.current = null;
      setZipProgress(null);
    }
  }, [toast]);

  return {
    startServerZip,
    zipProgress,
    zipReady,
    cancel,
    dismissReady,
    saveReady,
    isLikelyiOS,
  };
}
