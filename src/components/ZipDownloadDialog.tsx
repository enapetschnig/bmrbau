// Progress + Save-Button Dialog fuer Foto-ZIP-Downloads.
//
// Wichtig: waehrend der Build laeuft, ist der Dialog NICHT dismissible
// durch ESC oder Outside-Click — sonst tippt der Bauarbeiter mit
// dreckigen Haenden auf dem iPad versehentlich daneben und der Download
// bricht stumm ab. Cancel geht nur ueber den expliziten Button.

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import type { StreamZipProgress } from "@/lib/streamingZipDownload";

type Props = {
  zipProgress: StreamZipProgress | null;
  zipReady: { blobUrl: string; filename: string } | null;
  onCancel: () => void;
  onSave: () => void;
  onDismiss: () => void;
  iOS?: boolean;
};

const formatMB = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function ZipDownloadDialog({
  zipProgress,
  zipReady,
  onCancel: _onCancel,
  onSave,
  onDismiss,
  iOS,
}: Props) {
  const open = !!zipProgress || !!zipReady;
  const buildRunning = !!zipProgress && !zipReady;

  return (
    <Dialog
      open={open}
      // Waehrend Build: kein Dismiss durch ESC/Outside-Click. Nur explizit
      // ueber den Cancel-Button (der den Hook-State sauber aufraeumt).
      // Wenn ZIP fertig (blob-ready) und User klickt weg → revoke + close.
      onOpenChange={(v) => {
        if (v) return;
        if (zipReady) onDismiss();
        // buildRunning: bewusst ignorieren — Cancel nur via Button.
      }}
    >
      <DialogContent
        className="max-w-sm"
        // Pointer- und Escape-Down-Events vom Radix-Dialog blockieren
        // solange ein Build laeuft.
        onPointerDownOutside={(e) => { if (buildRunning) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (buildRunning) e.preventDefault(); }}
        onInteractOutside={(e) => { if (buildRunning) e.preventDefault(); }}
      >
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
            <div className="text-[11px] text-muted-foreground space-y-1">
              {/* bytesWritten nur anzeigen wenn echte Bytes (Streaming-Pfad).
                  Im Blob-Pfad ist bytesWritten=0 → wir verbergen die Zeile,
                  weil "0 KB geladen" wie ein Bug aussieht. */}
              {zipProgress.bytesWritten > 0 && (
                <p>📥 {formatMB(zipProgress.bytesWritten)} geladen</p>
              )}
              {zipProgress.currentFile && zipProgress.phase === "fetching" && zipProgress.filesTotal > 0 && (
                <p className="truncate">📄 {zipProgress.currentFile}</p>
              )}
              <p>Bitte warten — der Browser kümmert sich um den Download.</p>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={_onCancel}>
                <X className="h-3.5 w-3.5 mr-1" /> Abbrechen
              </Button>
            </div>
          </div>
        )}

        {/* Phase: ZIP fertig (nur Blob-Fallback) */}
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
