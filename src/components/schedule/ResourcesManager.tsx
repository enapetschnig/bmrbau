import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Package, Truck, Container, Wrench, Layers } from "lucide-react";

export type Resource = {
  id: string;
  name: string;
  kategorie: string;
  einheit: string | null;
  flaeche_m2: number | null;
  farbe: string | null;
  notizen: string | null;
  is_active: boolean | null;
  sort_order: number | null;
};

const KATEGORIE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  schalung: { label: "Schalung", icon: <Layers className="h-4 w-4" /> },
  geraet: { label: "Gerät", icon: <Wrench className="h-4 w-4" /> },
  container: { label: "Container", icon: <Container className="h-4 w-4" /> },
  transport: { label: "Transport", icon: <Truck className="h-4 w-4" /> },
  sonstiges: { label: "Sonstiges", icon: <Package className="h-4 w-4" /> },
};

const DEFAULT_COLORS = ["#F59E0B", "#F97316", "#EF4444", "#DC2626", "#8B5CF6", "#06B6D4", "#10B981", "#3B82F6", "#EC4899", "#94A3B8"];

type Props = {
  onChange?: () => void;
};

export function ResourcesManager({ onChange }: Props) {
  const { toast } = useToast();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    kategorie: "geraet",
    einheit: "Stk",
    flaeche_m2: "",
    farbe: "#F59E0B",
    notizen: "",
  });

  const fetchResources = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("resources")
      .select("*")
      .order("sort_order")
      .order("name");
    setResources((data as Resource[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchResources(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", kategorie: "geraet", einheit: "Stk", flaeche_m2: "", farbe: "#F59E0B", notizen: "" });
    setEditOpen(true);
  };

  const openEdit = (r: Resource) => {
    setEditing(r);
    setForm({
      name: r.name,
      kategorie: r.kategorie,
      einheit: r.einheit || "Stk",
      flaeche_m2: r.flaeche_m2 != null ? String(r.flaeche_m2) : "",
      farbe: r.farbe || "#F59E0B",
      notizen: r.notizen || "",
    });
    setEditOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      kategorie: form.kategorie,
      einheit: form.einheit.trim() || null,
      flaeche_m2: form.flaeche_m2 ? parseFloat(form.flaeche_m2) : null,
      farbe: form.farbe,
      notizen: form.notizen.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from("resources").update(payload).eq("id", editing.id)
      : await supabase.from("resources").insert(payload);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    toast({ title: editing ? "Ressource aktualisiert" : "Ressource hinzugefügt" });
    setEditOpen(false);
    fetchResources();
    onChange?.();
  };

  const remove = async (id: string) => {
    if (!confirm("Ressource wirklich löschen? Zuweisungen bleiben verlinkt.")) return;
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    toast({ title: "Ressource gelöscht" });
    fetchResources();
    onChange?.();
  };

  const toggleActive = async (r: Resource) => {
    const { error } = await supabase.from("resources").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    fetchResources();
    onChange?.();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Ressourcen
            </CardTitle>
            <CardDescription>
              Geräte, Schalung, Kran, Transport — verfügbar in Wochen- und Jahresplanung
            </CardDescription>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Neue Ressource
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Lädt...</p>
        ) : resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Ressourcen angelegt.</p>
        ) : (
          <div className="space-y-2">
            {resources.map(r => (
              <div key={r.id} className={`flex items-center gap-3 p-3 rounded-lg border ${!r.is_active ? "opacity-50" : ""}`}>
                <div
                  className="w-4 h-4 rounded shrink-0 border"
                  style={{ backgroundColor: r.farbe || "#94A3B8" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {r.name}
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      {KATEGORIE_LABELS[r.kategorie]?.icon}
                      {KATEGORIE_LABELS[r.kategorie]?.label || r.kategorie}
                    </Badge>
                    {r.einheit && <span className="text-xs text-muted-foreground">{r.einheit}</span>}
                    {r.flaeche_m2 != null && <span className="text-xs text-muted-foreground">{r.flaeche_m2} m²</span>}
                  </div>
                  {r.notizen && <p className="text-xs text-muted-foreground mt-0.5">{r.notizen}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(r)} title={r.is_active ? "Deaktivieren" : "Aktivieren"}>
                    {r.is_active ? "Aktiv" : "Inaktiv"}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Ressource bearbeiten" : "Neue Ressource"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="z.B. Kran 1 - 30m Ausladung" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <Select value={form.kategorie} onValueChange={v => setForm({ ...form, kategorie: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(KATEGORIE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Einheit</Label>
                <Input value={form.einheit} onChange={e => setForm({ ...form, einheit: e.target.value })} placeholder="Stk, m², m" />
              </div>
            </div>
            <div>
              <Label>Fläche m² (optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.flaeche_m2}
                onChange={e => setForm({ ...form, flaeche_m2: e.target.value })}
                placeholder="z.B. 120"
              />
            </div>
            <div>
              <Label>Farbe</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {DEFAULT_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, farbe: c })}
                    className={`w-8 h-8 rounded border-2 ${form.farbe === c ? "border-primary" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                <Input
                  type="color"
                  value={form.farbe}
                  onChange={e => setForm({ ...form, farbe: e.target.value })}
                  className="h-8 w-12 p-0.5"
                />
              </div>
            </div>
            <div>
              <Label>Notizen</Label>
              <Textarea rows={2} value={form.notizen} onChange={e => setForm({ ...form, notizen: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? "Speichert..." : editing ? "Aktualisieren" : "Speichern"}
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
