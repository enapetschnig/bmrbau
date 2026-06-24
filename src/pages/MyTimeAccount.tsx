// MA-Eigen-Sicht auf das ZA-Stundenkonto.
//
// Zeigt aktuellen Saldo, "pending ZA" (im laufenden Monat noch nicht
// verbuchte ZA-Stunden) sowie den vollstaendigen Buchungs-Verlauf.

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  formatBalance,
  formatHours,
  balanceColorClass,
} from "@/lib/zaLabels";
import {
  ZaTransactionsList,
  type ZaTransaction,
} from "@/components/za/ZaTransactionsList";

type Signoff = {
  id: string;
  year: number;
  month: number;
  posted_at: string | null;
  lohnstunden_total: number | null;
  zeitausgleich_total: number | null;
  signed_at: string | null;
};

const MONTHS = [
  "Jän", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

export default function MyTimeAccount() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [trackingStart, setTrackingStart] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ZaTransaction[]>([]);
  const [signoffs, setSignoffs] = useState<Signoff[]>([]);
  const [pendingThisMonth, setPendingThisMonth] = useState<number>(0);
  const [overdueMonthHint, setOverdueMonthHint] = useState<string | null>(null);
  const [maxBalance, setMaxBalance] = useState<number>(60);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // 1) Konto (Saldo + Stichtag)
    const { data: account } = await supabase
      .from("time_accounts")
      .select("balance_hours, za_tracking_start_date")
      .eq("user_id", user.id)
      .maybeSingle();
    const acc = account as { balance_hours?: number; za_tracking_start_date?: string } | null;
    setBalance(Number(acc?.balance_hours ?? 0));
    setTrackingStart(acc?.za_tracking_start_date ?? null);

    // 2) Verlauf
    const { data: tx } = await supabase
      .from("time_account_transactions")
      .select("id, user_id, changed_by, change_type, hours, balance_before, balance_after, reason, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setTransactions((tx || []) as unknown as ZaTransaction[]);

    // 3) Signoffs
    const { data: sigs } = await supabase
      .from("monthly_signoffs")
      .select("id, year, month, posted_at, lohnstunden_total, zeitausgleich_total, signed_at")
      .eq("user_id", user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    setSignoffs((sigs || []) as unknown as Signoff[]);

    // 4) Pending ZA im AKTUELLEN Monat (Stunden ab Stichtag, noch nicht
    //    durch posted_at abgerechnet)
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
    const monthEndDate = new Date(y, m, 0);
    const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(monthEndDate.getDate()).padStart(2, "0")}`;
    const cutoff = acc?.za_tracking_start_date || monthStart;
    const fromDate = cutoff > monthStart ? cutoff : monthStart;

    const { data: entries } = await supabase
      .from("time_entries")
      .select("zeitausgleich_stunden")
      .eq("user_id", user.id)
      .gte("datum", fromDate)
      .lte("datum", monthEnd);
    const sum = (entries || []).reduce(
      (s, e: { zeitausgleich_stunden?: number | null }) =>
        s + Math.max(0, Number(e.zeitausgleich_stunden ?? 0)),
      0,
    );
    setPendingThisMonth(Math.round(sum * 100) / 100);

    // 5) Ueberfaelliger Vormonat: gibt es ZA-Stunden ab Stichtag im
    //    Vormonat ohne posted_at?
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const prevEndDate = new Date(prevYear, prevMonth, 0);
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(prevEndDate.getDate()).padStart(2, "0")}`;
    const sigList = ((sigs || []) as unknown as Signoff[]);
    const prevSignoff = sigList.find(
      (s) => s.year === prevYear && s.month === prevMonth,
    );
    if (!prevSignoff?.posted_at && cutoff <= prevEnd) {
      const { data: prevEntries } = await supabase
        .from("time_entries")
        .select("zeitausgleich_stunden")
        .eq("user_id", user.id)
        .gte("datum", cutoff > prevStart ? cutoff : prevStart)
        .lte("datum", prevEnd);
      const prevSum = (prevEntries || []).reduce(
        (s, e: { zeitausgleich_stunden?: number | null }) =>
          s + Math.max(0, Number(e.zeitausgleich_stunden ?? 0)),
        0,
      );
      if (prevSum > 0) {
        setOverdueMonthHint(
          `${MONTHS[prevMonth - 1]} ${prevYear} noch nicht abgeschlossen — ${formatBalance(prevSum)} warten auf Buchung.`,
        );
      } else {
        setOverdueMonthHint(null);
      }
    } else {
      setOverdueMonthHint(null);
    }

    // 6) Warn-Schwelle laden
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "za_max_balance_hours")
      .maybeSingle();
    if (setting?.value) {
      const n = parseFloat(setting.value);
      if (!Number.isNaN(n)) setMaxBalance(n);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Mein Zeitausgleich" backPath="/" />
        <main className="container mx-auto px-4 py-6 max-w-3xl">
          <p className="text-center text-muted-foreground">Lade…</p>
        </main>
      </div>
    );
  }

  const colorClass = balanceColorClass(balance, maxBalance, -5);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Mein Zeitausgleich" backPath="/" />
      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
        {/* Saldo-Karte */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Aktueller Saldo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className={`text-4xl font-bold ${colorClass}`}>
              {formatBalance(balance)}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              ZA-Tracking seit {trackingStart || "—"}
            </p>
            {balance > maxBalance && (
              <div className="rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-2 text-xs text-orange-800 dark:text-orange-200 flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Saldo über {maxBalance}h. Plane ZA-Tage ein, damit sich nichts staut.
                </span>
              </div>
            )}
            {balance < 0 && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-2 text-xs text-red-800 dark:text-red-200 flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Saldo ist im Minus — Mehrstunden werden zuerst nachverrechnet.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending im aktuellen Monat */}
        {pendingThisMonth > 0 && (
          <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-full bg-orange-200 dark:bg-orange-900 p-2 shrink-0">
                <Clock className="h-4 w-4 text-orange-800 dark:text-orange-200" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Diesen Monat aufgelaufen: {formatHours(pendingThisMonth)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Wird vom Admin am Monatsende ins Konto verbucht.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Überfälliger Vormonat */}
        {overdueMonthHint && (
          <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
              <p className="text-sm">{overdueMonthHint}</p>
            </CardContent>
          </Card>
        )}

        {/* Tabs: Verlauf + Monatsabschlüsse */}
        <Tabs defaultValue="verlauf">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
            <TabsTrigger value="monate">Monatsabschlüsse</TabsTrigger>
          </TabsList>

          <TabsContent value="verlauf" className="pt-3">
            <Card>
              <CardContent className="p-3">
                <ZaTransactionsList
                  transactions={transactions}
                  trackingStartDate={trackingStart}
                  hideChangedBy
                  emptyHint="Noch keine Buchungen — ZA-Stunden sammeln sich, sobald du arbeitest."
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monate" className="pt-3">
            <Card>
              <CardContent className="p-3 space-y-2">
                {signoffs.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Noch keine abgeschlossenen Monate.
                  </p>
                )}
                {signoffs.map((s) => (
                  <div key={s.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="font-medium">
                        {MONTHS[s.month - 1]} {s.year}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          s.posted_at
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-amber-100 text-amber-800 border-amber-200"
                        }
                      >
                        {s.posted_at ? "Abgeschlossen" : "Offen"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {s.posted_at && (
                        <p>
                          Gebucht am{" "}
                          {new Date(s.posted_at).toLocaleDateString("de-AT")}
                        </p>
                      )}
                      {s.lohnstunden_total != null && (
                        <p>
                          Lohnstunden: {formatBalance(s.lohnstunden_total)} ·
                          ZA-Gutschrift:{" "}
                          {formatBalance(s.zeitausgleich_total ?? 0)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
