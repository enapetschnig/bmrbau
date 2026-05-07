import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar,
  HardHat,
  Wrench,
  GraduationCap,
  FileCheck,
  Bell,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { parseISO, differenceInDays } from "date-fns";

type AdminStats = {
  jahr: { total: number; offen: number };
  baustelle: { total: number; offen: number };
  geraet: { total: number; offen: number };
  schulungen: number;
  offenGesamt: number;
  ablaufGesamt: number;
};

type ModulType = "jahresunterweisung" | "baustellenunterweisung" | "geraeteunterweisung";

type OpenTask =
  | {
      kind: "unterweisung";
      id: string;
      titel: string;
      modul: ModulType;
      projectName?: string | null;
    }
  | {
      kind: "schulung";
      id: string;
      titel: string;
    };

type ExpiringCert = {
  id: string;
  schulungName: string;
  gueltig_bis: string;
  tage: number; // negativ = abgelaufen
};

const MODUL_LABEL: Record<ModulType, string> = {
  jahresunterweisung: "Jahres",
  baustellenunterweisung: "Baustelle",
  geraeteunterweisung: "Gerät",
};

const MODUL_COLOR: Record<ModulType, string> = {
  jahresunterweisung: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  baustellenunterweisung: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  geraeteunterweisung: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
};

type Role = "administrator" | "vorarbeiter" | "facharbeiter" | "lehrling" | "hilfsarbeiter" | "extern" | null;

export default function SafetyHub() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>(null);
  const [userId, setUserId] = useState<string>("");

  // Admin-Daten
  const [stats, setStats] = useState<AdminStats>({
    jahr: { total: 0, offen: 0 },
    baustelle: { total: 0, offen: 0 },
    geraet: { total: 0, offen: 0 },
    schulungen: 0,
    offenGesamt: 0,
    ablaufGesamt: 0,
  });

  // Mitarbeiter-Daten
  const [openTasks, setOpenTasks] = useState<OpenTask[]>([]);
  const [expiringCerts, setExpiringCerts] = useState<ExpiringCert[]>([]);
  const [signedCount, setSignedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const isAdminView = role === "administrator" || role === "vorarbeiter";

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      setRole((roleData?.role as Role) ?? "facharbeiter");
    })();
  }, []);

  useEffect(() => {
    if (!userId || role === null) return;
    (async () => {
      setLoading(true);
      if (role === "administrator" || role === "vorarbeiter") {
        await loadAdminStats();
      } else {
        await loadMitarbeiterSicht(userId);
      }
      setLoading(false);
    })();
  }, [userId, role]);

  const loadAdminStats = async () => {
    const [jahr, baustelle, geraet, schulungenCount] = await Promise.all([
      supabase.from("safety_evaluations").select("id, status").eq("modul", "jahresunterweisung"),
      supabase.from("safety_evaluations").select("id, status").eq("modul", "baustellenunterweisung"),
      supabase.from("safety_evaluations").select("id, status").eq("modul", "geraeteunterweisung"),
      supabase.from("schulungen").select("id", { count: "exact", head: true }),
    ]);

    const cnt = (data: { status: string }[] | null) => ({
      total: data?.length || 0,
      offen: (data || []).filter((e) => e.status !== "abgeschlossen").length,
    });
    const jahrC = cnt(jahr.data as any);
    const bauC = cnt(baustelle.data as any);
    const geraetC = cnt(geraet.data as any);

    // Ablaufende Zertifikate (in den naechsten 60 Tagen)
    const { data: zerts } = await supabase
      .from("schulung_zertifikate")
      .select("gueltig_bis")
      .not("gueltig_bis", "is", null);
    const heute = new Date(); heute.setHours(0, 0, 0, 0);
    const ablaufGesamt = (zerts || []).filter((z: any) => {
      const tage = differenceInDays(parseISO(z.gueltig_bis + "T00:00:00"), heute);
      return tage >= 0 && tage <= 60;
    }).length;

    setStats({
      jahr: jahrC,
      baustelle: bauC,
      geraet: geraetC,
      schulungen: schulungenCount.count || 0,
      offenGesamt: jahrC.offen + bauC.offen + geraetC.offen,
      ablaufGesamt,
    });
  };

  const loadMitarbeiterSicht = async (uid: string) => {
    // 1) Offene Unterweisungen (MA zugewiesen + noch nicht unterschrieben)
    //    PLUS 2) Fehlende Pflicht-Schulungen (MA hat kein Zertifikat)
    //    PLUS 3) Ablaufende / abgelaufene Zertifikate (konsistent zu Nachweise).
    const [
      { data: assignedRaw },
      { data: signedRaw },
      { data: certs },
      { data: pflichtSchulungen },
    ] = await Promise.all([
      supabase.from("safety_evaluation_employees").select("evaluation_id").eq("user_id", uid),
      supabase.from("safety_evaluation_signatures").select("evaluation_id").eq("user_id", uid),
      supabase
        .from("schulung_zertifikate")
        .select("id, schulung_id, gueltig_ab, gueltig_bis")
        .eq("user_id", uid),
      supabase.from("schulungen").select("id, name, ist_pflicht").eq("ist_pflicht", true),
    ]);

    const assigned = new Set((assignedRaw || []).map((r: any) => r.evaluation_id));
    const signed = new Set((signedRaw || []).map((r: any) => r.evaluation_id));
    setSignedCount(signed.size);

    const openList: OpenTask[] = [];

    // (1) Unterweisungen zur Unterschrift
    const openEvalIds = Array.from(assigned).filter((id) => !signed.has(id));
    if (openEvalIds.length > 0) {
      const { data: evs } = await supabase
        .from("safety_evaluations")
        .select("id, titel, modul, project_id")
        .in("id", openEvalIds);
      const projectIds = Array.from(
        new Set((evs || []).map((e: any) => e.project_id).filter(Boolean)),
      );
      const { data: projs } = projectIds.length
        ? await supabase.from("projects").select("id, name").in("id", projectIds)
        : { data: [] };
      const projectMap = new Map((projs || []).map((p: any) => [p.id, p.name as string]));
      for (const e of evs || []) {
        openList.push({
          kind: "unterweisung",
          id: e.id,
          titel: e.titel,
          modul: e.modul as ModulType,
          projectName: e.project_id ? projectMap.get(e.project_id) ?? null : null,
        });
      }
    }

    // (2) Fehlende Pflicht-Schulungen: Schulung hat ist_pflicht=true, aber es
    //     existiert kein Zertifikat fuer den MA.
    const schulungIdsWithCert = new Set(
      (certs || []).map((c: any) => c.schulung_id).filter(Boolean),
    );
    for (const s of pflichtSchulungen || []) {
      if (!schulungIdsWithCert.has(s.id)) {
        openList.push({ kind: "schulung", id: s.id, titel: s.name });
      }
    }

    setOpenTasks(openList);

    // (3) Ablaufende/abgelaufene Zertifikate: pro Schulung juengstes Zertifikat
    const latestPerSchulung = new Map<string, any>();
    for (const c of certs || []) {
      if (!c.gueltig_bis) continue;
      const prev = latestPerSchulung.get(c.schulung_id);
      if (!prev || parseISO(c.gueltig_bis) > parseISO(prev.gueltig_bis)) {
        latestPerSchulung.set(c.schulung_id, c);
      }
    }

    const schulungIdsFromCerts = Array.from(latestPerSchulung.keys());
    const { data: schulungen } = schulungIdsFromCerts.length
      ? await supabase.from("schulungen").select("id, name").in("id", schulungIdsFromCerts)
      : { data: [] };
    const sMap = new Map((schulungen || []).map((s: any) => [s.id, s.name as string]));

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const expList: ExpiringCert[] = [];
    for (const c of latestPerSchulung.values()) {
      const tage = differenceInDays(parseISO(c.gueltig_bis + "T00:00:00"), heute);
      if (tage <= 60) {
        expList.push({
          id: c.id,
          schulungName: sMap.get(c.schulung_id) || "Schulung",
          gueltig_bis: c.gueltig_bis,
          tage,
        });
      }
    }
    expList.sort((a, b) => a.tage - b.tage);
    setExpiringCerts(expList);
  };

  // ========== ADMIN-SICHT ==========
  const adminModules = [
    {
      key: "jahresunterweisungen",
      label: "Jahresunterweisungen",
      icon: <Calendar className="h-6 w-6 text-blue-600" />,
      description: "Videos, PDFs, Fragen zur Sicherheitsunterweisung fürs ganze Jahr",
      path: "/safety/jahresunterweisungen",
      stat: `${stats.jahr.total - stats.jahr.offen} / ${stats.jahr.total} abgeschlossen`,
      color: "border-blue-200 dark:border-blue-800",
    },
    {
      key: "baustellenunterweisungen",
      label: "Baustellenunterweisungen",
      icon: <HardHat className="h-6 w-6 text-orange-600" />,
      description: "Projektspezifische Unterweisungen mit Vorlagen",
      path: "/safety/baustellenunterweisungen",
      stat: `${stats.baustelle.total} Unterweisungen`,
      color: "border-orange-200 dark:border-orange-800",
    },
    {
      key: "geraeteunterweisungen",
      label: "Geräteunterweisungen",
      icon: <Wrench className="h-6 w-6 text-purple-600" />,
      description: "Ziegelsäge, Kran, Schalungssystem – Sicherheit & Bedienung",
      path: "/safety/geraeteunterweisungen",
      stat: `${stats.geraet.total} Unterweisungen`,
      color: "border-purple-200 dark:border-purple-800",
    },
    {
      key: "schulungen",
      label: "Schulungen",
      icon: <GraduationCap className="h-6 w-6 text-green-600" />,
      description: "Erste Hilfe, Brandschutz – mit Wiederholungsintervallen",
      path: "/safety/schulungen",
      stat: `${stats.schulungen} Schulungen definiert`,
      color: "border-green-200 dark:border-green-800",
    },
    {
      key: "nachweise",
      label: "Nachweise je Mitarbeiter",
      icon: <FileCheck className="h-6 w-6 text-teal-600" />,
      description: "Pro-MA-Übersicht aller Unterweisungen & Zertifikate, PDF-Export",
      path: "/safety/nachweise",
      stat: "",
      color: "border-teal-200 dark:border-teal-800",
    },
    {
      key: "erinnerungen",
      label: "Erinnerungen",
      icon: <Bell className="h-6 w-6 text-red-600" />,
      description: "Automatische Benachrichtigungen bei offenen Pflichten & ablaufenden Zertifikaten",
      path: "/safety/erinnerungen",
      stat: stats.ablaufGesamt > 0 ? `${stats.ablaufGesamt} ablaufend` : "Alle aktuell",
      color: "border-red-200 dark:border-red-800",
    },
  ];

  // ========== RENDERING ==========
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Sicherheit" backPath="/" />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {isAdminView ? (
          <>
            {/* Admin-Status-Leiste */}
            <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile
                label="Offen gesamt"
                value={stats.offenGesamt}
                icon={<AlertCircle className="h-5 w-5 text-orange-500" />}
              />
              <StatTile
                label="Bald ablaufend"
                value={stats.ablaufGesamt}
                icon={<Bell className="h-5 w-5 text-red-500" />}
              />
              <StatTile
                label="Schulungen"
                value={stats.schulungen}
                icon={<GraduationCap className="h-5 w-5 text-green-500" />}
              />
              <StatTile
                label="Jahres-Unterw."
                value={`${stats.jahr.total - stats.jahr.offen}/${stats.jahr.total}`}
                icon={<Calendar className="h-5 w-5 text-blue-500" />}
              />
            </div>

            <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
              <ShieldAlert className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Sicherheits-Verwaltung</p>
                <p className="text-xs text-muted-foreground">
                  Revisionssicher (PDF-Nachweise), Excel-kompatibel, einfach bedienbar für Baupersonal.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminModules.map((m) => (
                <Card
                  key={m.key}
                  className={`cursor-pointer hover:shadow-lg transition-all border-2 ${m.color}`}
                  onClick={() => navigate(m.path)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      {m.icon}
                      {m.stat && (
                        <Badge variant="outline" className="text-xs">{m.stat}</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{m.label}</CardTitle>
                    <CardDescription>{m.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Mitarbeiter-Sicht: vereinfachte 3-Kachel-Ansicht */}
            <MitarbeiterHub
              loading={loading}
              openTasks={openTasks}
              expiringCerts={expiringCerts}
              signedCount={signedCount}
              onOpenTask={(task) => {
                // Unterweisung -> Bestaetigungs-Seite. Fehlende Pflicht-
                // Schulung -> Nachweise-Seite, damit der MA sieht woran es liegt.
                if (task.kind === "unterweisung") navigate(`/safety/bestaetigen/${task.id}`);
                else navigate("/safety/nachweise");
              }}
              onOpenNachweise={() => navigate("/safety/nachweise")}
            />
          </>
        )}
      </main>
    </div>
  );
}

// ---- Subkomponenten ----

function StatTile({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

function MitarbeiterHub({
  loading,
  openTasks,
  expiringCerts,
  signedCount,
  onOpenTask,
  onOpenNachweise,
}: {
  loading: boolean;
  openTasks: OpenTask[];
  expiringCerts: ExpiringCert[];
  signedCount: number;
  onOpenTask: (task: OpenTask) => void;
  onOpenNachweise: () => void;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Lade…</p>;

  return (
    <div className="space-y-4">
      {/* Offene Unterweisungen */}
      <Card className={`border-2 ${openTasks.length > 0 ? "border-orange-300 dark:border-orange-700 bg-orange-50/40 dark:bg-orange-950/10" : "border-border"}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className={openTasks.length > 0 ? "h-5 w-5 text-orange-600" : "h-5 w-5 text-muted-foreground"} />
            {openTasks.length > 0 ? `Offen für dich (${openTasks.length})` : "Keine offenen Unterweisungen"}
          </CardTitle>
          <CardDescription>
            {openTasks.length > 0
              ? "Diese Unterweisungen warten auf deine Unterschrift."
              : "Alles erledigt. Gute Arbeit!"}
          </CardDescription>
        </CardHeader>
        {openTasks.length > 0 && (
          <CardContent className="space-y-2">
            {openTasks.map((t) => {
              const badgeClass =
                t.kind === "schulung"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                  : MODUL_COLOR[t.modul];
              const badgeLabel = t.kind === "schulung" ? "Fehlt" : MODUL_LABEL[t.modul];
              return (
                <button
                  key={`${t.kind}-${t.id}`}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted transition-colors"
                  onClick={() => onOpenTask(t)}
                >
                  <Badge className={`text-[10px] uppercase tracking-wide ${badgeClass}`}>
                    {badgeLabel}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{t.titel}</p>
                    {t.kind === "unterweisung" && t.projectName && (
                      <p className="text-xs text-muted-foreground truncate">Projekt: {t.projectName}</p>
                    )}
                    {t.kind === "schulung" && (
                      <p className="text-xs text-muted-foreground truncate">Pflicht-Schulung – noch kein gültiges Zertifikat</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* Meine Nachweise + Bald ablaufend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-all border-2 border-teal-200 dark:border-teal-800"
          onClick={onOpenNachweise}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <FileCheck className="h-6 w-6 text-teal-600" />
              <Badge variant="outline" className="text-xs">{signedCount} unterschrieben</Badge>
            </div>
            <CardTitle className="text-lg">Meine Nachweise</CardTitle>
            <CardDescription>
              Alle Unterschriften, Zertifikate und Schulungen mit PDF-Export.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" className="w-full">Öffnen</Button>
          </CardContent>
        </Card>

        <Card className={`border-2 ${expiringCerts.length > 0 ? "border-red-300 dark:border-red-700" : "border-green-200 dark:border-green-800"}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              {expiringCerts.length > 0 ? <Bell className="h-6 w-6 text-red-600" /> : <CheckCircle2 className="h-6 w-6 text-green-600" />}
              <Badge variant="outline" className="text-xs">
                {expiringCerts.length > 0 ? `${expiringCerts.length} ablaufend` : "Alle aktuell"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Bald ablaufend</CardTitle>
            <CardDescription>
              Zertifikate, die in den nächsten 60 Tagen fällig werden.
            </CardDescription>
          </CardHeader>
          {expiringCerts.length > 0 && (
            <CardContent className="space-y-2 pt-0">
              {expiringCerts.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{c.schulungName}</span>
                  <Badge
                    variant="outline"
                    className={
                      c.tage < 0
                        ? "text-xs border-red-300 text-red-700"
                        : c.tage <= 14
                          ? "text-xs border-red-300 text-red-700"
                          : "text-xs"
                    }
                  >
                    {c.tage < 0 ? "abgelaufen" : c.tage === 0 ? "heute" : `${c.tage} Tg.`}
                  </Badge>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
