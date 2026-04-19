// Spelling engine — reads words from KS2_SENTENCE_BANK and runs a real session.
// Uses browser SpeechSynthesis for "read aloud". Deterministic grading.

(function () {
  const ALL_WORDS = Object.keys(window.KS2_SENTENCE_BANK || {});

  // -----------------------------------------------------------------
  // Spaced-repetition mastery (mirrors the original preview.html):
  //   Each word has a stage 0..6; correct -> +1, wrong -> max(0, -1).
  //   SECURE_STAGE = 4 means 'mastered'.
  // Persists in localStorage under `ks2-spell-progress-<profileId>`.
  // -----------------------------------------------------------------
  const STAGE_MAX = 6;
  const SECURE_STAGE = 4;

  function progressKey(profileId) {
    return `ks2-spell-progress-${profileId || 'default'}`;
  }
  function loadProgress(profileId) {
    try { return JSON.parse(localStorage.getItem(progressKey(profileId))) || {}; }
    catch { return {}; }
  }
  function saveProgress(profileId, map) {
    localStorage.setItem(progressKey(profileId), JSON.stringify(map));
  }
  function getWordStage(profileId, word) {
    const m = loadProgress(profileId);
    return (m[word] && m[word].stage) || 0;
  }
  function isMastered(profileId, word) {
    return getWordStage(profileId, word) >= SECURE_STAGE;
  }

  // Record one answered result. Returns { prevStage, newStage, justMastered }.
  function recordAnswer(profileId, word, correct) {
    const m = loadProgress(profileId);
    const entry = m[word] || { stage: 0, correct: 0, wrong: 0, attempts: 0 };
    const prevStage = entry.stage;
    entry.attempts += 1;
    if (correct) {
      entry.correct += 1;
      entry.stage = Math.min(prevStage + 1, STAGE_MAX);
    } else {
      entry.wrong += 1;
      entry.stage = Math.max(0, prevStage - 1);
    }
    m[word] = entry;
    saveProgress(profileId, m);
    const justMastered = prevStage < SECURE_STAGE && entry.stage >= SECURE_STAGE;
    return { prevStage, newStage: entry.stage, justMastered };
  }

  // Count total mastered words in a given set (used for monster progress display)
  function countMastered(profileId, wordList) {
    const m = loadProgress(profileId);
    return wordList.filter(w => (m[w] && m[w].stage >= SECURE_STAGE)).length;
  }

  // Pools per monster
  const POOLS = {
    'y3-4': ALL_WORDS.filter(w => {
      const b = (window.KS2_WORD_META || {})[w];
      return !b || b.year === '3-4';
    }),
    'y5-6': ALL_WORDS.filter(w => {
      const b = (window.KS2_WORD_META || {})[w];
      return b && b.year === '5-6';
    }),
  };
  // Fallback if metadata not present: split alphabetically as a rough proxy
  if (!POOLS['y3-4'].length) POOLS['y3-4'] = ALL_WORDS.slice(0, Math.ceil(ALL_WORDS.length/2));
  if (!POOLS['y5-6'].length) POOLS['y5-6'] = ALL_WORDS.slice(Math.ceil(ALL_WORDS.length/2));

  // Small adaptive word list — a sensible KS2 cut
  const DEFAULT_SET = ALL_WORDS.length ? ALL_WORDS.slice(0, 60) : [
    'accident','actually','address','answer','appear','believe','bicycle',
    'breath','business','calendar','caught','century','certain','different',
    'difficult','early','enough','famous','February','favourite','forward',
    'friend','guard','heart','imagine','interest','island','knowledge',
    'library','medicine','minute','natural','naughty','ordinary','particular',
    'peculiar','potatoes','pressure','probably','promise','question','recent',
    'remember','separate','special','straight','surprise','therefore','though',
    'thought','through','various','weight','woman','women'
  ];

  function pickSentence(word) {
    const bank = (window.KS2_SENTENCE_BANK || {})[word];
    if (bank && bank.length) return bank[Math.floor(Math.random() * bank.length)];
    return `Use the word "${word}" in a sentence.`;
  }

  // Mask the target word inside the example sentence with ____
  function maskSentence(sentence, word) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    return sentence.replace(re, '_____');
  }

  // Browser read-aloud (SpeechSynthesis)
  function speak(text, rate = 1) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate; u.pitch = 1; u.lang = 'en-GB';
    // prefer a UK voice if available
    const voices = window.speechSynthesis.getVoices();
    const uk = voices.find(v => /en-GB/i.test(v.lang));
    if (uk) u.voice = uk;
    window.speechSynthesis.speak(u);
  }

  // Create a session of N words, optionally filtering by "review only"
  function createSession({ length = 10, wordList = DEFAULT_SET } = {}) {
    const pool = [...wordList];
    // shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picks = pool.slice(0, length).map(w => {
      const sentence = pickSentence(w);
      return {
        word: w,
        sentence,
        masked: maskSentence(sentence, w),
      };
    });
    return {
      items: picks,
      index: 0,
      results: [], // { word, typed, correct, skipped }
      startedAt: Date.now(),
    };
  }

  function grade(item, typed) {
    const t = (typed || '').trim().toLowerCase();
    return {
      correct: t === item.word.toLowerCase(),
      typed: t,
    };
  }

  // Which monster (pool) does this word belong to?
  function monsterForWord(word) {
    if (POOLS['y3-4'].includes(word)) return 'inklet';
    if (POOLS['y5-6'].includes(word)) return 'glimmerbug';
    return 'inklet'; // default
  }

  window.SpellingEngine = {
    DEFAULT_SET,
    POOLS,
    SECURE_STAGE,
    createSession,
    grade,
    speak,
    pickSentence,
    // mastery
    recordAnswer,
    getWordStage,
    isMastered,
    countMastered,
    monsterForWord,
  };
})();
