import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Pencil, PenTool, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { confirm } from "@/lib/confirm";
import { SketchRow, type SketchStroke } from "@/components/SketchRow";
import { SimpleSignatureDialog } from "@/components/SimpleSignatureDialog";
import { AufmassPhotoStrip, type AufmassPhoto } from "@/components/AufmassPhotoStrip";
import {
  generateAufmassPDF,
  getAufmassPDFFilename,
  type AufmassPositionForPDF,
  type AufmassSheetForPDF,
} from "@/lib/generateAufmassPDF";

type Position = {
  id: string;
  sort_order: number;
  input_mode: "text" | "sketch";
  pos_nr: string | null;
  bezeichnung: string | null;
  raum: string | null;
  berechnung: string | null;
  menge: number | null;
  einheit: string | null;
  sketch_data_url: string | null;
  sketch_strokes: SketchStroke[] | null;
};

type Sheet = {
  id: string;
  project_id: string;
  user_id: string;
  titel: string | null;
  aufmass_nr: string | null;
  datum: string;
  bauleiter: string | null;
  gewerk: string | null;
  notizen: string | null;
  status: "offen" | "abgeschlossen";
  pdf_url: string | null;
  unterschrift_kunde: string | null;
  unterschrift_name: string | null;
  unterschrift_am: string | null;
};

const COMMON_UNITS = ["m", "m²", "m³", "Stk", "kg", "t", "lfm", "h"];

export default function AufmassEditor() {
  const { projectId, sheetId } = useParams<{ projectId: string; sheetId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [photos, setPhotos] = useState<AufmassPhoto[]>([]);
  const [project, setProject] = useState<{ name: string; adresse: string | null; plz: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);

  // Auto-save Debouncing pro Sheet/Position.
  const sheetDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const posDebounceRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!sheetId) return;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase
        .from("aufmass_sheets")
        .select("*")
        .eq("id", sheetId)
        .maybeSingle();
      if (s) {
        setSheet(s as Sheet);
        const { data: proj } = await supabase
          .from("projects")
          .select("name, adresse, plz")
          .eq("id", s.project_id)
          .maybeSingle();
        if (proj) setProject(proj);
      }
      const { data: pos } = await supabase
        .from("aufmass_positions")
        .select("*")
        .eq("sheet_id", sheetId)
        .order("sort_order");
      if (pos) setPositions(pos as Position[]);
      const { data: pics } = await supabase
        .from("aufmass_photos")
        .select("*")
        .eq("sheet_id", sheetId)
        .order("sort_order");
      if (pics) setPhotos(pics as AufmassPhoto[]);
      setLoading(false);
    })();
  }, [sheetId]);

  const isReadOnly = sheet?.status === "abgeschlossen";

  const updateSheetField = (field: keyof Sheet, value: unknown) => {
    if (!sheet || isReadOnly) return;
    setSheet({ ...sheet, [field]: value as never });
    if (sheetDebounceRef.current) clearTimeout(sheetDebounceRef.current);
    sheetDebounceRef.current = setTimeout(async () => {
      setSaving(true);
      await supabase
        .from("aufmass_sheets")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", sheet.id);
      setSaving(false);
    }, 600);
  };

  const updatePosition = (id: string, patch: Partial<Position>) => {
    if (isReadOnly) return;
    setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    if (posDebounceRef.current[id]) clearTimeout(posDebounceRef.current[id]);
    posDebounceRef.current[id] = setTimeout(async () => {
      setSaving(true);
      await supabase.from("aufmass_positions").update(patch).eq("id", id);
      setSaving(false);
    }, 600);
  };

  const addPosition = async () => {
    if (!sheet || isReadOnly) return;
    const sort_order = positions.length > 0 ? Math.max(...positions.map((p) => p.sort_order)) + 1 : 0;
    const { data, error } = await supabase
      .from("aufmass_positions")
      .insert({ sheet_id: sheet.id, sort_order, input_mode: "text", einheit: "m²" })
      .select("*")
      .single();
    if (error || !data) {
      toast({ variant: "destructive", title: "Fehler", description: error?.message });
      return;
    }
    setPositions((prev) => [...prev, data as Position]);
  };

  const removePosition = async (id: string) => {
    if (isReadOnly) return;
    if (!(await confirm({ title: "Position löschen?", destructive: true, confirmLabel: "Löschen" }))) return;
    await supabase.from("aufmass_positions").delete().eq("id", id);
    setPositions((prev) => prev.filter((p) => p.id !== id));
  };

  const switchMode = async (id: string, target: "text" | "sketch") => {
    const pos = positions.find((p) => p.id === id);
    if (!pos || isReadOnly) return;
    if (pos.input_mode === target) return;
    if (target === "text" && pos.sketch_data_url) {
      if (!(await confirm({ title: "Skizze verwerfen?", description: "Die Skizze geht verloren wenn du auf Tipp-Modus wechselst.", destructive: true, confirmLabel: "Wechseln" }))) return;
      updatePosition(id, { input_mode: "text", sketch_data_url: null });
    } else {
      updatePosition(id, { input_mode: target });
    }
  };

  const handleAbschluss = async (withSignature?: { signature: string; name: string }) => {
    if (!sheet || submitting) return;
    if (positions.length === 0) {
      toast({ variant: "destructive", title: "Keine Positionen", description: "Bitte mindestens eine Position erfassen." });
      return;
    }
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const unterschrift_kunde = withSignature?.signature ?? sheet.unterschrift_kunde;
      const unterschrift_name = withSignature ? (withSignature.name || null) : sheet.unterschrift_name;
      const unterschrift_am = withSignature ? now : sheet.unterschrift_am;

      // Bei nachträglicher Unterschrift: altes PDF entfernen, damit wir mit
      // Signatur frisch erzeugen koennen.
      if (sheet.pdf_url) {
        await supabase.storage.from("project-aufmass").remove([sheet.pdf_url]);
        await supabase.from("documents").delete().eq("file_url", sheet.pdf_url);
      }

      const sheetForPdf: AufmassSheetForPDF = {
        titel: sheet.titel,
        aufmass_nr: sheet.aufmass_nr,
        datum: sheet.datum,
        bauleiter: sheet.bauleiter,
        gewerk: sheet.gewerk,
        notizen: sheet.notizen,
        project: project,
        unterschrift_kunde,
        unterschrift_name,
        unterschrift_am,
      };
      const positionsForPdf: AufmassPositionForPDF[] = positions.map((p) => ({
        id: p.id,
        sort_order: p.sort_order,
        input_mode: p.input_mode,
        pos_nr: p.pos_nr,
        bezeichnung: p.bezeichnung,
        raum: p.raum,
        berechnung: p.berechnung,
        menge: p.menge,
        einheit: p.einheit,
        sketch_data_url: p.sketch_data_url,
      }));

      // Alle Fotos parallel als Base64 laden (signed URLs).
      const photosForPdf = await Promise.all(photos.map(async (ph) => {
        const { data } = await supabase
          .storage.from("project-aufmass")
          .createSignedUrl(ph.file_path, 60);
        if (!data) return null;
        try {
          const resp = await fetch(data.signedUrl);
          if (!resp.ok) return null;
          const blob = await resp.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(blob);
          });
          return { position_id: ph.position_id, imageDataUrl: dataUrl, file_name: ph.file_name };
        } catch {
          return null;
        }
      }));
      const validPhotos = photosForPdf.filter((p): p is { position_id: string | null; imageDataUrl: string; file_name: string | null } => p !== null);

      const blob = (await generateAufmassPDF(sheetForPdf, positionsForPdf, validPhotos, { asBlob: true })) as Blob;
      const filename = getAufmassPDFFilename(sheetForPdf);
      const filePath = `${sheet.project_id}/${Date.now()}_${filename}`;
      const { error: upErr } = await supabase.storage
        .from("project-aufmass")
        .upload(filePath, blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("documents").insert({
          user_id: user.id,
          project_id: sheet.project_id,
          typ: "aufmass",
          name: filename,
          file_url: filePath,
          beschreibung: "Aufmaßblatt (automatisch generiert)",
        });
      }

      const updatePayload: Record<string, unknown> = {
        status: "abgeschlossen",
        pdf_url: filePath,
        pdf_generated_at: now,
      };
      if (withSignature) {
        updatePayload.unterschrift_kunde = unterschrift_kunde;
        updatePayload.unterschrift_name = unterschrift_name;
        updatePayload.unterschrift_am = unterschrift_am;
      }
      await supabase.from("aufmass_sheets").update(updatePayload).eq("id", sheet.id);

      toast({
        title: withSignature ? "Aufmaß unterzeichnet" : "Aufmaß abgeschlossen",
        description: "PDF wurde im Projekt gespeichert.",
      });
      navigate(`/projects/${sheet.project_id}/aufmass`);
    } catch (err) {
      toast({ variant: "destructive", title: "Fehler beim Abschluss", description: (err as Error).message });
      setSubmitting(false);
    }
  };

  const downloadPdf = async () => {
    if (!sheet?.pdf_url) return;
    const { data, error } = await supabase.storage.from("project-aufmass").createSignedUrl(sheet.pdf_url, 60);
    if (error || !data) {
      toast({ variant: "destructive", title: "Fehler", description: "PDF konnte nicht geladen werden." });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const totalMenge = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of positions) {
      if (p.input_mode === "text" && p.menge && p.einheit) {
        map[p.einheit] = (map[p.einheit] || 0) + Number(p.menge);
      }
    }
    return map;
  }, [positions]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!sheet) {
    return <div className="container mx-auto p-4">Aufmaßblatt nicht gefunden.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${sheet.project_id}/aufmass`)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
          </Button>
          <h1 className="text-lg sm:text-xl font-bold flex-1 truncate">
            Aufmaßblatt{sheet.aufmass_nr ? ` Nr. ${sheet.aufmass_nr}` : ""}
          </h1>
          {saving && <span className="text-xs text-muted-foreground hidden sm:inline">Speichert…</span>}
          <Badge variant={sheet.unterschrift_kunde ? "default" : isReadOnly ? "secondary" : "outline"}>
            {sheet.unterschrift_kunde ? "Unterzeichnet" : isReadOnly ? "Abgeschlossen" : "Offen"}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-5xl space-y-4">
        {/* Header-Felder */}
        <Card>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="text-base">Kopfdaten</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Aufmaß-Nr.</Label>
                <Input
                  value={sheet.aufmass_nr || ""}
                  onChange={(e) => updateSheetField("aufmass_nr", e.target.value)}
                  placeholder="z.B. A-2026-001"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label className="text-xs">Datum</Label>
                <Input
                  type="date"
                  value={sheet.datum}
                  onChange={(e) => updateSheetField("datum", e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Titel</Label>
                <Input
                  value={sheet.titel || ""}
                  onChange={(e) => updateSheetField("titel", e.target.value)}
                  placeholder="z.B. Putzarbeiten EG"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label className="text-xs">Bauleiter</Label>
                <Input
                  value={sheet.bauleiter || ""}
                  onChange={(e) => updateSheetField("bauleiter", e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label className="text-xs">Gewerk</Label>
                <Input
                  value={sheet.gewerk || ""}
                  onChange={(e) => updateSheetField("gewerk", e.target.value)}
                  placeholder="z.B. Beton, Putz, Estrich"
                  disabled={isReadOnly}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notizen (optional)</Label>
              <Textarea
                value={sheet.notizen || ""}
                onChange={(e) => updateSheetField("notizen", e.target.value)}
                placeholder="Zusätzliche Anmerkungen"
                disabled={isReadOnly}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Positionen */}
        <Card>
          <CardHeader className="p-3 sm:p-4 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Positionen ({positions.length})</CardTitle>
            {!isReadOnly && (
              <Button size="sm" onClick={addPosition}>
                <Plus className="w-4 h-4 mr-1" /> Zeile
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 space-y-3">
            {positions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Noch keine Position. Klicke auf "+ Zeile".
              </p>
            ) : (
              positions
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((pos, idx) => (
                  <div key={pos.id} className="border rounded-lg p-3 space-y-2 bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Position {idx + 1}
                      </span>
                      {!isReadOnly && (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant={pos.input_mode === "text" ? "default" : "outline"}
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => switchMode(pos.id, "text")}
                          >
                            <Pencil className="w-3.5 h-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Tipp</span>
                          </Button>
                          <Button
                            type="button"
                            variant={pos.input_mode === "sketch" ? "default" : "outline"}
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => switchMode(pos.id, "sketch")}
                          >
                            <PenTool className="w-3.5 h-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Stift</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive"
                            onClick={() => removePosition(pos.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {pos.input_mode === "text" ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          <div className="col-span-1">
                            <Label className="text-[10px]">Pos.-Nr.</Label>
                            <Input
                              value={pos.pos_nr || ""}
                              onChange={(e) => updatePosition(pos.id, { pos_nr: e.target.value })}
                              disabled={isReadOnly}
                              className="h-9 text-base sm:text-sm"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-3">
                            <Label className="text-[10px]">Bezeichnung</Label>
                            <Input
                              value={pos.bezeichnung || ""}
                              onChange={(e) => updatePosition(pos.id, { bezeichnung: e.target.value })}
                              placeholder="z.B. Innenputz Q3"
                              disabled={isReadOnly}
                              className="h-9 text-base sm:text-sm"
                            />
                          </div>
                          <div className="col-span-3 sm:col-span-2">
                            <Label className="text-[10px]">Raum / Geschoss</Label>
                            <Input
                              value={pos.raum || ""}
                              onChange={(e) => updatePosition(pos.id, { raum: e.target.value })}
                              placeholder="z.B. EG, Bad"
                              disabled={isReadOnly}
                              className="h-9 text-base sm:text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[10px]">Berechnung (Rechenweg)</Label>
                          <Input
                            value={pos.berechnung || ""}
                            onChange={(e) => updatePosition(pos.id, { berechnung: e.target.value })}
                            placeholder="z.B. 4,5 × 2,8 + 3,2 × 1,5"
                            disabled={isReadOnly}
                            className="h-9 text-base sm:text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <Label className="text-[10px]">Menge</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              value={pos.menge ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                updatePosition(pos.id, { menge: v === "" ? null : parseFloat(v.replace(",", ".")) });
                              }}
                              placeholder="0"
                              disabled={isReadOnly}
                              className="h-9 text-base sm:text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Einheit</Label>
                            <select
                              value={pos.einheit || ""}
                              onChange={(e) => updatePosition(pos.id, { einheit: e.target.value || null })}
                              disabled={isReadOnly}
                              className="w-full h-9 rounded-md border bg-background px-2 text-base sm:text-sm"
                            >
                              <option value="">—</option>
                              {COMMON_UNITS.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <SketchRow
                        value={pos.sketch_data_url}
                        strokes={pos.sketch_strokes}
                        onChange={(png, strokes) => updatePosition(pos.id, {
                          sketch_data_url: png,
                          sketch_strokes: strokes as unknown as Position["sketch_strokes"],
                        })}
                        disabled={isReadOnly}
                      />
                    )}

                    {/* Foto-Strip pro Position */}
                    <div className="border-t pt-2">
                      <AufmassPhotoStrip
                        sheetId={sheet.id}
                        positionId={pos.id}
                        projectId={sheet.project_id}
                        photos={photos.filter((ph) => ph.position_id === pos.id)}
                        onChange={(next) => {
                          const others = photos.filter((ph) => ph.position_id !== pos.id);
                          setPhotos([...others, ...next]);
                        }}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                ))
            )}
            {!isReadOnly && positions.length > 0 && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" size="sm" onClick={addPosition}>
                  <Plus className="w-4 h-4 mr-1" /> Weitere Position
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Globale Foto-Anhaenge (am Ende des Aufmasses) */}
        <Card>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="text-base">Foto-Anhänge</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <AufmassPhotoStrip
              sheetId={sheet.id}
              positionId={null}
              projectId={sheet.project_id}
              photos={photos.filter((ph) => ph.position_id === null)}
              onChange={(next) => {
                const positionPhotos = photos.filter((ph) => ph.position_id !== null);
                setPhotos([...positionPhotos, ...next]);
              }}
              disabled={isReadOnly}
            />
          </CardContent>
        </Card>

        {/* Summen-Vorschau */}
        {Object.keys(totalMenge).length > 0 && (
          <Card>
            <CardContent className="p-3 sm:p-4 flex flex-wrap gap-2 items-center">
              <span className="text-sm font-semibold mr-2">Summen:</span>
              {Object.entries(totalMenge).map(([einh, summe]) => (
                <Badge key={einh} variant="secondary" className="text-sm">
                  {summe.toFixed(2)} {einh}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Aktionen */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sticky bottom-3 z-20">
          {!isReadOnly && (
            <>
              <Button
                variant="outline"
                className="h-12 text-base shadow-lg bg-background"
                onClick={() => navigate(`/projects/${sheet.project_id}/aufmass`)}
                disabled={submitting}
              >
                Speichern & Zurück
              </Button>
              <Button
                variant="secondary"
                className="flex-1 h-12 text-base shadow-lg"
                onClick={() => handleAbschluss()}
                disabled={submitting}
              >
                {submitting ? "Erstellt PDF…" : "Ohne Unterschrift abschließen"}
              </Button>
              <Button
                className="flex-1 h-12 text-base shadow-lg"
                onClick={() => setShowSignDialog(true)}
                disabled={submitting}
              >
                <PenTool className="w-4 h-4 mr-2" />
                Unterschreiben & abschließen
              </Button>
            </>
          )}
          {isReadOnly && !sheet.unterschrift_kunde && (
            <Button
              className="flex-1 h-12 text-base shadow-lg"
              onClick={() => setShowSignDialog(true)}
              disabled={submitting}
            >
              <PenTool className="w-4 h-4 mr-2" />
              {submitting ? "Erstellt PDF…" : "Nachträglich unterschreiben"}
            </Button>
          )}
          {isReadOnly && sheet.pdf_url && (
            <Button variant={sheet.unterschrift_kunde ? "default" : "outline"} className="flex-1 h-12 text-base shadow-lg" onClick={downloadPdf}>
              PDF herunterladen
            </Button>
          )}
        </div>

        <SimpleSignatureDialog
          open={showSignDialog}
          onOpenChange={setShowSignDialog}
          title="Aufmaßblatt unterschreiben"
          description="Lassen Sie den Kunden bzw. Bauleiter direkt auf dem Gerät unterschreiben. Das PDF wird mit der Unterschrift neu erzeugt."
          defaultName={sheet.bauleiter || ""}
          submitLabel="Unterschrift speichern & abschließen"
          onSubmit={async ({ signature, name }) => {
            await handleAbschluss({ signature, name });
          }}
        />
      </main>
    </div>
  );
}
