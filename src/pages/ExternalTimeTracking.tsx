import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Trash2, Pencil, Calendar, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Project = {
  id: string;
  name: string;
  plz: string;
};

type ExistingEntry = {
  id: string;
  stunden: number;
  taetigkeit: string;
  project_name: string | null;
  project_id: string | null;
  kilometer: number | null;
};

const ExternalTimeTracking = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [existingDayEntries, setExistingDayEntries] = useState<ExistingEntry[]>([]);
  const [loadingDayEntries, setLoadingDayEntries] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [projectId, setProjectId] = useState("");
  const [taetigkeit, setTaetigkeit] = useState("");
  const [stunden, setStunden] = useState("");
  const [kilometer, setKilometer] = useState("");

  // Verify user is external
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await supabase
        .from("employees")
        .select("is_external, kategorie")
        .eq("user_id", user.id)
        .single();
      if (!data || (data.is_external !== true && data.kategorie !== "extern")) {
        navigate("/");
        return;
      }
      setLoading(false);
    };
    checkAccess();
  }, [navigate]);

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name, plz, status")
      .in("status", ["aktiv", "in_planung"])
      .order("name");
    if (data) setProjects(data.map(p => ({ id: p.id, name: p.name, plz: p.plz || "" })));
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const fetchExistingDayEntries = useCallback(async (date: string) => {
    setLoadingDayEntries(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingDayEntries(false); return; }

    const { data } = await supabase
      .from("time_entries")
      .select("id, stunden, taetigkeit, project_id, kilometer")
      .eq("user_id", user.id)
      .eq("datum", date)
      .order("created_at", { ascending: true });

    if (data) {
      const entries: ExistingEntry[] = [];
      for (const entry of data) {
        let projectName: string | null = null;
        if (entry.project_id) {
          const proj = projects.find(p => p.id === entry.project_id);
          projectName = proj ? proj.name : null;
        }
        entries.push({
          id: entry.id,
          stunden: entry.stunden,
          taetigkeit: entry.taetigkeit,
          project_id: entry.project_id,
          project_name: projectName,
          kilometer: entry.kilometer,
        });
      }
      setExistingDayEntries(entries);
    }
    setLoadingDayEntries(false);
  }, [projects]);

  useEffect(() => {
    if (!loading && projects.length >= 0) {
      fetchExistingDayEntries(selectedDate);
    }
  }, [selectedDate, loading, projects, fetchExistingDayEntries]);

  const resetForm = () => {
    setProjectId("");
    setTaetigkeit("");
    setStunden("");
    setKilometer("");
    setEditMode(false);
    setEditingEntryId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const hours = parseFloat(stunden);
    if (!hours || hours <= 0) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Gesamtstunden eingeben" });
      setSaving(false);
      return;
    }

    if (editMode && editingEntryId) {
      const { error } = await supabase
        .from("time_entries")
        .update({
          project_id: projectId || null,
          taetigkeit: taetigkeit || "",
          stunden: hours,
          kilometer: kilometer ? parseFloat(kilometer) : null,
        })
        .eq("id", editingEntryId);

      if (error) {
        toast({ variant: "destructive", title: "Fehler", description: "Eintrag konnte nicht aktualisiert werden" });
        setSaving(false);
        return;
      }
      toast({ title: "Erfolg", description: "Eintrag aktualisiert" });
    } else {
      const { error } = await supabase.from("time_entries").insert({
        user_id: user.id,
        datum: selectedDate,
        project_id: projectId || null,
        taetigkeit: taetigkeit || "",
        stunden: hours,
        start_time: null,
        end_time: null,
        pause_minutes: 0,
        location_type: "baustelle",
        notizen: null,
        week_type: null,
        kilometer: kilometer ? parseFloat(kilometer) : null,
        km_beschreibung: null,
        zeit_typ: "normal",
        diaeten_typ: null,
        diaeten_betrag: 0,
      });

      if (error) {
        toast({ variant: "destructive", title: "Fehler", description: "Eintrag konnte nicht gespeichert werden" });
        setSaving(false);
        return;
      }
      toast({ title: "Erfolg", description: "Stunden erfasst" });
    }

    resetForm();
    await fetchExistingDayEntries(selectedDate);
    setSaving(false);
  };

  const handleEdit = (entry: ExistingEntry) => {
    setEditMode(true);
    setEditingEntryId(entry.id);
    setProjectId(entry.project_id || "");
    setTaetigkeit(entry.taetigkeit || "");
    setStunden(entry.stunden.toString());
    setKilometer(entry.kilometer ? entry.kilometer.toString() : "");
  };

  const handleDelete = async (entryId: string) => {
    const { error } = await supabase.from("time_entries").delete().eq("id", entryId);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: "Eintrag konnte nicht gelöscht werden" });
      return;
    }
    toast({ title: "Gelöscht", description: "Eintrag wurde entfernt" });
    await fetchExistingDayEntries(selectedDate);
    if (editingEntryId === entryId) resetForm();
  };

  if (loading) return <div className="p-4">Lädt...</div>;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Zeiterfassung" />

      <div className="p-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <CardTitle>Arbeitszeit erfassen</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Datum */}
              <div className="space-y-2">
                <Label htmlFor="date">Datum</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { if (!editMode) setSelectedDate(e.target.value); }}
                  disabled={editMode}
                  required
                />
                {selectedDate && (
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedDate), "EEEE, dd. MMMM yyyy", { locale: de })}
                  </p>
                )}
              </div>

              {/* Existing entries */}
              {!editMode && (loadingDayEntries ? (
                <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 animate-pulse" />
                  Lade Tageseinträge...
                </div>
              ) : existingDayEntries.length > 0 ? (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-amber-700 dark:text-amber-300">Bereits gebuchte Zeiten</span>
                  </div>
                  <div className="space-y-1.5">
                    {existingDayEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between text-sm bg-background/60 rounded px-2 py-1.5">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="truncate">
                            {entry.project_name || entry.taetigkeit || "–"}
                          </span>
                          {entry.kilometer && entry.kilometer > 0 && (
                            <Badge variant="outline" className="text-xs shrink-0">{entry.kilometer} km</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-medium">{Number(entry.stunden).toFixed(2)}h</span>
                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(entry)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(entry.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-amber-200 dark:border-amber-700">
                    <span className="text-sm font-medium">Tagessumme</span>
                    <span className="font-bold">
                      {existingDayEntries.reduce((sum, e) => sum + Number(e.stunden), 0).toFixed(2)} Stunden
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Noch keine Einträge für diesen Tag
                  </p>
                </div>
              ))}

              {/* Edit mode banner */}
              {editMode && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                    <Pencil className="w-4 h-4" />
                    Eintrag bearbeiten
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetForm}>Abbrechen</Button>
                </div>
              )}

              {/* Form fields */}
              <div className="border rounded-lg p-4 space-y-4 bg-card">
                {/* Baustelle / Projekt */}
                <div className="space-y-2">
                  <Label>Baustelle / Projekt</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger><SelectValue placeholder="Projekt auswählen" /></SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}{p.plz ? ` (${p.plz})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tätigkeit */}
                <div className="space-y-2">
                  <Label>Tätigkeit</Label>
                  <Input
                    value={taetigkeit}
                    onChange={(e) => setTaetigkeit(e.target.value)}
                    placeholder="z.B. Montage, Aufmaß..."
                  />
                </div>

                {/* Gesamtstunden */}
                <div className="space-y-2">
                  <Label>Gesamtstunden *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.25"
                    value={stunden}
                    onChange={(e) => setStunden(e.target.value)}
                    placeholder="z.B. 8"
                    required
                  />
                </div>

                {/* Kilometer */}
                <div className="space-y-2">
                  <Label>Gefahrene Kilometer</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={kilometer}
                    onChange={(e) => setKilometer(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-2">
                {editMode && (
                  <Button type="button" variant="outline" className="flex-1" onClick={resetForm} disabled={saving}>
                    Abbrechen
                  </Button>
                )}
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving
                    ? "Wird gespeichert..."
                    : editMode
                      ? "Änderungen speichern"
                      : "Stunden erfassen"
                  }
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExternalTimeTracking;
