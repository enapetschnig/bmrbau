import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ChecklistItem } from "./SafetyExcelImportDialog";

export type ChecklistAnswer = {
  item_id: string;
  checked: boolean;
  bemerkung: string | null;
};

interface Props {
  items: ChecklistItem[];
  answers: ChecklistAnswer[];
  onChange: (answers: ChecklistAnswer[]) => void;
  readOnly?: boolean;
}

export function SafetyChecklistEditor({ items, answers, onChange, readOnly }: Props) {
  const getAnswer = (itemId: string): ChecklistAnswer =>
    answers.find((a) => a.item_id === itemId) || { item_id: itemId, checked: false, bemerkung: null };

  const updateAnswer = (itemId: string, field: "checked" | "bemerkung", value: boolean | string | null) => {
    const existing = answers.find((a) => a.item_id === itemId);
    if (existing) {
      onChange(answers.map((a) => (a.item_id === itemId ? { ...a, [field]: value } : a)));
    } else {
      onChange([...answers, { item_id: itemId, checked: false, bemerkung: null, [field]: value }]);
    }
  };

  // Group items by category
  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat} className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">{cat}</h4>
          {items
            .filter((i) => i.category === cat)
            .map((item) => {
              const answer = getAnswer(item.id);
              return (
                <div key={item.id} className="flex items-start gap-3 py-1.5">
                  <Checkbox
                    checked={answer.checked}
                    onCheckedChange={(v) => updateAnswer(item.id, "checked", !!v)}
                    disabled={readOnly}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm">{item.question}</p>
                    {!readOnly ? (
                      <Input
                        placeholder="Bemerkung (optional)"
                        value={answer.bemerkung || ""}
                        onChange={(e) => updateAnswer(item.id, "bemerkung", e.target.value || null)}
                        className="h-7 text-xs"
                      />
                    ) : answer.bemerkung ? (
                      <p className="text-xs text-muted-foreground">{answer.bemerkung}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Keine Checklisten-Punkte vorhanden. Importieren Sie eine Excel-Datei.
        </p>
      )}
    </div>
  );
}
