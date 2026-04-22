import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "./SignaturePad";
import { Loader2, PenTool } from "lucide-react";

/**
 * Leichtgewichtiger Unterschrifts-Dialog - nur Canvas + Name-Feld.
 * Wird fuer Tagesbericht + Aufmaßblatt verwendet, wo es keinen E-Mail-
 * Versand gibt und keine Zusammenfassung der Arbeits­details braucht.
 * Der groessere SignatureDialog bleibt fuer Regieberichte reserviert.
 */
interface SimpleSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  defaultName?: string;
  submitLabel?: string;
  onSubmit: (data: { signature: string; name: string }) => Promise<void>;
}

export const SimpleSignatureDialog = ({
  open,
  onOpenChange,
  title = "Unterschrift einholen",
  description = "Lassen Sie den Kunden direkt auf dem Gerät unterschreiben.",
  defaultName = "",
  submitLabel = "Unterschrift speichern",
  onSubmit,
}: SimpleSignatureDialogProps) => {
  const [signature, setSignature] = useState<string | null>(null);
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSignature(null);
      setName(defaultName);
    }
  }, [open, defaultName]);

  const canSubmit = !!signature && !saving;

  const handleSave = async () => {
    if (!signature) return;
    setSaving(true);
    try {
      await onSubmit({ signature, name: name.trim() });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="sig-name">Name des Unterzeichners (optional)</Label>
            <Input
              id="sig-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Hr. Müller (Bauherr)"
              disabled={saving}
            />
          </div>
          <div>
            <Label>Unterschrift</Label>
            <div className="mt-1">
              <SignaturePad onSignatureChange={setSignature} height={180} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!canSubmit}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Speichert…</> : submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
