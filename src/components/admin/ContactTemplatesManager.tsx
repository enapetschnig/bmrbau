import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Phone, Mail, Users, Star } from "lucide-react";

type ContactTemplate = {
  id: string;
  name: string;
  firma: string | null;
  rolle: string | null;
  telefon: string | null;
  email: string | null;
  notizen: string | null;
};

type DefaultContact = {
  name: string;
  rolle?: string;
  firma?: string;
  telefon?: string;
  email?: string;
};

export function ContactTemplatesManager() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ContactTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Template edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ContactTemplate | null>(null);
  const [form, setForm] = useState({ name: "", firma: "", rolle: "", telefon: "", email: "", notizen: "" });
  const [saving, setSaving] = useState(false);

  // Standard-Kontakte (app_settings: default_project_contacts)
  const [defaultContacts, setDefaultContacts] = useState<DefaultContact[]>([]);
  const [defaultsDirty, setDefaultsDirty] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_templates")
      .select("*")
      .order("name");
    if (!error && data) setTemplates(data as ContactTemplate[]);
    setLoading(false);
  };

  const fetchDefaults = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "default_project_contacts")
      .maybeSingle();
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed)) setDefaultContacts(parsed);
      } catch { /* ignore */ }
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchDefaults();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", firma: "", rolle: "", telefon: "", email: "", notizen: "" });
    setEditOpen(true);
  };

  const openEdit = (t: ContactTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      firma: t.firma || "",
      rolle: t.rolle || "",
      telefon: t.telefon || "",
      email: t.email || "",
      notizen: t.notizen || "",
    });
    setEditOpen(true);
  };

  const saveTemplate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      firma: form.firma.trim() || null,
      rolle: form.rolle.trim() || null,
      telefon: form.telefon.trim() || null,
      email: form.email.trim() || null,
      notizen: form.notizen.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from("contact_templates").update(payload).eq("id", editing.id)
      : await supabase.from("contact_templates").insert(payload);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    toast({ title: editing ? "Vorlage aktualisiert" : "Vorlage hinzugefügt" });
    setEditOpen(false);
    fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("contact_templates").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    toast({ title: "Vorlage gelöscht" });
    fetchTemplates();
  };

  const updateDefault = (idx: number, field: keyof DefaultContact, value: string) => {
    const next = [...defaultContacts];
    next[idx] = { ...next[idx], [field]: value };
    setDefaultContacts(next);
    setDefaultsDirty(true);
  };

  const addDefault = () => {
    setDefaultContacts([...defaultContacts, { name: "", rolle: "", telefon: "", email: "" }]);
    setDefaultsDirty(true);
  };

  const removeDefault = (idx: number) => {
    setDefaultContacts(defaultContacts.filter((_, i) => i !== idx));
    setDefaultsDirty(true);
  };

  const saveDefaults = async () => {
    setSavingDefaults(true);
    const cleaned = defaultContacts
      .filter(c => c.name?.trim())
      .map(c => ({
        name: c.name!.trim(),
        rolle: c.rolle?.trim() || undefined,
        firma: c.firma?.trim() || undefined,
        telefon: c.telefon?.trim() || undefined,
        email: c.email?.trim() || undefined,
      }));
    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "default_project_contacts",
        value: JSON.stringify(cleaned),
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
    setSavingDefaults(false);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    toast({ title: "Standard-Kontakte gespeichert" });
    setDefaultsDirty(false);
    fetchDefaults();
  };

  const addAsTemplate = async (c: DefaultContact) => {
    if (!c.name?.trim()) return;
    const { error } = await supabase.from("contact_templates").insert({
      name: c.name.trim(),
      rolle: c.rolle?.trim() || null,
      firma: c.firma?.trim() || null,
      telefon: c.telefon?.trim() || null,
      email: c.email?.trim() || null,
    });
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    toast({ title: "In Vorlagen übernommen" });
    fetchTemplates();
  };

  return (
    <div className="space-y-6">
      {/* Standard-Kontakte */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Standard-Kontakte bei Projekterstellung
          </CardTitle>
          <CardDescription>
            Diese Kontakte (z.B. Chef-Telefon, zugeteilte Person, Notfallnummern) werden bei jedem neuen Projekt automatisch eingefügt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {defaultContacts.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Standard-Kontakte hinterlegt.</p>
          )}
          {defaultContacts.map((c, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end border rounded-lg p-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input value={c.name || ""} onChange={(e) => updateDefault(idx, "name", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rolle</Label>
                <Input value={c.rolle || ""} onChange={(e) => updateDefault(idx, "rolle", e.target.value)} className="h-9" placeholder="z.B. Chef, Polier" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefon</Label>
                <Input value={c.telefon || ""} onChange={(e) => updateDefault(idx, "telefon", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-Mail</Label>
                <Input value={c.email || ""} onChange={(e) => updateDefault(idx, "email", e.target.value)} className="h-9" />
              </div>
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => addAsTemplate(c)} title="Auch als Vorlage speichern">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeDefault(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addDefault}>
              <Plus className="h-4 w-4 mr-1" /> Standard-Kontakt hinzufügen
            </Button>
            {defaultsDirty && (
              <Button size="sm" onClick={saveDefaults} disabled={savingDefaults}>
                {savingDefaults ? "Speichert..." : "Speichern"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Kontakt-Vorlagen */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Kontakt-Vorlagen
              </CardTitle>
              <CardDescription>
                Wiederverwendbare Kontakte (z.B. Zimmerer, Dachdecker). Können in jedem Projekt per "Aus Vorlage hinzufügen" verwendet werden.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Neue Vorlage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lädt...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Vorlagen angelegt.</p>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {t.name}
                      {t.firma && <span className="text-muted-foreground font-normal"> · {t.firma}</span>}
                    </div>
                    {t.rolle && <div className="text-xs text-muted-foreground">{t.rolle}</div>}
                    <div className="flex flex-wrap gap-3 mt-1">
                      {t.telefon && (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Phone className="h-3 w-3" /> {t.telefon}
                        </span>
                      )}
                      {t.email && (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Mail className="h-3 w-3" /> {t.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTemplate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Vorlage bearbeiten" : "Neue Vorlage"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-1">
                <Label>Firma</Label>
                <Input value={form.firma} onChange={(e) => setForm(f => ({ ...f, firma: e.target.value }))} className="h-10" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Rolle</Label>
              <Input placeholder="z.B. Zimmerer, Dachdecker" value={form.rolle} onChange={(e) => setForm(f => ({ ...f, rolle: e.target.value }))} className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Telefon</Label>
                <Input type="tel" value={form.telefon} onChange={(e) => setForm(f => ({ ...f, telefon: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-1">
                <Label>E-Mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="h-10" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notizen</Label>
              <Textarea rows={2} value={form.notizen} onChange={(e) => setForm(f => ({ ...f, notizen: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={saveTemplate} disabled={saving || !form.name.trim()}>
                {saving ? "Speichert..." : editing ? "Aktualisieren" : "Speichern"}
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
