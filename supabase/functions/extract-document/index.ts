import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "imageBase64 required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For non-image files (PDF, DOC, etc.): skip AI extraction
    const isImage = typeof mediaType === "string" && mediaType.startsWith("image/");
    if (!isImage) {
      return new Response(
        JSON.stringify({
          lieferant: null,
          datum: null,
          belegnummer: null,
          betrag: null,
          positionen: [],
          qualitaet: "nicht_bild",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call OpenAI GPT-4o Vision API with base64 image
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: `Analysiere dieses Bild einer Rechnung, eines Lieferscheins oder Lagerlieferscheins.

Extrahiere ALLE Informationen und antworte NUR mit einem validen JSON-Objekt (keine Erklärungen, kein Markdown):

{
  "lieferant": "Name des Lieferanten/Firma",
  "datum": "YYYY-MM-DD",
  "belegnummer": "Beleg-/Rechnungsnummer",
  "betrag": 0.00,
  "positionen": [
    {"material": "exakter Materialname", "menge": "Anzahl als Zahl", "einheit": "Stk/m/m²/kg/t/l/etc", "preis": "Einzelpreis als Zahl oder null"}
  ],
  "qualitaet": "gut/mittel/schlecht"
}

WICHTIGE REGELN:
- "positionen": Extrahiere JEDE einzelne Zeile/Position lückenlos — auch wenn es 50+ Positionen sind. Überspringe keine einzige Zeile. Lies das gesamte Dokument von oben bis unten durch.
- "datum": Format YYYY-MM-DD, sonst null.
- "betrag": Gesamtbetrag als reine Zahl ohne Währungszeichen, sonst null.
- "menge" und "preis": Als reine Zahlen (nicht als String mit Einheit).
- "qualitaet": "gut" = Text klar lesbar | "mittel" = teilweise lesbar | "schlecht" = kaum lesbar.
- Felder die nicht erkennbar sind → null.
- Antworte NUR mit dem JSON — kein Text davor oder danach.`,
              },
            ],
          },
        ],
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
      // Try to extract JSON from markdown-wrapped response
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
