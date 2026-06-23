// Foto-ZIP-Download mit Batch-Handling.
//
// Bei <= 1 Batch: ein Klick reicht, Download startet sofort.
// Bei mehreren Batches: Dialog mit "Paket N/M herunterladen"-Buttons.

import { useCallback, useState } from "react";
import {
  triggerBatchDownload,
  getProjectPhotoMeta,
  type ServerZipParams,
  type ProjectPhotoMeta,
} from "@/lib/serverZipDownload";
import { useToast } from "@/hooks/use-toast";

export type BatchState = {
  params: ServerZipParams;
  meta: ProjectPhotoMeta;
  nextBatchIndex: number;
};

export function useZipDownload() {
  const { toast } = useToast();
  const [batches, setBatches] = useState<BatchState | null>(null);
  const [preparing, setPreparing] = useState(false);

  const startServerZip = useCallback(async (params: ServerZipParams) => {
    setPreparing(true);
    let meta: ProjectPhotoMeta;
    try {
      meta = await getProjectPhotoMeta(params);
    } catch (err) {
      const e = err as { message?: string };
      toast({
        variant: "destructive",
        title: "Fotos nicht ladbar",
        description: e?.message || "Unbekannter Fehler",
      });
      setPreparing(false);
      return;
    }
    setPreparing(false);

    if (meta.totalFiles === 0) {
      toast({ variant: "destructive", title: "Keine Fotos" });
      return;
    }

    if (meta.batchCount === 1) {
      // Ein-Klick-Pfad: direkt herunterladen.
      triggerBatchDownload({
        ...params,
        offset: 0,
        limit: meta.batchLimit,
      });
      toast({
        title: "Download gestartet",
        description: `${meta.totalFiles} Fotos werden gepackt — der Browser zeigt den Fortschritt unten.`,
      });
      return;
    }

    // Multi-Batch: Dialog oeffnen, User klickt pro Batch einmal.
    setBatches({ params, meta, nextBatchIndex: 0 });
  }, [toast]);

  const downloadNextBatch = useCallback(() => {
    if (!batches) return;
    const { params, meta, nextBatchIndex } = batches;
    const offset = nextBatchIndex * meta.batchLimit;
    triggerBatchDownload({
      ...params,
      offset,
      limit: meta.batchLimit,
    });
    toast({
      title: `Paket ${nextBatchIndex + 1} von ${meta.batchCount}`,
      description: "Download startet — sobald er fertig ist, klick auf das nächste Paket.",
    });
    const newIndex = nextBatchIndex + 1;
    if (newIndex >= meta.batchCount) {
      // Alle gestartet, Dialog schliessen kann der User selbst, oder wir
      // schliessen automatisch.
      setBatches(null);
    } else {
      setBatches({ ...batches, nextBatchIndex: newIndex });
    }
  }, [batches, toast]);

  const cancelBatches = useCallback(() => {
    setBatches(null);
  }, []);

  return {
    startServerZip,
    preparing,
    batches,
    downloadNextBatch,
    cancelBatches,
  };
}
