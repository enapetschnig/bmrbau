import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const GESCHOSS_OPTIONS = [
  { value: "aussen", label: "Außen" },
  { value: "keller", label: "Keller" },
  { value: "eg", label: "EG" },
  { value: "og", label: "OG" },
  { value: "dg", label: "DG" },
] as const;

interface GeschossSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
}

export function GeschossSelector({ value, onChange, label = "Geschoss" }: GeschossSelectorProps) {
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
        {GESCHOSS_OPTIONS.map((opt) => (
          <Badge
            key={opt.value}
            variant={value.includes(opt.value) ? "default" : "outline"}
            className="cursor-pointer text-sm px-3 py-1.5 select-none"
            onClick={() => toggle(opt.value)}
          >
            {opt.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export { GESCHOSS_OPTIONS };
