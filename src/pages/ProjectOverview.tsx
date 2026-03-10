import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, FileCheck, Package, Camera, ImagePlus, Lock, Plus, MapPin, Users, Copy, Pencil, Trash2, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type DocumentCategory = {
  type: "plans" | "reports" | "photos" | "chef";
  title: string;
  description: string;
  icon: React.ReactNode;
  count: number;
  adminOnly?: boolean;
};

type CatalogItem = { id: string; name: string; einheit: string };
type Contact = {
  id: string; name: string; rolle: string | null; telefon: string | null;
  email: string | null; firma: string | null; phase: string; notizen: string | null;
};

const CUSTOM_MATERIAL_VALUE = "__custom__";

const ProjectOverview = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projectName, setProjectName] = useState("");
  const [projectInfo, setProjectInfo] = useState<{
    adresse: string | null; plz: string | null; bauherr: string | null;
    bauherr_kontakt: string | null; bauleiter: string | null;
    budget: number | null; start_datum: string | null; end_datum: string | null;
    beschreibung: string | null;
  } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [materialCount, setMaterialCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<DocumentCategory[]>([
    {
      type: "photos",
      title: "Fotos",
      description: "Baufortschritt und Dokumentationsfotos",
      icon: <Camera className="h-8 w-8" />,
      count: 0,
    },
    {
      type: "plans",
      title: "Pläne",
      description: "Baupläne und technische Zeichnungen",
      icon: <FileText className="h-8 w-8" />,
      count: 0,
    },
    {
      type: "reports",
      title: "Regieberichte",
      description: "Bautagebücher und Stundenberichte",
      icon: <FileCheck className="h-8 w-8" />,
      count: 0,
    },
    {
      type: "chef",
      title: "🔒 Chefordner",
      description: "Vertrauliche Chef-Dokumente",
      icon: <Lock className="h-8 w-8" />,
      count: 0,
      adminOnly: true,
    },
  ]);

  // Material dialog state
  const [materialCatalog, setMaterialCatalog] = useState<CatalogItem[]>([]);
  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [customMaterial, setCustomMaterial] = useState("");
  const [newMenge, setNewMenge] = useState("");
  const [submittingMaterial, setSubmittingMaterial] = useState(false);

  // Contacts state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", rolle: "", telefon: "", email: "", firma: "", phase: "bauphase", notizen: "" });

  useEffect(() => {
    if (projectId) {
      checkAdminStatus();
      fetchProjectName();
      fetchMaterialCatalog();
      fetchContacts();
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchFileCounts();
      fetchMaterialCount();
    }
  }, [projectId, isAdmin]);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "administrator")
      .maybeSingle();

    setIsAdmin(!!data);
  };

  const fetchProjectName = async () => {
    if (!projectId) return;

    const { data } = await supabase
      .from("projects")
      .select("name, adresse, plz, bauherr, bauherr_kontakt, bauleiter, budget, start_datum, end_datum, beschreibung")
      .eq("id", projectId)
      .single();

    if (data) {
      setProjectName(data.name);
      setProjectInfo({
        adresse: data.adresse, plz: data.plz, bauherr: data.bauherr,
        bauherr_kontakt: data.bauherr_kontakt, bauleiter: data.bauleiter,
        budget: data.budget, start_datum: data.start_datum, end_datum: data.end_datum,
        beschreibung: data.beschreibung,
      });
    }
  };

  const fetchMaterialCount = async () => {
    if (!projectId) return;

    const { count } = await supabase
      .from("material_entries")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId);

    setMaterialCount(count || 0);
  };

  const fetchMaterialCatalog = async () => {
    const { data } = await supabase
      .from("materials")
      .select("id, name, einheit")
      .order("name");
    if (data) setMaterialCatalog(data);
  };

  const fetchContacts = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("project_contacts")
      .select("*")
      .eq("project_id", projectId)
      .order("name");
    if (data) setContacts(data as Contact[]);
  };

  const handleSaveContact = async () => {
    if (!projectId || !contactForm.name.trim()) return;
    const payload = {
      project_id: projectId,
      name: contactForm.name.trim(),
      rolle: contactForm.rolle.trim() || null,
      telefon: contactForm.telefon.trim() || null,
      email: contactForm.email.trim() || null,
      firma: contactForm.firma.trim() || null,
      phase: contactForm.phase,
      notizen: contactForm.notizen.trim() || null,
    };

    if (editingContact) {
      const { error } = await supabase.from("project_contacts").update(payload).eq("id", editingContact.id);
      if (error) { toast({ variant: "destructive", title: "Fehler", description: error.message }); return; }
    } else {
      const { error } = await supabase.from("project_contacts").insert(payload);
      if (error) { toast({ variant: "destructive", title: "Fehler", description: error.message }); return; }
    }
    toast({ title: editingContact ? "Aktualisiert" : "Gespeichert" });
    resetContactDialog();
    fetchContacts();
  };

  const handleDeleteContact = async (id: string) => {
    const { error } = await supabase.from("project_contacts").delete().eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Fehler", description: error.message }); return; }
    toast({ title: "Gelöscht" });
    fetchContacts();
  };

  const resetContactDialog = () => {
    setShowContactDialog(false);
    setEditingContact(null);
    setContactForm({ name: "", rolle: "", telefon: "", email: "", firma: "", phase: "bauphase", notizen: "" });
  };

  const openEditContact = (c: Contact) => {
    setEditingContact(c);
    setContactForm({
      name: c.name, rolle: c.rolle || "", telefon: c.telefon || "",
      email: c.email || "", firma: c.firma || "", phase: c.phase, notizen: c.notizen || "",
    });
    setShowContactDialog(true);
  };

  const copyContact = (c: Contact) => {
    const text = [c.name, c.firma, c.telefon, c.email].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Kopiert", description: "Kontaktdaten in Zwischenablage" });
  };

  const getMaterialName = (): string => {
    if (selectedMaterial === CUSTOM_MATERIAL_VALUE) return customMaterial.trim();
    return selectedMaterial;
  };

  const handleAddMaterial = async () => {
    const materialName = getMaterialName();
    if (!projectId || !currentUserId || !materialName) return;

    setSubmittingMaterial(true);
    const { error } = await supabase
      .from("material_entries")
      .insert({
        project_id: projectId,
        user_id: currentUserId,
        material: materialName,
        menge: newMenge.trim() || null,
      });

    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: "Material konnte nicht gespeichert werden" });
    } else {
      toast({ title: "Gespeichert", description: "Material wurde hinzugefügt" });
      resetMaterialDialog();
      fetchMaterialCount();
    }
    setSubmittingMaterial(false);
  };

  const resetMaterialDialog = () => {
    setShowMaterialDialog(false);
    setSelectedMaterial("");
    setCustomMaterial("");
    setNewMenge("");
  };

  const fetchFileCounts = async () => {
    if (!projectId) return;

    const bucketMap: Record<string, string> = {
      plans: "project-plans",
      reports: "project-reports",
      photos: "project-photos",
      chef: "project-chef",
    };

    const updatedCategories = await Promise.all(
      categories.map(async (category) => {
        if (category.type === "chef" && !isAdmin) {
          return { ...category, count: 0 };
        }

        const bucket = bucketMap[category.type];
        const { data } = await supabase
          .storage
          .from(bucket)
          .list(projectId);

        return {
          ...category,
          count: data?.length || 0,
        };
      })
    );

    setCategories(updatedCategories);
  };

  const handleQuickPhotoUpload = () => {
    navigate(`/projects/${projectId}/photos`);
  };

  const visibleCategories = categories.filter(
    (category) => !category.adminOnly || isAdmin
  );

  // Get unit hint from catalog for selected material
  const selectedCatalogItem = materialCatalog.find(c => c.name === selectedMaterial);
  const mengePlaceholder = selectedCatalogItem
    ? `z.B. 10 ${selectedCatalogItem.einheit}`
    : "z.B. 10 Stück";

  const isMaterialValid = selectedMaterial === CUSTOM_MATERIAL_VALUE
    ? customMaterial.trim().length > 0
    : selectedMaterial.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Zurück</span>
            </Button>
            <img
              src="/schafferhofer-logo.svg"
              alt="Schafferhofer Bau"
              className="h-10 w-10 sm:h-14 sm:w-14 cursor-pointer hover:opacity-80 transition-opacity object-contain"
              onClick={() => navigate("/projects")}
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{projectName}</h1>
          {projectInfo && (projectInfo.adresse || projectInfo.bauherr || projectInfo.bauleiter || projectInfo.budget) ? (
            <div className="text-sm text-muted-foreground space-y-0.5">
              {projectInfo.adresse && (
                <p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(projectInfo.adresse + (projectInfo.plz ? `, ${projectInfo.plz}` : ''))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {projectInfo.adresse}{projectInfo.plz ? `, ${projectInfo.plz}` : ""}
                  </a>
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {projectInfo.bauherr && <span>Bauherr: <strong>{projectInfo.bauherr}</strong>{projectInfo.bauherr_kontakt ? ` (${projectInfo.bauherr_kontakt})` : ""}</span>}
                {projectInfo.bauleiter && <span>Bauleiter: <strong>{projectInfo.bauleiter}</strong></span>}
                {projectInfo.budget != null && <span>Budget: <strong>{new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(projectInfo.budget)}</strong></span>}
              </div>
              {(projectInfo.start_datum || projectInfo.end_datum) && (
                <p>Zeitraum: {projectInfo.start_datum ? new Date(projectInfo.start_datum).toLocaleDateString("de-AT") : "–"} – {projectInfo.end_datum ? new Date(projectInfo.end_datum).toLocaleDateString("de-AT") : "offen"}</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Dokumentation und Dateien</p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Fotos - first */}
          {visibleCategories.filter(c => c.type === "photos").map((category) => (
            <Card
              key={category.type}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/projects/${projectId}/${category.type}`)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="text-primary">{category.icon}</div>
                  <div className="text-2xl font-bold">{category.count}</div>
                </div>
                <CardTitle className="text-xl">{category.title}</CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">Öffnen</Button>
              </CardContent>
            </Card>
          ))}

          {/* Materialliste - second (nach Fotos) */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/projects/${projectId}/materials`)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-primary"><Package className="h-8 w-8" /></div>
                <div className="text-2xl font-bold">{materialCount}</div>
              </div>
              <CardTitle className="text-xl">Materialliste</CardTitle>
              <CardDescription>Verwendete Materialien dokumentieren</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Öffnen</Button>
            </CardContent>
          </Card>

          {/* Rest: Pläne, Regieberichte, Chefordner */}
          {visibleCategories.filter(c => c.type !== "photos").map((category) => (
            <Card
              key={category.type}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/projects/${projectId}/${category.type}`)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="text-primary">{category.icon}</div>
                  <div className="text-2xl font-bold">{category.count}</div>
                </div>
                <CardTitle className="text-xl">{category.title}</CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">Öffnen</Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Material hinzufügen Button */}
        <Button
          className="w-full mt-4 gap-2"
          variant="outline"
          size="lg"
          onClick={() => setShowMaterialDialog(true)}
        >
          <Plus className="h-5 w-5" />
          Material hinzufügen
        </Button>

        {/* Kontakte */}
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Projektkontakte
                {contacts.length > 0 && <span className="text-sm font-normal text-muted-foreground">({contacts.length})</span>}
              </CardTitle>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => setShowContactDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Kontakt
                </Button>
              )}
            </div>
          </CardHeader>
          {contacts.length > 0 && (
            <CardContent className="pt-0 space-y-2">
              {contacts.map(c => (
                <div key={c.id} className="flex items-start gap-3 p-2 rounded-lg border text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{c.name}{c.firma && <span className="text-muted-foreground font-normal"> · {c.firma}</span>}</div>
                    {c.rolle && <div className="text-xs text-muted-foreground">{c.rolle} · {c.phase === "planungsphase" ? "Planungsphase" : c.phase === "beide" ? "Alle Phasen" : "Bauphase"}</div>}
                    <div className="flex flex-wrap gap-3 mt-1">
                      {c.telefon && (
                        <a href={`tel:${c.telefon}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Phone className="h-3 w-3" /> {c.telefon}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Mail className="h-3 w-3" /> {c.email}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyContact(c)} title="Kontakt kopieren">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditContact(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteContact(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        {/* Floating Action Button für Fotos */}
        <Button
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
          size="icon"
          onClick={handleQuickPhotoUpload}
        >
          <ImagePlus className="h-6 w-6" />
        </Button>
      </main>

      {/* Material Dialog */}
      <Dialog open={showMaterialDialog} onOpenChange={(open) => { if (!open) resetMaterialDialog(); else setShowMaterialDialog(true); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Material hinzufügen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Material</Label>
              <Select value={selectedMaterial} onValueChange={(val) => { setSelectedMaterial(val); if (val !== CUSTOM_MATERIAL_VALUE) setCustomMaterial(""); }}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Material auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {materialCatalog.map(c => (
                    <SelectItem key={c.id} value={c.name} className="text-base py-3">
                      {c.name} ({c.einheit})
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_MATERIAL_VALUE} className="text-base py-3 font-medium">
                    Anderes Material...
                  </SelectItem>
                </SelectContent>
              </Select>
              {selectedMaterial === CUSTOM_MATERIAL_VALUE && (
                <Input
                  placeholder="Material eingeben"
                  value={customMaterial}
                  onChange={(e) => setCustomMaterial(e.target.value)}
                  autoFocus
                  className="h-12 text-base"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Menge</Label>
              <Input
                placeholder={mengePlaceholder}
                value={newMenge}
                onChange={(e) => setNewMenge(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 h-12 text-base"
                onClick={handleAddMaterial}
                disabled={submittingMaterial || !isMaterialValid}
              >
                {submittingMaterial ? "Speichert..." : "Speichern"}
              </Button>
              <Button
                className="flex-1 h-12 text-base"
                variant="outline"
                onClick={resetMaterialDialog}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={(open) => { if (!open) resetContactDialog(); else setShowContactDialog(true); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Kontakt bearbeiten" : "Kontakt hinzufügen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={contactForm.name} onChange={(e) => setContactForm(f => ({ ...f, name: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-1">
                <Label>Firma</Label>
                <Input value={contactForm.firma} onChange={(e) => setContactForm(f => ({ ...f, firma: e.target.value }))} className="h-10" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Rolle</Label>
              <Input placeholder="z.B. Zimmerer, Dachdecker, Energieversorger" value={contactForm.rolle} onChange={(e) => setContactForm(f => ({ ...f, rolle: e.target.value }))} className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Telefon</Label>
                <Input type="tel" value={contactForm.telefon} onChange={(e) => setContactForm(f => ({ ...f, telefon: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-1">
                <Label>E-Mail</Label>
                <Input type="email" value={contactForm.email} onChange={(e) => setContactForm(f => ({ ...f, email: e.target.value }))} className="h-10" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Phase</Label>
              <Select value={contactForm.phase} onValueChange={(v) => setContactForm(f => ({ ...f, phase: v }))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planungsphase">Planungsphase</SelectItem>
                  <SelectItem value="bauphase">Bauphase</SelectItem>
                  <SelectItem value="beide">Beide Phasen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 h-10" onClick={handleSaveContact} disabled={!contactForm.name.trim()}>
                {editingContact ? "Aktualisieren" : "Speichern"}
              </Button>
              <Button className="flex-1 h-10" variant="outline" onClick={resetContactDialog}>Abbrechen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectOverview;
