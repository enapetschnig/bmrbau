import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, HardHat, Wrench, GraduationCap, FileCheck, Bell, ShieldAlert } from "lucide-react";

type Stats = {
  jahr: { total: number; offen: number };
  baustelle: { total: number; offen: number };
  geraet: { total: number; offen: number };
  schulungen: number;
  nachweise_offen: number;
};

export default function SafetyHub() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    jahr: { total: 0, offen: 0 },
    baustelle: { total: 0, offen: 0 },
    geraet: { total: 0, offen: 0 },
    schulungen: 0,
    nachweise_offen: 0,
  });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      setIsAdmin(role?.role === "administrator");

      const [jahr, baustelle, geraet, schulungen, offeneEvals] = await Promise.all([
        supabase.from("safety_evaluations").select("id, status", { count: "exact" }).eq("modul", "jahresunterweisung"),
        supabase.from("safety_evaluations").select("id, status", { count: "exact" }).eq("modul", "baustellenunterweisung"),
        supabase.from("safety_evaluations").select("id, status", { count: "exact" }).eq("modul", "geraeteunterweisung"),
        supabase.from("schulungen").select("id", { count: "exact", head: true }),
        supabase.from("safety_evaluation_employees")
          .select("evaluation_id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      const cnt = (data: any[] | null) => ({
        total: data?.length || 0,
        offen: (data || []).filter((e: any) => e.status !== "abgeschlossen").length,
      });

      setStats({
        jahr: cnt(jahr.data),
        baustelle: cnt(baustelle.data),
        geraet: cnt(geraet.data),
        schulungen: schulungen.count || 0,
        nachweise_offen: offeneEvals.count || 0,
      });
    })();
  }, []);

  const modules = [
    {
      key: "jahresunterweisungen",
      label: "Jahresunterweisungen",
      icon: <Calendar className="h-6 w-6 text-blue-600" />,
      description: "Videos, PDFs, Fragenkatalog zur Sicherheitsunterweisung für das ganze Jahr",
      path: "/safety/jahresunterweisungen",
      stat: `${stats.jahr.total - stats.jahr.offen} / ${stats.jahr.total} abgeschlossen`,
      color: "border-blue-200 dark:border-blue-800",
    },
    {
      key: "baustellenunterweisungen",
      label: "Baustellenunterweisungen",
      icon: <HardHat className="h-6 w-6 text-orange-600" />,
      description: "Projektspezifische Unterweisungen mit Vorlagen-System",
      path: "/safety/baustellenunterweisungen",
      stat: `${stats.baustelle.total} Unterweisungen`,
      color: "border-orange-200 dark:border-orange-800",
    },
    {
      key: "geraeteunterweisungen",
      label: "Geräteunterweisungen",
      icon: <Wrench className="h-6 w-6 text-purple-600" />,
      description: "Ziegelsäge, Kran, Schalungssystem etc. — Sicherheit, Bedienung, Gefahren",
      path: "/safety/geraeteunterweisungen",
      stat: `${stats.geraet.total} Unterweisungen`,
      color: "border-purple-200 dark:border-purple-800",
    },
    {
      key: "schulungen",
      label: "Schulungen",
      icon: <GraduationCap className="h-6 w-6 text-green-600" />,
      description: "Erste Hilfe, Brandschutz, Spezialschulungen — mit Wiederholungsintervallen",
      path: "/safety/schulungen",
      stat: `${stats.schulungen} Schulungen definiert`,
      color: "border-green-200 dark:border-green-800",
    },
    {
      key: "nachweise",
      label: "Nachweise",
      icon: <FileCheck className="h-6 w-6 text-teal-600" />,
      description: "Pro-Mitarbeiter-Übersicht aller Unterweisungen & Zertifikate, PDF-Export",
      path: "/safety/nachweise",
      stat: stats.nachweise_offen > 0 ? `${stats.nachweise_offen} offen` : "Alle aktuell",
      color: "border-teal-200 dark:border-teal-800",
    },
    {
      key: "erinnerungen",
      label: "Erinnerungen",
      icon: <Bell className="h-6 w-6 text-red-600" />,
      description: "Automatische Benachrichtigungen bei offenen Pflichten & ablaufenden Zertifikaten",
      path: "/safety/erinnerungen",
      stat: "Benachrichtigungen",
      color: "border-red-200 dark:border-red-800",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Sicherheit" backPath="/" />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
          <ShieldAlert className="h-6 w-6 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Sicherheits-Dashboard</p>
            <p className="text-xs text-muted-foreground">
              Vollständig digital dokumentiert, revisionssicher (PDF-Nachweise), Excel-kompatibel, einfach bedienbar für Baupersonal.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
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
      </main>
    </div>
  );
}
