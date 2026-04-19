function browserSupportsSpeech() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function getPreferredVoice(voiceUri?: string) {
  if (!browserSupportsSpeech()) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (voiceUri) {
    const exact = voices.find((voice) => voice.voiceURI === voiceUri);
    if (exact) {
      return exact;
    }
  }

  return (
    voices.find((voice) => /^en-GB$/i.test(voice.lang)) ??
    voices.find((voice) => /british|united kingdom/i.test(voice.name)) ??
    voices.find((voice) => /^en/i.test(voice.lang)) ??
    null
  );
}

export function listUkBrowserVoices() {
  if (!browserSupportsSpeech()) {
    return [];
  }

  return window.speechSynthesis
    .getVoices()
    .filter(
      (voice) =>
        /^en-GB$/i.test(voice.lang) ||
        /british|united kingdom/i.test(voice.name),
    );
}

export async function speakBrowserText(text: string, options?: { rate?: number; voiceUri?: string }) {
  if (!browserSupportsSpeech()) {
    throw new Error("Browser speech synthesis is not available.");
  }

  window.speechSynthesis.cancel();

  await new Promise<void>((resolve, reject) => {
    const utterance = new window.SpeechSynthesisUtterance(text);
    const voice = getPreferredVoice(options?.voiceUri);

    utterance.lang = voice?.lang ?? "en-GB";
    utterance.rate = options?.rate ?? 1.05;
    utterance.pitch = 1;
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("Browser speech synthesis failed."));

    window.speechSynthesis.speak(utterance);
  });
}

