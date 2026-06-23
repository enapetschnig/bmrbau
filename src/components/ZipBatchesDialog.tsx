// Dialog fuer Multi-Batch-ZIP-Downloads. Server-RAM limitiert pro Paket
// auf ~80 MB, daher werden grosse Projekte aufgeteilt — der User muss
// fuer jeden Batch einmal klicken (notwendig wegen User-Gesture-Regeln
// auf iOS Safari).

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { BatchState } from "@/hooks/useZipDownload";

type Props = {
  batches: BatchState | null;
  onNext: () => void;
  onCancel: () => void;
};

export function ZipBatchesDialog({ batches, onNext, onCancel }: Props) {
  if (!batches) return null;
  const { meta, nextBatchIndex } = batches;
  const done = nextBatchIndex >= meta.batchCount;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Großes Projekt — in {meta.batchCount} Pakete aufgeteilt</DialogTitle>
          <DialogDescription>
            {meta.totalFiles} Fotos. Klick auf den Button, um das nächste Paket herunterzuladen.
            Sobald der Browser ein Paket fertig hat, kommt das nächste dran.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-2 space-y-3">
          <div className="text-sm">
            Fortschritt: <strong>{nextBatchIndex}</strong> von {meta.batchCount} Paketen gestartet
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.round((nextBatchIndex / meta.batchCount) * 100)}%` }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              {done ? "Schließen" : "Abbrechen"}
            </Button>
            {!done && (
              <Button size="sm" onClick={onNext}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Paket {nextBatchIndex + 1} von {meta.batchCount} herunterladen
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
