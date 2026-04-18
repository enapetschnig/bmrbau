import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invalidateBuakCalendarCache } from "@/hooks/useBuakWeekType";
import { getBuakWeekTypeFallback, type BuakWeekType } from "@/lib/workingHours";
import { Calendar } from "lucide-react";

type CalendarRow = {
  year: number;
  kw: number;
  week_type: BuakWeekType;
  notiz: string | null;
};

function mondayOfIsoWeek(year: number, week: number): Date {
  // 4. Januar des Jahres liegt immer in KW 1 (ISO)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

function formatDateRange(year: number, week: number): string {
  const mo = mondayOfIsoWeek(year, week);
  const fr = new Date(mo);
  fr.setUTCDate(mo.getUTCDate() + 4);
  const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.`;
  return `${fmt(mo)} – ${fmt(fr)}`;
}

function maxIsoWeek(year: number): number {
  // Robuste ISO-KW-Anzahl: 28. Dezember liegt immer in der letzten ISO-KW des Jahres.
  const dec28 = new Date(Date.UTC(year, 11, 28));
  const day = dec28.getUTCDay() || 7;
  const thursday = new Date(dec28);
  thursday.setUTCDate(dec28.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default function BuakCalendarAdmin() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [rows, setRows] = useState<Map<number, CalendarRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const weeks = useMemo(() => Array.from({ length: maxIsoWeek(year) }, (_, i) => i + 1), [year]);

  const load = async (y: number) => {
    setLoading(true);
    const { data } = await supabase
      .from("buak_week_calendar")
      .select("year, kw, week_type, notiz")
      .eq("year", y)
      .order("kw");
    const map = new Map<number, CalendarRow>();
    (data || []).forEach((r) => map.set(r.kw, r as CalendarRow));
    setRows(map);
    setLoading(false);
  };

  useEffect(() => {
    load(year);
  }, [year]);

  const upsert = async (kw: number, patch: Partial<Pick<CalendarRow, "week_type" | "notiz">>) => {
    const existing = rows.get(kw) || { year, kw, week_type: getBuakWeekTypeFallback(mondayOfIsoWeek(year, kw)), notiz: null };
    const next = { ...existing, ...patch };
    setRows((prev) => new Map(prev).set(kw, next));
    setSaving(kw);
    const { error } = await supabase
      .from("buak_week_calendar")
      .upsert({ year: next.year, kw: next.kw, week_type: next.week_type, notiz: next.notiz ?? null }, { onConflict: "year,kw" });
    setSaving(null);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      load(year);
      return;
    }
    invalidateBuakCalendarCache(year);
  };

  const applyRule = async () => {
    const payload = weeks.map((kw) => ({
      year,
      kw,
      week_type: (kw % 2 === 0 ? "lang" : "kurz") as BuakWeekType,
    }));
    const { error } = await supabase
      .from("buak_week_calendar")
      .upsert(payload, { onConflict: "year,kw" });
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    invalidateBuakCalendarCache(year);
    await load(year);
    toast({ title: "Regel angewendet", description: "Gerade KW = lang, ungerade KW = kurz." });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="BUAK-Kalender" />
      <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-5xl">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Wochenkalender {year}
            </CardTitle>
            <CardDescription>
              Legt pro Kalenderwoche fest, ob eine <strong>lange Woche</strong> (Mo–Fr mit Freitag) oder
              eine <strong>kurze Woche</strong> (Mo–Do, Fr frei) gearbeitet wird. Bei fehlendem Eintrag
              gilt automatisch: gerade KW = lang, ungerade KW = kurz.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div>
              <Label>Jahr</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={applyRule}>
              Regel anwenden (gerade = lang)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-6 text-muted-foreground">Lade…</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">KW</TableHead>
                    <TableHead className="w-36">Zeitraum</TableHead>
                    <TableHead className="w-40">Typ</TableHead>
                    <TableHead>Notiz (z. B. Feiertag)</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeks.map((kw) => {
                    const row = rows.get(kw);
                    const weekType = row?.week_type ?? getBuakWeekTypeFallback(mondayOfIsoWeek(year, kw));
                    return (
                      <TableRow key={kw}>
                        <TableCell className="font-medium">KW {kw}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateRange(year, kw)}</TableCell>
                        <TableCell>
                          <Select
                            value={weekType}
                            onValueChange={(v: BuakWeekType) => upsert(kw, { week_type: v })}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lang">Lange Woche</SelectItem>
                              <SelectItem value="kurz">Kurze Woche</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            defaultValue={row?.notiz || ""}
                            placeholder="z. B. Christi Himmelfahrt · Fenstertag"
                            onBlur={(e) => {
                              const v = e.target.value.trim() || null;
                              if ((row?.notiz ?? null) !== v) upsert(kw, { notiz: v });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {saving === kw ? (
                            <Badge variant="outline" className="text-xs">…</Badge>
                          ) : row ? (
                            <Badge variant="secondary" className="text-xs">✓</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">auto</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
