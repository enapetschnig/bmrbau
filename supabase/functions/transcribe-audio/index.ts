const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Max ~24 MB Base64 ≈ 18 MB Audio (OpenAI Whisper API limit ist 25 MB).
// Wir lassen etwas Puffer, damit die Edge-Function-Body-Limits nicht zuschlagen.
const MAX_BASE64_BYTES = 24 * 1024 * 1024;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { audio, mimeType, context } = await req.json();
    if (!audio || typeof audio !== "string") {
      return jsonResponse({ error: "Kein Audio-Daten erhalten. Bitte Aufnahme wiederholen." }, 400);
    }

    if (audio.length > MAX_BASE64_BYTES) {
      return jsonResponse({
        error: "Aufnahme zu lang (>18 MB). Bitte kürzer aufnehmen oder in Etappen diktieren.",
      }, 413);
    }

    // Base64 -> Binary
    let bytes: Uint8Array;
    try {
      const binaryString = atob(audio);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } catch (decodeErr) {
      console.error("base64 decode failed", decodeErr);
      return jsonResponse({ error: "Aufnahme konnte nicht gelesen werden (Base64-Fehler)." }, 400);
    }

    const ext = mimeType?.includes("webm") ? "webm"
      : mimeType?.includes("mp4") ? "mp4"
      : mimeType?.includes("mpeg") ? "mp3"
      : mimeType?.includes("wav") ? "wav"
      : mimeType?.includes("ogg") ? "ogg"
      : mimeType?.includes("m4a") ? "m4a"
      : "webm";
    const file = new File([bytes], `audio.${ext}`, { type: mimeType || "audio/webm" });

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("OPENAI_API_KEY fehlt in den Edge-Function-Secrets");
      return jsonResponse({ error: "Transkription ist serverseitig nicht konfiguriert." }, 500);
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", "whisper-1");
    formData.append("language", "de");
    if (context) {
      formData.append("prompt", String(context).slice(0, 200));
    }

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Whisper API error", response.status, errText);
      // Nur die Kernaussage in den Toast geben, nicht das ganze JSON.
      let msg = "Transkription fehlgeschlagen.";
      try {
        const parsed = JSON.parse(errText);
        msg = parsed?.error?.message || msg;
      } catch { /* Fallback-Text steht */ }
      return jsonResponse({ error: msg }, 200); // Client-seitig lesbarer Fehler
    }

    const result = await response.json();
    return jsonResponse({ text: result.text || "" });
  } catch (err) {
    console.error("transcribe-audio unerwarteter Fehler", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return jsonResponse({ error: message }, 200);
  }
});
