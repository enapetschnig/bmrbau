import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Check, X, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx-js-style";

export type ChecklistItem = {
  id: string;
  category: string;
  question: string;
};

type ParsedRow = {
  category: string;
  question: string;
  valid: boolean;
  error?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: ChecklistItem[]) => void;
}

export function SafetyExcelImportDialog({ open, onOpenChange, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const parsed: ParsedRow[] = json.map((row) => {
      const category = String(
        row["Kategorie"] || row["Category"] || row["Bereich"] || row["Gruppe"] || ""
      ).trim();
      const question = String(
        row["Frage"] || row["Prüfpunkt"] || row["Item"] || row["Punkt"] ||
        row["Beschreibung"] || row["Maßnahme"] || row["Text"] || ""
      ).trim();

      return {
        category,
        question,
        valid: !!question,
        error: !question ? "Frage/Prüfpunkt fehlt" : undefined,
      };
    });

    setRows(parsed);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    const validRows = rows.filter((r) => r.valid);
    const items: ChecklistItem[] = validRows.map((r, i) => ({
      id: `item-${Date.now()}-${i}`,
      category: r.category || "Allgemein",
      question: r.question,
    }));
    onImport(items);
    onOpenChange(false);
    setRows([]);
    setFileName("");
  };

  const validCount = rows.filter((r) => r.valid).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setRows([]); setFileName(""); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Checkliste aus Excel importieren</DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Erwartete Spalten: <strong>Kategorie</strong> (optional), <strong>Frage</strong> oder <strong>Prüfpunkt</strong> (Pflicht)
            </p>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Excel-Datei auswählen</p>
              <p className="text-xs text-muted-foreground">.xlsx oder .xls</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {fileName} — {validCount}/{rows.length} gültig
              </p>
              <Button variant="outline" size="sm" onClick={() => { setRows([]); setFileName(""); }}>
                Andere Datei
              </Button>
            </div>

            <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Frage / Prüfpunkt</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i} className={!row.valid ? "bg-red-50" : ""}>
                      <TableCell>
                        {row.valid ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{row.category || <span className="text-muted-foreground italic">—</span>}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {row.question || <span className="text-red-500 italic">fehlt</span>}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeRow(i)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button onClick={handleConfirm} disabled={validCount === 0}>
                {validCount} Prüfpunkte übernehmen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
