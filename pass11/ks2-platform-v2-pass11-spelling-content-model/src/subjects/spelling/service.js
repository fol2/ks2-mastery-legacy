import { WORDS as DEFAULT_WORDS, WORD_BY_SLUG as DEFAULT_WORD_BY_SLUG } from './data/word-data.js';
import { createLegacySpellingEngine } from './engine/legacy-engine.js';
import {
  SPELLING_MASTERY_MILESTONES,
  createSpellingMasteryMilestoneEvent,
  createSpellingRetryClearedEvent,
  createSpellingSessionCompletedEvent,
  createSpellingWordSecuredEvent,
} from './events.js';
import {
  cloneSerialisable,
  createInitialSpellingState,
  defaultLearningStatus,
  normaliseBoolean,
  normaliseFeedback,
  normaliseMode,
  normaliseNonNegativeInteger,
  normaliseOptionalString,
  normaliseRoundLength,
  normaliseStats,
  normaliseString,
  normaliseStringArray,
  normaliseSummary,
  normaliseTimestamp,
  normaliseYearFilter,
  SPELLING_ROOT_PHASES,
  SPELLING_SERVICE_STATE_VERSION,
  SPELLING_SESSION_PHASES,
  SPELLING_SESSION_TYPES,
} from './service-contract.js';

const PREF_KEY = 'ks2-platform-v2.spelling-prefs';

function createNoopStorage() {
  return {
    getItem() {
      return null;
    },
    setItem() {},
    removeItem() {},
  };
}

function prefsKey(learnerId) {
  return `${PREF_KEY}.${learnerId || 'default'}`;
}

function loadJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // local persistence is best-effort in the reference rebuild.
  }
}

function buildCloze(sentence, word) {
  const blanks = '_'.repeat(Math.max(String(word || '').length, 5));
  const escaped = String(word || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
  return String(sentence || '').replace(pattern, blanks);
}

function isKnownSlug(slug, wordBySlug = DEFAULT_WORD_BY_SLUG) {
  return typeof slug === 'string' && Boolean(wordBySlug[slug]);
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function clockFrom(now) {
  return () => {
    const value = typeof now === 'function' ? Number(now()) : Date.now();
    return Number.isFinite(value) ? value : Date.now();
  };
}

function defaultLabelForMode(mode) {
  if (mode === 'trouble') return 'Trouble drill';
  if (mode === 'single') return 'Single-word drill';
  if (mode === 'test') return 'SATs 20 test';
  return 'Smart review';
}

function normalisePrefs(rawPrefs = {}) {
  const mode = normaliseMode(rawPrefs.mode, 'smart');
  return {
    mode,
    yearFilter: normaliseYearFilter(rawPrefs.yearFilter, 'all'),
    roundLength: normaliseRoundLength(rawPrefs.roundLength, mode),
    showCloze: normaliseBoolean(rawPrefs.showCloze, true),
    autoSpeak: normaliseBoolean(rawPrefs.autoSpeak, true),
  };
}

function normaliseLearningStatus(entry, defaultNeeded) {
  const base = entry && typeof entry === 'object' && !Array.isArray(entry)
    ? entry
    : {};
  return {
    attempts: normaliseNonNegativeInteger(base.attempts, 0),
    successes: normaliseNonNegativeInteger(base.successes, 0),
    needed: Math.max(1, normaliseNonNegativeInteger(base.needed, defaultNeeded)),
    hadWrong: normaliseBoolean(base.hadWrong, false),
    wrongAnswers: normaliseStringArray(base.wrongAnswers),
    done: normaliseBoolean(base.done, false),
    applied: normaliseBoolean(base.applied, false),
  };
}

function normaliseTestResults(results, selectedSlugs) {
  const allowed = new Set(selectedSlugs);
  const seen = new Set();
  const list = Array.isArray(results) ? results : [];
  const clean = [];

  for (const entry of list) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const slug = typeof entry.slug === 'string' ? entry.slug : '';
    if (!allowed.has(slug) || seen.has(slug)) continue;
    clean.push({
      slug,
      answer: normaliseString(entry.answer),
      correct: normaliseBoolean(entry.correct, false),
    });
    seen.add(slug);
  }

  return clean;
}

function buildProgressMeta(session) {
  const total = Array.isArray(session?.uniqueWords) ? session.uniqueWords.length : 0;
  if (session?.type === 'test') {
    const results = Array.isArray(session?.results) ? session.results : [];
    return {
      total,
      checked: results.length,
      done: results.length,
      wrongCount: results.filter((item) => !item.correct).length,
    };
  }
  const statusEntries = Object.values(session?.status || {});
  return {
    total,
    checked: statusEntries.filter((info) => info.attempts > 0).length,
    done: statusEntries.filter((info) => info.done).length,
    wrongCount: statusEntries.filter((info) => info.hadWrong).length,
  };
}

function buildPrompt(engine, session, slug, wordBySlug = DEFAULT_WORD_BY_SLUG) {
  if (!isKnownSlug(slug, wordBySlug)) return null;
  const word = wordBySlug[slug];
  const current = session?.currentPrompt;
  const sentence = current?.slug === slug && typeof current.sentence === 'string'
    ? current.sentence
    : engine.peekPromptSentence(session, slug) || word.sentence || '';
  return {
    slug,
    sentence,
    cloze: buildCloze(sentence, word.word),
  };
}

function decorateSession(engine, learnerId, session, wordBySlug = DEFAULT_WORD_BY_SLUG) {
  if (!session) return null;
  const currentPrompt = session.currentSlug ? buildPrompt(engine, session, session.currentSlug, wordBySlug) : null;
  const currentCard = session.currentSlug && currentPrompt
    ? {
        slug: session.currentSlug,
        word: wordBySlug[session.currentSlug] || null,
        prompt: currentPrompt,
      }
    : null;

  return {
    ...session,
    version: SPELLING_SERVICE_STATE_VERSION,
    currentPrompt,
    currentCard,
    progress: buildProgressMeta(session),
    currentStage: currentCard?.slug ? engine.getProgress(learnerId, currentCard.slug).stage : 0,
  };
}

function buildTransition(state, { events = [], audio = null, changed = true, ok = true } = {}) {
  return {
    ok,
    state,
    events: Array.isArray(events) ? events.filter(Boolean) : [],
    audio,
    changed,
  };
}

function copyState(rawState) {
  return cloneSerialisable(rawState) || createInitialSpellingState();
}

function masteryMilestoneForCount(secureCount) {
  return SPELLING_MASTERY_MILESTONES.includes(secureCount) ? secureCount : null;
}

export function defaultSpellingPrefs() {
  return normalisePrefs();
}

export function createSpellingService({ repository, storage, tts, now, random, contentSnapshot } = {}) {
  const clock = clockFrom(now);
  const persistence = repository || {
    storage: storage || globalThis.localStorage || createNoopStorage(),
    syncPracticeSession() {},
    abandonPracticeSession() {},
    resetLearner() {},
  };
  const resolvedStorage = persistence.storage || storage || globalThis.localStorage || createNoopStorage();
  const randomFn = typeof random === 'function' ? random : Math.random;
  const runtimeWords = Array.isArray(contentSnapshot?.words)
    ? cloneSerialisable(contentSnapshot.words)
    : cloneSerialisable(DEFAULT_WORDS);
  const runtimeWordBySlug = contentSnapshot?.wordBySlug && typeof contentSnapshot.wordBySlug === 'object' && !Array.isArray(contentSnapshot.wordBySlug)
    ? cloneSerialisable(contentSnapshot.wordBySlug)
    : Object.fromEntries(runtimeWords.map((word) => [word.slug, cloneSerialisable(word)]));
  const isRuntimeKnownSlug = (slug) => isKnownSlug(slug, runtimeWordBySlug);

  const engine = createLegacySpellingEngine({
    words: runtimeWords,
    wordMeta: runtimeWordBySlug,
    storage: resolvedStorage,
    tts,
    now: clock,
    random,
  });

  function getPrefs(learnerId) {
    return normalisePrefs(loadJson(resolvedStorage, prefsKey(learnerId), {}));
  }

  function savePrefs(learnerId, prefs) {
    const next = normalisePrefs({ ...getPrefs(learnerId), ...(prefs || {}) });
    saveJson(resolvedStorage, prefsKey(learnerId), next);
    return next;
  }

  function getStats(learnerId, yearFilter = 'all') {
    return normaliseStats(engine.lifetimeStats(learnerId, normaliseYearFilter(yearFilter, 'all')));
  }

  function getAnalyticsSnapshot(learnerId) {
    return {
      version: SPELLING_SERVICE_STATE_VERSION,
      generatedAt: clock(),
      pools: {
        all: getStats(learnerId, 'all'),
        y34: getStats(learnerId, 'y3-4'),
        y56: getStats(learnerId, 'y5-6'),
      },
    };
  }

  function buildResumeSession(rawSession, learnerId) {
    if (!rawSession || typeof rawSession !== 'object' || Array.isArray(rawSession)) {
      return { session: null, summary: null, error: 'This spelling session is missing its saved state.' };
    }

    const raw = cloneSerialisable(rawSession);
    const type = SPELLING_SESSION_TYPES.includes(raw.type) ? raw.type : null;
    if (!type) {
      return { session: null, summary: null, error: 'This spelling session has an unknown type.' };
    }

    let currentSlug = isRuntimeKnownSlug(raw.currentSlug) ? raw.currentSlug : null;
    let uniqueWords = uniqueStrings(normaliseStringArray(raw.uniqueWords, isRuntimeKnownSlug));
    if (currentSlug && !uniqueWords.includes(currentSlug)) uniqueWords = [...uniqueWords, currentSlug];
    if (!uniqueWords.length) {
      return { session: null, summary: null, error: 'This spelling session no longer points at valid words.' };
    }

    const mode = normaliseMode(raw.mode, type === 'test' ? 'test' : 'smart');
    const session = {
      version: SPELLING_SERVICE_STATE_VERSION,
      id: normaliseString(raw.id, `sess-${clock()}-${randomFn().toString(16).slice(2)}`),
      type,
      mode,
      label: normaliseString(raw.label, defaultLabelForMode(mode)),
      fallbackToSmart: normaliseBoolean(raw.fallbackToSmart, false),
      profileId: normaliseString(raw.profileId, learnerId || 'default'),
      uniqueWords,
      queue: [],
      status: {},
      results: [],
      sentenceHistory: raw.sentenceHistory && typeof raw.sentenceHistory === 'object' && !Array.isArray(raw.sentenceHistory)
        ? raw.sentenceHistory
        : {},
      currentSlug,
      currentPrompt: null,
      phase: type === 'test'
        ? 'question'
        : (SPELLING_SESSION_PHASES.includes(raw.phase) ? raw.phase : 'question'),
      promptCount: normaliseNonNegativeInteger(raw.promptCount, 0),
      lastFamily: normaliseOptionalString(raw.lastFamily),
      lastYear: normaliseOptionalString(raw.lastYear),
      startedAt: normaliseTimestamp(raw.startedAt, clock()),
    };

    if (currentSlug) {
      session.currentPrompt = buildPrompt(engine, session, currentSlug, runtimeWordBySlug);
    }

    if (type === 'learning') {
      const existingStatus = raw.status && typeof raw.status === 'object' && !Array.isArray(raw.status)
        ? raw.status
        : {};
      for (const slug of uniqueWords) {
        const progress = engine.getProgress(learnerId, slug);
        session.status[slug] = normaliseLearningStatus(existingStatus[slug], progress.attempts === 0 ? 2 : 1);
      }
    }

    if (type === 'test') {
      session.results = normaliseTestResults(raw.results, uniqueWords);
    }

    const queued = uniqueStrings(normaliseStringArray(raw.queue, isRuntimeKnownSlug));
    if (queued.length) {
      session.queue = queued;
    } else if (type === 'learning') {
      session.queue = uniqueWords.filter((slug) => slug !== currentSlug && !session.status[slug]?.done);
    } else {
      const answered = new Set(session.results.map((entry) => entry.slug));
      session.queue = uniqueWords.filter((slug) => slug !== currentSlug && !answered.has(slug));
    }

    if (session.currentSlug && !runtimeWordBySlug[session.currentSlug]) {
      session.currentSlug = null;
      session.currentPrompt = null;
    }

    if (!session.currentSlug) {
      const next = engine.advanceCard(session, learnerId);
      if (next.done) {
        return {
          session: null,
          summary: normaliseSummary(engine.finalise(session), isRuntimeKnownSlug),
          error: '',
        };
      }
    }

    return {
      session: decorateSession(engine, learnerId, session, runtimeWordBySlug),
      summary: null,
      error: '',
    };
  }

  function initState(rawState = null, learnerId = null) {
    const source = rawState && typeof rawState === 'object' && !Array.isArray(rawState)
      ? copyState(rawState)
      : createInitialSpellingState();

    let phase = SPELLING_ROOT_PHASES.includes(source.phase) ? source.phase : 'dashboard';
    let feedback = normaliseFeedback(source.feedback);
    let summary = normaliseSummary(source.summary, isRuntimeKnownSlug);
    let error = normaliseString(source.error);
    let session = null;
    let awaitingAdvance = normaliseBoolean(source.awaitingAdvance, false);

    if (phase === 'summary') {
      if (!summary) {
        return {
          ...createInitialSpellingState(),
          error: error || 'This spelling summary could not be restored.',
        };
      }
      return {
        version: SPELLING_SERVICE_STATE_VERSION,
        phase: 'summary',
        session: null,
        feedback: null,
        summary,
        error: '',
        awaitingAdvance: false,
      };
    }

    if (phase === 'session') {
      const restored = buildResumeSession(source.session, learnerId);
      if (restored.summary) {
        return {
          version: SPELLING_SERVICE_STATE_VERSION,
          phase: 'summary',
          session: null,
          feedback: null,
          summary: restored.summary,
          error: '',
          awaitingAdvance: false,
        };
      }

      if (!restored.session) {
        return {
          ...createInitialSpellingState(),
          error: restored.error || error || 'This spelling session could not be resumed.',
        };
      }

      session = restored.session;
      feedback = normaliseFeedback(source.feedback);
      awaitingAdvance = awaitingAdvance && Boolean(feedback);
      error = '';

      return {
        version: SPELLING_SERVICE_STATE_VERSION,
        phase: 'session',
        session,
        feedback,
        summary: null,
        error,
        awaitingAdvance,
      };
    }

    return {
      version: SPELLING_SERVICE_STATE_VERSION,
      phase: 'dashboard',
      session: null,
      feedback: null,
      summary: null,
      error,
      awaitingAdvance: false,
    };
  }

  function activeAudioCue(learnerId, state, slow = false) {
    const prefs = getPrefs(learnerId);
    if (!prefs.autoSpeak) return null;
    const word = state?.session?.currentCard?.word;
    if (!word) return null;
    return {
      word,
      sentence: state.session.currentCard.prompt?.sentence,
      slow,
    };
  }

  function startSession(learnerId, options = {}) {
    const mode = normaliseMode(options.mode, 'smart');
    const yearFilter = normaliseYearFilter(options.yearFilter, 'all');
    const requestedWords = Array.isArray(options.words)
      ? uniqueStrings(options.words.map((slug) => normaliseString(slug).toLowerCase()).filter(Boolean))
      : null;
    const selectedWords = Array.isArray(options.words)
      ? uniqueStrings(options.words.map((slug) => (isRuntimeKnownSlug(slug) ? runtimeWordBySlug[slug] : null)).filter(Boolean).map((word) => word.slug)).map((slug) => runtimeWordBySlug[slug])
      : null;
    const length = mode === 'test'
      ? 20
      : options.length === 'all'
        ? Number.MAX_SAFE_INTEGER
        : Number(options.length) || 20;

    if (requestedWords?.length && !selectedWords?.length) {
      return buildTransition({
        ...createInitialSpellingState(),
        error: 'Could not start a spelling session.',
      }, { ok: false });
    }

    const created = engine.createSession({
      profileId: learnerId,
      mode,
      yearFilter,
      length,
      words: selectedWords,
    });

    if (!created.ok) {
      return buildTransition({
        ...createInitialSpellingState(),
        error: created.reason || 'Could not start a spelling session.',
      }, { ok: false });
    }

    const firstCard = engine.advanceCard(created.session, learnerId);
    const session = firstCard.done ? null : decorateSession(engine, learnerId, created.session, runtimeWordBySlug);
    if (!session) {
      return buildTransition({
        ...createInitialSpellingState(),
        error: 'Could not prepare the first spelling card.',
      }, { ok: false });
    }

    const nextState = {
      version: SPELLING_SERVICE_STATE_VERSION,
      phase: 'session',
      session,
      feedback: created.fallback
        ? {
            kind: 'warn',
            headline: 'Trouble drill fell back to Smart Review.',
            body: 'There were no active trouble words, so the engine built a mixed review round instead.',
          }
        : null,
      summary: null,
      error: '',
      awaitingAdvance: false,
    };

    persistence.syncPracticeSession(learnerId, nextState);
    return buildTransition(nextState, { audio: activeAudioCue(learnerId, nextState) });
  }

  function invalidSessionTransition(message) {
    return buildTransition({
      ...createInitialSpellingState(),
      error: message,
    }, { ok: false });
  }

  function submitAnswer(learnerId, rawState, typed) {
    const current = initState(rawState, learnerId);
    if (current.phase !== 'session' || !current.session) {
      return invalidSessionTransition('No active spelling session is available for that submission.');
    }

    if (current.awaitingAdvance) {
      return buildTransition(current, { changed: false });
    }

    const session = cloneSerialisable(current.session);
    const entryPhase = session.phase;
    const rawTyped = normaliseString(typed).trim();
    if (!rawTyped) {
      return buildTransition({
        ...current,
        feedback: {
          kind: 'warn',
          headline: 'Type an answer first.',
          body: 'No attempt was recorded.',
        },
        error: '',
        awaitingAdvance: false,
      });
    }

    const currentSlug = session.currentSlug;
    const result = session.type === 'test'
      ? engine.submitTest(session, learnerId, rawTyped)
      : engine.submitLearning(session, learnerId, rawTyped);

    if (!result) {
      return invalidSessionTransition('This spelling session became stale and was cleared.');
    }

    if (result.empty) {
      return buildTransition({
        ...current,
        feedback: {
          kind: 'warn',
          headline: 'Type an answer first.',
          body: 'No attempt was recorded.',
        },
        error: '',
        awaitingAdvance: false,
      });
    }

    const eventTime = clock();
    const events = [];
    if (currentSlug && result.correct && entryPhase !== 'question') {
      events.push(createSpellingRetryClearedEvent({
        learnerId,
        session,
        slug: currentSlug,
        fromPhase: entryPhase,
        attemptCount: session.status?.[currentSlug]?.attempts ?? null,
        createdAt: eventTime,
        wordMeta: runtimeWordBySlug,
      }));
    }
    if (result.outcome?.justMastered && currentSlug) {
      events.push(createSpellingWordSecuredEvent({
        learnerId,
        session,
        slug: currentSlug,
        stage: result.outcome.newStage,
        createdAt: eventTime,
        wordMeta: runtimeWordBySlug,
      }));

      const secureCount = getStats(learnerId, 'all').secure;
      const milestone = masteryMilestoneForCount(secureCount);
      if (milestone) {
        events.push(createSpellingMasteryMilestoneEvent({
          learnerId,
          session,
          milestone,
          secureCount,
          createdAt: eventTime,
        }));
      }
    }

    const nextState = {
      version: SPELLING_SERVICE_STATE_VERSION,
      phase: 'session',
      session: decorateSession(engine, learnerId, session, runtimeWordBySlug),
      feedback: normaliseFeedback(result.feedback),
      summary: null,
      error: '',
      awaitingAdvance: result.nextAction === 'advance',
    };

    const audio = !nextState.awaitingAdvance && result.phase === 'retry'
      ? activeAudioCue(learnerId, nextState, true)
      : null;

    persistence.syncPracticeSession(learnerId, nextState);
    return buildTransition(nextState, { events, audio });
  }

  function continueSession(learnerId, rawState) {
    const current = initState(rawState, learnerId);
    if (current.phase !== 'session' || !current.session) {
      return invalidSessionTransition('No active spelling session is available to continue.');
    }

    if (!current.awaitingAdvance) {
      return buildTransition(current, { changed: false });
    }

    const session = cloneSerialisable(current.session);
    const advanced = engine.advanceCard(session, learnerId);

    if (advanced.done) {
      const summary = normaliseSummary(engine.finalise(session), isRuntimeKnownSlug);
      const nextState = {
        version: SPELLING_SERVICE_STATE_VERSION,
        phase: 'summary',
        session: null,
        feedback: null,
        summary,
        error: '',
        awaitingAdvance: false,
      };
      persistence.syncPracticeSession(learnerId, nextState);
      return buildTransition(nextState, {
        events: [createSpellingSessionCompletedEvent({ learnerId, session, summary, createdAt: clock() })],
      });
    }

    const nextState = {
      version: SPELLING_SERVICE_STATE_VERSION,
      phase: 'session',
      session: decorateSession(engine, learnerId, session, runtimeWordBySlug),
      feedback: null,
      summary: null,
      error: '',
      awaitingAdvance: false,
    };

    persistence.syncPracticeSession(learnerId, nextState);
    return buildTransition(nextState, { audio: activeAudioCue(learnerId, nextState) });
  }

  function skipWord(learnerId, rawState) {
    const current = initState(rawState, learnerId);
    if (current.phase !== 'session' || !current.session) {
      return invalidSessionTransition('No active spelling session is available to skip within.');
    }

    if (current.awaitingAdvance) {
      return buildTransition(current, { changed: false });
    }

    const session = cloneSerialisable(current.session);
    const skipped = engine.skipCurrent(session);
    if (!skipped) {
      return buildTransition({
        ...current,
        feedback: {
          kind: 'warn',
          headline: 'This word cannot be skipped right now.',
          body: 'Finish the retry or correction step first.',
        },
        error: '',
      });
    }

    const advanced = engine.advanceCard(session, learnerId);
    if (advanced.done) {
      const summary = normaliseSummary(engine.finalise(session), isRuntimeKnownSlug);
      const nextState = {
        version: SPELLING_SERVICE_STATE_VERSION,
        phase: 'summary',
        session: null,
        feedback: null,
        summary,
        error: '',
        awaitingAdvance: false,
      };
      persistence.syncPracticeSession(learnerId, nextState);
      return buildTransition(nextState, {
        events: [createSpellingSessionCompletedEvent({ learnerId, session, summary, createdAt: clock() })],
      });
    }

    const nextState = {
      version: SPELLING_SERVICE_STATE_VERSION,
      phase: 'session',
      session: decorateSession(engine, learnerId, session, runtimeWordBySlug),
      feedback: {
        kind: 'info',
        headline: 'Skipped for now.',
        body: 'This word has been moved later in the round.',
      },
      summary: null,
      error: '',
      awaitingAdvance: false,
    };
    persistence.syncPracticeSession(learnerId, nextState);
    return buildTransition(nextState);
  }

  function endSession(learnerId, rawState = null) {
    const current = rawState ? initState(rawState, learnerId) : createInitialSpellingState();
    if (current.phase === 'session' && current.session) {
      persistence.abandonPracticeSession(learnerId, current);
    }
    return buildTransition(createInitialSpellingState());
  }

  function stageLabel(stage) {
    return engine.stageLabel(stage);
  }

  function resetLearner(learnerId) {
    engine.resetProgress(learnerId);
    persistence.resetLearner?.(learnerId);
    saveJson(resolvedStorage, prefsKey(learnerId), defaultSpellingPrefs());
  }

  return {
    initState,
    getPrefs,
    savePrefs,
    getStats,
    getAnalyticsSnapshot,
    startSession,
    submitAnswer,
    continueSession,
    skipWord,
    endSession,
    stageLabel,
    resetLearner,
  };
}
