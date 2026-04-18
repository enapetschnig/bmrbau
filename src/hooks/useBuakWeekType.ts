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
 * Liefert: { weekType, weekLabel, kw, year, isLoading, refresh, overrideLocally }
 */

type YearMap = Map<string, { week_type: BuakWeekType; notiz: string | null }>;

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
    .select("year, kw, week_type, notiz")
    .eq("year", year);

  const map: YearMap = new Map();
  if (!error && data) {
    for (const row of data) {
      map.set(keyOf(row.year, row.kw), {
        week_type: row.week_type as BuakWeekType,
        notiz: row.notiz ?? null,
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

export function useBuakWeekType(date: Date | string | null) {
  const parsed = date ? (typeof date === "string" ? new Date(date) : date) : null;
  const { year, week } = parsed ? isoYearWeek(parsed) : { year: 0, week: 0 };

  const [state, setState] = useState<{
    weekType: BuakWeekType;
    notiz: string | null;
    isLoading: boolean;
  }>(() => {
    if (!parsed) return { weekType: "lang", notiz: null, isLoading: false };
    const cached = cache.get(year)?.get(keyOf(year, week));
    return {
      weekType: cached?.week_type ?? getBuakWeekTypeFallback(parsed),
      notiz: cached?.notiz ?? null,
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
    isLoading: state.isLoading,
  };
}
