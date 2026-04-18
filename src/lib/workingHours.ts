export interface WorkTimePreset {
  startTime: string;
  endTime: string;
  pauseStart: string;
  pauseEnd: string;
  pauseMinutes: number;
  totalHours: number;
}

export interface DaySchedule {
  start: string | null;
  end: string | null;
  pause: number;
  pause_start?: string;
  pause_end?: string;
  hours: number;
}

export interface WeekSchedule {
  mo: DaySchedule;
  di: DaySchedule;
  mi: DaySchedule;
  do: DaySchedule;
  fr: DaySchedule;
  sa: DaySchedule;
  so: DaySchedule;
}

/**
 * Schwellenwert = Tages-Obergrenze fuer Lohnstunden.
 * Stunden bis zum Schwellenwert = Lohnverrechnung (ausbezahlt).
 * Stunden ueber dem Schwellenwert = Zeitausgleich (nicht ausbezahlt).
 */
export interface Schwellenwert {
  mo: number;
  di: number;
  mi: number;
  do: number;
  fr: number;
  sa: number;
  so: number;
}

export interface HoursSplit {
  lohnstunden: number;
  zeitausgleich: number;
}

/**
 * BUAK-Wochentyp – wechselt zwischen "lang" (Mo–Fr) und "kurz" (Mo–Do)
 * und wird aus der buak_week_calendar-Tabelle pro KW ermittelt.
 */
export type BuakWeekType = "lang" | "kurz";

/**
 * Zwei Wochenplaene pro Mitarbeiter: einer fuer "lange" Wochen (mit Fr),
 * einer fuer "kurze" (ohne Fr). Wird aus employees.regelarbeitszeit /
 * employees.regelarbeitszeit_kurz geladen.
 */
export interface EmployeeSchedules {
  lang: WeekSchedule | null;
  kurz: WeekSchedule | null;
}

// BMR-Bau BUAK-Standard: lange Woche
// Mo–Do 07:00–16:45 (1h Pause → 8,75h), Fr 07:00–15:45 (1h Pause → 7,75h)
// Wochensumme: 42,75h (Differenz zu 39h KV-Norm laeuft ueber Zeitausgleich/Ueberstunden)
export const BMR_BUAK_LANG_SCHEDULE: WeekSchedule = {
  mo: { start: "07:00", end: "16:45", pause: 60, pause_start: "12:00", pause_end: "13:00", hours: 8.75 },
  di: { start: "07:00", end: "16:45", pause: 60, pause_start: "12:00", pause_end: "13:00", hours: 8.75 },
  mi: { start: "07:00", end: "16:45", pause: 60, pause_start: "12:00", pause_end: "13:00", hours: 8.75 },
  do: { start: "07:00", end: "16:45", pause: 60, pause_start: "12:00", pause_end: "13:00", hours: 8.75 },
  fr: { start: "07:00", end: "15:45", pause: 60, pause_start: "12:00", pause_end: "13:00", hours: 7.75 },
  sa: { start: null, end: null, pause: 0, hours: 0 },
  so: { start: null, end: null, pause: 0, hours: 0 },
};

// BMR-Bau BUAK-Standard: kurze Woche (Fr frei)
export const BMR_BUAK_KURZ_SCHEDULE: WeekSchedule = {
  mo: { start: "07:00", end: "16:45", pause: 60, pause_start: "12:00", pause_end: "13:00", hours: 8.75 },
  di: { start: "07:00", end: "16:45", pause: 60, pause_start: "12:00", pause_end: "13:00", hours: 8.75 },
  mi: { start: "07:00", end: "16:45", pause: 60, pause_start: "12:00", pause_end: "13:00", hours: 8.75 },
  do: { start: "07:00", end: "16:45", pause: 60, pause_start: "12:00", pause_end: "13:00", hours: 8.75 },
  fr: { start: null, end: null, pause: 0, hours: 0 },
  sa: { start: null, end: null, pause: 0, hours: 0 },
  so: { start: null, end: null, pause: 0, hours: 0 },
};

// Fuer Abwaertskompatibilitaet: DEFAULT_SCHEDULE == lange Woche.
// Legacy-Callers die keinen Wochentyp kennen bekommen damit die lange Version.
export const DEFAULT_SCHEDULE: WeekSchedule = BMR_BUAK_LANG_SCHEDULE;

// Standard fuer Lehrlinge (kuerzere Arbeitszeiten) – gilt nur fuer lange Wochen.
// In kurzen Wochen arbeiten Lehrlinge Mo-Do gleich, Fr frei.
export const LEHRLING_SCHEDULE: WeekSchedule = {
  mo: { start: "07:00", end: "16:00", pause: 30, pause_start: "12:00", pause_end: "12:30", hours: 8.5 },
  di: { start: "07:00", end: "16:00", pause: 30, pause_start: "12:00", pause_end: "12:30", hours: 8.5 },
  mi: { start: "07:00", end: "16:00", pause: 30, pause_start: "12:00", pause_end: "12:30", hours: 8.5 },
  do: { start: "07:00", end: "16:00", pause: 30, pause_start: "12:00", pause_end: "12:30", hours: 8.5 },
  fr: { start: "07:00", end: "12:00", pause: 0, hours: 5 },
  sa: { start: null, end: null, pause: 0, hours: 0 },
  so: { start: null, end: null, pause: 0, hours: 0 },
};

export const LEHRLING_SCHEDULE_KURZ: WeekSchedule = {
  mo: { start: "07:00", end: "16:00", pause: 30, pause_start: "12:00", pause_end: "12:30", hours: 8.5 },
  di: { start: "07:00", end: "16:00", pause: 30, pause_start: "12:00", pause_end: "12:30", hours: 8.5 },
  mi: { start: "07:00", end: "16:00", pause: 30, pause_start: "12:00", pause_end: "12:30", hours: 8.5 },
  do: { start: "07:00", end: "16:00", pause: 30, pause_start: "12:00", pause_end: "12:30", hours: 8.5 },
  fr: { start: null, end: null, pause: 0, hours: 0 },
  sa: { start: null, end: null, pause: 0, hours: 0 },
  so: { start: null, end: null, pause: 0, hours: 0 },
};

/**
 * Regel-Fallback wenn der BUAK-Kalender fuer die betreffende KW noch nicht
 * gepflegt ist: gerade KW = lang, ungerade KW = kurz.
 * (Deckt sich mit dem Seed in Migration 20260418140000.)
 */
export function getBuakWeekTypeFallback(date: Date): BuakWeekType {
  // ISO-KW (Mo-basiert)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return week % 2 === 0 ? "lang" : "kurz";
}

/**
 * Gibt den fuer ein Datum passenden Wochenplan zurueck. Wenn kein kurz-Plan
 * gepflegt ist (Alt-Daten), wird lang als Fallback verwendet.
 */
export function pickScheduleForDate(
  date: Date,
  schedules: EmployeeSchedules | null,
  weekType: BuakWeekType,
): WeekSchedule {
  if (!schedules) return weekType === "kurz" ? BMR_BUAK_KURZ_SCHEDULE : BMR_BUAK_LANG_SCHEDULE;
  if (weekType === "kurz") return schedules.kurz || schedules.lang || BMR_BUAK_KURZ_SCHEDULE;
  return schedules.lang || BMR_BUAK_LANG_SCHEDULE;
}

const DAY_KEYS: Record<number, keyof WeekSchedule> = {
  0: "so",
  1: "mo",
  2: "di",
  3: "mi",
  4: "do",
  5: "fr",
  6: "sa",
};

function getDayKey(date: Date): keyof WeekSchedule {
  return DAY_KEYS[date.getDay()];
}

/**
 * Gibt die Normalarbeitszeit für einen Tag zurück, basierend auf individuellem Zeitplan
 */
export function getNormalWorkingHours(date: Date, schedule?: WeekSchedule | null): number {
  const s = schedule || DEFAULT_SCHEDULE;
  const dayKey = getDayKey(date);
  return s[dayKey]?.hours ?? 0;
}

/**
 * Gibt die Freitags-Überstunde zurück (nicht mehr relevant, bleibt für Kompatibilität)
 */
export function getFridayOvertime(_date: Date): number {
  return 0;
}

/**
 * Gibt die tatsächlichen Arbeitsstunden für einen Wochentag zurück
 */
export function getTotalWorkingHours(date: Date, schedule?: WeekSchedule | null): number {
  return getNormalWorkingHours(date, schedule);
}

/**
 * Gibt das Wochensoll zurück basierend auf individuellem Zeitplan
 */
export function getWeeklyTargetHours(schedule?: WeekSchedule | null): number {
  const s = schedule || DEFAULT_SCHEDULE;
  return Object.values(s).reduce((sum, day) => sum + (day?.hours ?? 0), 0);
}

/**
 * Gibt Standard-Arbeitszeiten für einen Tag zurück basierend auf individuellem Zeitplan
 */
export function getDefaultWorkTimes(date: Date, schedule?: WeekSchedule | null): WorkTimePreset | null {
  const s = schedule || DEFAULT_SCHEDULE;
  const dayKey = getDayKey(date);
  const day = s[dayKey];

  if (!day || !day.start || !day.end || day.hours === 0) return null;

  // Pausenzeit: direkt aus Schedule verwenden wenn vorhanden, sonst Mitte der Arbeitszeit
  let pauseStart: string;
  let pauseEnd: string;
  if (day.pause_start && day.pause_end) {
    pauseStart = day.pause_start;
    pauseEnd = day.pause_end;
  } else if (day.pause > 0) {
    const startMinutes = timeToMinutes(day.start);
    const endMinutes = timeToMinutes(day.end);
    const midpoint = Math.floor((startMinutes + endMinutes) / 2);
    const pauseStartMinutes = midpoint - Math.floor(day.pause / 2);
    pauseStart = minutesToTime(pauseStartMinutes);
    pauseEnd = minutesToTime(pauseStartMinutes + day.pause);
  } else {
    pauseStart = "";
    pauseEnd = "";
  }

  return {
    startTime: day.start,
    endTime: day.end,
    pauseStart,
    pauseEnd,
    pauseMinutes: day.pause,
    totalHours: day.hours,
  };
}

/**
 * Prüft ob ein Tag ein arbeitsfreier Tag ist basierend auf individuellem Zeitplan
 */
export function isNonWorkingDay(date: Date, schedule?: WeekSchedule | null): boolean {
  return getNormalWorkingHours(date, schedule) === 0;
}

/**
 * Berechnet Überstunden für einen Zeitblock
 */
export function calculateOvertime(actualHours: number, date: Date, schedule?: WeekSchedule | null): number {
  const normalHours = getNormalWorkingHours(date, schedule);
  return Math.max(0, actualHours - normalHours);
}

/**
 * Berechnet Diäten basierend auf Arbeitsstunden.
 * Österreichische Regelung (Baukollektivvertrag):
 * - unter 3 h: keine Diäten
 * - 3 bis 9 h (exklusiv): Tagesgebühr "klein" = 2,20 EUR pro ANGEFANGENE Stunde
 *   NACH der 3. Stunde → 5 h Arbeit ⇒ 2 × 2,20 = 4,40 EUR
 *   (Obergrenze 9 h: 6 × 2,20 = 13,20 EUR)
 * - ab 9 h: Tagesgebühr "groß" = 26,40 EUR (pauschal)
 * - Baustellenanfahrt-Pauschale: einmal täglich 4,40 EUR (additiv)
 *
 * Saetze stammen aus der letzten bekannten KV-Version. Admin kann sie im
 * UI ueber die Einstellungen ueberschreiben (TODO: Admin-Setting-Hook),
 * intern werden hier die Defaults verwendet.
 */
export function calculateDiaeten(
  totalHoursOnDay: number,
  isConstructionSite: boolean,
): { typ: "keine" | "klein" | "gross" | "anfahrt"; betrag: number } {
  let typ: "keine" | "klein" | "gross" | "anfahrt" = "keine";
  let betrag = 0;

  if (totalHoursOnDay >= 9) {
    typ = "gross";
    betrag = 26.40;
  } else if (totalHoursOnDay >= 3) {
    typ = "klein";
    // "Pro ANGEFANGENE Stunde nach 3h" → Math.ceil der Stunden oberhalb 3,
    // begrenzt auf 6 (= 9 h - 3 h).
    const stundenUeber3 = Math.min(6, Math.ceil(totalHoursOnDay - 3));
    betrag = 2.20 * Math.max(0, stundenUeber3);
  }

  // Baustellenanfahrt-Pauschale
  if (isConstructionSite && totalHoursOnDay > 0) {
    betrag += 4.40;
    if (typ === "keine") typ = "anfahrt";
  }

  return { typ, betrag: Math.round(betrag * 100) / 100 };
}

/**
 * Berechnet Kilometergeld (amtliches Kilometergeld Österreich 2025: 0,42 EUR/km)
 * Rate kann ueber Admin-Einstellungen konfiguriert werden.
 */
export function calculateKilometergeld(km: number, rate: number = 0.42): number {
  return Math.round(km * rate * 100) / 100;
}

/**
 * Gibt den Schwellenwert fuer einen bestimmten Tag zurueck.
 * Wenn kein Schwellenwert gesetzt ist, werden die Regelarbeitszeit-Stunden verwendet.
 */
export function getSchwellenwert(
  date: Date,
  schwellenwert?: Schwellenwert | null,
  schedule?: WeekSchedule | null
): number {
  if (schwellenwert) {
    const dayKey = getDayKey(date);
    return schwellenwert[dayKey] ?? 0;
  }
  // Fallback: Regelarbeitszeit-Stunden als Schwellenwert
  return getNormalWorkingHours(date, schedule);
}

/**
 * Teilt die Gesamtstunden eines Tages in Lohnstunden und Zeitausgleich auf.
 * - Lohnstunden: Stunden bis zum Schwellenwert (werden ausbezahlt)
 * - Zeitausgleich: Stunden ueber dem Schwellenwert (nicht ausbezahlt, gehen ins ZA-Konto)
 */
export function splitHours(
  totalHours: number,
  date: Date,
  schedule?: WeekSchedule | null,
  schwellenwert?: Schwellenwert | null
): HoursSplit {
  if (totalHours <= 0) return { lohnstunden: 0, zeitausgleich: 0 };

  const threshold = getSchwellenwert(date, schwellenwert, schedule);

  if (totalHours <= threshold) {
    return { lohnstunden: totalHours, zeitausgleich: 0 };
  }

  return {
    lohnstunden: threshold,
    zeitausgleich: Math.round((totalHours - threshold) * 100) / 100,
  };
}

// Hilfsfunktionen
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
