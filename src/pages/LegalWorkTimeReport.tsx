import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { Download } from "lucide-react";
import { format, getDaysInMonth } from "date-fns";
import { de } from "date-fns/locale";
import * as XLSX from "xlsx-js-style";
import { generateLegalWorkTimePDF } from "@/lib/generateLegalWorkTimePDF";

type Profile = { id: string; vorname: string; nachname: string };

type DayRow = {
  datum: string;
  beginn: string | null;
  ende: string | null;
  pauseMinutes: number;
  arbeitszeit: number;
};

const monthNames = [
  "Jänner", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export default function LegalWorkTimeReport() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedUserId, setSelectedUserId] = useState("");
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch employees (all profiles)
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, vorname, nachname")
        .eq("is_active", true)
        .order("nachname");
      if (data) setEmployees(data);
    };
    fetchEmployees();
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedUserId) {
      setRows([]);
      return;
    }
    setLoading(true);

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const { data } = await supabase
      .from("time_entries")
      .select("datum, start_time, end_time, pause_minutes, stunden")
      .eq("user_id", selectedUserId)
      .gte("datum", startDate)
      .lte("datum", endDate)
      .order("datum")
      .order("start_time");

    // Group by datum
    const grouped: Record<string, { starts: string[]; ends: string[]; pause: number; stunden: number }> = {};
    if (data) {
      for (const entry of data) {
        if (!grouped[entry.datum]) {
          grouped[entry.datum] = { starts: [], ends: [], pause: 0, stunden: 0 };
        }
        grouped[entry.datum].starts.push(entry.start_time);
        grouped[entry.datum].ends.push(entry.end_time);
        grouped[entry.datum].pause += entry.pause_minutes || 0;
        grouped[entry.datum].stunden += entry.stunden || 0;
      }
    }

    // Build rows for each day
    const dayRows: DayRow[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const datum = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const g = grouped[datum];
      if (g) {
        const beginn = g.starts.sort()[0]?.slice(0, 5) || null;
        const ende = g.ends.sort().reverse()[0]?.slice(0, 5) || null;
        dayRows.push({ datum, beginn, ende, pauseMinutes: g.pause, arbeitszeit: Math.round(g.stunden * 100) / 100 });
      } else {
        dayRows.push({ datum, beginn: null, ende: null, pauseMinutes: 0, arbeitszeit: 0 });
      }
    }

    setRows(dayRows);
    setLoading(false);
  }, [selectedUserId, month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalHours = rows.reduce((sum, r) => sum + r.arbeitszeit, 0);
  const totalPause = rows.reduce((sum, r) => sum + r.pauseMinutes, 0);
  const workingDays = rows.filter((r) => r.arbeitszeit > 0).length;

  const selectedEmployee = employees.find((e) => e.id === selectedUserId);
  const employeeName = selectedEmployee ? `${selectedEmployee.vorname} ${selectedEmployee.nachname}` : "";

  const formatPause = (minutes: number) => {
    if (minutes === 0) return "–";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  const handleExportExcel = () => {
    if (!selectedUserId || rows.length === 0) return;

    const wsData = [
      ["Arbeitszeitaufzeichnung"],
      [`Mitarbeiter: ${employeeName}`],
      [`Zeitraum: ${monthNames[month - 1]} ${year}`],
      [],
      ["Datum", "Wochentag", "Arbeitsbeginn", "Arbeitsende", "Pause", "Arbeitszeit (h)"],
    ];

    for (const row of rows) {
      const dayName = format(new Date(row.datum), "EEEE", { locale: de });
      wsData.push([
        format(new Date(row.datum), "dd.MM.yyyy"),
        dayName,
        row.beginn || "",
        row.ende || "",
        row.pauseMinutes > 0 ? formatPause(row.pauseMinutes) : "",
        row.arbeitszeit > 0 ? row.arbeitszeit.toFixed(2) : "",
      ]);
    }

    wsData.push([]);
    wsData.push(["", "", "", "Summe:", formatPause(totalPause), totalHours.toFixed(2)]);
    wsData.push(["", "", "", "Arbeitstage:", "", workingDays.toString()]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws["!cols"] = [
      { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    ];

    // Bold header row
    for (let c = 0; c < 6; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 4, c })];
      if (cell) cell.s = { font: { bold: true } };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Arbeitszeitaufzeichnung");
    XLSX.writeFile(wb, `Arbeitszeitaufzeichnung_${employeeName.replace(/\s/g, "_")}_${monthNames[month - 1]}_${year}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!selectedUserId || rows.length === 0) return;
    generateLegalWorkTimePDF({
      employeeName,
      month: monthNames[month - 1],
      year,
      rows,
      totalHours,
      totalPause,
      workingDays,
    });
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <PageHeader title="Gesetzl. Arbeitszeitaufzeichnung" />

      <p className="text-sm text-muted-foreground mb-6">
        Arbeitszeitaufzeichnung gemäß § 26 AZG — reine Arbeitszeiten ohne Projekt- oder Tätigkeitszuordnung
      </p>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen" /></SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.vorname} {e.nachname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthNames.map((name, i) => (
              <SelectItem key={i} value={(i + 1).toString()}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map((y) => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedUserId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Bitte einen Mitarbeiter auswählen
          </CardContent>
        </Card>
      ) : loading ? (
        <p className="text-center text-muted-foreground py-8">Lade...</p>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Arbeitstage</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-2xl font-bold">{workingDays}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gesamtstunden</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gesamtpause</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-2xl font-bold">{formatPause(totalPause)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <Download className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Beginn</TableHead>
                      <TableHead>Ende</TableHead>
                      <TableHead>Pause</TableHead>
                      <TableHead className="text-right">Arbeitszeit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const date = new Date(row.datum);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      return (
                        <TableRow
                          key={row.datum}
                          className={isWeekend ? "bg-muted/50" : row.arbeitszeit === 0 ? "text-muted-foreground" : ""}
                        >
                          <TableCell className="text-sm">{format(date, "dd.MM.")}</TableCell>
                          <TableCell className="text-sm">{format(date, "EEE", { locale: de })}</TableCell>
                          <TableCell className="text-sm">{row.beginn || "–"}</TableCell>
                          <TableCell className="text-sm">{row.ende || "–"}</TableCell>
                          <TableCell className="text-sm">{row.pauseMinutes > 0 ? formatPause(row.pauseMinutes) : "–"}</TableCell>
                          <TableCell className="text-sm text-right font-medium">
                            {row.arbeitszeit > 0 ? `${row.arbeitszeit.toFixed(2)}h` : "–"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-bold">Summe</TableCell>
                      <TableCell className="font-bold">{formatPause(totalPause)}</TableCell>
                      <TableCell className="text-right font-bold">{totalHours.toFixed(2)}h</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
