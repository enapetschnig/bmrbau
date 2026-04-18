import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Check, X, Trash2, Upload, Loader2, RotateCcw } from "lucide-react";

export type CapturedPhoto = {
  id: string;
  file: File;
  preview: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Wird beim Abschliessen aufgerufen mit allen uebernommenen Files */
  onFinish: (files: File[]) => Promise<void> | void;
  title?: string;
}

/**
 * Serienaufnahme:
 * 1. Kamera oeffnet sich automatisch beim Dialog-Start
 * 2. Nach jedem Foto: Preview mit "Übernehmen" / "Verwerfen"
 * 3. Übernommene Fotos werden gesammelt
 * 4. "Abschliessen" → onFinish callback mit allen Files
 */
export function SerialPhotoCapture({
  open,
  onOpenChange,
  onFinish,
  title = "Serienaufnahme",
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [captured, setCaptured] = useState<CapturedPhoto[]>([]);
  const [currentPreview, setCurrentPreview] = useState<{ file: File; url: string } | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Beim Oeffnen: Kamera starten
  useEffect(() => {
    if (open) {
      setCaptured([]);
      setCurrentPreview(null);
      setFinishing(false);
      // Kamera oeffnen nach kurzer Verzoegerung (damit der Dialog schon da ist)
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 150);
    } else {
      // Cleanup object-URLs
      if (currentPreview) URL.revokeObjectURL(currentPreview.url);
      captured.forEach(p => URL.revokeObjectURL(p.preview));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // Reset so same file can be re-selected
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCurrentPreview({ file, url });
  };

  const acceptCurrent = () => {
    if (!currentPreview) return;
    setCaptured(prev => [...prev, {
      id: crypto.randomUUID(),
      file: currentPreview.file,
      preview: currentPreview.url,
    }]);
    setCurrentPreview(null);
    // Nächste Aufnahme starten
    setTimeout(() => fileInputRef.current?.click(), 200);
  };

  const rejectCurrent = () => {
    if (!currentPreview) return;
    URL.revokeObjectURL(currentPreview.url);
    setCurrentPreview(null);
    // Erneut aufnehmen
    setTimeout(() => fileInputRef.current?.click(), 200);
  };

  const removeCaptured = (id: string) => {
    setCaptured(prev => {
      const target = prev.find(p => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter(p => p.id !== id);
    });
  };

  const takeAnother = () => {
    fileInputRef.current?.click();
  };

  const finish = async () => {
    if (captured.length === 0) {
      onOpenChange(false);
      return;
    }
    setFinishing(true);
    try {
      await onFinish(captured.map(p => p.file));
      // Cleanup
      captured.forEach(p => URL.revokeObjectURL(p.preview));
      if (currentPreview) URL.revokeObjectURL(currentPreview.url);
      onOpenChange(false);
    } finally {
      setFinishing(false);
    }
  };

  const cancel = () => {
    captured.forEach(p => URL.revokeObjectURL(p.preview));
    if (currentPreview) URL.revokeObjectURL(currentPreview.url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cancel(); else onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title} {captured.length > 0 && <span className="text-sm text-muted-foreground">({captured.length} aufgenommen)</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Hidden camera input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Aktuelle Preview */}
        {currentPreview ? (
          <div className="space-y-3">
            <div className="rounded-lg border overflow-hidden bg-muted">
              <img
                src={currentPreview.url}
                alt="Preview"
                className="w-full max-h-[50vh] object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={rejectCurrent}
              >
                <X className="w-4 h-4 mr-1" /> Verwerfen
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={acceptCurrent}
              >
                <Check className="w-4 h-4 mr-1" /> Übernehmen
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {captured.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Kamera wird geöffnet... Falls nicht:
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={takeAnother}>
                    <Camera className="w-4 h-4 mr-1" /> Foto aufnehmen
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {captured.length} Foto{captured.length === 1 ? "" : "s"} bereit zum Hochladen
                </p>
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {captured.map(p => (
                    <div key={p.id} className="relative group">
                      <img src={p.preview} alt="" className="aspect-square w-full object-cover rounded border" />
                      <button
                        type="button"
                        onClick={() => removeCaptured(p.id)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Entfernen"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={takeAnother} disabled={finishing}>
                    <Camera className="w-4 h-4 mr-1" /> Weiteres Foto
                  </Button>
                  <Button className="flex-1" onClick={finish} disabled={finishing}>
                    {finishing
                      ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Lädt hoch...</>
                      : <><Upload className="w-4 h-4 mr-1" /> Abschließen ({captured.length})</>}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
