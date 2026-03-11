import { useAvailableEmployees } from "@/hooks/useAvailableEmployees";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function SafetyEmployeeSelector({ selectedIds, onChange }: Props) {
  const { employees, loading } = useAvailableEmployees(false);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  if (loading) return <p className="text-sm text-muted-foreground">Lade Mitarbeiter...</p>;

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
      {employees.map((emp) => (
        <div key={emp.id} className="flex items-center gap-2">
          <Checkbox
            id={`emp-${emp.id}`}
            checked={selectedIds.includes(emp.id)}
            onCheckedChange={() => toggle(emp.id)}
          />
          <Label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer">
            {emp.vorname} {emp.nachname}
          </Label>
        </div>
      ))}
      {employees.length === 0 && (
        <p className="text-sm text-muted-foreground">Keine Mitarbeiter gefunden</p>
      )}
    </div>
  );
}
