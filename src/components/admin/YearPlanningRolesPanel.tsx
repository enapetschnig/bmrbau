import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "lucide-react";

type Roles = {
  admin: boolean;
  vorarbeiter: boolean;
  facharbeiter: boolean;
  lehrling: boolean;
  extern: boolean;
};

const DEFAULT: Roles = {
  admin: true,
  vorarbeiter: true,
  facharbeiter: false,
  lehrling: false,
  extern: false,
};

const ROLE_LABELS: Record<keyof Roles, string> = {
  admin: "Admin",
  vorarbeiter: "Vorarbeiter",
  facharbeiter: "Facharbeiter",
  lehrling: "Lehrling",
  extern: "Extern",
};

export function YearPlanningRolesPanel() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<Roles>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "jahresgrobplanung_rollen")
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          setRoles({ ...DEFAULT, ...parsed });
        } catch { /* default */ }
      }
      setLoading(false);
    })();
  }, []);

  const toggle = (role: keyof Roles) => {
    // Admin immer aktiv
    if (role === "admin") return;
    setRoles(r => ({ ...r, [role]: !r[role] }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: "jahresgrobplanung_rollen",
      value: JSON.stringify(roles),
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }
    toast({ title: "Rechte gespeichert" });
    setDirty(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Zugriff auf Jahresgrobplanung
        </CardTitle>
        <CardDescription>
          Welche Rollen dürfen die Jahresgrobplanung in der Plantafel sehen? Admins haben immer Zugriff.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Lädt...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(Object.keys(ROLE_LABELS) as (keyof Roles)[]).map(key => (
                <label
                  key={key}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${roles[key] ? "bg-primary/5 border-primary/30" : ""} ${key === "admin" ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  <Checkbox
                    checked={roles[key]}
                    onCheckedChange={() => toggle(key)}
                    disabled={key === "admin"}
                  />
                  <span className="text-sm">{ROLE_LABELS[key]}</span>
                </label>
              ))}
            </div>
            {dirty && (
              <Button onClick={save} disabled={saving}>
                {saving ? "Speichert..." : "Speichern"}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
