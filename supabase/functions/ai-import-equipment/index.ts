import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Keine Zeilen uebergeben");
    }

    // Maximal 100 Zeilen pro Batch (Token-Limit)
    const limited = rows.slice(0, 100);

    const prompt = `Du bist ein Experte fuer den Import von Geraete-Daten in eine Baufirma-App.

Zielschema (genau diese Felder, genau diese Werte fuer Enums):
- name (String, Pflicht): Geraetename
- kategorie (String): EINER dieser Werte: werkzeug, maschine, fahrzeug, geruest, sicherheitsausruestung
- seriennummer (String oder null)
- kaufdatum (YYYY-MM-DD oder null): Anschaffungsdatum
- zustand (String): EINER dieser Werte: gut, beschaedigt, in_reparatur, ausgemustert. Default: gut
- standort_typ (String): "lager" oder "baustelle". Default: "lager"
- wartungsintervall_monate (Integer oder null): Wartungsintervall in Monaten
- naechste_wartung (YYYY-MM-DD oder null)
- notizen (String oder null)

WICHTIG:
- Erkenne die Spalten intelligent, auch wenn sie anders benannt sind (z.B. "Bezeichnung" -> name, "Typ" -> kategorie, "S/N" -> seriennummer, "Kauf" -> kaufdatum, "Status"/"State" -> zustand, "Bemerkung" -> notizen).
- Kategorie-Mapping:
  * Werkzeuge (Bohrmaschine, Hammer, Saege, Schraubenzieher) -> werkzeug
  * Grosse Maschinen (Bagger, Kran, Mischer, Kompressor, Stromaggregat) -> maschine
  * Auto/LKW/Transporter/PKW -> fahrzeug
  * Geruest -> geruest
  * Helm, Handschuhe, Schutzbrille, Gurt -> sicherheitsausruestung
  * Unklar -> werkzeug
- Zustand-Mapping:
  * "ok", "gut", "einwandfrei", "neu", "i.O." -> gut
  * "defekt", "kaputt", "beschaedigt" -> beschaedigt
  * "in Reparatur", "in Wartung", "reparatur" -> in_reparatur
  * "entsorgt", "ausrangiert", "alt" -> ausgemustert
  * Leer -> gut
- Datumsformate: erkenne "15.03.2024", "15/03/2024", "2024-03-15", "Maerz 2024" -> "2024-03-15" oder "2024-03-01"
- Name ist Pflicht. Wenn kein Name erkennbar: Zeile ueberspringen.

Eingabe (${limited.length} Zeilen aus Excel):
${JSON.stringify(limited, null, 2)}

Antworte AUSSCHLIESSLICH als valides JSON-Objekt im Format:
{
  "equipment": [
    { "name": "...", "kategorie": "werkzeug", "seriennummer": null, "kaufdatum": null, "zustand": "gut", "standort_typ": "lager", "wartungsintervall_monate": null, "naechste_wartung": null, "notizen": null },
    ...
  ],
  "uebersprungen": [
    { "grund": "Kein Name erkannt", "zeile": 3 }
  ]
}`;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY nicht gesetzt");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${err}`);
    }

    const aiResult = await response.json();
    const text = aiResult.choices?.[0]?.message?.content || "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { equipment: [], uebersprungen: [] };
    }

    // Validierung + Normalisierung
    const validKategorien = ["werkzeug", "maschine", "fahrzeug", "geruest", "sicherheitsausruestung"];
    const validZustaende = ["gut", "beschaedigt", "in_reparatur", "ausgemustert"];

    const equipment = Array.isArray(parsed.equipment) ? parsed.equipment.map((e: any) => ({
      name: String(e.name || "").trim(),
      kategorie: validKategorien.includes(e.kategorie) ? e.kategorie : "werkzeug",
      seriennummer: e.seriennummer || null,
      kaufdatum: e.kaufdatum && /^\d{4}-\d{2}-\d{2}$/.test(e.kaufdatum) ? e.kaufdatum : null,
      zustand: validZustaende.includes(e.zustand) ? e.zustand : "gut",
      standort_typ: e.standort_typ === "baustelle" ? "baustelle" : "lager",
      wartungsintervall_monate: Number.isInteger(e.wartungsintervall_monate) ? e.wartungsintervall_monate : null,
      naechste_wartung: e.naechste_wartung && /^\d{4}-\d{2}-\d{2}$/.test(e.naechste_wartung) ? e.naechste_wartung : null,
      notizen: e.notizen || null,
    })).filter((e: any) => e.name.length > 0) : [];

    return new Response(
      JSON.stringify({
        equipment,
        uebersprungen: parsed.uebersprungen || [],
        total_input: limited.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
