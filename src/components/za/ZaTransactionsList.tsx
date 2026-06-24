// Wiederverwendbare Verlauf-Tabelle fuer time_account_transactions.
// Genutzt in MyTimeAccount (MA-Sicht) + TimeAccountManagement (Admin).

import { Badge } from "@/components/ui/badge";
import { zaLabel, formatHours, formatBalance } from "@/lib/zaLabels";

export type ZaTransaction = {
  id: string;
  user_id: string;
  changed_by: string;
  change_type: string;
  hours: number;
  balance_before: number;
  balance_after: number;
  reason: string | null;
  created_at: string;
};

type Props = {
  transactions: ZaTransaction[];
  /** Stichtag — Eintraege davor werden grau markiert. */
  trackingStartDate?: string | null;
  /** Map: changed_by-User-ID → Name. Wenn null, wird "Admin" angezeigt. */
  changedByNames?: Record<string, string> | null;
  /** Wenn true, wird die "Von"-Spalte ausgeblendet (MA-Sicht). */
  hideChangedBy?: boolean;
  emptyHint?: string;
};

export function ZaTransactionsList({
  transactions,
  trackingStartDate,
  changedByNames,
  hideChangedBy = false,
  emptyHint = "Noch keine Buchungen.",
}: Props) {
  if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {emptyHint}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((t) => {
        const badge = zaLabel(t.change_type);
        const dt = new Date(t.created_at);
        const isPreCutoff =
          trackingStartDate &&
          dt.toISOString().slice(0, 10) < trackingStartDate;
        const changedBy = hideChangedBy
          ? null
          : changedByNames?.[t.changed_by] || "Admin";

        return (
          <div
            key={t.id}
            className={`rounded-md border p-3 ${
              isPreCutoff ? "bg-muted/40" : "bg-card"
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={`text-xs ${badge.className}`}>
                {badge.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {dt.toLocaleDateString("de-AT")}{" "}
                {dt.toLocaleTimeString("de-AT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {isPreCutoff && (
                <span
                  className="text-[10px] uppercase text-muted-foreground"
                  title="vor Tracking-Start"
                >
                  · vor Stichtag
                </span>
              )}
              {changedBy && (
                <span className="text-xs text-muted-foreground ml-auto">
                  von {changedBy}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span
                className={
                  t.hours > 0
                    ? "font-semibold text-emerald-700"
                    : t.hours < 0
                      ? "font-semibold text-orange-700"
                      : "font-semibold text-muted-foreground"
                }
              >
                {formatHours(t.hours)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatBalance(t.balance_before)} → {formatBalance(t.balance_after)}
              </span>
            </div>
            {t.reason && (
              <p className="text-xs text-muted-foreground mt-1">{t.reason}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
