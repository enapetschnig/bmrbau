const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Kontext-spezifische Prompt-Vorlagen
const CONTEXT_PROMPTS: Record<string, string> = {
  tagesbericht: `Kontext: Tagesbericht einer Baustelle. Formuliere knapp, sachlich, in Aufzaehlungsform oder kurzen Saetzen. Verwende bautechnische Fachsprache. Beispielstil: "Fundament geschalt. Bewehrung eingelegt. Beton gegossen (C25/30)."`,
  regiebericht: `Kontext: Regiebericht mit Material- und Stundenauflistung. Sachlich, praezise, aus Sicht des Vorarbeiters.`,
  zeiterfassung: `Kontext: Taetigkeitsbeschreibung fuer die Zeiterfassung. Sehr knapp, stichwortartig, z.B. "Mauerarbeiten Ostseite" oder "Schalung Decke OG".`,
  notiz: `Kontext: Interne Notiz fuer einen Bauleiter. Klar und knapp.`,
  bestellung: `Kontext: Bestellanfrage oder Materialbestellung. Sachlich, eindeutig.`,
  anmerkung: `Kontext: Anmerkung oder Bemerkung zu einer Arbeit/einem Projekt. Knapp und klar.`,
  default: `Kontext: Baustellen-/Bauunternehmens-Formular.`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, context, mode } = await req.json();
    if (!text || !text.trim()) {
      throw new Error("Kein Text uebergeben");
    }

    const ctxPrompt = CONTEXT_PROMPTS[context as string] || CONTEXT_PROMPTS.default;

    const modeInstruction = mode === "expand"
      ? "Formuliere den Text ausfuehrlicher aus, aber bleibe sachlich."
      : mode === "summarize"
      ? "Fasse den Text kuerzer zusammen, Stichworte erlaubt."
      : "Korrigiere Rechtschreibung und Grammatik, mache den Text klarer und professioneller. Aendere nicht den Inhalt, nur die Formulierung. Behalte die deutsche Sprache bei.";

    const prompt = `Du bist ein Assistent fuer eine oesterreichische Bauunternehmen-App.

${ctxPrompt}

Aufgabe: ${modeInstruction}

WICHTIG:
- Antworte AUSSCHLIESSLICH mit dem verbesserten Text, ohne Einleitung, ohne Anfuehrungszeichen, ohne Markdown.
- Behalte Zahlen, Namen, Mengenangaben und Fachbegriffe unveraendert.
- Schreibe in der gleichen Sprache wie der Input (Deutsch / oesterreichisches Deutsch).
- Falls der Input nur Stichworte enthaelt, lass ihn im Stichwort-Stil.

Input-Text:
${text}`;

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
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${err}`);
    }

    const aiResult = await response.json();
    const improved = aiResult.choices?.[0]?.message?.content?.trim() || text;

    return new Response(
      JSON.stringify({ text: improved }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
