import { useState, useEffect } from "react";
import { Plus, Package, Trash2, Download, Upload, FileText, Filter, Image as ImageIcon, User } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { confirm } from "@/lib/confirm";
import { PageHeader } from "@/components/PageHeader";
import { VoiceAIInput } from "@/components/VoiceAIInput";

type Project = { id: string; name: string };
type Bestellung = {
  id: string;
  project_id: string | null;
  erstellt_von: string;
  zugewiesen_an: string | null;
  typ: string;
  titel: string;
  beschreibung: string | null;
  status: string;
  lieferant: string | null;
  produktgruppe: string | null;
  dokument_url: string | null;
  notizen: string | null;
  created_at: string;
};
type Position = { id: string; artikel: string; menge: number | null; einheit: string | null };
type Employee = { user_id: string; name: string; kategorie: string };

const STATUS_COLORS: Record<string, string> = {
  angefragt: "bg-yellow-100 text-yellow-800",
  teilweise_bestellt: "bg-blue-100 text-blue-800",
  bestellt: "bg-green-100 text-green-800",
  offen: "bg-yellow-100 text-yellow-800",
  nicht_vollstaendig: "bg-orange-100 text-orange-800",
  vollstaendig: "bg-green-100 text-green-800",
};
const STATUS_LABELS: Record<string, string> = {
  angefragt: "Angefragt",
  teilweise_bestellt: "Teilw. bestellt",
  bestellt: "Bestellt",
  offen: "Offen",
  nicht_vollstaendig: "Nicht vollständig",
  vollstaendig: "Vollständig",
};

const triggerPush = async (userIds: string[], title: string, body: string, url?: string) => {
  if (userIds.length === 0) return;
  try {
    await supabase.functions.invoke("send-push", { body: { user_ids: userIds, title, body, url } });
  } catch { /* Push optional */ }
};

export default function Bestellungen() {
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bestellungen, setBestellungen] = useState<Bestellung[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    titel: "", beschreibung: "", projectId: "", lieferant: "",
    produktgruppe: "", zugewiesenAn: "",
  });
  const [formPositions, setFormPositions] = useState<{ artikel: string; menge: string; einheit: string }[]>([
    { artikel: "", menge: "", einheit: "Stk" },
  ]);
  const [formDocument, setFormDocument] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Detail view
  const [selectedOrder, setSelectedOrder] = useState<Bestellung | null>(null);
  const [orderPositions, setOrderPositions] = useState<Position[]>([]);

  // Filters
  const [filterLieferant, setFilterLieferant] = useState("");
  const [filterProduktgruppe, setFilterProduktgruppe] = useState("");
  const [filterStatus, setFilterStatus] = useState("alle");
  const [filterProjekt, setFilterProjekt] = useState("alle");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const adminFlag = roleData?.role === "administrator";
    setIsAdmin(adminFlag);

    const [{ data: projData }, { data: profData }, { data: empData }] = await Promise.all([
      supabase.from("projects").select("id, name").eq("status", "aktiv").order("name"),
      supabase.from("profiles").select("id, vorname, nachname"),
      supabase.from("employees").select("user_id, vorname, nachname, kategorie"),
    ]);
    if (projData) setProjects(projData);
    if (profData) {
      const map: Record<string, string> = {};
      profData.forEach((p: any) => { map[p.id] = `${p.vorname || ""} ${p.nachname || ""}`.trim(); });
      setProfiles(map);
    }
    if (empData) {
      setEmployees(empData
        .filter((e: any) => e.user_id)
        .map((e: any) => ({
          user_id: e.user_id,
          name: `${e.vorname || ""} ${e.nachname || ""}`.trim(),
          kategorie: e.kategorie || "",
        })));
    }
    fetchBestellungen();
  };

  const fetchBestellungen = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bestellungen")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setBestellungen(data as Bestellung[]);
    setLoading(false);
  };

  const uploadDocument = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("bestellungen").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      toast({ variant: "destructive", title: "Upload fehlgeschlagen", description: error.message });
      return null;
    }
    const { data } = supabase.storage.from("bestellungen").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreate = async () => {
    if (!formData.titel.trim()) return;
    setSaving(true);

    let documentUrl: string | null = null;
    if (formDocument) {
      documentUrl = await uploadDocument(formDocument);
      if (!documentUrl) { setSaving(false); return; }
    }

    const typ = isAdmin ? "chef" : "mitarbeiter";
    const { data, error } = await supabase.from("bestellungen").insert({
      erstellt_von: userId,
      typ,
      titel: formData.titel.trim(),
      beschreibung: formData.beschreibung.trim() || null,
      project_id: formData.projectId || null,
      lieferant: formData.lieferant.trim() || null,
      produktgruppe: formData.produktgruppe.trim() || null,
      zugewiesen_an: isAdmin ? (formData.zugewiesenAn || null) : null,
      dokument_url: documentUrl,
      status: isAdmin ? "offen" : "angefragt",
    }).select().single();

    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      setSaving(false);
      return;
    }

    const newOrder = data as Bestellung;

    // Positionen speichern
    const validPositions = formPositions.filter(p => p.artikel.trim());
    if (validPositions.length > 0) {
      await supabase.from("bestellpositionen").insert(
        validPositions.map(p => ({
          bestellung_id: newOrder.id,
          artikel: p.artikel.trim(),
          menge: p.menge ? parseFloat(p.menge) : null,
          einheit: p.einheit || null,
        }))
      );
    }

    // Benachrichtigungen
    if (typ === "mitarbeiter") {
      // Alle Admins benachrichtigen
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "administrator");
      const adminIds = (admins || []).map((a: any) => a.user_id);
      if (adminIds.length > 0) {
        await supabase.from("notifications").insert(
          adminIds.map(uid => ({
            user_id: uid,
            type: "bestellung_angefragt",
            title: "Neue Bestellung angefragt",
            message: `${formData.titel} wurde angefragt.`,
            metadata: { bestellung_id: newOrder.id },
          }))
        );
        triggerPush(adminIds, "Neue Bestellung angefragt", `${formData.titel} wurde angefragt.`, "/bestellungen");
      }
    } else if (typ === "chef" && formData.zugewiesenAn) {
      // Zugewiesenem Polier benachrichtigen
      await supabase.from("notifications").insert({
        user_id: formData.zugewiesenAn,
        type: "bestellung_kontrolle",
        title: "Bestellung zur Kontrolle",
        message: `${formData.titel} wartet auf deine Kontrolle.`,
        metadata: { bestellung_id: newOrder.id },
      });
      triggerPush([formData.zugewiesenAn], "Bestellung zur Kontrolle", `${formData.titel} wartet auf deine Kontrolle.`, "/bestellungen");
    }

    toast({ title: "Bestellung erstellt" });
    setShowForm(false);
    setFormData({ titel: "", beschreibung: "", projectId: "", lieferant: "", produktgruppe: "", zugewiesenAn: "" });
    setFormPositions([{ artikel: "", menge: "", einheit: "Stk" }]);
    setFormDocument(null);
    fetchBestellungen();
    setSaving(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    await supabase.from("bestellungen").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
    setBestellungen(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
    if (selectedOrder?.id === id) setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);

    const order = bestellungen.find(b => b.id === id);
    if (order && order.erstellt_von !== userId) {
      await supabase.from("notifications").insert({
        user_id: order.erstellt_von,
        type: "bestellung_status",
        title: `Bestellung: ${STATUS_LABELS[newStatus]}`,
        message: `"${order.titel}" wurde auf "${STATUS_LABELS[newStatus]}" gesetzt.`,
        metadata: { bestellung_id: id },
      });
      triggerPush([order.erstellt_von], `Bestellung: ${STATUS_LABELS[newStatus]}`, `"${order.titel}" wurde auf "${STATUS_LABELS[newStatus]}" gesetzt.`, "/bestellungen");
    }

    toast({ title: `Status auf "${STATUS_LABELS[newStatus]}" geändert` });
  };

  const openDetail = async (order: Bestellung) => {
    setSelectedOrder(order);
    const { data } = await supabase.from("bestellpositionen").select("*").eq("bestellung_id", order.id);
    setOrderPositions((data as Position[]) || []);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({ title: "Bestellung wirklich löschen?", destructive: true, confirmLabel: "Löschen" }))) return;
    await supabase.from("bestellungen").delete().eq("id", id);
    setBestellungen(prev => prev.filter(b => b.id !== id));
    setSelectedOrder(null);
    toast({ title: "Bestellung gelöscht" });
  };

  // Eindeutige Lieferanten/Produktgruppen aus Daten
  const uniqueLieferanten = Array.from(new Set(bestellungen.map(b => b.lieferant).filter(Boolean))) as string[];
  const uniqueProduktgruppen = Array.from(new Set(bestellungen.map(b => b.produktgruppe).filter(Boolean))) as string[];

  // Gefiltert
  const applyFilters = (list: Bestellung[]) => list.filter(b => {
    if (filterStatus !== "alle" && b.status !== filterStatus) return false;
    if (filterProjekt !== "alle" && b.project_id !== filterProjekt) return false;
    if (filterLieferant && !(b.lieferant || "").toLowerCase().includes(filterLieferant.toLowerCase())) return false;
    if (filterProduktgruppe && !(b.produktgruppe || "").toLowerCase().includes(filterProduktgruppe.toLowerCase())) return false;
    return true;
  });

  const filteredAll = applyFilters(bestellungen);
  const chefOrders = filteredAll.filter(b => b.typ === "chef");
  const maOrders = filteredAll.filter(b => b.typ === "mitarbeiter");

  const exportExcel = (rows: Bestellung[]) => {
    const data = rows.map(b => ({
      Titel: b.titel,
      Typ: b.typ === "chef" ? "Chef" : "Mitarbeiter",
      Status: STATUS_LABELS[b.status] || b.status,
      Lieferant: b.lieferant || "",
      Produktgruppe: b.produktgruppe || "",
      Projekt: projects.find(p => p.id === b.project_id)?.name || "",
      Zugewiesen: b.zugewiesen_an ? (profiles[b.zugewiesen_an] || "") : "",
      Erstellt: new Date(b.created_at).toLocaleDateString("de-AT"),
      "Erstellt von": profiles[b.erstellt_von] || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bestellungen");
    XLSX.writeFile(wb, `Bestellungen_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = async (rows: Bestellung[]) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 14;
    let y = margin;

    doc.setFontSize(16);
    doc.text("Bestellungen", margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Erstellt am ${new Date().toLocaleDateString("de-AT")} · ${rows.length} Eintrag/Eintraege`, margin, y);
    doc.setTextColor(0);
    y += 8;

    // Positionen fuer alle auf einmal
    const orderIds = rows.map(r => r.id);
    const positionsByOrder: Record<string, Position[]> = {};
    if (orderIds.length > 0) {
      const { data: allPos } = await supabase.from("bestellpositionen").select("*").in("bestellung_id", orderIds);
      for (const p of (allPos || []) as Position[]) {
        const anyPos: any = p;
        const bid = anyPos.bestellung_id as string;
        if (!positionsByOrder[bid]) positionsByOrder[bid] = [];
        positionsByOrder[bid].push(p);
      }
    }

    for (const b of rows) {
      if (y > 270) { doc.addPage(); y = margin; }
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`${b.titel}`, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      y += 5;

      const metaParts = [
        `Typ: ${b.typ === "chef" ? "Chef" : "Mitarbeiter"}`,
        `Status: ${STATUS_LABELS[b.status] || b.status}`,
        b.lieferant ? `Lieferant: ${b.lieferant}` : null,
        b.produktgruppe ? `Produktgruppe: ${b.produktgruppe}` : null,
        b.project_id ? `Projekt: ${projects.find(p => p.id === b.project_id)?.name || "-"}` : null,
        `Erstellt: ${new Date(b.created_at).toLocaleDateString("de-AT")} von ${profiles[b.erstellt_von] || "-"}`,
        b.zugewiesen_an ? `Zugewiesen: ${profiles[b.zugewiesen_an] || "-"}` : null,
      ].filter(Boolean).join(" · ");
      const metaLines = doc.splitTextToSize(metaParts, 180);
      doc.text(metaLines, margin, y);
      y += 4 * metaLines.length;

      if (b.beschreibung) {
        const descLines = doc.splitTextToSize(b.beschreibung, 180);
        doc.text(descLines, margin, y);
        y += 4 * descLines.length;
      }

      const pos = positionsByOrder[b.id] || [];
      if (pos.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.text("Positionen:", margin, y);
        doc.setFont("helvetica", "normal");
        y += 4;
        for (const p of pos) {
          if (y > 280) { doc.addPage(); y = margin; }
          doc.text(`• ${p.artikel} — ${p.menge ?? ""} ${p.einheit || ""}`.trim(), margin + 3, y);
          y += 4;
        }
      }

      y += 4;
      doc.setDrawColor(220);
      doc.line(margin, y, 210 - margin, y);
      y += 4;
    }

    doc.save(`Bestellungen_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const mineAssignedOpen = bestellungen.filter(b =>
    b.typ === "chef" && b.zugewiesen_an === userId && (b.status === "offen" || b.status === "nicht_vollstaendig")
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Bestellungen" />
      <main className="container mx-auto px-4 py-6 max-w-5xl">

        {/* Banner fuer zugewiesene offene Chef-Bestellungen */}
        {mineAssignedOpen.length > 0 && (
          <Card className="mb-4 border-2 border-orange-400 bg-orange-50">
            <CardContent className="p-4 flex items-center gap-3">
              <Package className="h-6 w-6 text-orange-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-orange-900">
                  {mineAssignedOpen.length} Bestellung{mineAssignedOpen.length === 1 ? "" : "en"} zur Kontrolle
                </p>
                <p className="text-xs text-orange-800">
                  Prüfe, ob die Lieferung vollständig ist und setze den Status.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <p className="text-sm text-muted-foreground">{filteredAll.length} von {bestellungen.length} Bestellungen</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-1" /> Filter {showFilters ? "ausblenden" : "einblenden"}
            </Button>
            {filteredAll.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() => exportExcel(filteredAll)}>
                  <Download className="w-4 h-4 mr-1" /> Excel
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportPDF(filteredAll)}>
                  <FileText className="w-4 h-4 mr-1" /> PDF
                </Button>
              </>
            )}
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Neue Bestellung
            </Button>
          </div>
        </div>

        {/* Filter-Panel */}
        {showFilters && (
          <Card className="mb-4">
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle</SelectItem>
                    <SelectItem value="offen">Offen</SelectItem>
                    <SelectItem value="nicht_vollstaendig">Nicht vollständig</SelectItem>
                    <SelectItem value="vollstaendig">Vollständig</SelectItem>
                    <SelectItem value="angefragt">Angefragt</SelectItem>
                    <SelectItem value="teilweise_bestellt">Teilw. bestellt</SelectItem>
                    <SelectItem value="bestellt">Bestellt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Projekt</Label>
                <Select value={filterProjekt} onValueChange={setFilterProjekt}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle Projekte</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Lieferant</Label>
                <Input
                  className="h-9"
                  placeholder={uniqueLieferanten[0] || "Suche..."}
                  value={filterLieferant}
                  onChange={e => setFilterLieferant(e.target.value)}
                  list="lieferanten-list"
                />
                <datalist id="lieferanten-list">
                  {uniqueLieferanten.map(l => <option key={l} value={l} />)}
                </datalist>
              </div>
              <div>
                <Label className="text-xs">Produktgruppe</Label>
                <Input
                  className="h-9"
                  placeholder={uniqueProduktgruppen[0] || "Suche..."}
                  value={filterProduktgruppe}
                  onChange={e => setFilterProduktgruppe(e.target.value)}
                  list="pg-list"
                />
                <datalist id="pg-list">
                  {uniqueProduktgruppen.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="alle">
          <TabsList className="mb-4">
            <TabsTrigger value="alle">Alle ({filteredAll.length})</TabsTrigger>
            <TabsTrigger value="chef">Chef ({chefOrders.length})</TabsTrigger>
            <TabsTrigger value="mitarbeiter">Mitarbeiter ({maOrders.length})</TabsTrigger>
          </TabsList>

          {["alle", "chef", "mitarbeiter"].map(tab => {
            const list = tab === "alle" ? filteredAll : tab === "chef" ? chefOrders : maOrders;
            return (
              <TabsContent key={tab} value={tab}>
                {loading ? <p className="text-center py-8 text-muted-foreground">Lädt...</p> : (
                  <div className="space-y-2">
                    {list.map(order => (
                      <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(order)}>
                        <CardContent className="p-4 flex items-center gap-3">
                          {order.dokument_url
                            ? <ImageIcon className="h-5 w-5 text-primary shrink-0" />
                            : <Package className="h-5 w-5 text-primary shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{order.titel}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {profiles[order.erstellt_von] || "?"} · {new Date(order.created_at).toLocaleDateString("de-AT")}
                              {order.lieferant && ` · ${order.lieferant}`}
                              {order.produktgruppe && ` · ${order.produktgruppe}`}
                              {order.zugewiesen_an && ` · → ${profiles[order.zugewiesen_an] || "?"}`}
                            </p>
                          </div>
                          <Badge className={STATUS_COLORS[order.status] || ""}>{STATUS_LABELS[order.status] || order.status}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                    {list.length === 0 && (
                      <p className="text-center py-8 text-muted-foreground">Keine Bestellungen</p>
                    )}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </main>

      {/* Neue Bestellung Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isAdmin ? "Neue Bestellung (Chef)" : "Neue Bestellung"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titel *</Label>
              <Input value={formData.titel} onChange={e => setFormData({ ...formData, titel: e.target.value })} placeholder="z.B. Zement 25kg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Projekt</Label>
                <Select value={formData.projectId} onValueChange={v => setFormData({ ...formData, projectId: v })}>
                  <SelectTrigger><SelectValue placeholder="optional" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produktgruppe</Label>
                <Input
                  list="pg-form-list"
                  value={formData.produktgruppe}
                  onChange={e => setFormData({ ...formData, produktgruppe: e.target.value })}
                  placeholder="z.B. Dämmung"
                />
                <datalist id="pg-form-list">
                  {uniqueProduktgruppen.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
            </div>
            <div>
              <Label>Lieferant</Label>
              <Input
                list="lief-form-list"
                value={formData.lieferant}
                onChange={e => setFormData({ ...formData, lieferant: e.target.value })}
                placeholder="z.B. Lagerhaus, Baumit..."
              />
              <datalist id="lief-form-list">
                {uniqueLieferanten.map(l => <option key={l} value={l} />)}
              </datalist>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <VoiceAIInput
                multiline
                rows={2}
                context="bestellung"
                value={formData.beschreibung}
                onChange={(v) => setFormData({ ...formData, beschreibung: v })}
              />
            </div>

            {/* Chef-spezifisch: Zuweisung + Upload */}
            {isAdmin && (
              <>
                <div>
                  <Label>Zuweisen an (Polier / Mitarbeiter)</Label>
                  <Select value={formData.zugewiesenAn} onValueChange={v => setFormData({ ...formData, zugewiesenAn: v })}>
                    <SelectTrigger><SelectValue placeholder="Wer kontrolliert die Lieferung?" /></SelectTrigger>
                    <SelectContent>
                      {employees
                        .sort((a, b) => (a.kategorie === "vorarbeiter" ? -1 : 1) - (b.kategorie === "vorarbeiter" ? -1 : 1))
                        .map(e => (
                          <SelectItem key={e.user_id} value={e.user_id}>
                            {e.name} {e.kategorie ? `(${e.kategorie})` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Dokument (Bild oder PDF)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={e => setFormDocument(e.target.files?.[0] || null)}
                      className="flex-1"
                    />
                    {formDocument && (
                      <Button variant="ghost" size="icon" onClick={() => setFormDocument(null)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {formDocument && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {formDocument.name} ({(formDocument.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Positionen */}
            <div>
              <Label>Positionen</Label>
              <div className="space-y-2 mt-1">
                {formPositions.map((pos, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input className="flex-1" placeholder="Artikel" value={pos.artikel} onChange={e => {
                      const updated = [...formPositions];
                      updated[i].artikel = e.target.value;
                      setFormPositions(updated);
                    }} />
                    <Input className="w-20" type="number" placeholder="Menge" value={pos.menge} onChange={e => {
                      const updated = [...formPositions];
                      updated[i].menge = e.target.value;
                      setFormPositions(updated);
                    }} />
                    <Input className="w-16" placeholder="Einheit" value={pos.einheit} onChange={e => {
                      const updated = [...formPositions];
                      updated[i].einheit = e.target.value;
                      setFormPositions(updated);
                    }} />
                    {formPositions.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => setFormPositions(prev => prev.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setFormPositions(prev => [...prev, { artikel: "", menge: "", einheit: "Stk" }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Position
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving || !formData.titel.trim()}>
              {saving ? "Speichert..." : "Bestellung erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedOrder.titel}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Badge className={STATUS_COLORS[selectedOrder.status]}>{STATUS_LABELS[selectedOrder.status]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(selectedOrder.created_at).toLocaleDateString("de-AT")}
                  </span>
                </div>

                {/* Dokument-Vorschau */}
                {selectedOrder.dokument_url && (() => {
                  const isPdf = /\.pdf(\?|$)/i.test(selectedOrder.dokument_url);
                  return isPdf ? (
                    <div className="rounded-lg border overflow-hidden">
                      <iframe
                        src={`${selectedOrder.dokument_url}#toolbar=1`}
                        className="w-full h-80"
                        title="Bestell-Dokument"
                      />
                      <div className="px-3 py-2 text-xs flex justify-between border-t">
                        <span className="text-muted-foreground">PDF-Dokument</span>
                        <a href={selectedOrder.dokument_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          In neuem Tab öffnen
                        </a>
                      </div>
                    </div>
                  ) : (
                    <a href={selectedOrder.dokument_url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border overflow-hidden">
                      <img src={selectedOrder.dokument_url} alt="Dokument" className="w-full max-h-80 object-contain bg-muted" />
                    </a>
                  );
                })()}

                {selectedOrder.beschreibung && <p className="text-sm whitespace-pre-wrap">{selectedOrder.beschreibung}</p>}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selectedOrder.lieferant && (
                    <div><span className="text-muted-foreground">Lieferant:</span> {selectedOrder.lieferant}</div>
                  )}
                  {selectedOrder.produktgruppe && (
                    <div><span className="text-muted-foreground">Produktgruppe:</span> {selectedOrder.produktgruppe}</div>
                  )}
                  {selectedOrder.project_id && (
                    <div><span className="text-muted-foreground">Projekt:</span> {projects.find(p => p.id === selectedOrder.project_id)?.name || "-"}</div>
                  )}
                  <div><span className="text-muted-foreground">Erstellt von:</span> {profiles[selectedOrder.erstellt_von] || "?"}</div>
                  {selectedOrder.zugewiesen_an && (
                    <div className="col-span-2 flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Zugewiesen:</span> {profiles[selectedOrder.zugewiesen_an] || "?"}
                    </div>
                  )}
                </div>

                {orderPositions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Positionen:</p>
                    <div className="space-y-1">
                      {orderPositions.map(p => (
                        <div key={p.id} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                          <span>{p.artikel}</span>
                          <span className="text-muted-foreground">{p.menge} {p.einheit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status aendern: Admin kann alles */}
                {isAdmin && (
                  <div>
                    <Label className="text-xs">Status ändern</Label>
                    <Select value={selectedOrder.status} onValueChange={v => handleStatusChange(selectedOrder.id, v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {selectedOrder.typ === "chef" ? (
                          <>
                            <SelectItem value="offen">Offen</SelectItem>
                            <SelectItem value="nicht_vollstaendig">Nicht vollständig</SelectItem>
                            <SelectItem value="vollstaendig">Vollständig</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="angefragt">Angefragt</SelectItem>
                            <SelectItem value="teilweise_bestellt">Teilweise bestellt</SelectItem>
                            <SelectItem value="bestellt">Bestellt</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Zugewiesener MA: Chef-Bestellung pruefen */}
                {!isAdmin && selectedOrder.typ === "chef" && selectedOrder.zugewiesen_an === userId && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => handleStatusChange(selectedOrder.id, "nicht_vollstaendig")}>
                      Nicht vollständig
                    </Button>
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange(selectedOrder.id, "vollstaendig")}>
                      Vollständig
                    </Button>
                  </div>
                )}

                {isAdmin && (
                  <Button variant="destructive" size="sm" className="w-full" onClick={() => handleDelete(selectedOrder.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Bestellung löschen
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
