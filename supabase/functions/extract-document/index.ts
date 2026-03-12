import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_PROMPT = `Du bist ein präziser Parser für Lieferantenrechnungen eines Unternehmens.

Die hochgeladene Datei ist eine Rechnung eines Lieferanten.
Die Rechnung enthält hauptsächlich Produktpositionen (Material) und manchmal auch Arbeitspositionen.

Deine Aufgabe ist es, alle relevanten Daten exakt zu extrahieren und in die bestehende Datenstruktur des Systems einzupassen.

WICHTIG:
- Erfinde niemals Werte
- Wenn ein Feld nicht eindeutig ist → schreibe "nicht gefunden"
- Zahlen immer exakt aus der Rechnung übernehmen
- Dezimalzahlen mit Punkt schreiben (z.B. 10145.29)

------------------------------------

1. RECHNUNGSDATEN EXTRAHIEREN

Extrahiere folgende Felder:

Lieferant
Datum (Rechnungsdatum)
Belegnummer (Rechnungsnummer)
Betrag Netto
Betrag Brutto

Falls mehrere Netto-Zwischensummen vorkommen, verwende die Netto-Gesamtsumme der Rechnung.

------------------------------------

2. POSITIONEN EXTRAHIEREN

Extrahiere jede einzelne Position der Rechnung.

Für jede Position extrahiere:

Material (Beschreibung der Position)
Menge
Einheit
Einzelpreis (€ netto)
Gesamt (€ netto)

WICHTIG:

- Extrahiere ALLE Positionen
- Auch Arbeitspositionen wie "Monteur", "Techniker" zählen als Position
- Verwende exakt die Bezeichnungen aus der Rechnung
- Mengen und Preise dürfen nicht gerundet werden

------------------------------------

3. POSITIONEN BERECHNUNG PRÜFEN

Prüfe:

Menge × Einzelpreis ≈ Gesamtpreis

Wenn die Rechnung kleine Rundungsdifferenzen enthält, übernehme trotzdem die Werte aus der Rechnung.

------------------------------------

4. AUSGABEFORMAT

Die Ausgabe muss exakt der folgenden Struktur entsprechen (NUR JSON, kein Markdown, kein Text davor oder danach):

{
  "Lieferant": "",
  "Datum": "",
  "Belegnummer": "",
  "Betrag Netto (€)": "",
  "Betrag Brutto (€)": "",
  "Positionen": [
    {
      "Material": "",
      "Menge": "",
      "Einheit": "",
      "Einzelpreis (€ netto)": "",
      "Gesamt (€ netto)": ""
    }
  ]
}

------------------------------------

5. VALIDIERUNG

Am Ende prüfe:

- Stimmen die Positionssummen ungefähr mit dem Netto-Gesamtbetrag überein?
- Ist Brutto ≈ Netto + MwSt?

Falls etwas nicht passt, füge ein optionales Feld "Warnung" mit einer kurzen Erklärung hinzu.

Arbeite langsam und überprüfe alle Zahlen sorgfältig.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64, mediaType, pdfText } = await req.json();

    let messages: any[];

    if (pdfText && typeof pdfText === "string" && pdfText.trim().length > 0) {
      // PDF mit eingebettetem Textlayer — direkt als Text an GPT
      const prompt = `${BASE_PROMPT}

------------------------------------

Hier ist der extrahierte Text der Rechnung:

${pdfText}`;

      messages = [{ role: "user", content: prompt }];

    } else if (imageBase64 && typeof mediaType === "string" && mediaType.startsWith("image/")) {
      // Foto (JPG, PNG) oder gescannte PDF ohne Textlayer → Vision (OCR)
      const prompt = `${BASE_PROMPT}

------------------------------------

Lies den Text der Rechnung buchstabengenau vom Bild ab.`;

      messages = [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
          { type: "text", text: prompt },
        ],
      }];

    } else {
      return new Response(
        JSON.stringify({ error: "pdfText or imageBase64 (image/*) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 8000,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI extraction failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || "{}";

    let extracted;
    try {
      extracted = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      extracted = match ? JSON.parse(match[0]) : {};
    }

    return new Response(
      JSON.stringify(extracted),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
