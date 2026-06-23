// One-Click Foto-ZIP-Download. Streaming via Service Worker (beliebig
// grosse Projekte) mit Blob-Fallback (falls SW nicht verfuegbar).

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  streamingZipDownload,
  isStreamingSupported,
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

const asciiize = (s: string): string =>
  s
    .replace(/ä/g, "ae").replace(/Ä/g, "Ae")
    .replace(/ö/g, "oe").replace(/Ö/g, "Oe")
    .replace(/ü/g, "ue").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[/\\:*?"<>|]+/g, "_")
    .slice(0, 200);

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

    // 4) Streaming-Pfad bevorzugen — kein RAM-Limit, beliebige Groessen
    const swReady = await isStreamingSupported();

    try {
      if (swReady) {
        await streamingZipDownload(files, zipName, {
          signal: controller.signal,
          onProgress: setZipProgress,
        });
        toast({ title: "Download abgeschlossen", description: zipName });
      } else {
        // 5) Fallback: client-side ZIP als Blob (existing path)
        // Mapped auf den ZipFile-Typ den buildZipDownload erwartet
        const blobFiles: ZipFile[] = files.map((f) => ({ name: f.name, url: f.url }));
        const result = await buildZipDownload(blobFiles, zipName, {
          signal: controller.signal,
          onProgress: (p) => setZipProgress({
            filesDone: p.filesDone,
            filesTotal: p.filesTotal,
            bytesWritten: 0,
            currentFile: p.currentFile,
            phase: p.phase,
          }),
        });
        if (result.mode === "saved") {
          toast({ title: "ZIP gespeichert", description: zipName });
        } else {
          setZipReady({ blobUrl: result.blobUrl, filename: result.filename });
        }
      }
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e?.name === "AbortError") {
        toast({ title: "Download abgebrochen" });
      } else if (e instanceof StreamingUnavailableError) {
        toast({
          variant: "destructive",
          title: "Streaming nicht verfügbar",
          description: "Bitte Seite neu laden — der Service Worker wird initialisiert.",
        });
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
