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

    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch image and convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Could not fetch image" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const uint8Array = new Uint8Array(imageBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Image = btoa(binary);
    const mediaType = imageResponse.headers.get("content-type") || "image/png";

    // Call OpenAI GPT-4o Vision API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${base64Image}`,
                },
              },
              {
                type: "text",
                text: `Analysiere dieses Bild einer Bestellung oder eines Lieferscheins. Extrahiere alle Materialpositionen als JSON-Array.
Jedes Element soll folgende Felder haben:
- "material": Name oder Beschreibung des Materials (String)
- "menge": Anzahl/Menge als String (z.B. "10", "2,5")
- "einheit": Einheit (z.B. "Stk", "m", "m²", "m³", "kg", "Pkt", "Sack", "Pal", "Ltr")

Antworte NUR mit einem validen JSON-Array, ohne zusätzliche Erklärungen.
Falls kein Material erkennbar ist, antworte mit [].
Beispiel: [{"material": "Schrauben 4x40mm", "menge": "200", "einheit": "Stk"}, {"material": "Zement CEM II", "menge": "5", "einheit": "Sack"}]`,
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
    const text = result.choices?.[0]?.message?.content || "[]";

    // Parse the JSON from OpenAI's response
    let materials;
    try {
      materials = JSON.parse(text);
    } catch {
      // Try to extract JSON array from response if wrapped in markdown
      const match = text.match(/\[[\s\S]*\]/);
      materials = match ? JSON.parse(match[0]) : [];
    }

    return new Response(
      JSON.stringify({ materials }),
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
