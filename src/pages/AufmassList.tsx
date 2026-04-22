import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Download, Trash2, Ruler, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { confirm } from "@/lib/confirm";
import { format } from "date-fns";
import { de } from "date-fns/locale";

type Sheet = {
  id: string;
  project_id: string;
  user_id: string;
  titel: string | null;
  aufmass_nr: string | null;
  datum: string;
  bauleiter: string | null;
  gewerk: string | null;
  status: "offen" | "abgeschlossen";
  pdf_url: string | null;
  created_at: string;
};

export default function AufmassList() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const [{ data: proj }, { data: list }] = await Promise.all([
        supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
        supabase
          .from("aufmass_sheets")
          .select("*")
          .eq("project_id", projectId)
          .order("datum", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      if (proj) setProjectName(proj.name);
      if (list) setSheets(list as Sheet[]);
      setLoading(false);
    })();
  }, [projectId]);

  const createSheet = async () => {
    if (!projectId || creating) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }
    // Naechste Aufmaß-Nr automatisch vorschlagen.
    const used = sheets
      .map((s) => s.aufmass_nr || "")
      .map((n) => parseInt(n.replace(/[^0-9]/g, ""), 10))
      .filter((n) => !isNaN(n));
    const nextNr = String((used.length > 0 ? Math.max(...used) : 0) + 1).padStart(3, "0");
    const { data, error } = await supabase
      .from("aufmass_sheets")
      .insert({
        project_id: projectId,
        user_id: user.id,
        aufmass_nr: nextNr,
        datum: new Date().toISOString().split("T")[0],
      })
      .select("*")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ variant: "destructive", title: "Fehler", description: error?.message });
      return;
    }
    navigate(`/projects/${projectId}/aufmass/${data.id}`);
  };

  const downloadPdf = async (s: Sheet) => {
    if (!s.pdf_url) return;
    const { data, error } = await supabase.storage
      .from("project-aufmass")
      .createSignedUrl(s.pdf_url, 60);
    if (error || !data) {
      toast({ variant: "destructive", title: "Fehler", description: "PDF konnte nicht geladen werden." });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const deleteSheet = async (s: Sheet) => {
    if (!(await confirm({
      title: "Aufmaßblatt löschen?",
      description: "Auch das PDF wird aus dem Projekt entfernt.",
      destructive: true,
      confirmLabel: "Löschen",
    }))) return;
    if (s.pdf_url) {
      await supabase.storage.from("project-aufmass").remove([s.pdf_url]);
      await supabase.from("documents").delete().eq("file_url", s.pdf_url);
    }
    await supabase.from("aufmass_sheets").delete().eq("id", s.id);
    setSheets((prev) => prev.filter((x) => x.id !== s.id));
    toast({ title: "Gelöscht" });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Ruler className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold truncate">Aufmaßblätter</h1>
          </div>
          <Button size="sm" onClick={createSheet} disabled={creating} className="h-9">
            <Plus className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Neues Aufmaß</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-4xl space-y-2">
        {projectName && (
          <p className="text-sm text-muted-foreground mb-3">Projekt: <span className="font-medium text-foreground">{projectName}</span></p>
        )}

        {sheets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Ruler className="w-10 h-10 mx-auto mb-3" />
              <p className="font-semibold mb-1">Noch keine Aufmaßblätter</p>
              <p className="text-sm">Klicke auf "Neues Aufmaß" um eines anzulegen.</p>
            </CardContent>
          </Card>
        ) : (
          sheets.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/projects/${projectId}/aufmass/${s.id}`)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">
                        {s.aufmass_nr ? `Nr. ${s.aufmass_nr}` : "Aufmaß"}
                      </span>
                      <Badge variant={s.status === "offen" ? "outline" : "default"} className="text-xs">
                        {s.status === "offen" ? "Offen" : "Abgeschlossen"}
                      </Badge>
                      {s.gewerk && <Badge variant="secondary" className="text-xs">{s.gewerk}</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {format(new Date(s.datum), "EEEE, dd.MM.yyyy", { locale: de })}
                      {s.titel && ` · ${s.titel}`}
                    </div>
                    {s.bauleiter && (
                      <div className="text-xs text-muted-foreground">Bauleiter: {s.bauleiter}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {s.pdf_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        onClick={(e) => { e.stopPropagation(); downloadPdf(s); }}
                        title="PDF herunterladen"
                      >
                        <Download className="w-3.5 h-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">PDF</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteSheet(s); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
