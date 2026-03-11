import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, Users, ArrowLeft } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface ExternalEmployee {
  userId: string;
  vorname: string;
  nachname: string;
}

interface ExternalTimeEntry {
  id: string;
  userId: string;
  employeeName: string;
  datum: string;
  taetigkeit: string;
  projectName: string | null;
  stunden: number;
  kilometer: number;
}

interface EmployeeSummary {
  userId: string;
  name: string;
  totalHours: number;
  totalKm: number;
  projectBreakdown: Record<string, { hours: number; km: number }>;
}

const monthNames = [
  "Jänner", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

interface ExternalHoursReportProps {
  onBack: () => void;
}

export default function ExternalHoursReport({ onBack }: ExternalHoursReportProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [externalEmployees, setExternalEmployees] = useState<ExternalEmployee[]>([]);
  const [entries, setEntries] = useState<ExternalTimeEntry[]>([]);
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  useEffect(() => {
    fetchExternalEmployees();
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [month, year, externalEmployees]);

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("id, name");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(p => { map[p.id] = p.name; });
      setProjects(map);
    }
  };

  const fetchExternalEmployees = async () => {
    const { data: empData } = await supabase
      .from("employees")
      .select("user_id, vorname, nachname, is_external, kategorie")
      .or("is_external.eq.true,kategorie.eq.extern");

    if (!empData) return;

    const employees: ExternalEmployee[] = [];
    for (const emp of empData) {
      if (emp.user_id) {
        employees.push({
          userId: emp.user_id,
          vorname: emp.vorname || "",
          nachname: emp.nachname || "",
        });
      }
    }
    setExternalEmployees(employees);
  };

  const fetchEntries = async () => {
    if (externalEmployees.length === 0) { setLoading(false); return; }

    setLoading(true);
    const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];
    const extIds = externalEmployees.map(e => e.userId);

    const { data, error } = await supabase
      .from("time_entries")
      .select("id, datum, stunden, taetigkeit, project_id, user_id, kilometer")
      .in("user_id", extIds)
      .gte("datum", startDate)
      .lte("datum", endDate)
      .order("datum", { ascending: true });

    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: "Einträge konnten nicht geladen werden" });
      setLoading(false);
      return;
    }

    if (data) {
      const mapped: ExternalTimeEntry[] = data.map(entry => {
        const emp = externalEmployees.find(e => e.userId === entry.user_id);
        return {
          id: entry.id,
          userId: entry.user_id,
          employeeName: emp ? `${emp.vorname} ${emp.nachname}` : "Unbekannt",
          datum: entry.datum,
          taetigkeit: entry.taetigkeit || "",
          projectName: entry.project_id ? (projects[entry.project_id] || "Unbekanntes Projekt") : null,
          stunden: Number(entry.stunden),
          kilometer: Number(entry.kilometer || 0),
        };
      });
      setEntries(mapped);
      buildSummaries(mapped);
    }
    setLoading(false);
  };

  const buildSummaries = (data: ExternalTimeEntry[]) => {
    const map: Record<string, EmployeeSummary> = {};
    for (const entry of data) {
      if (!map[entry.userId]) {
        map[entry.userId] = {
          userId: entry.userId,
          name: entry.employeeName,
          totalHours: 0,
          totalKm: 0,
          projectBreakdown: {},
        };
      }
      const s = map[entry.userId];
      s.totalHours += entry.stunden;
      s.totalKm += entry.kilometer;
      const projKey = entry.projectName || "Ohne Projekt";
      if (!s.projectBreakdown[projKey]) s.projectBreakdown[projKey] = { hours: 0, km: 0 };
      s.projectBreakdown[projKey].hours += entry.stunden;
      s.projectBreakdown[projKey].km += entry.kilometer;
    }
    setSummaries(Object.values(map).sort((a, b) => a.name.localeCompare(b.name)));
  };

  const filteredEntries = selectedUserId === "all" ? entries : entries.filter(e => e.userId === selectedUserId);
  const filteredSummaries = selectedUserId === "all" ? summaries : summaries.filter(s => s.userId === selectedUserId);
  const grandTotalHours = filteredSummaries.reduce((sum, s) => sum + s.totalHours, 0);
  const grandTotalKm = filteredSummaries.reduce((sum, s) => sum + s.totalKm, 0);

  const exportToExcel = () => {
    const rows: (string | number)[][] = [
      ["Externe Mitarbeiter — Stundenauswertung", "", "", "", ""],
      [`${monthNames[month - 1]} ${year}`, "", "", "", ""],
      [],
      ["Mitarbeiter", "Datum", "Projekt", "Tätigkeit", "Stunden", "Kilometer"],
    ];

    for (const summary of filteredSummaries) {
      const empEntries = filteredEntries.filter(e => e.userId === summary.userId);
      for (const entry of empEntries) {
        rows.push([
          summary.name,
          format(parseISO(entry.datum), "dd.MM.yyyy"),
          entry.projectName || "–",
          entry.taetigkeit || "–",
          entry.stunden,
          entry.kilometer,
        ]);
      }
      rows.push(["", "", "", "Summe " + summary.name, summary.totalHours, summary.totalKm]);
      rows.push([]);
    }

    rows.push(["", "", "", "GESAMT", grandTotalHours, grandTotalKm]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 10 }, { wch: 12 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Externe Mitarbeiter");
    XLSX.writeFile(wb, `Externe_Mitarbeiter_${monthNames[month - 1]}_${year}.xlsx`);
    toast({ title: "Excel exportiert", description: "Datei wurde heruntergeladen" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-3xl font-bold">Externe Mitarbeiter — Auswertung</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                Stundenauswertung Externe Mitarbeiter
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Stunden und Kilometer pro externem Mitarbeiter und Projekt
              </CardDescription>
            </div>
            <Button onClick={exportToExcel} disabled={filteredEntries.length === 0} className="h-11">
              <Download className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Excel exportieren</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Mitarbeiter auswählen" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">Alle externen Mitarbeiter</SelectItem>
                {externalEmployees.map(emp => (
                  <SelectItem key={emp.userId} value={emp.userId}>
                    {emp.vorname} {emp.nachname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {monthNames.map((name, i) => (
                  <SelectItem key={i} value={(i + 1).toString()}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Lädt...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Keine Einträge für den ausgewählten Zeitraum
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary per employee */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Gesamtstunden</p>
                    <p className="text-2xl font-bold">{grandTotalHours.toFixed(2)} h</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gesamt Kilometer</p>
                    <p className="text-2xl font-bold">{grandTotalKm.toFixed(1)} km</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Externe Mitarbeiter</p>
                    <p className="text-2xl font-bold">{filteredSummaries.length}</p>
                  </div>
                </div>
              </div>

              {/* Detailed table per employee */}
              {filteredSummaries.map(summary => (
                <Card key={summary.userId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{summary.name}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {summary.totalHours.toFixed(2)} h | {summary.totalKm.toFixed(1)} km
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Datum</TableHead>
                            <TableHead>Projekt</TableHead>
                            <TableHead>Tätigkeit</TableHead>
                            <TableHead className="text-right">Stunden</TableHead>
                            <TableHead className="text-right">km</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEntries
                            .filter(e => e.userId === summary.userId)
                            .map(entry => (
                              <TableRow key={entry.id}>
                                <TableCell className="font-mono text-xs">
                                  {format(parseISO(entry.datum), "dd.MM.yyyy")}
                                </TableCell>
                                <TableCell>{entry.projectName || "–"}</TableCell>
                                <TableCell>{entry.taetigkeit || "–"}</TableCell>
                                <TableCell className="text-right font-medium">{entry.stunden.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{entry.kilometer > 0 ? entry.kilometer.toFixed(1) : "–"}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={3} className="font-medium">Summe</TableCell>
                            <TableCell className="text-right font-bold">{summary.totalHours.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-bold">{summary.totalKm.toFixed(1)}</TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>

                    {/* Project breakdown */}
                    {Object.keys(summary.projectBreakdown).length > 1 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Nach Projekt:</p>
                        <div className="grid gap-1">
                          {Object.entries(summary.projectBreakdown).map(([proj, data]) => (
                            <div key={proj} className="flex items-center justify-between text-sm">
                              <span className="truncate">{proj}</span>
                              <span className="font-medium shrink-0 ml-2">{data.hours.toFixed(2)} h</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
