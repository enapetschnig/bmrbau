import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Undo2 } from "lucide-react";

interface SketchRowProps {
  /** Initial-PNG-DataURL (z. B. nach Reload aus DB). */
  value?: string | null;
  /** Wird beim Loslassen des Stiftes mit dem aktuellen PNG-DataURL aufgerufen. */
  onChange: (value: string | null) => void;
  /** Innenmasse des Canvas (intern). UI rendert full-width. */
  width?: number;
  height?: number;
  disabled?: boolean;
}

/**
 * Schreib-Zeile fuer Aufmaßblaetter. Mit Apple Pencil / Stift sehr
 * gut nutzbar dank PointerEvents (Druckstaerke wird wenn moeglich
 * mitgenutzt) und touch-action: none.
 */
export const SketchRow = ({
  value = null,
  onChange,
  width = 1200,
  height = 200,
  disabled = false,
}: SketchRowProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  // History fuer Undo (Datenkopien des Canvas pro Strich-Beginn).
  const historyRef = useRef<string[]>([]);
  const [hasContent, setHasContent] = useState(!!value);

  // Initial-Setup + Re-Initialisierung wenn value von aussen kommt.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#101010";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasContent(true);
      };
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPointerCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const pushHistorySnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    historyRef.current.push(canvas.toDataURL("image/png"));
    // History-Cap auf 30 Schritte.
    if (historyRef.current.length > 30) historyRef.current.shift();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    pushHistorySnapshot();
    const { x, y } = getPointerCoords(e);
    lastPointRef.current = { x, y };
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    // Einzeltaps zeichnen einen Punkt.
    ctx.beginPath();
    ctx.arc(x, y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#101010";
    ctx.fill();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPointerCoords(e);
    const last = lastPointRef.current;
    // Druckstaerke (Apple Pencil etc.) modulieren die Linienbreite.
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    ctx.lineWidth = 1.6 + pressure * 2.4;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    lastPointRef.current = { x, y };
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    setHasContent(true);
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    canvasRef.current?.releasePointerCapture(e.pointerId);
    finishStroke();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    pushHistorySnapshot();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    onChange(null);
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const last = historyRef.current.pop();
    if (!last) {
      handleClear();
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const stillHas = historyRef.current.length > 0 || true;
      setHasContent(stillHas);
      onChange(canvas.toDataURL("image/png"));
    };
    img.src = last;
  };

  return (
    <div className="space-y-1.5 w-full">
      <div className="border rounded-md overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block w-full touch-none"
          style={{ height: 90, cursor: disabled ? "not-allowed" : "crosshair" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {hasContent ? "Mit Stift weiterschreiben oder löschen." : "Mit Stift / Finger schreiben."}
        </p>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" onClick={handleUndo} disabled={disabled} className="h-7 px-2">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={disabled} className="h-7 px-2">
            <Eraser className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
