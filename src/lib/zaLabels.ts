// Mapping von time_account_transactions.change_type (Postgres-Werte) auf
// deutsche User-facing Labels + Badge-Farben fuer den Verlauf.

export type ZaChangeType =
  | "monatsabschluss"
  | "za_abzug"           // legacy/manuell vom Admin
  | "za_nehmen"          // Live-Abzug bei MA-ZA-Nahme
  | "gutschrift"
  | "abzug"
  | "storno"
  | "initial_saldo"
  | "korrektur"
  | "austritt_auszahlung"
  | "verfallen_jahresstichtag"
  | "tracking_start_geaendert"
  | string;

export type ZaBadge = {
  label: string;
  className: string; // Tailwind classes fuer Badge
};

export const ZA_LABELS: Record<string, ZaBadge> = {
  monatsabschluss: {
    label: "Monatsabschluss",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  za_abzug: {
    label: "Manueller Abzug",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  za_nehmen: {
    label: "ZA genommen",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  gutschrift: {
    label: "Gutschrift",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  abzug: {
    label: "Abzug",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  storno: {
    label: "Storno",
    className: "bg-slate-200 text-slate-800 border-slate-300",
  },
  initial_saldo: {
    label: "Initial-Saldo",
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  korrektur: {
    label: "Korrektur",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  austritt_auszahlung: {
    label: "Austritts-Auszahlung",
    className: "bg-zinc-200 text-zinc-900 border-zinc-300",
  },
  verfallen_jahresstichtag: {
    label: "Verfall Jahresstichtag",
    className: "bg-rose-100 text-rose-800 border-rose-200",
  },
  tracking_start_geaendert: {
    label: "Stichtag verschoben",
    className: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
};

export function zaLabel(changeType: string): ZaBadge {
  return (
    ZA_LABELS[changeType] || {
      label: changeType,
      className: "bg-muted text-foreground",
    }
  );
}

/** Formatiert Stunden mit Vorzeichen und 2 Nachkommastellen. */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return "0,00 h";
  const sign = hours > 0 ? "+" : "";
  return `${sign}${hours.toFixed(2).replace(".", ",")} h`;
}

/** Formatiert Saldo (kein Vorzeichen fuer positive Werte). */
export function formatBalance(hours: number | null | undefined): string {
  if (hours == null) return "0,00 h";
  return `${hours.toFixed(2).replace(".", ",")} h`;
}

/** Farb-Klasse fuer Saldo-Anzeige. */
export function balanceColorClass(
  hours: number | null | undefined,
  maxWarn = 60,
  minWarn = -5,
): string {
  const h = hours ?? 0;
  if (h < minWarn) return "text-red-600";
  if (h < 0) return "text-amber-600";
  if (h > maxWarn) return "text-orange-600";
  return "text-emerald-600";
}
