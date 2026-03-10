import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TemperatureInputProps {
  minValue: number | null;
  maxValue: number | null;
  onMinChange: (value: number | null) => void;
  onMaxChange: (value: number | null) => void;
}

export function TemperatureInput({ minValue, maxValue, onMinChange, onMaxChange }: TemperatureInputProps) {
  return (
    <div className="space-y-2">
      <Label>Temperatur (°C)</Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Min</Label>
          <Input
            type="number"
            step="0.5"
            min="-40"
            max="50"
            value={minValue ?? ""}
            onChange={(e) => onMinChange(e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="z.B. -2"
            className="h-10"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Max</Label>
          <Input
            type="number"
            step="0.5"
            min="-40"
            max="50"
            value={maxValue ?? ""}
            onChange={(e) => onMaxChange(e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="z.B. 15"
            className="h-10"
          />
        </div>
      </div>
    </div>
  );
}
