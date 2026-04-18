const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { audio, mimeType, context } = await req.json();
    if (!audio) throw new Error("Kein Audio-Daten");

    // Base64 -> Binary
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const ext = mimeType?.includes("webm") ? "webm"
      : mimeType?.includes("mp4") ? "mp4"
      : mimeType?.includes("mpeg") ? "mp3"
      : mimeType?.includes("wav") ? "wav"
      : "webm";
    const file = new File([bytes], `audio.${ext}`, { type: mimeType || "audio/webm" });

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY nicht gesetzt");

    // Whisper
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
      const err = await response.text();
      throw new Error(`Whisper API error: ${err}`);
    }

    const result = await response.json();
    return new Response(
      JSON.stringify({ text: result.text || "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
