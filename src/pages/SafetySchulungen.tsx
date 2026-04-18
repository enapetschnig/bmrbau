import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { confirm } from "@/lib/confirm";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Plus, Pencil, Trash2, Upload, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { format, addMonths, parseISO, differenceInDays } from "date-fns";

type Schulung = {
  id: string;
  name: string;
  beschreibung: string | null;
  kategorie: string;
  wiederholung_monate: number;
  ist_pflicht: boolean;
};

type Zertifikat = {
  id: string;
  schulung_id: string;
  user_id: string;
  zertifikat_url: string | null;
  gueltig_ab: string;
  gueltig_bis: string | null;
  notizen: string | null;
  user_name?: string;
  schulung_name?: string;
};

type Employee = { user_id: string; name: string };

export default function SafetySchulungen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<"schulungen" | "zertifikate">("schulungen");
  const [schulungen, setSchulungen] = useState<Schulung[]>([]);
  const [zertifikate, setZertifikate] = useState<Zertifikat[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Schulung-Dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Schulung | null>(null);
  const [form, setForm] = useState({ name: "", beschreibung: "", kategorie: "allgemein", wiederholung_monate: "12", ist_pflicht: false });

  // Zertifikat-Dialog
  const [certOpen, setCertOpen] = useState(false);
  const [certForm, setCertForm] = useState({
    schulung_id: "",
    user_id: "",
    gueltig_ab: new Date().toISOString().split("T")[0],
    gueltig_bis: "",
    notizen: "",
    file: null as File | null,
  });
  const [savingCert, setSavingCert] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      setIsAdmin(role?.role === "administrator");
    }
    const [schulData, zertData, empData] = await Promise.all([
      supabase.from("schulungen").select("*").order("name"),
      supabase.from("schulung_zertifikate").select("*").order("gueltig_ab", { ascending: false }),
      supabase.from("employees").select("user_id, vorname, nachname").not("user_id", "is", null),
    ]);
    setSchulungen((schulData.data as Schulung[]) || []);

    const emps = (empData.data || []).map((e: any) => ({
      user_id: e.user_id,
      name: `${e.vorname || ""} ${e.nachname || ""}`.trim() || "Unbekannt",
    }));
    setEmployees(emps);

    // Join mit Namen
    const enriched = (zertData.data || []).map((z: any) => ({
      ...z,
      user_name: emps.find(e => e.user_id === z.user_id)?.name || "?",
      schulung_name: (schulData.data as Schulung[])?.find(s => s.id === z.schulung_id)?.name || "?",
    }));
    setZertifikate(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", beschreibung: "", kategorie: "allgemein", wiederholung_monate: "12", ist_pflicht: false });
    setEditOpen(true);
  };

  const openEdit = (s: Schulung) => {
    setEditing(s);
    setForm({
      name: s.name,
      beschreibung: s.beschreibung || "",
      kategorie: s.kategorie,
      wiederholung_monate: String(s.wiederholung_monate),
      ist_pflicht: s.ist_pflicht,
    });
    setEditOpen(true);
  };

  const saveSchulung = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      beschreibung: form.beschreibung.trim() || null,
      kategorie: form.kategorie,
      wiederholung_monate: parseInt(form.wiederholung_monate) || 12,
      ist_pflicht: form.ist_pflicht,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from("schulungen").update(payload).eq("id", editing.id)
      : await supabase.from("schulungen").insert(payload);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    toast({ title: editing ? "Schulung aktualisiert" : "Schulung angelegt" });
    setEditOpen(false);
    fetchAll();
  };

  const removeSchulung = async (s: Schulung) => {
    if (!(await confirm({
      title: `Schulung "${s.name}" löschen?`,
      description: "Alle zugehörigen Zertifikate werden ebenfalls entfernt.",
      destructive: true,
      confirmLabel: "Löschen",
    }))) return;
    await supabase.from("schulungen").delete().eq("id", s.id);
    toast({ title: "Gelöscht" });
    fetchAll();
  };

  const openCertDialog = () => {
    setCertForm({
      schulung_id: schulungen[0]?.id || "",
      user_id: "",
      gueltig_ab: new Date().toISOString().split("T")[0],
      gueltig_bis: "",
      notizen: "",
      file: null,
    });
    setCertOpen(true);
  };

  const saveZertifikat = async () => {
    if (!certForm.schulung_id || !certForm.user_id) return;
    setSavingCert(true);
    try {
      let zertUrl: string | null = null;
      if (certForm.file) {
        const ext = certForm.file.name.split(".").pop() || "pdf";
        const path = `zertifikate/${certForm.user_id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("safety-materials").upload(path, certForm.file);
        if (!upErr) {
          const { data } = supabase.storage.from("safety-materials").getPublicUrl(path);
          zertUrl = data.publicUrl;
        }
      }
      // Auto-calc gueltig_bis if not set
      let gueltig_bis = certForm.gueltig_bis || null;
      if (!gueltig_bis) {
        const schulung = schulungen.find(s => s.id === certForm.schulung_id);
        if (schulung) {
          gueltig_bis = addMonths(parseISO(certForm.gueltig_ab), schulung.wiederholung_monate).toISOString().split("T")[0];
        }
      }
      const { error } = await supabase.from("schulung_zertifikate").insert({
        schulung_id: certForm.schulung_id,
        user_id: certForm.user_id,
        zertifikat_url: zertUrl,
        gueltig_ab: certForm.gueltig_ab,
        gueltig_bis,
        notizen: certForm.notizen.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Zertifikat erfasst" });
      setCertOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    } finally {
      setSavingCert(false);
    }
  };

  const getStatus = (z: Zertifikat): "aktiv" | "laeuft_ab" | "abgelaufen" => {
    if (!z.gueltig_bis) return "aktiv";
    const heute = new Date(); heute.setHours(0, 0, 0, 0);
    const days = differenceInDays(parseISO(z.gueltig_bis + "T00:00:00"), heute);
    if (days < 0) return "abgelaufen";
    if (days < 30) return "laeuft_ab";
    return "aktiv";
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Schulungen" backPath="/safety" />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex gap-1 mb-4 p-1 bg-muted/40 rounded-lg w-fit">
          <Button size="sm" variant={tab === "schulungen" ? "default" : "ghost"} onClick={() => setTab("schulungen")}>
            Schulungen ({schulungen.length})
          </Button>
          <Button size="sm" variant={tab === "zertifikate" ? "default" : "ghost"} onClick={() => setTab("zertifikate")}>
            Zertifikate ({zertifikate.length})
          </Button>
        </div>

        {tab === "schulungen" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Schulungstypen</CardTitle>
                  <CardDescription>Mit Wiederholungsintervall und Pflicht-Flag</CardDescription>
                </div>
                {isAdmin && (
                  <Button onClick={openNew}>
                    <Plus className="h-4 w-4 mr-1" /> Neue Schulung
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">Lädt...</p> : schulungen.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  Keine Schulungen angelegt
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Wiederholung</TableHead>
                      <TableHead>Pflicht</TableHead>
                      {isAdmin && <TableHead></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schulungen.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.kategorie}</TableCell>
                        <TableCell>{s.wiederholung_monate} Monate</TableCell>
                        <TableCell>
                          {s.ist_pflicht ? <Badge>Pflicht</Badge> : <Badge variant="outline">Freiwillig</Badge>}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeSchulung(s)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "zertifikate" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Zertifikate & Nachweise</CardTitle>
                  <CardDescription>Upload von Zertifikaten, Gültigkeitszeitraum, Status</CardDescription>
                </div>
                {isAdmin && (
                  <Button onClick={openCertDialog} disabled={schulungen.length === 0}>
                    <Plus className="h-4 w-4 mr-1" /> Zertifikat erfassen
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">Lädt...</p> : zertifikate.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Keine Zertifikate erfasst</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mitarbeiter</TableHead>
                      <TableHead>Schulung</TableHead>
                      <TableHead>Gültig ab</TableHead>
                      <TableHead>Gültig bis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Zertifikat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zertifikate.map((z) => {
                      const status = getStatus(z);
                      return (
                        <TableRow key={z.id}>
                          <TableCell className="font-medium">{z.user_name}</TableCell>
                          <TableCell>{z.schulung_name}</TableCell>
                          <TableCell>{format(parseISO(z.gueltig_ab), "dd.MM.yyyy")}</TableCell>
                          <TableCell>{z.gueltig_bis ? format(parseISO(z.gueltig_bis), "dd.MM.yyyy") : "—"}</TableCell>
                          <TableCell>
                            {status === "aktiv" && <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" /> Aktiv</Badge>}
                            {status === "laeuft_ab" && <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" /> Läuft ab</Badge>}
                            {status === "abgelaufen" && <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Abgelaufen</Badge>}
                          </TableCell>
                          <TableCell>
                            {z.zertifikat_url ? (
                              <a href={z.zertifikat_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">Öffnen</a>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Schulung-Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Schulung bearbeiten" : "Neue Schulung"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Erste Hilfe" /></div>
            <div><Label>Beschreibung</Label><Textarea rows={2} value={form.beschreibung} onChange={(e) => setForm({ ...form, beschreibung: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <Input value={form.kategorie} onChange={(e) => setForm({ ...form, kategorie: e.target.value })} />
              </div>
              <div>
                <Label>Wiederholung (Monate)</Label>
                <Input type="number" value={form.wiederholung_monate} onChange={(e) => setForm({ ...form, wiederholung_monate: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ist_pflicht} onCheckedChange={(c) => setForm({ ...form, ist_pflicht: c })} />
              <Label className="cursor-pointer">Pflicht-Schulung</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            <Button onClick={saveSchulung} disabled={!form.name.trim()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zertifikat-Dialog */}
      <Dialog open={certOpen} onOpenChange={setCertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zertifikat erfassen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>Schulung *</Label>
              <Select value={certForm.schulung_id} onValueChange={(v) => setCertForm({ ...certForm, schulung_id: v })}>
                <SelectTrigger><SelectValue placeholder="Schulung wählen" /></SelectTrigger>
                <SelectContent>
                  {schulungen.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mitarbeiter *</Label>
              <Select value={certForm.user_id} onValueChange={(v) => setCertForm({ ...certForm, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.user_id} value={e.user_id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Gültig ab</Label><Input type="date" value={certForm.gueltig_ab} onChange={(e) => setCertForm({ ...certForm, gueltig_ab: e.target.value })} /></div>
              <div><Label>Gültig bis</Label><Input type="date" value={certForm.gueltig_bis} onChange={(e) => setCertForm({ ...certForm, gueltig_bis: e.target.value })} placeholder="auto" /></div>
            </div>
            <div>
              <Label>Zertifikat-Datei (optional)</Label>
              <Input type="file" accept="image/*,.pdf" onChange={(e) => setCertForm({ ...certForm, file: e.target.files?.[0] || null })} />
            </div>
            <div><Label>Notizen</Label><Textarea rows={2} value={certForm.notizen} onChange={(e) => setCertForm({ ...certForm, notizen: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertOpen(false)}>Abbrechen</Button>
            <Button onClick={saveZertifikat} disabled={savingCert || !certForm.schulung_id || !certForm.user_id}>
              {savingCert ? "Speichert..." : <><Upload className="h-4 w-4 mr-1" /> Speichern</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
