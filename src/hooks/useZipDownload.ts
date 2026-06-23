// One-Click Foto-ZIP-Download — client-side via client-zip.
//
// Der Browser zieht alle Fotos direkt von der Storage-CDN (Supabase-Edge-
// Function-RAM-Limit umgangen), baut die ZIP via Stream-API und speichert
// sie. Auf Chromium-Desktop nutzen wir den File-System-Access-API-Pfad
// (Stream direkt auf Platte, beliebig grosse Downloads). Sonst Blob mit
// Save-Button-Click im Progress-Dialog (Safari/iOS-Gesture-safe).

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildZipDownload,
  triggerBlobDownload,
  isLikelyiOS,
  type ZipFile,
  type ZipProgress,
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
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);
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

    // 2) URL-Liste bauen (public bucket → getPublicUrl, oder relative Pfad)
    const files: ZipFile[] = data.map((d) => {
      const fu = d.file_url as string | null;
      if (fu && fu.startsWith("http")) {
        return { name: d.name as string, url: fu };
      }
      const storagePath = fu || `${params.projectId}/${d.name}`;
      const { data: urlData } = supabase.storage
        .from("project-photos")
        .getPublicUrl(storagePath);
      return { name: d.name as string, url: urlData.publicUrl };
    });

    // 3) Client-side ZIP-Build via client-zip
    const controller = new AbortController();
    abortRef.current = controller;

    const stamp = new Date().toISOString().slice(0, 10);
    const safeProject = asciiize(params.projectName) || "projekt";
    const suffix = params.subType ? `_${asciiize(params.subType)}` : "";
    const zipName = `${safeProject}_fotos${suffix}_${stamp}.zip`;

    try {
      const result = await buildZipDownload(files, zipName, {
        signal: controller.signal,
        onProgress: setZipProgress,
      });
      if (result.mode === "saved") {
        // Chromium-FSA-Pfad → schon auf der Platte
        toast({ title: "ZIP gespeichert", description: zipName });
      } else {
        // Blob fertig → User klickt "Speichern" im Dialog (iOS-Gesture-safe)
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
    startServerZip,
    zipProgress,
    zipReady,
    cancel,
    dismissReady,
    saveReady,
    isLikelyiOS,
  };
}
