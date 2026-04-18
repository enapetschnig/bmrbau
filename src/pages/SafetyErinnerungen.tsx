import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bell, Send, AlertCircle, XCircle, Loader2, CheckCircle2 } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { de } from "date-fns/locale";

type OffeneUnterweisung = {
  kind: "unterweisung" | "zertifikat";
  evaluation_id?: string;
  schulung_id?: string;
  user_id: string;
  user_name: string;
  label: string;
  modul?: string;
  tage_offen?: number;
  tage_bis_ablauf?: number;
  status: "offen" | "laeuft_ab" | "abgelaufen";
};

export default function SafetyErinnerungen() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [offene, setOffene] = useState<OffeneUnterweisung[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetch_ = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (role?.role !== "administrator") {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);

    const rows: OffeneUnterweisung[] = [];

    // 1. Assigned evaluations ohne Unterschrift
    const { data: assigned } = await supabase
      .from("safety_evaluation_employees")
      .select("evaluation_id, user_id");
    const { data: signatures } = await supabase
      .from("safety_evaluation_signatures")
      .select("evaluation_id, user_id");
    const signedSet = new Set((signatures || []).map((s: any) => `${s.evaluation_id}_${s.user_id}`));
    const evalIds = [...new Set((assigned || []).map((a: any) => a.evaluation_id))];
    const { data: evals } = await supabase
      .from("safety_evaluations")
      .select("id, titel, modul, created_at")
      .in("id", evalIds.length > 0 ? evalIds : ["00000000-0000-0000-0000-000000000000"]);
    const evalMap = new Map((evals || []).map((e: any) => [e.id, e]));

    const userIds = [...new Set((assigned || []).map((a: any) => a.user_id))];
    const { data: emps } = await supabase
      .from("employees")
      .select("user_id, vorname, nachname")
      .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const empMap = new Map((emps || []).map((e: any) => [e.user_id, `${e.vorname || ""} ${e.nachname || ""}`.trim()]));

    for (const a of assigned || []) {
      if (signedSet.has(`${a.evaluation_id}_${a.user_id}`)) continue;
      const ev = evalMap.get(a.evaluation_id);
      if (!ev) continue;
      const tage = differenceInDays(new Date(), parseISO(ev.created_at));
      rows.push({
        kind: "unterweisung",
        evaluation_id: a.evaluation_id,
        user_id: a.user_id,
        user_name: empMap.get(a.user_id) || "?",
        label: ev.titel,
        modul: ev.modul,
        tage_offen: tage,
        status: "offen",
      });
    }

    // 2. Ablaufende/abgelaufene Zertifikate (naechste 60 Tage)
    const { data: certs } = await supabase
      .from("schulung_zertifikate")
      .select("schulung_id, user_id, gueltig_bis, gueltig_ab")
      .not("gueltig_bis", "is", null);
    const { data: schulungen } = await supabase.from("schulungen").select("id, name");
    const schMap = new Map((schulungen || []).map((s: any) => [s.id, s.name]));

    // Pro user+schulung: neuestes Zertifikat
    const latestMap = new Map<string, any>();
    for (const c of certs || []) {
      const key = `${c.user_id}_${c.schulung_id}`;
      const existing = latestMap.get(key);
      if (!existing || c.gueltig_ab > existing.gueltig_ab) latestMap.set(key, c);
    }
    const allUserIds = [...new Set([...latestMap.values()].map(c => c.user_id))];
    const { data: moreEmps } = await supabase
      .from("employees")
      .select("user_id, vorname, nachname")
      .in("user_id", allUserIds.length > 0 ? allUserIds : ["00000000-0000-0000-0000-000000000000"]);
    for (const e of moreEmps || []) {
      empMap.set(e.user_id, `${e.vorname || ""} ${e.nachname || ""}`.trim());
    }

    for (const c of latestMap.values()) {
      const tage = differenceInDays(parseISO(c.gueltig_bis), new Date());
      if (tage > 60) continue;
      rows.push({
        kind: "zertifikat",
        schulung_id: c.schulung_id,
        user_id: c.user_id,
        user_name: empMap.get(c.user_id) || "?",
        label: schMap.get(c.schulung_id) || "Schulung",
        tage_bis_ablauf: tage,
        status: tage < 0 ? "abgelaufen" : "laeuft_ab",
      });
    }

    setOffene(rows);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const toggleRow = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const rowKey = (r: OffeneUnterweisung, i: number) => `${i}_${r.kind}_${r.user_id}_${r.evaluation_id || r.schulung_id}`;

  const selectAll = () => {
    if (selected.size === offene.length) setSelected(new Set());
    else setSelected(new Set(offene.map((r, i) => rowKey(r, i))));
  };

  const sendReminders = async () => {
    if (selected.size === 0) {
      toast({ variant: "destructive", title: "Niemand ausgewählt" });
      return;
    }
    setSending(true);
    const targets = offene.filter((r, i) => selected.has(rowKey(r, i)));
    // Gruppieren pro user
    const byUser = new Map<string, OffeneUnterweisung[]>();
    for (const t of targets) {
      const list = byUser.get(t.user_id) || [];
      list.push(t);
      byUser.set(t.user_id, list);
    }

    const notifications: any[] = [];
    const pushTargets: string[] = [];
    for (const [userId, items] of byUser) {
      const labels = items.map(i => `• ${i.label}${i.kind === "zertifikat" ? ` (${i.status === "abgelaufen" ? "abgelaufen" : "läuft ab"})` : ""}`).join("\n");
      notifications.push({
        user_id: userId,
        type: "safety_reminder",
        title: items.length === 1 ? "Sicherheits-Erinnerung" : `${items.length} Sicherheits-Pflichten offen`,
        message: labels.slice(0, 500),
        metadata: { count: items.length },
      });
      pushTargets.push(userId);
    }

    await supabase.from("notifications").insert(notifications);
    await supabase.functions.invoke("send-push", {
      body: {
        user_ids: pushTargets,
        title: "Sicherheit: Erinnerung",
        body: "Du hast offene Unterweisungen oder ablaufende Zertifikate. Bitte bearbeiten.",
        url: "/safety/nachweise",
      },
    });
    toast({ title: `${notifications.length} Mitarbeiter benachrichtigt` });
    setSelected(new Set());
    setSending(false);
  };

  if (!isAdmin && !loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Erinnerungen" backPath="/safety" />
        <main className="container mx-auto px-4 py-6 max-w-2xl">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nur für Administratoren
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Erinnerungen" backPath="/safety" />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Offene Sicherheitspflichten ({offene.length})
                </CardTitle>
                <CardDescription>
                  Unterweisungen ohne Unterschrift + Zertifikate die bald ablaufen oder abgelaufen sind
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={selectAll} disabled={offene.length === 0}>
                  {selected.size === offene.length ? "Auswahl leeren" : "Alle auswählen"}
                </Button>
                <Button size="sm" disabled={selected.size === 0 || sending} onClick={sendReminders}>
                  {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  {selected.size} benachrichtigen
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Lädt...</p> : offene.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 mx-auto text-green-600 mb-2" />
                <p className="text-sm">Keine offenen Pflichten. Alles aktuell.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {offene.map((r, i) => {
                  const key = rowKey(r, i);
                  return (
                    <label key={key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected.has(key) ? "bg-primary/5 border-primary/30" : "hover:bg-muted/40"
                    }`}>
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggleRow(key)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{r.user_name}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-sm">{r.label}</span>
                          {r.status === "offen" && <Badge variant="outline" className="text-xs bg-orange-50 text-orange-800">Offen seit {r.tage_offen}d</Badge>}
                          {r.status === "laeuft_ab" && <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-800">Läuft in {r.tage_bis_ablauf}d ab</Badge>}
                          {r.status === "abgelaufen" && <Badge variant="outline" className="text-xs bg-red-50 text-red-800">Abgelaufen</Badge>}
                        </div>
                        {r.modul && <p className="text-xs text-muted-foreground mt-0.5">{r.modul}</p>}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
