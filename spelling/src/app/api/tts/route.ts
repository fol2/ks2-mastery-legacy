import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buildSpeechPrompt, GEMINI_TTS_ENDPOINT, pcmToWavBytes } from "@/lib/spelling/tts";

export const runtime = "nodejs";

interface GeminiInlineDataPart {
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
}

interface GeminiResponsePayload {
  error?: { message?: string };
  candidates?: Array<{ content?: { parts?: GeminiInlineDataPart[] } }>;
}

interface TtsRequestPayload {
  word?: string;
  sentence?: string;
  slow?: boolean;
  voiceName?: string;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function POST(request: Request) {
  const processEnvKey = typeof process !== "undefined" ? process.env.GEMINI_API_KEY : undefined;
  const cloudflareEnv = getCloudflareContext().env as { GEMINI_API_KEY?: string };
  const apiKey = processEnvKey ?? cloudflareEnv.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonError("Gemini API key is not configured on the server.", 503);
  }

  let payload: TtsRequestPayload | null = null;
  try {
    payload = (await request.json()) as TtsRequestPayload;
  } catch {
    return jsonError("Invalid TTS request payload.", 400);
  }

  const word = String(payload?.word ?? "").trim();
  const sentence = String(payload?.sentence ?? "").trim();
  const voiceName = String(payload?.voiceName ?? "Schedar").trim() || "Schedar";
  const slow = Boolean(payload?.slow);

  if (!word) {
    return jsonError("A spelling word is required.", 400);
  }

  const requestBody = {
    contents: [{ parts: [{ text: buildSpeechPrompt(word, sentence, slow) }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    },
  };

  let lastError = "Gemini TTS failed.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${GEMINI_TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    let geminiPayload: GeminiResponsePayload | null = null;

    try {
      geminiPayload = (await response.json()) as GeminiResponsePayload;
    } catch {
      geminiPayload = null;
    }

    const parts = geminiPayload?.candidates?.[0]?.content?.parts ?? [];
    const inlineAudio = parts.find((part) => part.inlineData?.data)?.inlineData;

    if (response.ok && inlineAudio?.data) {
      const wavBytes = pcmToWavBytes(inlineAudio.data, inlineAudio.mimeType ?? "audio/l16; rate=24000; channels=1");
      return new Response(wavBytes, {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "private, max-age=31536000, immutable",
        },
      });
    }

    lastError =
      geminiPayload?.error?.message ??
      (response.status >= 500 ? `Gemini TTS failed with status ${response.status}.` : "Gemini TTS returned no audio.");

    if (response.status < 500 || attempt === 1) {
      return jsonError(lastError, response.status >= 400 && response.status < 500 ? response.status : 502);
    }
  }

  return jsonError(lastError, 502);
}
