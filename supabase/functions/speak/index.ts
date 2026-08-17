/**
 * Japanese pronunciation, in the same voice on every device.
 *
 * The browser's own speech synthesis speaks with whatever voice the OS ships —
 * Microsoft's on Windows, Apple's compact Kyoko on a Mac, nothing at all on some
 * Linux installs. Same word, three different readings of it. This hands the text
 * to Google's Text-to-Speech instead and passes the audio straight back, so the
 * voice is a property of the app rather than of the machine it's opened on.
 *
 * Nothing is stored. The bytes are synthesised, returned, played and dropped.
 *
 * The API key lives here because the site is static: anything the browser holds
 * is readable by anyone who opens it. That makes this endpoint the thing worth
 * protecting, so it speaks only for callers who are signed in, and only for
 * something the length of a word.
 */

const KEY = Deno.env.get("GOOGLE_TTS_KEY");
// Pinned, and overridable without a redeploy. Leaving Google to pick would give
// away the one thing this function exists to provide.
const VOICE = Deno.env.get("TTS_VOICE") ?? "ja-JP-Neural2-B";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** A reading, not an essay — a cap on what a lifted token could run up. */
const MAX_CHARS = 64;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/**
 * Verified against the auth server rather than by decoding the token here: this
 * function has no business holding a signing secret, and the caller's own
 * publishable key is public anyway — it's the JWT that has to be genuine.
 */
async function signedIn(req: Request): Promise<boolean> {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!jwt) return false;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: req.headers.get("apikey") ?? "" },
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!KEY) return json({ error: "GOOGLE_TTS_KEY is not set" }, 500);
  if (!(await signedIn(req))) return json({ error: "Not signed in" }, 401);

  const { text } = await req.json().catch(() => ({ text: "" }));
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_CHARS) {
    return json({ error: `text must be 1-${MAX_CHARS} characters` }, 400);
  }

  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "ja-JP", name: VOICE },
      // Just under natural pace, matching what the browser voices were told.
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.95 },
    }),
  });

  if (!res.ok) {
    // Passed through rather than swallowed: the client falls back to the OS
    // voice either way, but a wrong voice name or a disabled API should be
    // legible in the function logs instead of looking like silence.
    return json({ error: await res.text() }, 502);
  }

  const { audioContent } = await res.json();
  const bytes = Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: { ...CORS, "Content-Type": "audio/mpeg" },
  });
});
