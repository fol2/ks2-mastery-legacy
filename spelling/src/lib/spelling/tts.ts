import { FORMAL_UK_PROMPT_VERSION } from "./constants";
import type { AudioRequest } from "./types";

export const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
export const GEMINI_TTS_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`;

export function buildSpeechPrompt(word: string, sentence: string, slow: boolean) {
  const cleanSentence = String(sentence || "").trim();
  const transcript = cleanSentence
    ? `The word is ${word}. ${cleanSentence} The word is ${word}.`
    : `The word is ${word}. The word is ${word}.`;
  const paceDirection = slow
    ? "Speak slowly and clearly in formal UK English."
    : "Speak clearly in formal UK English at a brisk classroom dictation pace.";

  return [
    "Generate speech only.",
    paceDirection,
    "TRANSCRIPT:",
    transcript,
  ].join("\n");
}

export function buildAudioCacheKey(request: AudioRequest) {
  return [
    FORMAL_UK_PROMPT_VERSION,
    request.voiceName,
    request.slow ? "slow" : "normal",
    request.word.trim().toLowerCase(),
    request.sentence.trim(),
  ].join("||");
}

export function parseGeminiAudioMimeType(mimeType: string) {
  const rateMatch = String(mimeType || "").match(/rate=(\d+)/i);
  const channelsMatch = String(mimeType || "").match(/channels=(\d+)/i);
  return {
    sampleRate: Number(rateMatch?.[1]) || 24000,
    channels: Number(channelsMatch?.[1]) || 1,
    bitsPerSample: 16,
  };
}

export function decodeBase64(base64: string) {
  const binary = Buffer.from(base64, "base64");
  return new Uint8Array(binary);
}

export function pcmToWavBytes(base64Data: string, mimeType: string) {
  const pcmBytes = decodeBase64(base64Data);
  if (/audio\/wav/i.test(String(mimeType || ""))) {
    return pcmBytes;
  }

  const { sampleRate, channels, bitsPerSample } = parseGeminiAudioMimeType(mimeType);
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + pcmBytes.length);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, "data");
  view.setUint32(40, pcmBytes.length, true);
  new Uint8Array(buffer, 44).set(pcmBytes);

  return new Uint8Array(buffer);
}
