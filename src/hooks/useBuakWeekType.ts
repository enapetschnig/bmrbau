import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getBuakWeekTypeFallback,
  type BuakWeekType,
} from "@/lib/workingHours";

/**
 * Liest den BUAK-Wochentyp-Kalender einmal (pro Jahr) aus Supabase und legt
 * ein einfaches In-Memory-Cache an. Wenn ein Eintrag fehlt, wird der
 * Regel-Fallback (gerade KW = lang, ungerade = kurz) verwendet.
 *
 * Fuer Schreibzugriffe gibt es die exportierte Funktion
 * `setBuakWeekTypeForWeek()` — sie persistiert den Wochentyp fuer die ganze
 * KW und invalidiert den Cache.
 */

type CachedEntry = { week_type: BuakWeekType; notiz: string | null; is_manual: boolean };
type YearMap = Map<string, CachedEntry>;

const cache = new Map<number, YearMap>();
const listeners = new Set<(year: number) => void>();

function keyOf(year: number, kw: number): string {
  return `${year}-${kw}`;
}

function isoYearWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

async function loadYear(year: number): Promise<YearMap> {
  const cached = cache.get(year);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("buak_week_calendar")
    .select("year, kw, week_type, notiz, is_manual")
    .eq("year", year);

  const map: YearMap = new Map();
  if (!error && data) {
    for (const row of data as Array<{ year: number; kw: number; week_type: BuakWeekType; notiz: string | null; is_manual: boolean | null }>) {
      map.set(keyOf(row.year, row.kw), {
        week_type: row.week_type,
        notiz: row.notiz ?? null,
        is_manual: row.is_manual ?? false,
      });
    }
  }
  cache.set(year, map);
  return map;
}

export function invalidateBuakCalendarCache(year?: number) {
  if (typeof year === "number") {
    cache.delete(year);
    listeners.forEach((fn) => fn(year));
  } else {
    const years = Array.from(cache.keys());
    cache.clear();
    years.forEach((y) => listeners.forEach((fn) => fn(y)));
  }
}

/**
 * Setzt den Wochentyp fuer eine bestimmte ISO-KW. Macht einen UPSERT in die
 * Tabelle; der Trigger aus Migration 20260420100000 kuemmert sich um
 * is_manual, updated_by und updated_at.
 *
 * Gibt ein Error-Objekt zurueck falls etwas schiefgeht (z. B. RLS).
 */
export async function setBuakWeekTypeForWeek(
  year: number,
  kw: number,
  weekType: BuakWeekType,
  notiz: string | null = null,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("buak_week_calendar")
    .upsert(
      { year, kw, week_type: weekType, notiz },
      { onConflict: "year,kw" },
    );
  if (error) {
    return { error: new Error(error.message) };
  }
  invalidateBuakCalendarCache(year);
  return { error: null };
}

export function useBuakWeekType(date: Date | string | null) {
  const parsed = date ? (typeof date === "string" ? new Date(date) : date) : null;
  const { year, week } = parsed ? isoYearWeek(parsed) : { year: 0, week: 0 };

  const [state, setState] = useState<{
    weekType: BuakWeekType;
    notiz: string | null;
    isManual: boolean;
    isLoading: boolean;
  }>(() => {
    if (!parsed) return { weekType: "lang", notiz: null, isManual: false, isLoading: false };
    const cached = cache.get(year)?.get(keyOf(year, week));
    return {
      weekType: cached?.week_type ?? getBuakWeekTypeFallback(parsed),
      notiz: cached?.notiz ?? null,
      isManual: cached?.is_manual ?? false,
      isLoading: !cached,
    };
  });

  useEffect(() => {
    if (!parsed) return;
    let cancelled = false;

    (async () => {
      const map = await loadYear(year);
      if (cancelled) return;
      const entry = map.get(keyOf(year, week));
      setState({
        weekType: entry?.week_type ?? getBuakWeekTypeFallback(parsed),
        notiz: entry?.notiz ?? null,
        isManual: entry?.is_manual ?? false,
        isLoading: false,
      });
    })();

    const onInvalidate = (changedYear: number) => {
      if (changedYear !== year) return;
      (async () => {
        const map = await loadYear(year);
        if (cancelled) return;
        const entry = map.get(keyOf(year, week));
        setState({
          weekType: entry?.week_type ?? getBuakWeekTypeFallback(parsed),
          notiz: entry?.notiz ?? null,
          isManual: entry?.is_manual ?? false,
          isLoading: false,
        });
      })();
    };
    listeners.add(onInvalidate);

    return () => {
      cancelled = true;
      listeners.delete(onInvalidate);
    };
  }, [year, week, parsed?.getTime()]);

  return {
    year,
    kw: week,
    weekType: state.weekType,
    weekLabel: state.weekType === "lang" ? "Lange Woche (Mo–Fr)" : "Kurze Woche (Mo–Do)",
    notiz: state.notiz,
    isManual: state.isManual,
    isLoading: state.isLoading,
  };
}
