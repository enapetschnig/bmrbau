import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

interface TemperatureInputProps {
  minValue: number | null;
  maxValue: number | null;
  onMinChange: (value: number | null) => void;
  onMaxChange: (value: number | null) => void;
}

function Stepper({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder: string;
}) {
  const bumpBy = (delta: number) => {
    const current = value ?? 0;
    onChange(Math.max(-40, Math.min(50, current + delta)));
  };
  return (
    <div className="flex items-stretch rounded-md border overflow-hidden">
      <button
        type="button"
        onClick={() => bumpBy(-1)}
        className="px-2 bg-muted hover:bg-muted/70 border-r active:bg-muted/50"
        aria-label="Minus"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <Input
        type="number"
        step="0.5"
        min="-40"
        max="50"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
        placeholder={placeholder}
        className="h-10 border-0 rounded-none text-center focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <button
        type="button"
        onClick={() => bumpBy(1)}
        className="px-2 bg-muted hover:bg-muted/70 border-l active:bg-muted/50"
        aria-label="Plus"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function TemperatureInput({ minValue, maxValue, onMinChange, onMaxChange }: TemperatureInputProps) {
  return (
    <div className="space-y-2">
      <Label>Temperatur (°C)</Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Min</Label>
          <Stepper value={minValue} onChange={onMinChange} placeholder="5" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Max</Label>
          <Stepper value={maxValue} onChange={onMaxChange} placeholder="20" />
        </div>
      </div>
    </div>
  );
}
