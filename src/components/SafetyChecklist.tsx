import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";

export interface SafetyItem {
  id: string;
  label: string;
  checked: boolean;
}

export const DEFAULT_SAFETY_ITEMS: SafetyItem[] = [
  { id: "psa", label: "PSA (Persönliche Schutzausrüstung) vorhanden", checked: false },
  { id: "erste_hilfe", label: "Erste-Hilfe-Kasten vorhanden und zugänglich", checked: false },
  { id: "absturz", label: "Absturzsicherungen kontrolliert", checked: false },
  { id: "brandschutz", label: "Brandschutz gewährleistet", checked: false },
  { id: "fluchtwege", label: "Zugangs- und Fluchtwege frei", checked: false },
  { id: "maschinen", label: "Maschinen und Geräte geprüft", checked: false },
  { id: "absicherung", label: "Baustelle abgesichert", checked: false },
];

interface SafetyChecklistProps {
  items: SafetyItem[];
  onChange: (items: SafetyItem[]) => void;
  disabled?: boolean;
}

export function SafetyChecklist({ items, onChange, disabled = false }: SafetyChecklistProps) {
  const allChecked = items.every((item) => item.checked);

  const toggleItem = (id: string) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className={`w-5 h-5 ${allChecked ? "text-green-600" : "text-muted-foreground"}`} />
        <Label className="text-base font-semibold">Sicherheitscheckliste</Label>
        {allChecked && (
          <span className="text-xs text-green-600 font-medium">Vollständig</span>
        )}
      </div>
      <div className="space-y-2 pl-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <Checkbox
              id={`safety-${item.id}`}
              checked={item.checked}
              onCheckedChange={() => toggleItem(item.id)}
              disabled={disabled}
            />
            <Label
              htmlFor={`safety-${item.id}`}
              className={`text-sm cursor-pointer ${item.checked ? "text-foreground" : "text-muted-foreground"}`}
            >
              {item.label}
            </Label>
          </div>
        ))}
      </div>
      {!allChecked && (
        <p className="text-xs text-destructive">
          Alle Punkte müssen bestätigt werden, bevor der Bericht unterschrieben werden kann.
        </p>
      )}
    </div>
  );
}
