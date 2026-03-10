import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const WEATHER_OPTIONS = [
  { value: "sonnig", label: "Sonnig", icon: "☀️" },
  { value: "bewoelkt", label: "Bewölkt", icon: "☁️" },
  { value: "regen", label: "Regen", icon: "🌧️" },
  { value: "schnee", label: "Schnee", icon: "❄️" },
  { value: "wind", label: "Wind", icon: "💨" },
  { value: "frost", label: "Frost", icon: "🥶" },
] as const;

interface WeatherSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
}

export function WeatherSelector({ value, onChange, label = "Wetter" }: WeatherSelectorProps) {
  const toggle = (item: string) => {
    if (value.includes(item)) {
      onChange(value.filter((v) => v !== item));
    } else {
      onChange([...value, item]);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {WEATHER_OPTIONS.map((opt) => (
          <Badge
            key={opt.value}
            variant={value.includes(opt.value) ? "default" : "outline"}
            className="cursor-pointer text-sm px-3 py-1.5 select-none"
            onClick={() => toggle(opt.value)}
          >
            {opt.icon} {opt.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
