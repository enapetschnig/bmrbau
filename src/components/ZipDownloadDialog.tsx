// Progress + Save-Button Dialog fuer den client-side ZIP-Download.

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import type { ZipProgress } from "@/lib/zipDownloader";

type Props = {
  zipProgress: ZipProgress | null;
  zipReady: { blobUrl: string; filename: string } | null;
  onCancel: () => void;
  onSave: () => void;
  onDismiss: () => void;
  iOS?: boolean;
};

export function ZipDownloadDialog({
  zipProgress,
  zipReady,
  onCancel,
  onSave,
  onDismiss,
  iOS,
}: Props) {
  const open = !!zipProgress || !!zipReady;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) return;
        if (zipProgress) onCancel();
        if (zipReady) onDismiss();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{zipReady ? "ZIP fertig" : "ZIP wird gebaut…"}</DialogTitle>
        </DialogHeader>

        {/* Phase: Build laeuft */}
        {zipProgress && !zipReady && (
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              {zipProgress.phase === "finalizing"
                ? "ZIP wird abgeschlossen…"
                : zipProgress.filesTotal > 0
                  ? `Foto ${Math.min(zipProgress.filesDone + 1, zipProgress.filesTotal)} von ${zipProgress.filesTotal}`
                  : zipProgress.currentFile || "Wird vorbereitet…"}
            </p>
            {zipProgress.filesTotal > 0 && (
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, Math.round((zipProgress.filesDone / zipProgress.filesTotal) * 100))}%`,
                  }}
                />
              </div>
            )}
            {zipProgress.currentFile && zipProgress.phase === "fetching" && zipProgress.filesTotal > 0 && (
              <p className="text-[11px] text-muted-foreground truncate">📄 {zipProgress.currentFile}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Dialog nicht schließen — bricht den Build ab.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onCancel}>
                <X className="h-3.5 w-3.5 mr-1" /> Abbrechen
              </Button>
            </div>
          </div>
        )}

        {/* Phase: ZIP fertig - User clickt aus frischem Gesture */}
        {zipReady && (
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Klick zum Speichern.{iOS && " Die Datei landet in der Dateien-App → Downloads."}
            </p>
            <p className="text-xs truncate">📦 {zipReady.filename}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onDismiss}>Verwerfen</Button>
              <Button size="sm" onClick={onSave}>
                <Download className="h-3.5 w-3.5 mr-1" /> ZIP speichern
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
