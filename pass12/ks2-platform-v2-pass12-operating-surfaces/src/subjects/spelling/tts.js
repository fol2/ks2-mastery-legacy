import { clamp } from '../../platform/core/utils.js';

export function createBrowserTts() {
  function available() {
    return typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && 'SpeechSynthesisUtterance' in window;
  }

  function stop() {
    if (!available()) return;
    window.speechSynthesis.cancel();
  }

  function speak({ word, sentence, slow = false } = {}) {
    if (!available()) return Promise.resolve(false);
    stop();
    const spokenWord = typeof word === 'string' ? word : word?.word;
    const transcript = sentence
      ? `The word is ${spokenWord}. ${sentence} The word is ${spokenWord}.`
      : `The word is ${spokenWord}. The word is ${spokenWord}.`;
    const utterance = new SpeechSynthesisUtterance(transcript);
    utterance.lang = 'en-GB';
    utterance.rate = clamp(slow ? 0.9 : 1.02, 0.8, 1.2);
    return new Promise((resolve) => {
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      window.speechSynthesis.speak(utterance);
    });
  }

  return {
    isReady: available,
    speak,
    stop,
    warmup() {},
  };
}
