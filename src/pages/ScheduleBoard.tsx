import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays, Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfISOWeek,
  addDays,
  addWeeks,
  subWeeks,
  getISOWeek,
  format,
  isSameDay,
} from "date-fns";
import { de } from "date-fns/locale";

type Profile = { id: string; vorname: string; nachname: string };
type Project = { id: string; name: string };
type Assignment = {
  id: string;
  user_id: string;
  project_id: string;
  datum: string;
  notizen: string | null;
};
type Resource = {
  id: string;
  project_id: string;
  datum: string;
  resource_name: string;
  menge: number | null;
  einheit: string | null;
};
type DailyTarget = {
  id: string;
  project_id: string;
  datum: string;
  tagesziel: string | null;
  nachkalkulation_stunden: number | null;
  notizen: string | null;
};

const PROJECT_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-300",
  "bg-green-100 text-green-800 border-green-300",
  "bg-amber-100 text-amber-800 border-amber-300",
  "bg-purple-100 text-purple-800 border-purple-300",
  "bg-rose-100 text-rose-800 border-rose-300",
  "bg-cyan-100 text-cyan-800 border-cyan-300",
  "bg-orange-100 text-orange-800 border-orange-300",
  "bg-indigo-100 text-indigo-800 border-indigo-300",
];

const RESOURCE_SUGGESTIONS = ["Bagger", "Kran", "LKW", "Betonmischer", "Schalung", "Rüttler", "Pumpe"];

function getProjectColor(projectId: string): string {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = ((hash << 5) - hash + projectId.charCodeAt(i)) | 0;
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

export default function ScheduleBoard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [weekStart, setWeekStart] = useState(() => startOfISOWeek(new Date()));
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTarget[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 4);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
    setUserId(user.id);

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const admin = roleData?.role === "administrator";
    setIsAdmin(admin);

    if (!admin) { navigate("/"); return; }

    const fromDate = format(weekStart, "yyyy-MM-dd");
    const toDate = format(weekEnd, "yyyy-MM-dd");

    const [{ data: profs }, { data: projs }, { data: assigns }, { data: res }, { data: targets }] = await Promise.all([
      supabase.from("profiles").select("id, vorname, nachname").eq("is_active", true).order("nachname"),
      supabase.from("projects").select("id, name").eq("status", "aktiv").order("name"),
      supabase.from("worker_assignments").select("id, user_id, project_id, datum, notizen").gte("datum", fromDate).lte("datum", toDate),
      supabase.from("assignment_resources").select("id, project_id, datum, resource_name, menge, einheit").gte("datum", fromDate).lte("datum", toDate),
      supabase.from("project_daily_targets").select("id, project_id, datum, tagesziel, nachkalkulation_stunden, notizen").gte("datum", fromDate).lte("datum", toDate),
    ]);

    if (profs) setProfiles(profs);
    if (projs) setProjects(projs);
    if (assigns) setAssignments(assigns as Assignment[]);
    if (res) setResources(res as Resource[]);
    if (targets) setDailyTargets(targets as DailyTarget[]);

    setLoading(false);
  }, [weekStart, navigate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getAssignment = (uid: string, date: Date): Assignment | undefined =>
    assignments.find(a => a.user_id === uid && isSameDay(new Date(a.datum), date));

  const handleAssign = async (uid: string, date: Date, projectId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const datum = format(date, "yyyy-MM-dd");
    const existing = getAssignment(uid, date);

    if (existing) {
      const { error } = await supabase
        .from("worker_assignments")
        .update({ project_id: projectId })
        .eq("id", existing.id);

      if (error) {
        toast({ variant: "destructive", title: "Fehler", description: error.message });
        return;
      }
      setAssignments(prev => prev.map(a => a.id === existing.id ? { ...a, project_id: projectId } : a));
    } else {
      const { data, error } = await supabase
        .from("worker_assignments")
        .insert({ user_id: uid, project_id: projectId, datum, created_by: user.id })
        .select()
        .single();

      if (error) {
        toast({ variant: "destructive", title: "Fehler", description: error.message });
        return;
      }
      if (data) setAssignments(prev => [...prev, data as Assignment]);
    }
  };

  const handleRemove = async (uid: string, date: Date) => {
    const existing = getAssignment(uid, date);
    if (!existing) return;

    const { error } = await supabase.from("worker_assignments").delete().eq("id", existing.id);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    setAssignments(prev => prev.filter(a => a.id !== existing.id));
  };

  // --- Daily Targets ---
  const getTarget = (projectId: string, datum: string): DailyTarget | undefined =>
    dailyTargets.find(t => t.project_id === projectId && t.datum === datum);

  const upsertTarget = (projectId: string, datum: string, field: keyof DailyTarget, value: string | number | null) => {
    const key = `${projectId}-${datum}`;
    // Optimistic local update
    setDailyTargets(prev => {
      const existing = prev.find(t => t.project_id === projectId && t.datum === datum);
      if (existing) {
        return prev.map(t => t.id === existing.id ? { ...t, [field]: value } : t);
      }
      return [...prev, { id: `temp-${key}`, project_id: projectId, datum, tagesziel: null, nachkalkulation_stunden: null, notizen: null, [field]: value } as DailyTarget];
    });

    // Debounced save
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(async () => {
      const current = dailyTargets.find(t => t.project_id === projectId && t.datum === datum);
      const payload: any = {
        project_id: projectId,
        datum,
        created_by: userId,
        [field]: value,
      };

      if (current && !current.id.startsWith("temp-")) {
        const { error } = await supabase.from("project_daily_targets").update({ [field]: value }).eq("id", current.id);
        if (error) toast({ variant: "destructive", title: "Fehler", description: error.message });
      } else {
        // Merge with any existing temp values
        const tempTarget = dailyTargets.find(t => t.project_id === projectId && t.datum === datum);
        if (tempTarget) {
          payload.tagesziel = tempTarget.tagesziel;
          payload.nachkalkulation_stunden = tempTarget.nachkalkulation_stunden;
          payload.notizen = tempTarget.notizen;
          payload[field] = value;
        }
        const { data, error } = await supabase
          .from("project_daily_targets")
          .upsert(payload, { onConflict: "project_id,datum" })
          .select()
          .single();
        if (error) {
          toast({ variant: "destructive", title: "Fehler", description: error.message });
        } else if (data) {
          setDailyTargets(prev => prev.map(t => (t.project_id === projectId && t.datum === datum) ? data as DailyTarget : t));
        }
      }
    }, 500);
  };

  // --- Resources ---
  const getResources = (projectId: string, datum: string): Resource[] =>
    resources.filter(r => r.project_id === projectId && r.datum === datum);

  const handleAddResource = async (projectId: string, datum: string, resourceName: string) => {
    if (!resourceName.trim()) return;
    const { data, error } = await supabase
      .from("assignment_resources")
      .upsert(
        { project_id: projectId, datum, resource_name: resourceName.trim(), menge: 1, einheit: "Stk", created_by: userId },
        { onConflict: "project_id,datum,resource_name" }
      )
      .select()
      .single();

    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    if (data) {
      setResources(prev => {
        const exists = prev.find(r => r.project_id === projectId && r.datum === datum && r.resource_name === resourceName.trim());
        if (exists) return prev.map(r => r.id === exists.id ? (data as Resource) : r);
        return [...prev, data as Resource];
      });
    }
  };

  const handleUpdateResource = async (id: string, field: "menge" | "einheit", value: number | string | null) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    const { error } = await supabase.from("assignment_resources").update({ [field]: value }).eq("id", id);
    if (error) toast({ variant: "destructive", title: "Fehler", description: error.message });
  };

  const handleDeleteResource = async (id: string) => {
    const { error } = await supabase.from("assignment_resources").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    setResources(prev => prev.filter(r => r.id !== id));
  };

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

  // Compute which projects have assignments this week
  const activeProjectIds = [...new Set(assignments.map(a => a.project_id))];
  const activeProjects = projects.filter(p => activeProjectIds.includes(p.id));

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p>Lade...</p></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Zurück</span>
            </Button>
            <img
              src="/schafferhofer-logo.svg"
              alt="Schafferhofer Bau"
              className="h-10 w-10 sm:h-14 sm:w-14 cursor-pointer hover:opacity-80 transition-opacity object-contain"
              onClick={() => navigate("/")}
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <CalendarDays className="h-7 w-7" />
              Plantafel
            </h1>
            <p className="text-sm text-muted-foreground">Mitarbeiter-Einsatzplanung</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(prev => subWeeks(prev, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfISOWeek(new Date()))}>
              Heute
            </Button>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(prev => addWeeks(prev, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium ml-2">
              KW {getISOWeek(weekStart)} · {format(weekStart, "dd.MM.", { locale: de })} – {format(weekEnd, "dd.MM.yyyy", { locale: de })}
            </span>
          </div>
        </div>

        {/* Worker Assignment Table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px] sticky left-0 bg-card z-10">Mitarbeiter</TableHead>
                {weekDays.map(day => (
                  <TableHead key={day.toISOString()} className="min-w-[140px] text-center">
                    <div>{format(day, "EEEE", { locale: de })}</div>
                    <div className="text-xs font-normal">{format(day, "dd.MM.")}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map(profile => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium sticky left-0 bg-card z-10 whitespace-nowrap">
                    {profile.vorname} {profile.nachname}
                  </TableCell>
                  {weekDays.map(day => {
                    const assignment = getAssignment(profile.id, day);
                    const projectName = assignment ? projectMap[assignment.project_id] : null;
                    const colorClass = assignment ? getProjectColor(assignment.project_id) : "";

                    return (
                      <TableCell key={day.toISOString()} className="p-1 text-center">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className={`w-full min-h-[44px] rounded-md border text-xs font-medium px-2 py-1.5 transition-colors ${
                                assignment
                                  ? `${colorClass} hover:opacity-80`
                                  : "bg-muted/30 border-dashed border-muted-foreground/30 hover:bg-muted/50 text-muted-foreground"
                              }`}
                            >
                              {projectName || "–"}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="start">
                            <div className="space-y-3">
                              <p className="text-sm font-medium">
                                {profile.vorname} {profile.nachname} – {format(day, "EEE dd.MM.", { locale: de })}
                              </p>
                              <Select
                                value={assignment?.project_id || ""}
                                onValueChange={(val) => handleAssign(profile.id, day, val)}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder="Projekt zuweisen" />
                                </SelectTrigger>
                                <SelectContent>
                                  {projects.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {assignment && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleRemove(profile.id, day)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                  Zuweisung entfernen
                                </Button>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {profiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Keine aktiven Mitarbeiter gefunden
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Legend */}
        {projects.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {projects.map(p => (
              <span
                key={p.id}
                className={`text-xs px-2 py-1 rounded border ${getProjectColor(p.id)}`}
              >
                {p.name}
              </span>
            ))}
          </div>
        )}

        {/* Project Details Section */}
        {activeProjects.length > 0 && (
          <div className="mt-8 space-y-3">
            <h2 className="text-lg font-semibold">Projektdetails dieser Woche</h2>

            {activeProjects.map(project => {
              const isExpanded = expandedProjects.has(project.id);
              const workerCount = new Set(
                assignments.filter(a => a.project_id === project.id).map(a => a.user_id)
              ).size;
              const daysWithAssignment = [...new Set(
                assignments.filter(a => a.project_id === project.id).map(a => a.datum)
              )].sort();

              return (
                <Collapsible key={project.id} open={isExpanded} onOpenChange={() => toggleProject(project.id)}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
                        <CardTitle className="flex items-center justify-between text-base">
                          <span className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full border ${getProjectColor(project.id).split(" ").slice(0, 1).join(" ")}`} />
                            {project.name}
                            <span className="text-xs font-normal text-muted-foreground">
                              ({workerCount} MA, {daysWithAssignment.length} Tage)
                            </span>
                          </span>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <Tabs defaultValue={daysWithAssignment[0] || format(weekDays[0], "yyyy-MM-dd")}>
                          <TabsList className="mb-3">
                            {weekDays.map(day => {
                              const datum = format(day, "yyyy-MM-dd");
                              const hasAssignment = daysWithAssignment.includes(datum);
                              return (
                                <TabsTrigger
                                  key={datum}
                                  value={datum}
                                  disabled={!hasAssignment}
                                  className="text-xs"
                                >
                                  {format(day, "EEE dd.", { locale: de })}
                                </TabsTrigger>
                              );
                            })}
                          </TabsList>

                          {weekDays.map(day => {
                            const datum = format(day, "yyyy-MM-dd");
                            const target = getTarget(project.id, datum);
                            const dayResources = getResources(project.id, datum);

                            return (
                              <TabsContent key={datum} value={datum} className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className="text-sm font-medium mb-1 block">Tagesziel</label>
                                    <Textarea
                                      placeholder="Was soll heute erreicht werden?"
                                      rows={2}
                                      value={target?.tagesziel || ""}
                                      onChange={(e) => upsertTarget(project.id, datum, "tagesziel", e.target.value || null)}
                                    />
                                  </div>
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-sm font-medium mb-1 block">Nachkalkulation (Stunden)</label>
                                      <Input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        placeholder="0"
                                        value={target?.nachkalkulation_stunden ?? ""}
                                        onChange={(e) => upsertTarget(project.id, datum, "nachkalkulation_stunden", e.target.value ? parseFloat(e.target.value) : null)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium mb-1 block">Notizen</label>
                                      <Textarea
                                        placeholder="Anmerkungen zum Tag..."
                                        rows={1}
                                        value={target?.notizen || ""}
                                        onChange={(e) => upsertTarget(project.id, datum, "notizen", e.target.value || null)}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Resources */}
                                <div>
                                  <label className="text-sm font-medium mb-2 block">Ressourcen / Geräte</label>
                                  {dayResources.length > 0 && (
                                    <div className="space-y-1.5 mb-2">
                                      {dayResources.map(r => (
                                        <div key={r.id} className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1.5">
                                          <span className="text-sm font-medium flex-1 min-w-0 truncate">{r.resource_name}</span>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="w-16 h-8 text-sm"
                                            value={r.menge ?? ""}
                                            onChange={(e) => handleUpdateResource(r.id, "menge", e.target.value ? parseFloat(e.target.value) : null)}
                                          />
                                          <Input
                                            className="w-20 h-8 text-sm"
                                            value={r.einheit || ""}
                                            placeholder="Einheit"
                                            onChange={(e) => handleUpdateResource(r.id, "einheit", e.target.value)}
                                          />
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0 text-destructive"
                                            onClick={() => handleDeleteResource(r.id)}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <ResourceAdder
                                    existingNames={dayResources.map(r => r.resource_name)}
                                    onAdd={(name) => handleAddResource(project.id, datum, name)}
                                  />
                                </div>
                              </TabsContent>
                            );
                          })}
                        </Tabs>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function ResourceAdder({ existingNames, onAdd }: { existingNames: string[]; onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const available = RESOURCE_SUGGESTIONS.filter(s => !existingNames.includes(s));

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
      setShowSuggestions(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Input
          className="h-8 text-sm"
          placeholder="Ressource hinzufügen..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        {showSuggestions && available.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 bg-popover border rounded-md shadow-md mt-1 py-1 max-h-40 overflow-y-auto">
            {available
              .filter(s => !value || s.toLowerCase().includes(value.toLowerCase()))
              .map(s => (
                <button
                  key={s}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onAdd(s);
                    setValue("");
                    setShowSuggestions(false);
                  }}
                >
                  {s}
                </button>
              ))}
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" className="h-8" onClick={handleAdd} disabled={!value.trim()}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Hinzufügen
      </Button>
    </div>
  );
}
