import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Clipboard, Loader2, Plus, Trash2, Sparkles } from "lucide-react";

type ExtractedItem = {
  material: string;
  menge: string;
  einheit: string;
};

interface OrderCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

export function OrderCreateDialog({ open, onOpenChange, projectId, onSuccess }: OrderCreateDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [showItems, setShowItems] = useState(false);

  const resetForm = () => {
    setTitle("");
    setNotes("");
    setImageFile(null);
    setImagePreview(null);
    setItems([]);
    setShowItems(false);
    setExtracting(false);
    setSaving(false);
  };

  const processImage = async (file: File) => {
    setImageFile(file);

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const clipItems = e.clipboardData?.items;
    if (!clipItems) return;

    for (const item of Array.from(clipItems)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const file = new File([blob], `paste-${Date.now()}.png`, { type: blob.type });
          processImage(file);
        }
        break;
      }
    }
  };

  const handleExtract = async () => {
    if (!imageFile) return;

    setExtracting(true);

    try {
      // Upload image to storage
      const ext = imageFile.name.split(".").pop() || "png";
      const filePath = `${projectId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("order-screenshots")
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("order-screenshots")
        .getPublicUrl(filePath);

      const imageUrl = urlData.publicUrl;
      setImagePreview(imageUrl);

      // Call AI extraction
      const { data, error } = await supabase.functions.invoke("extract-materials", {
        body: { imageUrl },
      });

      if (error) throw error;

      const extracted = data?.materials || [];
      setItems(extracted.map((m: any) => ({
        material: m.material || "",
        menge: m.menge || "",
        einheit: m.einheit || "Stk",
      })));
      setShowItems(true);

      if (extracted.length === 0) {
        toast({ title: "Hinweis", description: "Keine Materialien erkannt. Sie können manuell hinzufügen." });
      } else {
        toast({ title: "KI-Extraktion", description: `${extracted.length} Material(ien) erkannt` });
      }
    } catch (err: any) {
      console.error("Extract error:", err);
      toast({ variant: "destructive", title: "Fehler", description: err.message || "KI-Extraktion fehlgeschlagen" });
      setShowItems(true); // Allow manual entry
    } finally {
      setExtracting(false);
    }
  };

  const addItem = () => {
    setItems([...items, { material: "", menge: "", einheit: "Stk" }]);
  };

  const updateItem = (index: number, field: keyof ExtractedItem, value: string) => {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const validItems = items.filter(i => i.material.trim());
    if (validItems.length === 0) {
      toast({ variant: "destructive", title: "Fehler", description: "Mindestens ein Material erforderlich" });
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        project_id: projectId,
        user_id: user.id,
        title: title.trim() || null,
        notes: notes.trim() || null,
        screenshot_url: imagePreview?.startsWith("http") ? imagePreview : null,
        status: "offen",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      toast({ variant: "destructive", title: "Fehler", description: orderError?.message || "Bestellung konnte nicht erstellt werden" });
      setSaving(false);
      return;
    }

    // Insert items
    const { error: itemsError } = await supabase.from("order_items").insert(
      validItems.map((item, idx) => ({
        order_id: order.id,
        material: item.material.trim(),
        menge: item.menge.trim() || null,
        einheit: item.einheit.trim() || null,
        sort_order: idx,
        status: "offen",
      }))
    );

    if (itemsError) {
      toast({ variant: "destructive", title: "Fehler", description: "Materialien konnten nicht gespeichert werden" });
      setSaving(false);
      return;
    }

    toast({ title: "Gespeichert", description: `Bestellung mit ${validItems.length} Position(en) erstellt` });
    resetForm();
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onPaste={handlePaste}>
        <DialogHeader>
          <DialogTitle>Neue Bestellung</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Label>Bezeichnung (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Bestellung Lagerhaus 11.03." />
          </div>

          {/* Image upload / paste area */}
          {!showItems && (
            <div className="space-y-3">
              <Label>Screenshot der Bestellung</Label>
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Vorschau" className="w-full rounded-lg border max-h-64 object-contain bg-muted" />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-3">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <Clipboard className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Bild hochladen oder einfügen</p>
                    <p className="text-xs text-muted-foreground">
                      Klicken zum Auswählen oder <strong>Strg+V</strong> zum Einfügen aus Zwischenablage
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              )}

              {/* Extract button */}
              <div className="flex gap-2">
                {imageFile && (
                  <Button onClick={handleExtract} disabled={extracting} className="flex-1">
                    {extracting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        KI analysiert Bestellung...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Materialien extrahieren
                      </>
                    )}
                  </Button>
                )}
                <Button variant="outline" onClick={() => { setShowItems(true); addItem(); }}>
                  Manuell eingeben
                </Button>
              </div>
            </div>
          )}

          {/* Extracted / editable items */}
          {showItems && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Materialien ({items.length})</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="w-4 h-4 mr-1" /> Hinzufügen
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={item.material}
                      onChange={(e) => updateItem(idx, "material", e.target.value)}
                      placeholder="Material"
                      className="flex-1"
                    />
                    <Input
                      value={item.menge}
                      onChange={(e) => updateItem(idx, "menge", e.target.value)}
                      placeholder="Menge"
                      className="w-20"
                    />
                    <Input
                      value={item.einheit}
                      onChange={(e) => updateItem(idx, "einheit", e.target.value)}
                      placeholder="Einheit"
                      className="w-20"
                    />
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={() => removeItem(idx)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notizen (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Bemerkungen..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving || !showItems}>
              {saving ? "Speichere..." : "Bestellung speichern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
