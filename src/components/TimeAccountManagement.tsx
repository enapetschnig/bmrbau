import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Clock, Plus, History, Loader2, CalendarCheck, AlertTriangle, Wallet, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ZaTransactionsList, type ZaTransaction } from "@/components/za/ZaTransactionsList";
import { balanceColorClass, formatBalance, formatHours } from "@/lib/zaLabels";

type Profile = { id: string; vorname: string; nachname: string };

type TimeAccount = {
  id: string;
  user_id: string;
  balance_hours: number;
  za_tracking_start_date: string;
};

type SignoffRow = {
  id: string;
  user_id: string;
  year: number;
  month: number;
  posted_at: string | null;
  lohnstunden_total: number | null;
  zeitausgleich_total: number | null;
};

type Preview = {
  userId: string;
  lohnstunden: number;
  zaErarbeitet: number;
  zaGenommen: number;
  preCutoffHours: number;
  posted_at: string | null;
  balance_before: number;
  balance_after_preview: number;
};

interface Props {
  profiles: Profile[];
}

const MONTHS = ["Jän", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const FUNCTION_INVOKE = async (
  userId: string,
  year: number,
  month: number,
  mode: "post" | "storno_repost",
) => {
  const { data, error } = await supabase.functions.invoke("post-monthly-za", {
    body: { userId, year, month, mode },
  });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in data) {
    throw new Error((data as { error: string }).error);
  }
  return data;
};

export default function TimeAccountManagement({ profiles }: Props) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<TimeAccount[]>([]);
  const [transactions, setTransactions] = useState<ZaTransaction[]>([]);
  const [signoffs, setSignoffs] = useState<SignoffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxBalance, setMaxBalance] = useState<number>(60);

  // Buchungs-Dialog (Gutschrift/Abzug)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustUserId, setAdjustUserId] = useState<string | null>(null);
  const [adjustHours, setAdjustHours] = useState("");
  const [adjustType, setAdjustType] = useState<"gutschrift" | "abzug" | "korrektur">("gutschrift");
  const [adjustReason, setAdjustReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Initial-Saldo-Dialog
  const [showInitialDialog, setShowInitialDialog] = useState(false);
  const [initUserId, setInitUserId] = useState<string | null>(null);
  const [initHours, setInitHours] = useState("");
  const [initPeriod, setInitPeriod] = useState("");
  const [initReason, setInitReason] = useState("");

  // Stichtag-Editor
  const [showCutoffDialog, setShowCutoffDialog] = useState(false);
  const [cutoffUserId, setCutoffUserId] = useState<string | null>(null);
  const [cutoffDate, setCutoffDate] = useState("");

  // Verlauf-Dialog
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);

  // Monatsabschluss
  const today = new Date();
  const [pickYear, setPickYear] = useState<number>(today.getFullYear());
  const [pickMonth, setPickMonth] = useState<number>(
    today.getMonth() === 0 ? 12 : today.getMonth(), // Vormonat als Default
  );
  useEffect(() => {
    if (today.getMonth() === 0) setPickYear(today.getFullYear() - 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);

  const profileName = useCallback(
    (id: string) => {
      const p = profiles.find((p) => p.id === id);
      return p ? `${p.vorname} ${p.nachname}` : "Unbekannt";
    },
    [profiles],
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: accData }, { data: txData }, { data: sigData }, { data: setting }] = await Promise.all([
      supabase.from("time_accounts").select("id, user_id, balance_hours, za_tracking_start_date"),
      supabase
        .from("time_account_transactions")
        .select("id, user_id, changed_by, change_type, hours, balance_before, balance_after, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("monthly_signoffs")
        .select("id, user_id, year, month, posted_at, lohnstunden_total, zeitausgleich_total")
        .order("year", { ascending: false })
        .order("month", { ascending: false }),
      supabase.from("app_settings").select("value").eq("key", "za_max_balance_hours").maybeSingle(),
    ]);
    setAccounts((accData || []) as unknown as TimeAccount[]);
    setTransactions((txData || []) as unknown as ZaTransaction[]);
    setSignoffs((sigData || []) as unknown as SignoffRow[]);
    if (setting?.value) {
      const n = parseFloat(setting.value);
      if (!Number.isNaN(n)) setMaxBalance(n);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Vorschau pro MA fuer den gewaehlten Monat berechnen
  const buildPreview = useCallback(async () => {
    setPreviewLoading(true);
    const monthStart = `${pickYear}-${String(pickMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(pickYear, pickMonth, 0).getDate();
    const monthEnd = `${pickYear}-${String(pickMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Alle time_entries des Monats laden (einmal, dann pro MA gruppieren)
    const { data: entries } = await supabase
      .from("time_entries")
      .select("user_id, datum, lohnstunden, zeitausgleich_stunden, taetigkeit, stunden")
      .gte("datum", monthStart)
      .lte("datum", monthEnd);

    const byUser = new Map<string, { lohnstunden: number; zaErarbeitet: number; zaGenommen: number; preCutoffHours: number }>();
    type Entry = {
      user_id: string;
      datum: string;
      lohnstunden?: number | null;
      zeitausgleich_stunden?: number | null;
      taetigkeit?: string | null;
      stunden?: number | null;
    };
    for (const e of (entries || []) as Entry[]) {
      const acc = accounts.find((a) => a.user_id === e.user_id);
      if (!acc) continue;
      const start = acc.za_tracking_start_date;
      const slot = byUser.get(e.user_id) ?? {
        lohnstunden: 0,
        zaErarbeitet: 0,
        zaGenommen: 0,
        preCutoffHours: 0,
      };
      if (e.datum < start) {
        slot.preCutoffHours += Math.max(0, Number(e.zeitausgleich_stunden ?? 0));
      } else {
        slot.lohnstunden += Number(e.lohnstunden ?? 0);
        slot.zaErarbeitet += Math.max(0, Number(e.zeitausgleich_stunden ?? 0));
        if (e.taetigkeit === "Zeitausgleich") {
          slot.zaGenommen += Number(e.stunden ?? 0);
        }
      }
      byUser.set(e.user_id, slot);
    }

    const out: Preview[] = accounts.map((a) => {
      const slot = byUser.get(a.user_id) ?? { lohnstunden: 0, zaErarbeitet: 0, zaGenommen: 0, preCutoffHours: 0 };
      const sig = signoffs.find((s) => s.user_id === a.user_id && s.year === pickYear && s.month === pickMonth);
      return {
        userId: a.user_id,
        lohnstunden: round2(slot.lohnstunden),
        zaErarbeitet: round2(slot.zaErarbeitet),
        zaGenommen: round2(slot.zaGenommen),
        preCutoffHours: round2(slot.preCutoffHours),
        posted_at: sig?.posted_at ?? null,
        balance_before: Number(a.balance_hours),
        balance_after_preview: round2(Number(a.balance_hours) + slot.zaErarbeitet),
      };
    });
    setPreviews(out);
    setPreviewLoading(false);
  }, [accounts, signoffs, pickYear, pickMonth]);

  useEffect(() => {
    if (accounts.length > 0) buildPreview();
  }, [accounts, signoffs, pickYear, pickMonth, buildPreview]);

  // "Offen seit" pro MA: aelteste time_entries.datum mit ZA-Stunden nach
  // Stichtag, deren Monat nicht gepostet ist. Vereinfacht: pruefe den
  // direkten Vormonat.
  const offenSeit = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of accounts) {
      const now = new Date();
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const sig = signoffs.find((s) => s.user_id === a.user_id && s.year === prevYear && s.month === prevMonth);
      if (sig?.posted_at) continue;
      // Tag-1-des-aktuellen-Monats minus Tag-1-des-Vormonats = etwa 30
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysSince = Math.floor((Date.now() - firstOfThisMonth.getTime()) / (1000 * 60 * 60 * 24));
      const wouldBeOpen = previews.find(
        (p) => p.userId === a.user_id && p.zaErarbeitet > 0 && !p.posted_at,
      );
      if (wouldBeOpen) map.set(a.user_id, daysSince);
    }
    return map;
  }, [accounts, signoffs, previews]);

  const offenCount = offenSeit.size;
  const maxOffenDays = Math.max(0, ...Array.from(offenSeit.values()));
  const offenColor =
    maxOffenDays > 7
      ? "border-red-300 bg-red-50 dark:bg-red-950/30"
      : maxOffenDays > 3
        ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30"
        : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30";

  const ensureAccount = async (userId: string) => {
    const { error } = await supabase.from("time_accounts").insert({ user_id: userId, balance_hours: 0 });
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
    }
    fetchAll();
  };

  const openInitialDialog = (userId: string) => {
    setInitUserId(userId);
    setInitHours("");
    setInitPeriod("");
    setInitReason("");
    setShowInitialDialog(true);
  };

  const handleInitial = async () => {
    if (!initUserId || !initHours || !initPeriod.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Stunden + Bezugs-Zeitraum sind Pflicht" });
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const acc = accounts.find((a) => a.user_id === initUserId);
    if (!acc || !user) {
      setSubmitting(false);
      return;
    }
    const h = parseFloat(initHours);
    const before = Number(acc.balance_hours);
    const after = before + h;
    const { error: u1 } = await supabase
      .from("time_accounts")
      .update({ balance_hours: after, updated_at: new Date().toISOString() })
      .eq("id", acc.id);
    if (u1) {
      toast({ variant: "destructive", title: "Fehler", description: u1.message });
      setSubmitting(false);
      return;
    }
    await supabase.from("time_account_transactions").insert({
      user_id: initUserId,
      changed_by: user.id,
      change_type: "initial_saldo",
      hours: h,
      balance_before: before,
      balance_after: after,
      reason: `Initial-Saldo (${initPeriod.trim()}): ${initReason.trim() || "—"}`,
    });
    toast({ title: "Initial-Saldo gebucht", description: profileName(initUserId) });
    setShowInitialDialog(false);
    setSubmitting(false);
    fetchAll();
  };

  const openAdjustDialog = (userId: string) => {
    setAdjustUserId(userId);
    setAdjustHours("");
    setAdjustType("gutschrift");
    setAdjustReason("");
    setShowAdjustDialog(true);
  };

  const handleAdjust = async () => {
    if (!adjustUserId || !adjustHours || !adjustReason.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte alle Felder ausfüllen" });
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const acc = accounts.find((a) => a.user_id === adjustUserId);
    if (!acc || !user) {
      setSubmitting(false);
      return;
    }
    const h = parseFloat(adjustHours);
    const effective = adjustType === "abzug" ? -Math.abs(h) : h; // korrektur kann ±
    const before = Number(acc.balance_hours);
    const after = before + effective;
    const { error: u1 } = await supabase
      .from("time_accounts")
      .update({ balance_hours: after, updated_at: new Date().toISOString() })
      .eq("id", acc.id);
    if (u1) {
      toast({ variant: "destructive", title: "Fehler", description: u1.message });
      setSubmitting(false);
      return;
    }
    await supabase.from("time_account_transactions").insert({
      user_id: adjustUserId,
      changed_by: user.id,
      change_type: adjustType,
      hours: effective,
      balance_before: before,
      balance_after: after,
      reason: adjustReason.trim(),
    });
    toast({ title: "Gebucht", description: `${profileName(adjustUserId)}: ${formatHours(effective)}` });
    setShowAdjustDialog(false);
    setSubmitting(false);
    fetchAll();
  };

  const openCutoffDialog = (userId: string) => {
    const acc = accounts.find((a) => a.user_id === userId);
    setCutoffUserId(userId);
    setCutoffDate(acc?.za_tracking_start_date ?? "");
    setShowCutoffDialog(true);
  };

  const handleCutoffSave = async () => {
    if (!cutoffUserId || !cutoffDate) return;
    const acc = accounts.find((a) => a.user_id === cutoffUserId);
    if (!acc) return;
    const ok = window.confirm(
      `Stichtag von ${acc.za_tracking_start_date} auf ${cutoffDate} setzen?\n\nAlle ZA-Stunden aus time_entries ab diesem Datum werden beim nächsten Monatsabschluss neu mitgerechnet. Der Audit-Log wird automatisch geschrieben.`,
    );
    if (!ok) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("time_accounts")
      .update({ za_tracking_start_date: cutoffDate, updated_at: new Date().toISOString() })
      .eq("id", acc.id);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      setSubmitting(false);
      return;
    }
    toast({ title: "Stichtag aktualisiert" });
    setShowCutoffDialog(false);
    setSubmitting(false);
    fetchAll();
  };

  const handlePost = async (userId: string, isRepost: boolean) => {
    setPosting(userId);
    try {
      const data = await FUNCTION_INVOKE(userId, pickYear, pickMonth, isRepost ? "storno_repost" : "post");
      const d = data as { za_erarbeitet?: number; balance_after?: number };
      toast({
        title: isRepost ? "Storno + neu gebucht" : "Monat gebucht",
        description: `${profileName(userId)}: ${formatHours(d.za_erarbeitet ?? 0)} → Saldo ${formatBalance(d.balance_after ?? 0)}`,
      });
      await fetchAll();
    } catch (err) {
      const e = err as { message?: string };
      toast({ variant: "destructive", title: "Buchung fehlgeschlagen", description: e?.message || "Unbekannt" });
    } finally {
      setPosting(null);
    }
  };

  const handlePostAll = async () => {
    const candidates = previews.filter((p) => !p.posted_at && p.zaErarbeitet > 0);
    if (candidates.length === 0) {
      toast({ title: "Nichts zu buchen", description: "Alle MA sind bereits gebucht." });
      return;
    }
    const ok = window.confirm(`${candidates.length} MA jetzt buchen?`);
    if (!ok) return;
    for (const p of candidates) {
      await handlePost(p.userId, false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Offene-Monate-Banner */}
      {offenCount > 0 && (
        <Card className={`border-2 ${offenColor}`}>
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">
                {offenCount} Mitarbeiter mit offenem Vormonats-Abschluss
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ältester offener Stand: {maxOffenDays} Tage. Bitte über die
                Monatsabschluss-Sektion unten buchen.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Übersicht alle Mitarbeiter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Zeitkonten
          </CardTitle>
          <CardDescription>
            Saldo · Tracking-Stichtag · Verlauf · Initialsaldo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {profiles
              .filter((p) => p.vorname && p.nachname)
              .map((profile) => {
                const acc = accounts.find((a) => a.user_id === profile.id);
                const bal = acc ? Number(acc.balance_hours) : 0;
                return (
                  <div
                    key={profile.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {profile.vorname} {profile.nachname}
                      </p>
                      {acc ? (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>
                            Saldo:{" "}
                            <span className={`font-semibold ${balanceColorClass(bal, maxBalance, -5)}`}>
                              {formatBalance(bal)}
                            </span>
                            {bal > maxBalance && (
                              <Badge variant="outline" className="ml-2 text-[10px] bg-orange-100 text-orange-800 border-orange-200">
                                zu viel ZA
                              </Badge>
                            )}
                            {bal < 0 && (
                              <Badge variant="outline" className="ml-2 text-[10px] bg-red-100 text-red-800 border-red-200">
                                Minus
                              </Badge>
                            )}
                          </p>
                          <p>Tracking ab: {acc.za_tracking_start_date}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Noch kein Zeitkonto</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {acc ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openAdjustDialog(profile.id)}>
                            <Plus className="h-3 w-3 mr-1" /> Buchen
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openInitialDialog(profile.id)}>
                            <Wallet className="h-3 w-3 mr-1" /> Initial
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openCutoffDialog(profile.id)}>
                            <CalendarClock className="h-3 w-3 mr-1" /> Stichtag
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setHistoryUserId(profile.id);
                              setShowHistoryDialog(true);
                            }}
                          >
                            <History className="h-3 w-3 mr-1" /> Verlauf
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => ensureAccount(profile.id)}>
                          Zeitkonto anlegen
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Monatsabschluss */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4" /> Monatsabschluss
          </CardTitle>
          <CardDescription>
            Bucht die ZA-Erarbeitet-Summe für den gewählten Monat ins Konto.
            Stunden vor dem Tracking-Stichtag werden ignoriert.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Jahr</Label>
              <Select value={String(pickYear)} onValueChange={(v) => setPickYear(parseInt(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[today.getFullYear(), today.getFullYear() - 1, today.getFullYear() - 2].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monat</Label>
              <Select value={String(pickMonth)} onValueChange={(v) => setPickMonth(parseInt(v))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handlePostAll} disabled={previewLoading || !!posting} className="ml-auto">
              Alle MA buchen
            </Button>
          </div>

          {previewLoading ? (
            <div className="text-center py-6">
              <Loader2 className="h-5 w-5 animate-spin inline" />
            </div>
          ) : (
            <div className="space-y-2">
              {previews
                .filter((p) => {
                  const profile = profiles.find((pr) => pr.id === p.userId);
                  return profile && profile.vorname && profile.nachname;
                })
                .map((p) => {
                  const isPosted = !!p.posted_at;
                  const hasData = p.zaErarbeitet > 0 || p.lohnstunden > 0 || p.zaGenommen > 0;
                  if (!isPosted && !hasData) return null;
                  return (
                    <div
                      key={p.userId}
                      className="rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{profileName(p.userId)}</p>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>
                            Lohnstunden: <strong>{formatBalance(p.lohnstunden)}</strong> ·
                            ZA-Erarbeitet: <strong className="text-emerald-700">{formatHours(p.zaErarbeitet)}</strong>
                            {p.zaGenommen > 0 && <> · ZA-Genommen: <strong>{formatBalance(p.zaGenommen)}</strong></>}
                          </p>
                          <p>
                            Saldo: {formatBalance(p.balance_before)} → <strong>{formatBalance(p.balance_after_preview)}</strong>
                          </p>
                          {p.preCutoffHours > 0 && (
                            <p className="text-amber-700 dark:text-amber-400">
                              ⚠ {formatBalance(p.preCutoffHours)} vor Stichtag — werden ignoriert.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isPosted ? (
                          <>
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                              Gebucht
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => handlePost(p.userId, true)} disabled={posting === p.userId}>
                              {posting === p.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Storno + Neu"}
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" onClick={() => handlePost(p.userId, false)} disabled={posting === p.userId}>
                            {posting === p.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Buchen"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              {previews.filter((p) => p.zaErarbeitet > 0 || p.posted_at).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Keine Buchungs-Kandidaten für {MONTHS[pickMonth - 1]} {pickYear}.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buchungs-Dialog (Gutschrift/Abzug/Korrektur) */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zeitkonto buchen</DialogTitle>
            <DialogDescription>
              {adjustUserId && profileName(adjustUserId)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Art</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as typeof adjustType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gutschrift">Gutschrift (Überstunden)</SelectItem>
                  <SelectItem value="abzug">Abzug</SelectItem>
                  <SelectItem value="korrektur">Korrektur (±)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stunden {adjustType === "korrektur" && "(mit Vorzeichen)"}</Label>
              <Input
                type="number"
                step="0.25"
                value={adjustHours}
                onChange={(e) => setAdjustHours(e.target.value)}
                placeholder={adjustType === "korrektur" ? "z.B. -1,5" : "z.B. 8"}
              />
            </div>
            <div className="space-y-2">
              <Label>Grund</Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="z.B. Manueller Ausgleich KW20"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>Abbrechen</Button>
            <Button onClick={handleAdjust} disabled={submitting}>
              {submitting ? "Wird gebucht…" : "Buchen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Initial-Saldo-Dialog */}
      <Dialog open={showInitialDialog} onOpenChange={setShowInitialDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Initial-Saldo buchen</DialogTitle>
            <DialogDescription>
              Übertrag der Stunden, die VOR dem Tracking-Stichtag erarbeitet wurden.{" "}
              {initUserId && profileName(initUserId)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Stunden</Label>
              <Input type="number" step="0.25" value={initHours} onChange={(e) => setInitHours(e.target.value)} placeholder="z.B. 45" />
            </div>
            <div className="space-y-2">
              <Label>Bezugs-Zeitraum (Pflicht)</Label>
              <Input value={initPeriod} onChange={(e) => setInitPeriod(e.target.value)} placeholder="z.B. 01.01.–23.06.2026" />
            </div>
            <div className="space-y-2">
              <Label>Anmerkung</Label>
              <Textarea value={initReason} onChange={(e) => setInitReason(e.target.value)} placeholder="optional" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitialDialog(false)}>Abbrechen</Button>
            <Button onClick={handleInitial} disabled={submitting}>
              {submitting ? "Wird gebucht…" : "Initial-Saldo buchen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stichtag-Editor */}
      <Dialog open={showCutoffDialog} onOpenChange={setShowCutoffDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tracking-Stichtag</DialogTitle>
            <DialogDescription>
              {cutoffUserId && profileName(cutoffUserId)} — ab diesem Datum
              werden ZA-Stunden ins Konto gebucht.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} />
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Stichtag rückdatieren bringt alte ZA-Stunden ins Saldo zurück.
                Audit-Log wird automatisch geschrieben.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCutoffDialog(false)}>Abbrechen</Button>
            <Button onClick={handleCutoffSave} disabled={submitting}>
              {submitting ? "Speichert…" : "Stichtag setzen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verlauf */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Verlauf — {historyUserId && profileName(historyUserId)}</DialogTitle>
            <DialogDescription>Alle Buchungen am Zeitkonto</DialogDescription>
          </DialogHeader>
          <ZaTransactionsList
            transactions={transactions.filter((t) => t.user_id === historyUserId)}
            trackingStartDate={accounts.find((a) => a.user_id === historyUserId)?.za_tracking_start_date}
            changedByNames={Object.fromEntries(profiles.map((p) => [p.id, `${p.vorname} ${p.nachname}`]))}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
