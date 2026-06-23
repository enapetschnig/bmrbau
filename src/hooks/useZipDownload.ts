// Gemeinsamer State + Dialog fuer ZIP-Downloads (Server-Variante).
//
// Beide Aufrufer (Projekt-Detail Foto-Tab, Projekte-Uebersicht Auswahl)
// nutzen dieselbe Pipeline:
//   1. start(...) -> Server baut ZIP, Progress laeuft
//   2. Bei Chromium-FSA-Pfad: gleich gespeichert, Dialog macht sich zu
//   3. Sonst: dialog zeigt "ZIP speichern"-Button → User-Click triggert
//      den Anchor-Download synchron aus frischem Gesture (iOS-safe)

import { useCallback, useRef, useState } from "react";
import {
  downloadProjectPhotosFromServer,
  isLikelyiOS,
  triggerBlobDownload,
  type ZipProgress,
} from "@/lib/serverZipDownload";
import { useToast } from "@/hooks/use-toast";

export type StartServerZipParams = {
  projectId: string;
  projectName: string;
  subType?: string | null;
};

export function useZipDownload() {
  const { toast } = useToast();
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);
  const [zipReady, setZipReady] = useState<{ blobUrl: string; filename: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const dismiss = useCallback(() => {
    setZipReady((prev) => {
      if (prev) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  }, []);

  const save = useCallback(() => {
    setZipReady((prev) => {
      if (!prev) return null;
      triggerBlobDownload(prev.blobUrl, prev.filename);
      toast({ title: "Download gestartet", description: prev.filename });
      return null;
    });
  }, [toast]);

  const startServerZip = useCallback(async (params: StartServerZipParams) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setZipProgress({
      filesDone: 0,
      filesTotal: 0,
      currentFile: "Server bereitet Paket vor…",
      phase: "fetching",
    });
    try {
      const result = await downloadProjectPhotosFromServer({
        projectId: params.projectId,
        projectName: params.projectName,
        subType: params.subType,
        signal: controller.signal,
        onProgress: setZipProgress,
      });
      if (result.mode === "saved") {
        toast({ title: "ZIP gespeichert" });
      } else {
        setZipReady({ blobUrl: result.blobUrl, filename: result.filename });
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
    zipProgress,
    zipReady,
    isLikelyiOS,
    startServerZip,
    cancel,
    dismiss,
    save,
  };
}
