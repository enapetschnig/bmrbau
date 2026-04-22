import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PenLine, Minus, Square, ArrowRight, Eraser, Undo2, Redo2, Trash2,
  Maximize2,
} from "lucide-react";

/**
 * Daten-Modell:
 * - Koordinaten normalisiert (0..1) relativ zum Canvas.
 * - Dadurch sieht die Skizze in der Zeile und im Vollbild identisch aus
 *   und ist unabhaengig von Display-Aufloesung.
 */
export type SketchToolType = "pen" | "line" | "rect" | "arrow" | "eraser";

export interface SketchStroke {
  type: SketchToolType;
  points: { x: number; y: number }[];
  color: string;
  width: number; // px im 1000er Referenz-Canvas, wird skaliert
}

interface Props {
  /** PNG-DataURL zum Einbetten ins PDF. Wird vom Component generiert. */
  value?: string | null;
  /** Editierbare Stroke-Liste (persistent, JSONB in DB). */
  strokes?: SketchStroke[] | null;
  /** onChange liefert sowohl aktuelles PNG als auch Stroke-Liste. */
  onChange: (png: string | null, strokes: SketchStroke[]) => void;
  height?: number;
  disabled?: boolean;
}

const TOOLS: { key: SketchToolType; label: string; icon: React.ReactNode }[] = [
  { key: "pen",    label: "Stift",      icon: <PenLine className="h-4 w-4" /> },
  { key: "line",   label: "Linie",      icon: <Minus className="h-4 w-4" /> },
  { key: "rect",   label: "Rechteck",   icon: <Square className="h-4 w-4" /> },
  { key: "arrow",  label: "Pfeil",      icon: <ArrowRight className="h-4 w-4" /> },
  { key: "eraser", label: "Radierer",   icon: <Eraser className="h-4 w-4" /> },
];

/** Malt einen einzelnen Stroke auf den Canvas (in Pixel-Koordinaten). */
function paintStroke(
  ctx: CanvasRenderingContext2D,
  s: SketchStroke,
  canvasW: number,
  canvasH: number,
) {
  if (s.points.length === 0) return;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  // Referenz-Canvas 1000px Breite -> skaliere die Strichbreite relativ dazu.
  const scale = Math.max(0.6, canvasW / 1000);
  ctx.lineWidth = Math.max(1.2, s.width * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const p0 = s.points[0];
  const pLast = s.points[s.points.length - 1];

  if (s.type === "pen") {
    ctx.beginPath();
    s.points.forEach((p, i) => {
      const x = p.x * canvasW;
      const y = p.y * canvasH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Single-tap dot
    if (s.points.length === 1) {
      ctx.beginPath();
      ctx.arc(p0.x * canvasW, p0.y * canvasH, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (s.type === "line") {
    ctx.beginPath();
    ctx.moveTo(p0.x * canvasW, p0.y * canvasH);
    ctx.lineTo(pLast.x * canvasW, pLast.y * canvasH);
    ctx.stroke();
  } else if (s.type === "rect") {
    const ax = p0.x * canvasW;
    const ay = p0.y * canvasH;
    const bx = pLast.x * canvasW;
    const by = pLast.y * canvasH;
    ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
  } else if (s.type === "arrow") {
    const ax = p0.x * canvasW;
    const ay = p0.y * canvasH;
    const bx = pLast.x * canvasW;
    const by = pLast.y * canvasH;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    // Pfeilspitze
    const headLen = Math.max(12, ctx.lineWidth * 4);
    const angle = Math.atan2(by - ay, bx - ax);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - headLen * Math.cos(angle - Math.PI / 6), by - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - headLen * Math.cos(angle + Math.PI / 6), by - headLen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }
}

function strokeBoundingBoxContains(s: SketchStroke, x: number, y: number, pad: number): boolean {
  // Hit-Test: alle Punkte des Strokes bilden ein normalisiertes Rechteck.
  // Wir erlauben einen Padding-Bereich drumrum.
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of s.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return x >= minX - pad && x <= maxX + pad && y >= minY - pad && y <= maxY + pad;
}

export const SketchRow = ({ value, strokes, onChange, height = 160, disabled }: Props) => {
  const [allStrokes, setAllStrokes] = useState<SketchStroke[]>(strokes ?? []);
  const [redoStack, setRedoStack] = useState<SketchStroke[]>([]);
  const [tool, setTool] = useState<SketchToolType>("pen");
  const [currentStroke, setCurrentStroke] = useState<SketchStroke | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Sync strokes-Prop (wenn sich Position laedt). Nur initial.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    setAllStrokes(strokes ?? []);
    // Legacy: falls strokes leer aber value (PNG) existiert, PNG als
    // Hintergrund laden (nicht mehr editierbar, aber sichtbar).
    if ((!strokes || strokes.length === 0) && value) {
      const img = new Image();
      img.onload = () => setBgImage(img);
      img.src = value;
    }
  }, [strokes, value]);

  // Debounced commit: onChange mit PNG + Strokes.
  const commitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const commit = useCallback((nextStrokes: SketchStroke[], activeCanvas: HTMLCanvasElement | null) => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      if (!activeCanvas) {
        onChange(nextStrokes.length > 0 ? null : null, nextStrokes);
        return;
      }
      const png = nextStrokes.length === 0 && !bgImage
        ? null
        : activeCanvas.toDataURL("image/png");
      onChange(png, nextStrokes);
    }, 200);
  }, [onChange, bgImage]);

  // --- Shared handlers -----------------------------------------
  const onPointerDownAt = (canvas: HTMLCanvasElement, e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (tool === "eraser") {
      const pad = 0.02;
      const kept = allStrokes.filter((s) => !strokeBoundingBoxContains(s, x, y, pad));
      if (kept.length !== allStrokes.length) {
        setAllStrokes(kept);
        setRedoStack([]);
        commit(kept, canvas);
      }
      return;
    }

    setCurrentStroke({
      type: tool,
      points: [{ x, y }],
      color: "#101010",
      width: 3,
    });
  };

  const onPointerMoveAt = (canvas: HTMLCanvasElement, e: React.PointerEvent) => {
    if (!currentStroke || disabled) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    // Pen: neue Punkte anhaengen; andere: Endpunkt updaten.
    if (tool === "pen") {
      setCurrentStroke({ ...currentStroke, points: [...currentStroke.points, { x, y }] });
    } else {
      // Fuer line/rect/arrow: zwei Punkte (Anfang + Ende).
      const first = currentStroke.points[0];
      setCurrentStroke({ ...currentStroke, points: [first, { x, y }] });
    }
  };

  const onPointerUpAt = (canvas: HTMLCanvasElement, e: React.PointerEvent) => {
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!currentStroke) return;
    const next = [...allStrokes, currentStroke];
    setAllStrokes(next);
    setRedoStack([]);
    setCurrentStroke(null);
    commit(next, canvas);
  };

  const handleUndo = () => {
    if (allStrokes.length === 0) return;
    const last = allStrokes[allStrokes.length - 1];
    const next = allStrokes.slice(0, -1);
    setAllStrokes(next);
    setRedoStack([...redoStack, last]);
    commit(next, null);
  };
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    const next = [...allStrokes, last];
    setAllStrokes(next);
    setRedoStack(redoStack.slice(0, -1));
    commit(next, null);
  };
  const handleClear = () => {
    setAllStrokes([]);
    setRedoStack([]);
    setBgImage(null);
    onChange(null, []);
  };

  return (
    <>
      <div className="space-y-1.5">
        <ToolBar
          tool={tool}
          setTool={setTool}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          onFullscreen={() => setFullscreen(true)}
          canUndo={allStrokes.length > 0}
          canRedo={redoStack.length > 0}
          disabled={disabled}
        />
        <SketchCanvas
          strokes={allStrokes}
          currentStroke={currentStroke}
          bgImage={bgImage}
          tool={tool}
          height={height}
          disabled={disabled}
          onPointerDown={onPointerDownAt}
          onPointerMove={onPointerMoveAt}
          onPointerUp={onPointerUpAt}
          onCommit={(canvas) => commit(allStrokes, canvas)}
        />
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] p-3 sm:p-4 flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Skizze — Vollbild</DialogTitle>
          </DialogHeader>
          <ToolBar
            tool={tool}
            setTool={setTool}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
            onFullscreen={() => setFullscreen(false)}
            canUndo={allStrokes.length > 0}
            canRedo={redoStack.length > 0}
            disabled={disabled}
            fullscreenActive
          />
          <div className="flex-1 min-h-0">
            <SketchCanvas
              strokes={allStrokes}
              currentStroke={currentStroke}
              bgImage={bgImage}
              tool={tool}
              fullheight
              disabled={disabled}
              onPointerDown={onPointerDownAt}
              onPointerMove={onPointerMoveAt}
              onPointerUp={onPointerUpAt}
              onCommit={(canvas) => commit(allStrokes, canvas)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// =================================================================
// ToolBar + Canvas als interne Subkomponenten
// =================================================================

interface ToolBarProps {
  tool: SketchToolType;
  setTool: (t: SketchToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onFullscreen: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
  fullscreenActive?: boolean;
}

const ToolBar = ({ tool, setTool, onUndo, onRedo, onClear, onFullscreen, canUndo, canRedo, disabled, fullscreenActive }: ToolBarProps) => (
  <div className="flex flex-wrap items-center gap-1">
    {TOOLS.map((t) => (
      <Button
        key={t.key}
        type="button"
        variant={tool === t.key ? "default" : "outline"}
        size="sm"
        className="h-8 px-2"
        onClick={() => setTool(t.key)}
        disabled={disabled}
        title={t.label}
      >
        {t.icon}
        <span className="hidden md:inline ml-1 text-xs">{t.label}</span>
      </Button>
    ))}
    <div className="mx-1 h-6 w-px bg-border" />
    <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={onUndo} disabled={disabled || !canUndo} title="Rückgängig">
      <Undo2 className="h-4 w-4" />
    </Button>
    <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={onRedo} disabled={disabled || !canRedo} title="Wiederholen">
      <Redo2 className="h-4 w-4" />
    </Button>
    <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-destructive" onClick={onClear} disabled={disabled} title="Alles löschen">
      <Trash2 className="h-4 w-4" />
    </Button>
    <div className="ml-auto">
      <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={onFullscreen} disabled={disabled} title={fullscreenActive ? "Schließen" : "Vollbild"}>
        <Maximize2 className="h-4 w-4" />
        <span className="hidden sm:inline ml-1 text-xs">{fullscreenActive ? "Schließen" : "Vollbild"}</span>
      </Button>
    </div>
  </div>
);

interface SketchCanvasProps {
  strokes: SketchStroke[];
  currentStroke: SketchStroke | null;
  bgImage: HTMLImageElement | null;
  tool: SketchToolType;
  height?: number;
  fullheight?: boolean;
  disabled?: boolean;
  onPointerDown: (canvas: HTMLCanvasElement, e: React.PointerEvent) => void;
  onPointerMove: (canvas: HTMLCanvasElement, e: React.PointerEvent) => void;
  onPointerUp: (canvas: HTMLCanvasElement, e: React.PointerEvent) => void;
  /** Nach jedem Redraw (post-commit) kann der Aufrufer das PNG holen. */
  onCommit: (canvas: HTMLCanvasElement) => void;
}

const SketchCanvas = ({ strokes, currentStroke, bgImage, tool, height, fullheight, disabled, onPointerDown, onPointerMove, onPointerUp, onCommit }: SketchCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas auf Container-Groesse + DPR setzen und redraw bei Resize.
  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }, []);

  useEffect(() => {
    setup();
    const obs = new ResizeObserver(setup);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [setup, fullheight, height]);

  // Redraw bei jeder Stroke-Aenderung.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Clear + weisser Hintergrund (bereits auf DPR-Pixel-Basis).
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (bgImage) ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    for (const s of strokes) paintStroke(ctx, s, canvas.width, canvas.height);
    if (currentStroke) paintStroke(ctx, currentStroke, canvas.width, canvas.height);
    ctx.restore();
  }, [strokes, currentStroke, bgImage]);

  // Nach jedem Redraw ohne aktiven Stroke: PNG commit ausloesen.
  useEffect(() => {
    if (currentStroke) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onCommit(canvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, bgImage]);

  return (
    <div
      ref={containerRef}
      className="w-full border rounded overflow-hidden bg-white"
      style={fullheight ? { height: "100%" } : { height: `${height ?? 160}px` }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full touch-none"
        style={{ cursor: disabled ? "not-allowed" : tool === "eraser" ? "cell" : "crosshair" }}
        onPointerDown={(e) => canvasRef.current && onPointerDown(canvasRef.current, e)}
        onPointerMove={(e) => canvasRef.current && onPointerMove(canvasRef.current, e)}
        onPointerUp={(e) => canvasRef.current && onPointerUp(canvasRef.current, e)}
        onPointerCancel={(e) => canvasRef.current && onPointerUp(canvasRef.current, e)}
      />
    </div>
  );
};
