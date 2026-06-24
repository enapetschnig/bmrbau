// Kleines Dashboard-Widget fuer MA: ZA-Saldo + Pending-ZA des Monats.
// Klickbar → leitet zur Detail-Seite.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { balanceColorClass, formatBalance, formatHours } from "@/lib/zaLabels";

export function MyZaWidget() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [pending, setPending] = useState<number>(0);
  const [trackingStart, setTrackingStart] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHidden(true);
        return;
      }
      const { data: acc } = await supabase
        .from("time_accounts")
        .select("balance_hours, za_tracking_start_date")
        .eq("user_id", user.id)
        .maybeSingle();
      const a = acc as { balance_hours?: number; za_tracking_start_date?: string } | null;
      if (!a) {
        setHidden(true);
        return;
      }
      setBalance(Number(a.balance_hours ?? 0));
      setTrackingStart(a.za_tracking_start_date ?? null);

      // Pending im aktuellen Monat
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const fromDate = a.za_tracking_start_date && a.za_tracking_start_date > monthStart
        ? a.za_tracking_start_date
        : monthStart;
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
      setPending(Math.round(sum * 100) / 100);
    })();
  }, []);

  if (hidden || balance === null) return null;

  const colorClass = balanceColorClass(balance, 60, -5);

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50"
      onClick={() => navigate("/my-time-account")}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Mein Zeitausgleich</p>
            <p className="text-[11px] text-muted-foreground">
              Tracking seit {trackingStart || "—"}
            </p>
          </div>
        </div>
        <p className={`text-3xl font-bold ${colorClass}`}>
          {formatBalance(balance)}
        </p>
        {pending > 0 && (
          <p className="text-xs text-orange-700 dark:text-orange-300 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Diesen Monat aufgelaufen: {formatHours(pending)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
