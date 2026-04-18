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
    const { lieferschein, rechnung } = await req.json();

    const formatPositionen = (positionen: any[]) => {
      if (!positionen || positionen.length === 0) return "Keine Positionen";
      return positionen
        .map((p: any, i: number) =>
          `${i + 1}. Material: "${p.material || "?"}" | Menge: ${p.menge || "?"} ${p.einheit || ""}`
        )
        .join("\n");
    };

    const prompt = `Du bist ein Experte für Rechnungsprüfung in einem Bauunternehmen.

Deine Aufgabe: Vergleiche die Positionen eines Lieferscheins mit einer Rechnung und erkenne welche Positionen übereinstimmen und welche nicht.

WICHTIG:
- Preise werden NICHT verglichen (Lieferscheine haben oft keine Preise)
- Vergleiche NUR: Material-Bezeichnung und Menge+Einheit
- Sei intelligent bei der Zuordnung - Material kann leicht unterschiedlich geschrieben sein
  (z.B. "Zement 25kg" = "Portlandzement 25 kg Sack" - wahrscheinlich das gleiche)
- Unterschiede bei Mengen sind wichtig (5 Stk vs 10 Stk = Unstimmigkeit)
- Eine Rechnung kann MEHR Positionen haben als ein Lieferschein (z.B. Fracht, Pauschalen)

LIEFERSCHEIN POSITIONEN:
${formatPositionen(lieferschein.positionen)}

RECHNUNG POSITIONEN:
${formatPositionen(rechnung.positionen)}

Ordne jede Lieferschein-Position einer Rechnungs-Position zu (falls möglich).
Markiere auch Positionen die NUR in der Rechnung sind aber NICHT im Lieferschein.

Antworte NUR als JSON (kein Markdown, kein Text davor/danach):
{
  "matches": [
    {
      "lieferschein_index": 0,
      "rechnung_index": 0,
      "status": "match|menge_abweichung|kein_match",
      "bemerkung": "Kurze Beschreibung auf Deutsch (z.B. 'Material identisch, Menge stimmt', 'Gleicher Artikel, aber 5 statt 10 Stück')"
    }
  ],
  "nur_in_rechnung": [
    {
      "rechnung_index": 2,
      "material": "Material-Name",
      "hinweis": "Kurze Beschreibung warum das extra ist (z.B. 'Fracht/Transport', 'Zusatzposition')"
    }
  ],
  "nur_im_lieferschein": [
    {
      "lieferschein_index": 1,
      "material": "Material-Name",
      "hinweis": "Kurze Beschreibung (z.B. 'Nicht in Rechnung enthalten')"
    }
  ],
  "zusammenfassung": "2-3 Saetze Zusammenfassung des Abgleichs auf Deutsch",
  "match_score": 0
}

match_score Regeln (0-100):
- 100: Alle Lieferschein-Positionen haben Match in Rechnung, keine Mengen-Abweichungen
- 80-99: Alle gematcht aber kleine Unstimmigkeiten (z.B. leicht andere Schreibweise)
- 50-79: Manche Positionen stimmen nicht überein oder fehlen
- 0-49: Viele Positionen fehlen oder grosse Abweichungen

status-Werte:
- "match": Position stimmt überein (Material + Menge)
- "menge_abweichung": Material passt, aber Menge unterschiedlich
- "kein_match": Position im Lieferschein hat KEINE Entsprechung in Rechnung

Indizes sind 0-basiert (erste Position = 0).`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
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

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { matches: [], nur_in_rechnung: [], nur_im_lieferschein: [], zusammenfassung: text, match_score: 0 };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
