import { useRef, useState, useEffect } from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Undo2, Redo2, Eraser, Trash2, Download, Send, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  onSave: (editedBlob: Blob) => Promise<void>;
  title?: string;
}

const COLORS = [
  { value: "#ef4444", label: "Rot" },
  { value: "#22c55e", label: "Gruen" },
  { value: "#3b82f6", label: "Blau" },
  { value: "#eab308", label: "Gelb" },
  { value: "#000000", label: "Schwarz" },
  { value: "#ffffff", label: "Weiss" },
];

const STROKE_WIDTHS = [
  { value: 3, label: "S" },
  { value: 6, label: "M" },
  { value: 12, label: "L" },
];

export function ImageEditor({ open, onClose, imageUrl, onSave, title = "Bild bearbeiten" }: Props) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [strokeColor, setStrokeColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [imageReady, setImageReady] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bild laden + Canvas-Groesse an Bild anpassen
  useEffect(() => {
    if (!open || !imageUrl) return;
    setImageReady(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Container-Groesse ermitteln
      const maxWidth = window.innerWidth > 900 ? 800 : window.innerWidth - 40;
      const maxHeight = window.innerHeight - 200;

      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const ratio = w / h;

      if (w > maxWidth) { w = maxWidth; h = w / ratio; }
      if (h > maxHeight) { h = maxHeight; w = h * ratio; }

      setCanvasSize({ width: Math.round(w), height: Math.round(h) });
      setImageReady(true);
    };
    img.onerror = () => setImageReady(true);
    img.src = imageUrl;
  }, [open, imageUrl]);

  // Radiergummi toggle
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.eraseMode(isEraser);
    }
  }, [isEraser]);

  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const handleClear = () => {
    if (confirm("Alle Anmerkungen entfernen?")) {
      canvasRef.current?.resetCanvas();
    }
  };

  const handleSave = async () => {
    if (!canvasRef.current) return;
    setSaving(true);

    try {
      // 1. Canvas-Anmerkungen als Data-URL exportieren
      const drawingDataUrl = await canvasRef.current.exportImage("png");

      // 2. Original-Bild + Anmerkungen zu einem Blob mergen
      const img = new Image();
      img.crossOrigin = "anonymous";
      const loadImg = new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
      });
      img.src = imageUrl;
      const originalImg = await loadImg;

      const drawingImg = new Image();
      const loadDrawing = new Promise<HTMLImageElement>((resolve, reject) => {
        drawingImg.onload = () => resolve(drawingImg);
        drawingImg.onerror = reject;
      });
      drawingImg.src = drawingDataUrl;
      await loadDrawing;

      const mergeCanvas = document.createElement("canvas");
      mergeCanvas.width = originalImg.naturalWidth;
      mergeCanvas.height = originalImg.naturalHeight;
      const ctx = mergeCanvas.getContext("2d")!;

      // Original zeichnen
      ctx.drawImage(originalImg, 0, 0);

      // Zeichnung daruebersetzen (skaliert auf Original-Groesse)
      ctx.drawImage(drawingImg, 0, 0, originalImg.naturalWidth, originalImg.naturalHeight);

      // Als JPEG Blob
      const blob = await new Promise<Blob>((resolve) => {
        mergeCanvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9);
      });

      await onSave(blob);
      onClose();
    } catch (err) {
      console.error("Image editor save error:", err);
      alert("Fehler beim Speichern des Bildes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl p-0 flex flex-col gap-0 h-[95vh] overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-4 w-4" />
            {title}
          </DialogTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-3 py-2 border-b bg-muted/30 flex flex-wrap items-center gap-2">
          {/* Farben */}
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c.value}
                className={cn(
                  "w-7 h-7 rounded-full border-2 transition-all",
                  strokeColor === c.value && !isEraser
                    ? "border-gray-900 dark:border-white scale-110 ring-2 ring-offset-1"
                    : "border-gray-300 hover:scale-105"
                )}
                style={{ backgroundColor: c.value }}
                onClick={() => { setStrokeColor(c.value); setIsEraser(false); }}
                title={c.label}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Strichstaerke */}
          <div className="flex gap-1">
            {STROKE_WIDTHS.map((s) => (
              <Button
                key={s.value}
                variant={strokeWidth === s.value ? "default" : "outline"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setStrokeWidth(s.value)}
              >
                {s.label}
              </Button>
            ))}
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Radiergummi */}
          <Button
            variant={isEraser ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEraser(!isEraser)}
            title="Radiergummi"
          >
            <Eraser className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border" />

          {/* Undo/Redo */}
          <Button variant="outline" size="sm" onClick={handleUndo} title="Rueckgaengig">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleRedo} title="Wiederherstellen">
            <Redo2 className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border" />

          {/* Zuruecksetzen */}
          <Button variant="outline" size="sm" onClick={handleClear} title="Alles loeschen" className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>

          <div className="flex-1" />

          {/* Speichern */}
          <Button onClick={handleSave} disabled={saving || !imageReady} size="sm" className="gap-1">
            <Send className="h-4 w-4" />
            {saving ? "Speichert..." : "Teilen"}
          </Button>
        </div>

        {/* Canvas-Bereich */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-auto bg-gray-100 dark:bg-gray-900 p-4"
          style={{ touchAction: "none" }}
        >
          {!imageReady ? (
            <p className="text-muted-foreground">Bild wird geladen...</p>
          ) : (
            <div
              className="relative shadow-lg"
              style={{ width: canvasSize.width, height: canvasSize.height }}
            >
              {/* Hintergrundbild */}
              <img
                src={imageUrl}
                alt="Bearbeiten"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                draggable={false}
              />
              {/* Canvas drauf */}
              <ReactSketchCanvas
                ref={canvasRef}
                width={`${canvasSize.width}px`}
                height={`${canvasSize.height}px`}
                strokeWidth={strokeWidth}
                eraserWidth={strokeWidth * 2}
                strokeColor={strokeColor}
                canvasColor="transparent"
                style={{ border: "none", position: "relative", zIndex: 10 }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
