import { clamp } from '../../platform/core/utils.js';

export function buildDictationTranscript({ word, sentence } = {}) {
  const spokenWord = typeof word === 'string' ? word : word?.word;
  return sentence
    ? `The word is ${spokenWord}. ${sentence} The word is ${spokenWord}.`
    : `The word is ${spokenWord}. The word is ${spokenWord}.`;
}

function shouldUseRemoteTts() {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get('local') !== '1';
  } catch {
    return true;
  }
}

export function createPlatformTts({
  fetchFn = globalThis.fetch?.bind(globalThis),
  endpoint = '/api/tts',
  remoteEnabled = shouldUseRemoteTts(),
} = {}) {
  let playbackId = 0;
  let currentAbort = null;
  let currentAudio = null;
  let currentObjectUrl = null;
  let pendingResolve = null;

  function available() {
    return typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && 'SpeechSynthesisUtterance' in window;
  }

  function stopBrowserSpeech() {
    if (!available()) return;
    window.speechSynthesis.cancel();
  }

  function cleanupAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.removeAttribute('src');
      currentAudio.load?.();
    }
    currentAudio = null;
    if (currentObjectUrl && typeof URL !== 'undefined') {
      URL.revokeObjectURL(currentObjectUrl);
    }
    currentObjectUrl = null;
    currentAbort = null;
  }

  function resolvePending(value) {
    const resolve = pendingResolve;
    pendingResolve = null;
    if (typeof resolve === 'function') resolve(value);
  }

  function stop() {
    playbackId += 1;
    currentAbort?.abort?.();
    cleanupAudio();
    resolvePending(false);
    stopBrowserSpeech();
  }

  function speakWithBrowser({ word, sentence, slow = false } = {}) {
    if (!available()) return Promise.resolve(false);
    stopBrowserSpeech();
    const transcript = buildDictationTranscript({ word, sentence });
    const utterance = new SpeechSynthesisUtterance(transcript);
    utterance.lang = 'en-GB';
    utterance.rate = clamp(slow ? 0.9 : 1.02, 0.8, 1.2);
    return new Promise((resolve) => {
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      window.speechSynthesis.speak(utterance);
    });
  }

  async function speakWithRemote({ word, sentence, slow = false }, token) {
    if (!remoteEnabled || typeof fetchFn !== 'function' || typeof Audio === 'undefined' || typeof URL === 'undefined') {
      return false;
    }

    currentAbort = new AbortController();
    try {
      const response = await fetchFn(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          accept: 'audio/mpeg',
          'content-type': 'application/json',
        },
        signal: currentAbort.signal,
        body: JSON.stringify({ word, sentence, slow }),
      });
      if (!response.ok) return false;
      const blob = await response.blob();
      if (token !== playbackId) return false;

      currentObjectUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(currentObjectUrl);
      return await new Promise((resolve) => {
        pendingResolve = resolve;
        currentAudio.onended = () => {
          cleanupAudio();
          resolvePending(true);
        };
        currentAudio.onerror = () => {
          cleanupAudio();
          resolvePending(false);
        };
        currentAudio.play().catch(() => {
          cleanupAudio();
          resolvePending(false);
        });
      });
    } catch {
      return false;
    } finally {
      if (token === playbackId) currentAbort = null;
    }
  }

  async function speak(payload = {}) {
    stop();
    const token = playbackId;
    const playedRemote = await speakWithRemote(payload, token);
    if (playedRemote || token !== playbackId) return playedRemote;
    return speakWithBrowser(payload);
  }

  return {
    isReady: available,
    speak,
    stop,
    warmup() {},
  };
}

export const createBrowserTts = createPlatformTts;
