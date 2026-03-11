import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Pen } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Employee = {
  id: string;
  vorname: string;
  nachname: string;
};

type Signature = {
  id: string;
  user_id: string;
  unterschrift: string;
  unterschrift_name: string;
  unterschrieben_am: string;
};

interface Props {
  evaluationId: string;
  employees: Employee[];
  signatures: Signature[];
  currentUserId: string;
  onSignatureAdded: () => void;
}

export function SafetySignatureCollector({
  evaluationId,
  employees,
  signatures,
  currentUserId,
  onSignatureAdded,
}: Props) {
  const { toast } = useToast();
  const [signingFor, setSigningFor] = useState<string | null>(null);
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasSigned = (userId: string) =>
    signatures.some((s) => s.user_id === userId);

  const getSignature = (userId: string) =>
    signatures.find((s) => s.user_id === userId);

  const handleSave = async () => {
    if (!signingFor || !currentSignature) return;
    setSaving(true);

    const emp = employees.find((e) => e.id === signingFor);
    const name = emp ? `${emp.vorname} ${emp.nachname}` : "Unbekannt";

    const { error } = await supabase.from("safety_evaluation_signatures").insert({
      evaluation_id: evaluationId,
      user_id: signingFor,
      unterschrift: currentSignature,
      unterschrift_name: name,
    });

    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
    } else {
      toast({ title: "Unterschrift gespeichert" });
      onSignatureAdded();
    }

    setSigningFor(null);
    setCurrentSignature(null);
    setSaving(false);
  };

  const canSign = (empId: string) => empId === currentUserId && !hasSigned(empId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Unterschriften ({signatures.length}/{employees.length})
        </h3>
        {signatures.length === employees.length && employees.length > 0 && (
          <Badge className="bg-green-100 text-green-800">Alle unterschrieben</Badge>
        )}
      </div>

      <div className="space-y-2">
        {employees.map((emp) => {
          const sig = getSignature(emp.id);
          const isSigning = signingFor === emp.id;

          return (
            <div key={emp.id} className="border rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {sig ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span className="text-sm font-medium">
                    {emp.vorname} {emp.nachname}
                  </span>
                </div>
                {sig ? (
                  <span className="text-xs text-muted-foreground">
                    {new Date(sig.unterschrieben_am).toLocaleDateString("de-AT")}
                  </span>
                ) : canSign(emp.id) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSigningFor(isSigning ? null : emp.id)}
                  >
                    <Pen className="w-3 h-3 mr-1" />
                    {isSigning ? "Abbrechen" : "Unterschreiben"}
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-xs">Ausstehend</Badge>
                )}
              </div>

              {sig && (
                <img
                  src={sig.unterschrift}
                  alt={`Unterschrift ${emp.vorname}`}
                  className="mt-2 h-16 border rounded bg-white"
                />
              )}

              {isSigning && (
                <div className="mt-3 space-y-2">
                  <SignaturePad onSignatureChange={setCurrentSignature} height={150} />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={!currentSignature || saving}
                    >
                      {saving ? "Speichert..." : "Unterschrift speichern"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {employees.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Keine Mitarbeiter zugewiesen
        </p>
      )}
    </div>
  );
}
