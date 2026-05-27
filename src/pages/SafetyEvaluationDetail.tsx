import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, FileSpreadsheet, Download, Trash2, Plus, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SafetyChecklistEditor, type ChecklistAnswer } from "@/components/safety/SafetyChecklistEditor";
import { SafetySignatureCollector } from "@/components/safety/SafetySignatureCollector";
import { SafetyExcelImportDialog, type ChecklistItem } from "@/components/safety/SafetyExcelImportDialog";
import { SafetyEmployeeSelector } from "@/components/safety/SafetyEmployeeSelector";
import { generateSafetyEvaluationPDF } from "@/lib/generateSafetyEvaluationPDF";
import { confirm } from "@/lib/confirm";

const STATUS_LABELS: Record<string, string> = {
  entwurf: "Entwurf",
  warte_auf_unterschrift: "Zur Unterschrift",
  ausgefuellt: "Ausgefüllt",
  diskutiert: "Diskutiert",
  abgeschlossen: "Unterschrieben",
};

const STATUS_COLORS: Record<string, string> = {
  entwurf: "bg-slate-100 text-slate-700",
  warte_auf_unterschrift: "bg-orange-100 text-orange-700",
  ausgefuellt: "bg-blue-100 text-blue-700",
  diskutiert: "bg-violet-100 text-violet-700",
  abgeschlossen: "bg-green-100 text-green-700",
};

const MODUL_LABELS: Record<string, string> = {
  jahresunterweisung: "Jahresunterweisung",
  baustellenunterweisung: "Baustellenunterweisung",
  geraeteunterweisung: "Geräteunterweisung",
};

type Employee = { id: string; vorname: string; nachname: string };
type Signature = {
  id: string;
  user_id: string;
  unterschrift: string;
  unterschrift_name: string;
  unterschrieben_am: string;
  personal_answers?: Array<{ item_id: string; checked: boolean; bemerkung: string | null }>;
};

export default function SafetyEvaluationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [evaluation, setEvaluation] = useState<any>(null);
  const [projectName, setProjectName] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  // Editable state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [answers, setAnswers] = useState<ChecklistAnswer[]>([]);
  const [diskussionNotizen, setDiskussionNotizen] = useState("");
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [showEmployeeEditor, setShowEmployeeEditor] = useState(false);
  const [editEmployeeIds, setEditEmployeeIds] = useState<string[]>([]);
  const [newItemKategorie, setNewItemKategorie] = useState("");
  const [newItemFrage, setNewItemFrage] = useState("");

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      setIsAdmin(roleData?.role === "administrator");
    }

    const { data: ev } = await supabase.from("safety_evaluations").select("*").eq("id", id).single();
    if (!ev) {
      setLoading(false);
      return;
    }

    setEvaluation(ev);
    setChecklistItems((ev.checklist_items as ChecklistItem[]) || []);
    setAnswers((ev.filled_answers as ChecklistAnswer[]) || []);
    setDiskussionNotizen(ev.diskussion_notizen || "");

    // Project name (nur wenn project_id gesetzt - Jahres-/Geraete-Unterweisungen
    // haengen an keinem Projekt).
    if (ev.project_id) {
      const { data: proj } = await supabase.from("projects").select("name").eq("id", ev.project_id).maybeSingle();
      if (proj) setProjectName(proj.name);
    } else {
      setProjectName("");
    }

    // Equipment name (nur bei Geraeteunterweisung).
    if (ev.equipment_id) {
      const { data: equip } = await supabase.from("equipment").select("name").eq("id", ev.equipment_id).maybeSingle();
      if (equip) setEquipmentName(equip.name);
    } else {
      setEquipmentName("");
    }

    // Employees + profiles
    const { data: empData } = await supabase
      .from("safety_evaluation_employees")
      .select("user_id")
      .eq("evaluation_id", id);
    const empIds = (empData || []).map((e: any) => e.user_id);
    setEmployeeIds(empIds);

    if (empIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, vorname, nachname")
        .in("id", empIds);
      setEmployees((profiles || []) as Employee[]);
    }

    // Signatures
    const { data: sigData } = await supabase
      .from("safety_evaluation_signatures")
      .select("*")
      .eq("evaluation_id", id);
    setSignatures((sigData || []) as unknown as Signature[]);

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Admins und der Ersteller der Evaluierung duerfen sie solange editieren
  // wie der Status "warte_auf_unterschrift" ist. Nach "abgeschlossen" ist
  // sie eingefroren, damit bereits gesammelte Unterschriften rechtsverbindlich
  // bleiben.
  const status = evaluation?.status || "warte_auf_unterschrift";
  const canEdit = (isAdmin || (evaluation?.created_by && userId === evaluation.created_by))
    && status === "warte_auf_unterschrift";

  const addManualItem = () => {
    if (!newItemFrage.trim()) return;
    setChecklistItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: newItemKategorie.trim() || "Allgemein",
        question: newItemFrage.trim(),
      },
    ]);
    setNewItemFrage("");
    setNewItemKategorie("");
  };

  const removeChecklistItem = (itemId: string) => {
    setChecklistItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleSaveChecklistStructure = async () => {
    if (!id) return;
    setSaving(true);

    const { error } = await supabase
      .from("safety_evaluations")
      .update({ checklist_items: checklistItems })
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
    } else {
      toast({ title: "Checkliste gespeichert" });
      setEvaluation((prev: any) => ({ ...prev, checklist_items: checklistItems }));
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!(await confirm({
      title: "Evaluierung wirklich löschen?",
      description: "Dieser Vorgang kann nicht rückgängig gemacht werden.",
      destructive: true,
      confirmLabel: "Löschen",
    }))) return;
    const { error } = await supabase.from("safety_evaluations").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
    } else {
      toast({ title: "Evaluierung gelöscht" });
      navigate("/safety");
    }
  };

  const handleSaveEmployees = async () => {
    if (!id) return;
    setSaving(true);

    // Remove all existing
    await supabase.from("safety_evaluation_employees").delete().eq("evaluation_id", id);

    // Insert new
    if (editEmployeeIds.length > 0) {
      const inserts = editEmployeeIds.map((uid) => ({
        evaluation_id: id,
        user_id: uid,
      }));
      await supabase.from("safety_evaluation_employees").insert(inserts);
    }

    toast({ title: "Mitarbeiter aktualisiert" });
    setShowEmployeeEditor(false);
    setSaving(false);
    fetchData();
  };

  const handleCheckComplete = async () => {
    // Auto-close if all signed
    if (signatures.length >= employees.length && employees.length > 0) {
      await supabase.from("safety_evaluations").update({ status: "abgeschlossen" }).eq("id", id);
      toast({ title: "Evaluierung abgeschlossen" });
      setEvaluation((prev: any) => ({ ...prev, status: "abgeschlossen" }));
    }
  };

  const handleExportPDF = () => {
    if (!evaluation) return;
    generateSafetyEvaluationPDF({
      titel: evaluation.titel,
      typ: evaluation.typ,
      kategorie: evaluation.kategorie,
      projektName: projectName,
      status: evaluation.status,
      created_at: evaluation.created_at,
      checklistItems,
      answers,
      diskussionNotizen,
      signatures,
      employees,
      modul: evaluation.modul,
      jahr: evaluation.jahr,
      equipmentName,
      fragen: Array.isArray(evaluation.fragen) ? evaluation.fragen : [],
    });
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p>Lade...</p></div>;
  if (!evaluation) return <div className="flex items-center justify-center min-h-screen"><p>Nicht gefunden</p></div>;

  // Header-Beschriftung: Modul-spezifisch, mit nur den Feldern die tatsaechlich
  // gesetzt sind. Vorher zeigte z.B. eine Jahresunterweisung "Sicherheits-
  // unterweisung · " (leerer Projekt-Slot mit haengendem Trennzeichen).
  const modulLabel = evaluation.modul
    ? (MODUL_LABELS[evaluation.modul] || evaluation.modul)
    : (evaluation.typ === "evaluierung" ? "Evaluierung" : "Sicherheitsunterweisung");
  const headerParts = [modulLabel];
  if (evaluation.jahr) headerParts.push(String(evaluation.jahr));
  if (equipmentName) headerParts.push(equipmentName);
  if (projectName) headerParts.push(projectName);
  if (evaluation.kategorie) headerParts.push(evaluation.kategorie);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/safety")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{evaluation.titel}</h1>
          <p className="text-sm text-muted-foreground">
            {headerParts.join(" · ")}
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-1" />
            Löschen
          </Button>
        )}
        {status === "abgeschlossen" && (
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-1" />
            PDF
          </Button>
        )}
        <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
      </div>

      <Tabs defaultValue="checklist">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="checklist">Checkliste</TabsTrigger>
          <TabsTrigger value="signatures">
            Unterschriften ({signatures.length}/{employees.length})
          </TabsTrigger>
        </TabsList>

        {/* Checklist Tab */}
        <TabsContent value="checklist" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg">Checkliste</CardTitle>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => setShowExcelImport(true)}>
                    <FileSpreadsheet className="w-4 h-4 mr-1" />
                    Excel importieren
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Hinweis-Banner: bereits Unterschriebene werden NICHT erneut
                  zur Bestätigung gezwungen. Admin soll wissen, was er tut. */}
              {canEdit && signatures.length > 0 && (
                <div className="mb-3 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>{signatures.length} Mitarbeiter haben bereits unterschrieben</strong>
                    {": "}{signatures.map((s) => s.unterschrift_name).join(", ")}.
                    {" "}Nachträgliche Änderungen werden nicht erneut bestätigt.
                  </div>
                </div>
              )}

              <SafetyChecklistEditor
                items={checklistItems}
                answers={answers}
                onChange={setAnswers}
                readOnly={true}
              />

              {/* Per-Punkt Loeschen (nur im Edit-Mode) */}
              {canEdit && checklistItems.length > 0 && (
                <div className="mt-3 border-t pt-3 space-y-1">
                  <Label className="text-xs text-muted-foreground">Punkte verwalten</Label>
                  {checklistItems.map((item) => (
                    <div key={`mgr-${item.id}`} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 w-24 truncate">{item.category || "Allgemein"}</span>
                      <span className="flex-1 truncate">{item.question}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0 text-destructive"
                        onClick={() => removeChecklistItem(item.id)}
                        title="Punkt entfernen"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Neuen Punkt manuell hinzufuegen (analog Anlege-Dialog) */}
              {canEdit && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  <Label className="text-xs">Prüfpunkt hinzufügen</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newItemKategorie}
                      onChange={(e) => setNewItemKategorie(e.target.value)}
                      placeholder="Kategorie"
                      className="w-28 text-sm"
                    />
                    <Input
                      value={newItemFrage}
                      onChange={(e) => setNewItemFrage(e.target.value)}
                      placeholder="Neuer Prüfpunkt…"
                      className="flex-1 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && addManualItem()}
                    />
                    <Button size="sm" variant="outline" onClick={addManualItem} disabled={!newItemFrage.trim()}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {canEdit && checklistItems.length > 0 && (
                <div className="flex justify-end mt-4">
                  <Button onClick={handleSaveChecklistStructure} disabled={saving}>
                    <Save className="w-4 h-4 mr-1" />
                    {saving ? "Speichert..." : "Checkliste speichern"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Employee management */}
          {canEdit && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Beteiligte Mitarbeiter ({employees.length})</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditEmployeeIds(employeeIds); setShowEmployeeEditor(!showEmployeeEditor); }}
                  >
                    {showEmployeeEditor ? "Abbrechen" : "Bearbeiten"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showEmployeeEditor ? (
                  <div className="space-y-3">
                    <SafetyEmployeeSelector
                      selectedIds={editEmployeeIds}
                      onChange={setEditEmployeeIds}
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={handleSaveEmployees} disabled={saving}>
                        {saving ? "Speichert..." : "Mitarbeiter speichern"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {employees.map((emp) => (
                      <Badge key={emp.id} variant="outline" className="text-xs">
                        {emp.vorname} {emp.nachname}
                      </Badge>
                    ))}
                    {employees.length === 0 && (
                      <p className="text-sm text-muted-foreground">Keine Mitarbeiter zugewiesen</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Signatures Tab */}
        <TabsContent value="signatures" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <SafetySignatureCollector
                evaluationId={id!}
                employees={employees}
                signatures={signatures}
                currentUserId={userId}
                onSignatureAdded={() => {
                  fetchData();
                  handleCheckComplete();
                }}
              />

              {/* Personal answers per employee */}
              {signatures.some((s) => s.personal_answers && s.personal_answers.length > 0) && (
                <div className="mt-6 space-y-4">
                  <h4 className="text-sm font-semibold">Abgehakte Punkte pro Mitarbeiter</h4>
                  {signatures.map((sig) => {
                    const answers = sig.personal_answers || [];
                    const checkedAnswers = answers.filter((a) => a.checked);
                    if (checkedAnswers.length === 0) return null;
                    return (
                      <div key={sig.id} className="border rounded-md p-3 space-y-1">
                        <p className="text-sm font-medium">{sig.unterschrift_name}</p>
                        <p className="text-xs text-muted-foreground mb-2">
                          {checkedAnswers.length} von {answers.length} Punkten abgehakt
                        </p>
                        {checkedAnswers.map((a) => {
                          const item = checklistItems.find((i) => i.id === a.item_id);
                          return (
                            <div key={a.item_id} className="flex items-start gap-2 text-xs">
                              <span className="text-green-600 shrink-0">✓</span>
                              <span>{item?.question || a.item_id}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Excel Import Dialog */}
      <SafetyExcelImportDialog
        open={showExcelImport}
        onOpenChange={setShowExcelImport}
        onImport={(items) => {
          setChecklistItems(items);
          setShowExcelImport(false);
        }}
      />
    </div>
  );
}
