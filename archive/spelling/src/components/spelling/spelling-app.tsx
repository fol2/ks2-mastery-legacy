"use client";

import {
  DEFAULT_GEMINI_VOICE,
  DEFAULT_SESSION_SIZE,
  GEMINI_TTS_VOICES,
} from "@/lib/spelling/constants";
import { getCachedAudio, putCachedAudio } from "@/lib/spelling/audio-cache";
import { listUkBrowserVoices, speakBrowserText } from "@/lib/spelling/browser-tts";
import { loadLearnerState, saveLearnerState } from "@/lib/spelling/persistence";
import {
  advanceSession,
  chooseSmartWords,
  chooseTestWords,
  chooseTroubleWords,
  computeLiveStats,
  computePracticeStats,
  createLearningSession,
  createTestSession,
  currentPrompt,
  currentWord,
  filteredWords,
  normalizeAnswer,
  skipCurrentLearningWord,
  stageLabel,
  statusClassForWord,
  submitLearningAnswer,
  submitTestAnswer,
  type YearFilter,
} from "@/lib/spelling/session";
import { buildAudioCacheKey } from "@/lib/spelling/tts";
import { SPELLING_WORDS, SPELLING_WORDS_BY_SLUG } from "@/lib/spelling/words";
import type {
  AudioEngine,
  LearnerState,
  PracticeSession,
  SessionSummary,
  SpellingWord,
} from "@/lib/spelling/types";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

type Route = "home" | "spelling" | "collection";
type SubjectTab = "practice" | "analytics" | "profiles" | "settings" | "method";

type SubjectCard = {
  id: string;
  name: string;
  blurb: string;
  accent: string;
  accentSoft: string;
  accentTint: string;
  icon: IconName;
  enabled: boolean;
};

type IconName =
  | "pen"
  | "plus"
  | "brain"
  | "speech"
  | "quote"
  | "book"
  | "play"
  | "chart"
  | "people"
  | "cog"
  | "method"
  | "home"
  | "back"
  | "next"
  | "volume"
  | "check"
  | "close"
  | "spark"
  | "flame";

const SUBJECTS: Record<string, SubjectCard> = {
  spelling: {
    id: "spelling",
    name: "Spelling",
    blurb: "Learn tricky words by sound, sight and meaning in formal UK English.",
    accent: "#3E6FA8",
    accentSoft: "#DCE6F3",
    accentTint: "#EEF3FA",
    icon: "pen",
    enabled: true,
  },
  arithmetic: {
    id: "arithmetic",
    name: "Arithmetic",
    blurb: "Build speed and fluency with the four operations.",
    accent: "#C06B3E",
    accentSoft: "#F5DDCE",
    accentTint: "#FBEEE4",
    icon: "plus",
    enabled: false,
  },
  reasoning: {
    id: "reasoning",
    name: "Reasoning",
    blurb: "Plan, work it out and check multi-step maths with confidence.",
    accent: "#8A5A9D",
    accentSoft: "#E6D9ED",
    accentTint: "#F1E9F4",
    icon: "brain",
    enabled: false,
  },
  grammar: {
    id: "grammar",
    name: "Grammar",
    blurb: "Word classes, clauses, tense and sentence shape.",
    accent: "#2E8479",
    accentSoft: "#CFE8E3",
    accentTint: "#E3F1EE",
    icon: "speech",
    enabled: false,
  },
  punctuation: {
    id: "punctuation",
    name: "Punctuation",
    blurb: "Commas, apostrophes, speech marks and more.",
    accent: "#B8873F",
    accentSoft: "#F0E1C4",
    accentTint: "#F7EEDC",
    icon: "quote",
    enabled: false,
  },
  reading: {
    id: "reading",
    name: "Reading",
    blurb: "Retrieve, infer and explain from rich KS2 passages.",
    accent: "#4B7A4A",
    accentSoft: "#D9E7D7",
    accentTint: "#E8F0E6",
    icon: "book",
    enabled: false,
  },
};

const SUBJECT_ORDER = ["spelling", "arithmetic", "reasoning", "grammar", "punctuation", "reading"] as const;
const SUBJECT_TABS: Array<{ id: SubjectTab; label: string; icon: IconName }> = [
  { id: "practice", label: "Practice", icon: "play" },
  { id: "analytics", label: "Progress", icon: "chart" },
  { id: "profiles", label: "Profiles", icon: "people" },
  { id: "settings", label: "Settings", icon: "cog" },
  { id: "method", label: "Method", icon: "method" },
];

function buildDictationTranscript(word: string, sentence: string) {
  const cleanSentence = sentence.trim();
  return cleanSentence
    ? `The word is ${word}. ${cleanSentence} The word is ${word}.`
    : `The word is ${word}. The word is ${word}.`;
}

function feedbackShouldAdvance(kind: string) {
  return kind === "correct" || kind === "locked-in" || kind === "saved";
}

function readLocalValue<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.localStorage.getItem(key);
  return value ? (value as T) : fallback;
}

function subjectTheme(subject: SubjectCard): CSSProperties {
  return {
    "--subject-accent": subject.accent,
    "--subject-accent-soft": subject.accentSoft,
    "--subject-accent-tint": subject.accentTint,
  } as CSSProperties;
}

export function SpellingApp({ hasGeminiKey }: { hasGeminiKey: boolean }) {
  const [route, setRoute] = useState<Route>(() => readLocalValue("ks2-mastery-route", "home"));
  const [activeTab, setActiveTab] = useState<SubjectTab>(() => readLocalValue("ks2-mastery-tab", "practice"));
  const [learnerState, setLearnerState] = useState<LearnerState>(() => loadLearnerState());
  const [yearFilter, setYearFilter] = useState<YearFilter>("all");
  const [sessionSize, setSessionSize] = useState<number>(DEFAULT_SESSION_SIZE);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: string;
    tone: "success" | "info" | "error";
    title: string;
    message: string;
    answer?: string;
  } | null>(null);
  const [answer, setAnswer] = useState("");
  const [wordSearch, setWordSearch] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showCloze, setShowCloze] = useState(true);
  const [rate, setRate] = useState(1.05);
  const [ttsEngine, setTtsEngine] = useState<AudioEngine>(hasGeminiKey ? "gemini" : "browser");
  const [geminiVoice, setGeminiVoice] = useState<string>(DEFAULT_GEMINI_VOICE);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [browserVoiceUri, setBrowserVoiceUri] = useState("");
  const [statusLine, setStatusLine] = useState(
    "Smart Review prioritises due words, weak words and unseen spellings.",
  );
  const [audioNote, setAudioNote] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioUrlRef = useRef("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestRef = useRef(0);
  const advanceTimerRef = useRef<number | null>(null);

  const currentSubject = SUBJECTS.spelling;
  const currentWordData = useMemo(() => currentWord(session, SPELLING_WORDS_BY_SLUG), [session]);
  const currentPromptData = useMemo(() => currentPrompt(session), [session]);
  const visibleWords = useMemo(() => {
    const query = normalizeAnswer(wordSearch);
    return filteredWords(SPELLING_WORDS, yearFilter).filter((word) => {
      if (!query) {
        return true;
      }

      return (
        word.slug.includes(query) ||
        normalizeAnswer(word.family).includes(query) ||
        normalizeAnswer(word.yearLabel).includes(query)
      );
    });
  }, [wordSearch, yearFilter]);
  const practiceStats = useMemo(
    () => computePracticeStats(SPELLING_WORDS, learnerState.progress, yearFilter),
    [learnerState.progress, yearFilter],
  );
  const liveStats = useMemo(
    () => computeLiveStats(SPELLING_WORDS, learnerState.progress, yearFilter),
    [learnerState.progress, yearFilter],
  );

  const learningProgress = useMemo(() => {
    if (!session || session.type !== "learning") {
      return { text: "", ratio: 0 };
    }

    const done = Object.values(session.status).filter((info) => info.done).length;
    const checked = Object.values(session.status).filter((info) => info.attempts > 0).length;
    const trouble = Object.values(session.status).filter((info) => info.hadWrong).length;
    const total = session.uniqueWords.length;
    const ratio = total ? (checked + done) / (total * 2) : 0;

    return {
      text: `${checked} of ${total} checked • ${done} secure • ${trouble} need another pass`,
      ratio,
    };
  }, [session]);

  const testProgress = useMemo(() => {
    if (!session || session.type !== "test") {
      return { text: "", ratio: 0 };
    }

    const total = session.uniqueWords.length;
    const completed = session.results.length;
    return {
      text: `${Math.min(completed + 1, total)} of ${total} test words`,
      ratio: total ? completed / total : 0,
    };
  }, [session]);

  const groupedWords = useMemo(
    () => [
      { key: "3-4", title: "Years 3-4", words: visibleWords.filter((word) => word.year === "3-4") },
      { key: "5-6", title: "Years 5-6", words: visibleWords.filter((word) => word.year === "5-6") },
    ],
    [visibleWords],
  );

  const displayedAudioNote =
    audioNote ??
    (ttsEngine === "gemini"
      ? hasGeminiKey
        ? "Gemini TTS ready for formal UK dictation."
        : "Gemini secret missing. Browser UK speech only."
      : browserVoices.length
        ? "Browser UK speech ready."
        : "Browser speech available.");

  useEffect(() => {
    saveLearnerState(learnerState);
  }, [learnerState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("ks2-mastery-route", route);
  }, [route]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("ks2-mastery-tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const syncVoices = () => {
      const voices = listUkBrowserVoices();
      setBrowserVoices(voices);
      setBrowserVoiceUri((current) => {
        if (voices.some((voice) => voice.voiceURI === current)) {
          return current;
        }
        return voices[0]?.voiceURI ?? "";
      });
    };

    syncVoices();
    window.speechSynthesis.onvoiceschanged = syncVoices;

    return () => {
      if (window.speechSynthesis.onvoiceschanged === syncVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    inputRef.current?.focus();
  }, [session?.currentSlug, session]);

  function revokeActiveAudioUrl() {
    if (!activeAudioUrlRef.current) {
      return;
    }

    URL.revokeObjectURL(activeAudioUrlRef.current);
    activeAudioUrlRef.current = "";
  }

  const stopAudioPlayback = useCallback(() => {
    activeRequestRef.current += 1;
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    audioPlayerRef.current?.pause();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.removeAttribute("src");
      audioPlayerRef.current.load();
    }
    revokeActiveAudioUrl();
  }, []);

  useEffect(() => {
    audioPlayerRef.current = new Audio();
    return () => {
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  const playCurrentWord = useCallback(async (slow: boolean) => {
    if (!currentWordData || !currentPromptData) {
      return;
    }

    const sentence = currentPromptData.sentence || currentWordData.sentence;
    const playbackRate = slow ? Math.max(0.92, Number(rate) - 0.12) : Number(rate);
    const transcript = buildDictationTranscript(currentWordData.word, sentence);
    const canUseGemini = ttsEngine === "gemini" && hasGeminiKey;

    if (!canUseGemini) {
      try {
        stopAudioPlayback();
        setAudioNote("Speaking with browser voice...");
        await speakBrowserText(transcript, { rate: playbackRate, voiceUri: browserVoiceUri });
        setAudioNote("Browser speech ready.");
      } catch {
        setAudioNote("Browser speech unavailable.");
      }
      return;
    }

    stopAudioPlayback();
    const requestId = activeRequestRef.current;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setAudioNote("Loading audio...");

    try {
      const requestPayload = {
        word: currentWordData.word,
        sentence,
        slow,
        voiceName: geminiVoice,
      };
      const cacheKey = buildAudioCacheKey(requestPayload);
      let audioBlob = await getCachedAudio(cacheKey);

      if (!audioBlob) {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `Gemini TTS failed with status ${response.status}.`);
        }

        audioBlob = await response.blob();
        void putCachedAudio(cacheKey, audioBlob);
      }

      if (requestId !== activeRequestRef.current) {
        return;
      }

      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio();
      }
      revokeActiveAudioUrl();
      activeAudioUrlRef.current = URL.createObjectURL(audioBlob);
      audioPlayerRef.current.src = activeAudioUrlRef.current;
      audioPlayerRef.current.playbackRate = playbackRate;
      await audioPlayerRef.current.play();
      setAudioNote("Gemini TTS ready.");
    } catch (error) {
      if (abortController.signal.aborted || requestId !== activeRequestRef.current) {
        return;
      }

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          setAudioNote("Gemini unavailable. Using browser speech.");
          await speakBrowserText(transcript, { rate: playbackRate, voiceUri: browserVoiceUri });
          setAudioNote("Browser speech ready.");
          return;
        } catch {
          // fall through
        }
      }

      setAudioNote(error instanceof Error ? error.message : "Audio error.");
    } finally {
      if (requestId === activeRequestRef.current) {
        abortControllerRef.current = null;
      }
    }
  }, [browserVoiceUri, currentPromptData, currentWordData, geminiVoice, hasGeminiKey, rate, stopAudioPlayback, ttsEngine]);

  useEffect(() => {
    if (!autoSpeak || !currentWordData || !currentPromptData) {
      return;
    }

    const timer = window.setTimeout(() => {
      void playCurrentWord(false);
    }, 140);

    return () => window.clearTimeout(timer);
  }, [autoSpeak, currentPromptData, currentWordData, playCurrentWord]);

  function beginLearningRound(mode: "smart" | "trouble" | "single", customWords?: SpellingWord[]) {
    stopAudioPlayback();
    setRoute("spelling");
    setActiveTab("practice");
    setFeedback(null);
    setSummary(null);
    setAnswer("");
    setAudioNote(null);

    let selectedWords: SpellingWord[] = [];
    let usedSmartFallback = false;

    if (customWords?.length) {
      selectedWords = customWords;
    } else if (mode === "trouble") {
      const choice = chooseTroubleWords(SPELLING_WORDS, learnerState.progress, yearFilter, sessionSize);
      selectedWords = choice.words;
      usedSmartFallback = choice.fallback;
    } else {
      selectedWords = chooseSmartWords(SPELLING_WORDS, learnerState.progress, yearFilter, sessionSize);
    }

    if (!selectedWords.length) {
      setStatusLine("No spellings were available for that round.");
      setSession(null);
      return;
    }

    const nextSession = createLearningSession(selectedWords, learnerState.progress, mode, usedSmartFallback);
    const completedSummary = advanceSession(nextSession, SPELLING_WORDS_BY_SLUG, learnerState.progress);
    if (completedSummary) {
      setSummary(completedSummary);
      setSession(null);
      return;
    }

    setStatusLine(
      usedSmartFallback
        ? "No saved trouble words yet, so Smart Review started instead."
        : `${nextSession.label} started.`,
    );
    setSession(nextSession);
  }

  function beginTestRound() {
    stopAudioPlayback();
    setRoute("spelling");
    setActiveTab("practice");
    setFeedback(null);
    setSummary(null);
    setAnswer("");
    setAudioNote(null);

    const selectedWords = chooseTestWords(SPELLING_WORDS, yearFilter);
    if (!selectedWords.length) {
      setStatusLine("No spellings were available for a test.");
      setSession(null);
      return;
    }

    const nextSession = createTestSession(selectedWords);
    const completedSummary = advanceSession(nextSession, SPELLING_WORDS_BY_SLUG, learnerState.progress);
    if (completedSummary) {
      setSummary(completedSummary);
      setSession(null);
      return;
    }

    setStatusLine("SATs-style test started.");
    setSession(nextSession);
  }

  function handleSubmit() {
    if (!session) {
      return;
    }

    const nextSession = structuredClone(session);
    const nextProgress = structuredClone(learnerState.progress);
    const result =
      nextSession.type === "learning"
        ? submitLearningAnswer(nextSession, answer, SPELLING_WORDS_BY_SLUG, nextProgress)
        : submitTestAnswer(nextSession, answer, SPELLING_WORDS_BY_SLUG, nextProgress);

    setLearnerState({ progress: nextProgress });
    setSession(nextSession);
    setFeedback(result);

    if (result.kind === "retry") {
      setAnswer("");
      window.setTimeout(() => {
        void playCurrentWord(true);
      }, 140);
      return;
    }

    if (result.kind === "correction") {
      setAnswer("");
      return;
    }

    if (!feedbackShouldAdvance(result.kind)) {
      return;
    }

    const delay = nextSession.type === "test" ? 320 : 500;
    advanceTimerRef.current = window.setTimeout(() => {
      const sessionToAdvance = structuredClone(nextSession);
      const completedSummary = advanceSession(sessionToAdvance, SPELLING_WORDS_BY_SLUG, nextProgress);

      if (completedSummary) {
        stopAudioPlayback();
        setSession(null);
        setSummary(completedSummary);
        setFeedback(null);
      } else {
        setSession(sessionToAdvance);
        setFeedback(null);
      }

      setAnswer("");
    }, delay);
  }

  function handleSkip() {
    if (!session || session.type !== "learning" || session.phase !== "question") {
      return;
    }

    const nextSession = structuredClone(session);
    skipCurrentLearningWord(nextSession, SPELLING_WORDS_BY_SLUG);
    const completedSummary = advanceSession(nextSession, SPELLING_WORDS_BY_SLUG, learnerState.progress);

    if (completedSummary) {
      setSession(null);
      setSummary(completedSummary);
      setFeedback(null);
      return;
    }

    setAnswer("");
    setFeedback(null);
    setSession(nextSession);
    setStatusLine("Word requeued for later in this round.");
  }

  function handleEndSession() {
    stopAudioPlayback();
    setSession(null);
    setSummary(null);
    setFeedback(null);
    setAnswer("");
    setAudioNote(null);
    setStatusLine("Session ended. Choose a new round when ready.");
  }

  function drillSummaryMistakes() {
    if (!summary?.mistakes.length) {
      return;
    }

    const words = summary.mistakes.map((slug) => SPELLING_WORDS_BY_SLUG[slug]).filter(Boolean);
    beginLearningRound("trouble", words);
  }

  return (
    <main className="mastery-page">
      {route === "home" ? (
        <DashboardView
          hasGeminiKey={hasGeminiKey}
          practiceStats={practiceStats}
          liveStats={liveStats}
          statusLine={statusLine}
          goToSubject={() => setRoute("spelling")}
          goToCollection={() => setRoute("collection")}
          startSmart={() => beginLearningRound("smart")}
          startTrouble={() => beginLearningRound("trouble")}
          startTest={beginTestRound}
        />
      ) : null}

      {route === "collection" ? (
        <CollectionView
          practiceStats={practiceStats}
          liveStats={liveStats}
          onBack={() => setRoute("home")}
          onOpenSpelling={() => setRoute("spelling")}
        />
      ) : null}

      {route === "spelling" ? (
        <section className="subject-shell" style={subjectTheme(currentSubject)}>
          <div className="subject-toolbar">
            <button className="ghost-button small-button" onClick={() => setRoute("home")}>
              <Icon name="back" size={14} />
              Back to dashboard
            </button>
            <button className="ghost-button small-button" onClick={() => setRoute("collection")}>
              <Icon name="spark" size={14} />
              Monster Codex
            </button>
          </div>

          <header className="subject-header">
            <div className="subject-header-main">
              <SubjectGlyph subject={currentSubject} size={58} filled />
              <div>
                <p className="eyebrow accent-text">KS2 Mastery · Web engine</p>
                <h1>{currentSubject.name}</h1>
                <p className="subject-copy">
                  {currentSubject.blurb} This is the live Cloudflare-ready engine with local progress,
                  IndexedDB audio cache and browser fallback.
                </p>
              </div>
            </div>
            <div className="subject-header-meta">
              <Chip tone="accent" accent={currentSubject.accent} background={currentSubject.accentTint}>
                <Icon name="flame" size={12} />
                {liveStats.due} due today
              </Chip>
              <Chip tone="accent" accent={currentSubject.accent} background={currentSubject.accentTint}>
                <Icon name="spark" size={12} />
                {practiceStats.secure} secure
              </Chip>
              <Chip tone={hasGeminiKey ? "good" : "warn"}>
                {hasGeminiKey ? "Gemini server-ready" : "Browser-only audio"}
              </Chip>
            </div>
            <nav className="subject-tabs">
              {SUBJECT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon name={tab.icon} size={15} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </header>

          {activeTab === "practice" ? (
            <PracticeTab
              currentSubject={currentSubject}
              yearFilter={yearFilter}
              setYearFilter={setYearFilter}
              sessionSize={sessionSize}
              setSessionSize={setSessionSize}
              ttsEngine={ttsEngine}
              setTtsEngine={setTtsEngine}
              hasGeminiKey={hasGeminiKey}
              geminiVoice={geminiVoice}
              setGeminiVoice={setGeminiVoice}
              browserVoices={browserVoices}
              browserVoiceUri={browserVoiceUri}
              setBrowserVoiceUri={setBrowserVoiceUri}
              rate={rate}
              setRate={setRate}
              autoSpeak={autoSpeak}
              setAutoSpeak={setAutoSpeak}
              showCloze={showCloze}
              setShowCloze={setShowCloze}
              statusLine={statusLine}
              displayedAudioNote={displayedAudioNote}
              beginLearningRound={beginLearningRound}
              beginTestRound={beginTestRound}
              session={session}
              currentWordData={currentWordData}
              currentPromptData={currentPromptData}
              learnerState={learnerState}
              learningProgress={learningProgress}
              testProgress={testProgress}
              playCurrentWord={playCurrentWord}
              handleSkip={handleSkip}
              inputRef={inputRef}
              answer={answer}
              setAnswer={setAnswer}
              handleSubmit={handleSubmit}
              feedback={feedback}
              liveStats={liveStats}
              handleEndSession={handleEndSession}
              summary={summary}
              drillSummaryMistakes={drillSummaryMistakes}
              wordSearch={wordSearch}
              setWordSearch={setWordSearch}
              groupedWords={groupedWords}
            />
          ) : null}

          {activeTab === "analytics" ? (
            <AnalyticsTab practiceStats={practiceStats} liveStats={liveStats} groupedWords={groupedWords} learnerState={learnerState} />
          ) : null}

          {activeTab === "profiles" ? (
            <ProfilesTab practiceStats={practiceStats} liveStats={liveStats} />
          ) : null}

          {activeTab === "settings" ? (
            <SettingsTab
              yearFilter={yearFilter}
              setYearFilter={setYearFilter}
              sessionSize={sessionSize}
              setSessionSize={setSessionSize}
              ttsEngine={ttsEngine}
              setTtsEngine={setTtsEngine}
              hasGeminiKey={hasGeminiKey}
              geminiVoice={geminiVoice}
              setGeminiVoice={setGeminiVoice}
              browserVoices={browserVoices}
              browserVoiceUri={browserVoiceUri}
              setBrowserVoiceUri={setBrowserVoiceUri}
              rate={rate}
              setRate={setRate}
              autoSpeak={autoSpeak}
              setAutoSpeak={setAutoSpeak}
              showCloze={showCloze}
              setShowCloze={setShowCloze}
              displayedAudioNote={displayedAudioNote}
            />
          ) : null}

          {activeTab === "method" ? (
            <MethodTab hasGeminiKey={hasGeminiKey} />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function DashboardView({
  hasGeminiKey,
  practiceStats,
  liveStats,
  statusLine,
  goToSubject,
  goToCollection,
  startSmart,
  startTrouble,
  startTest,
}: {
  hasGeminiKey: boolean;
  practiceStats: ReturnType<typeof computePracticeStats>;
  liveStats: ReturnType<typeof computeLiveStats>;
  statusLine: string;
  goToSubject: () => void;
  goToCollection: () => void;
  startSmart: () => void;
  startTrouble: () => void;
  startTest: () => void;
}) {
  return (
    <section className="dashboard-shell">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">KS2 Mastery · Unified shell</p>
          <h1>Spelling is now the first live subject in the wider KS2 platform.</h1>
          <p>
            This foundation follows the newer UX/UI direction, while keeping the current spelling engine
            ready for Cloudflare hosting, Gemini TTS and browser offline fallback.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={goToSubject}>
              <Icon name="play" size={15} />
              Open spelling
            </button>
            <button className="ghost-button" onClick={goToCollection}>
              <Icon name="spark" size={15} />
              Monster Codex
            </button>
          </div>
        </div>
        <div className="hero-sidecard">
          <div className="hero-chip-row">
            <Chip tone="accent" accent={SUBJECTS.spelling.accent} background={SUBJECTS.spelling.accentTint}>
              {practiceStats.practiceSpellings} spellings
            </Chip>
            <Chip tone="good">{hasGeminiKey ? "Gemini connected" : "Browser fallback"}</Chip>
          </div>
          <dl className="hero-summary-list">
            <div>
              <dt>Due now</dt>
              <dd>{liveStats.due}</dd>
            </div>
            <div>
              <dt>Secure</dt>
              <dd>{practiceStats.secure}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{practiceStats.accuracy === null ? "—" : `${practiceStats.accuracy}%`}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="dashboard-grid">
        {SUBJECT_ORDER.map((subjectId) => {
          const subject = SUBJECTS[subjectId];
          return (
            <button
              key={subject.id}
              className={`subject-card ${subject.enabled ? "" : "locked"}`}
              onClick={subject.enabled ? goToSubject : undefined}
              disabled={!subject.enabled}
              style={subjectTheme(subject)}
            >
              <div className="subject-card-head">
                <SubjectGlyph subject={subject} size={48} filled={subject.enabled} />
                <Chip tone={subject.enabled ? "accent" : "neutral"} accent={subject.accent} background={subject.accentTint}>
                  {subject.enabled ? "Live now" : "Coming soon"}
                </Chip>
              </div>
              <h2>{subject.name}</h2>
              <p>{subject.blurb}</p>
            </button>
          );
        })}
      </section>

      <section className="dashboard-support-grid">
        <Panel
          eyebrow="Quick launch"
          title="Start a spelling session"
          description="Use the live engine immediately from the dashboard."
        >
          <div className="quick-action-grid">
            <button className="primary-button" onClick={startSmart}>
              Smart Review
            </button>
            <button className="secondary-button" onClick={startTrouble}>
              Trouble Drill
            </button>
            <button className="ghost-button" onClick={startTest}>
              SATs 20 test
            </button>
          </div>
          <p className="muted-copy">{statusLine}</p>
        </Panel>

        <Panel eyebrow="At a glance" title="Current progress">
          <div className="stats-grid compact-stats">
            <StatCard label="Official sets" value={practiceStats.officialSets} note="Statutory families in scope" />
            <StatCard label="Due today" value={practiceStats.dueToday} note="Ready for review now" />
            <StatCard label="New left" value={practiceStats.newLeft} note="Not yet attempted locally" />
            <StatCard label="Trouble" value={liveStats.trouble} note="Still fragile or frequently missed" />
          </div>
        </Panel>
      </section>
    </section>
  );
}

function CollectionView({
  practiceStats,
  liveStats,
  onBack,
  onOpenSpelling,
}: {
  practiceStats: ReturnType<typeof computePracticeStats>;
  liveStats: ReturnType<typeof computeLiveStats>;
  onBack: () => void;
  onOpenSpelling: () => void;
}) {
  return (
    <section className="collection-shell">
      <div className="subject-toolbar">
        <button className="ghost-button small-button" onClick={onBack}>
          <Icon name="back" size={14} />
          Back to dashboard
        </button>
      </div>

      <Panel eyebrow="Monster Codex" title="Collection layer reserved for the next pass" description="The newer UX shell expects a cross-subject reward layer. For now, the spelling engine still drives the underlying mastery data.">
        <div className="stats-grid">
          <StatCard label="Secure words" value={practiceStats.secure} note="Already strong in local progress" />
          <StatCard label="Due words" value={liveStats.due} note="Ready for another review today" />
          <StatCard label="Trouble words" value={liveStats.trouble} note="Likely to feed future collection events" />
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={onOpenSpelling}>
            <Icon name="pen" size={15} />
            Return to spelling
          </button>
        </div>
      </Panel>
    </section>
  );
}

function PracticeTab({
  currentSubject,
  yearFilter,
  setYearFilter,
  sessionSize,
  setSessionSize,
  ttsEngine,
  setTtsEngine,
  hasGeminiKey,
  geminiVoice,
  setGeminiVoice,
  browserVoices,
  browserVoiceUri,
  setBrowserVoiceUri,
  rate,
  setRate,
  autoSpeak,
  setAutoSpeak,
  showCloze,
  setShowCloze,
  statusLine,
  displayedAudioNote,
  beginLearningRound,
  beginTestRound,
  session,
  currentWordData,
  currentPromptData,
  learnerState,
  learningProgress,
  testProgress,
  playCurrentWord,
  handleSkip,
  inputRef,
  answer,
  setAnswer,
  handleSubmit,
  feedback,
  liveStats,
  handleEndSession,
  summary,
  drillSummaryMistakes,
  wordSearch,
  setWordSearch,
  groupedWords,
}: {
  currentSubject: SubjectCard;
  yearFilter: YearFilter;
  setYearFilter: (value: YearFilter) => void;
  sessionSize: number;
  setSessionSize: (value: number) => void;
  ttsEngine: AudioEngine;
  setTtsEngine: (value: AudioEngine) => void;
  hasGeminiKey: boolean;
  geminiVoice: string;
  setGeminiVoice: (value: string) => void;
  browserVoices: SpeechSynthesisVoice[];
  browserVoiceUri: string;
  setBrowserVoiceUri: (value: string) => void;
  rate: number;
  setRate: (value: number) => void;
  autoSpeak: boolean;
  setAutoSpeak: (value: boolean) => void;
  showCloze: boolean;
  setShowCloze: (value: boolean) => void;
  statusLine: string;
  displayedAudioNote: string;
  beginLearningRound: (mode: "smart" | "trouble" | "single", customWords?: SpellingWord[]) => void;
  beginTestRound: () => void;
  session: PracticeSession | null;
  currentWordData: SpellingWord | null;
  currentPromptData: ReturnType<typeof currentPrompt>;
  learnerState: LearnerState;
  learningProgress: { text: string; ratio: number };
  testProgress: { text: string; ratio: number };
  playCurrentWord: (slow: boolean) => Promise<void>;
  handleSkip: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  answer: string;
  setAnswer: (value: string) => void;
  handleSubmit: () => void;
  feedback: {
    kind: string;
    tone: "success" | "info" | "error";
    title: string;
    message: string;
    answer?: string;
  } | null;
  liveStats: ReturnType<typeof computeLiveStats>;
  handleEndSession: () => void;
  summary: SessionSummary | null;
  drillSummaryMistakes: () => void;
  wordSearch: string;
  setWordSearch: (value: string) => void;
  groupedWords: Array<{ key: string; title: string; words: SpellingWord[] }>;
}) {
  const progressRatio = session?.type === "test" ? testProgress.ratio : learningProgress.ratio;
  const progressText = session?.type === "test" ? testProgress.text : learningProgress.text;

  return (
    <div className="practice-layout">
      <div className="practice-main">
        <Panel eyebrow="Today's session" title="Practice setup" description="Keep the same engine, but run it inside the new shell.">
          <div className="setup-grid">
            <label className="field">
              <span>Year group</span>
              <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value as YearFilter)}>
                <option value="all">All KS2 words</option>
                <option value="3-4">Years 3-4</option>
                <option value="5-6">Years 5-6</option>
              </select>
            </label>

            <label className="field">
              <span>Round size</span>
              <select value={sessionSize} onChange={(event) => setSessionSize(Number(event.target.value))}>
                <option value={8}>8 words</option>
                <option value={12}>12 words</option>
                <option value={16}>16 words</option>
                <option value={20}>20 words</option>
              </select>
            </label>

            <label className="toggle-card">
              <span>Auto-play new cards</span>
              <input type="checkbox" checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} />
            </label>

            <label className="toggle-card">
              <span>Show cloze sentence</span>
              <input type="checkbox" checked={showCloze} onChange={(event) => setShowCloze(event.target.checked)} />
            </label>
          </div>

          <div className="hero-actions">
            <button className="primary-button" onClick={() => beginLearningRound("smart")}>
              <Icon name="play" size={15} />
              Smart Review
            </button>
            <button className="secondary-button" onClick={() => beginLearningRound("trouble")}>
              Trouble Drill
            </button>
            <button className="ghost-button" onClick={beginTestRound}>
              SATs 20 test
            </button>
          </div>

          <p className="muted-copy">{statusLine}</p>
        </Panel>

        <Panel
          eyebrow={session ? session.label : "Question card"}
          title={session ? (session.type === "test" ? "Formal dictation test" : "Guided spelling practice") : "Ready when you are"}
          description={
            session
              ? session.notes.description
              : "Start a round to hear the word in formal UK English and type the spelling from memory."
          }
          action={
            session ? (
              <button className="ghost-button small-button" onClick={handleEndSession}>
                End session
              </button>
            ) : null
          }
          className="question-panel"
        >
          {session && currentWordData && currentPromptData ? (
            <>
              <div className="progress-row">
                <span>{progressText}</span>
                <span>{currentWordData.yearLabel}</span>
              </div>
              <ProgressBar value={progressRatio} accent={currentSubject.accent} />

              <div className="question-banner">
                <Chip tone="accent" accent={currentSubject.accent} background="#ffffff">
                  {session.type === "test" ? "Single attempt" : "Listen, hold it, then spell it"}
                </Chip>
                <Chip tone="neutral">Current strength: {stageLabel(learnerState.progress[currentWordData.slug]?.stage ?? 0)}</Chip>
              </div>

              <div className="prompt-card">
                <div className="prompt-title">Spell this word</div>
                <div className="prompt-quote">
                  {showCloze ? currentPromptData.cloze : "Use the audio buttons to hear the word and the sentence."}
                </div>
                <p className="muted-copy">{session.notes.hint}</p>
              </div>

              <div className="hero-actions">
                <button className="primary-button" onClick={() => void playCurrentWord(false)}>
                  <Icon name="volume" size={15} />
                  Play word
                </button>
                <button className="secondary-button" onClick={() => void playCurrentWord(true)}>
                  Play slower
                </button>
                {session.type === "learning" ? (
                  <button className="ghost-button" onClick={handleSkip} disabled={session.phase !== "question"}>
                    Skip for now
                  </button>
                ) : null}
              </div>

              <div className="answer-row">
                <input
                  ref={inputRef}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder={
                    session.type === "test"
                      ? "Type the spelling and move on"
                      : session.phase === "retry"
                        ? "Try once more from memory"
                        : session.phase === "correction"
                          ? "Type the correct spelling once"
                          : "Type the spelling here"
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className={`answer-input ${feedback ? feedback.tone : ""}`}
                />
                <button className="primary-button submit-button" onClick={handleSubmit}>
                  {session.type === "test"
                    ? "Save and next"
                    : session.phase === "retry"
                      ? "Try again"
                      : session.phase === "correction"
                        ? "Lock it in"
                        : "Submit"}
                </button>
              </div>

              {feedback ? (
                <div className={`feedback-card ${feedback.tone}`}>
                  <strong>{feedback.title}</strong>
                  {feedback.answer ? <div className="answer-reveal">{feedback.answer}</div> : null}
                  <p>{feedback.message}</p>
                </div>
              ) : null}

              <p className="muted-copy">{session.notes.footer}</p>
            </>
          ) : (
            <div className="empty-card">
              <div className="empty-card-icon">
                <Icon name="volume" size={24} />
              </div>
              <div>
                <h3>No live round yet</h3>
                <p>Open a Smart Review, Trouble Drill or SATs test from the setup panel above.</p>
              </div>
            </div>
          )}
        </Panel>

        {summary ? (
          <Panel
            eyebrow="Round summary"
            title={summary.title}
            description={summary.text}
            action={
              <div className="hero-actions compact-actions">
                <button className="primary-button" onClick={() => beginLearningRound("smart")}>
                  New smart round
                </button>
                <button className="secondary-button" onClick={drillSummaryMistakes} disabled={!summary.mistakes.length}>
                  Drill mistakes
                </button>
              </div>
            }
          >
            <div className="stats-grid">
              {summary.cards.map((card) => (
                <StatCard key={card.label} label={card.label} value={card.value} note={card.sub} />
              ))}
            </div>

            {summary.mistakes.length ? (
              <div className="pill-grid">
                {summary.mistakes.map((slug) => {
                  const word = SPELLING_WORDS_BY_SLUG[slug];
                  if (!word) {
                    return null;
                  }

                  return (
                    <button
                      key={slug}
                      className="word-pill trouble"
                      onClick={() => beginLearningRound("single", [word])}
                    >
                      {word.word} ({word.family})
                    </button>
                  );
                })}
              </div>
            ) : null}
          </Panel>
        ) : null}

        <Panel eyebrow="Word bank" title="Pick a single spelling" description="Search the bank and jump straight into a one-word drill.">
          <label className="field full-width">
            <span>Search</span>
            <input
              type="search"
              value={wordSearch}
              onChange={(event) => setWordSearch(event.target.value)}
              placeholder="Find a spelling or family"
            />
          </label>

          <div className="word-group-stack">
            {groupedWords
              .filter((group) => (yearFilter === "all" ? true : group.key === yearFilter))
              .map((group) => {
                const secureCount = group.words.filter(
                  (word) => (learnerState.progress[word.slug]?.stage ?? 0) >= 4,
                ).length;

                return (
                  <section key={group.key} className="word-group-card">
                    <div className="panel-head compact-head">
                      <div>
                        <h3>{group.title}</h3>
                        <p>{secureCount} secure out of {group.words.length} visible spellings</p>
                      </div>
                    </div>
                    <div className="pill-grid">
                      {group.words.map((word) => (
                        <button
                          key={word.slug}
                          className={`word-pill ${statusClassForWord(learnerState.progress, word)}`}
                          onClick={() => beginLearningRound("single", [word])}
                          title={`${word.word} • ${word.family} • ${stageLabel(
                            learnerState.progress[word.slug]?.stage ?? 0,
                          )}`}
                        >
                          {word.word}
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
          </div>
        </Panel>
      </div>

      <aside className="practice-rail">
        <Panel eyebrow="Live stats" title="This filter">
          <div className="stats-grid compact-stats">
            <StatCard label="Secure" value={liveStats.secure} note="At two weeks or better" compact />
            <StatCard label="Due" value={liveStats.due} note="Ready to revisit" compact />
            <StatCard label="Trouble" value={liveStats.trouble} note="Still fragile" compact />
            <StatCard label="Bank size" value={liveStats.bankSize} note="Visible words" compact />
          </div>
        </Panel>

        <Panel eyebrow="Audio" title="Engine and voice">
          <div className="setup-grid single-column">
            <label className="field">
              <span>Audio engine</span>
              <select
                value={ttsEngine}
                onChange={(event) => {
                  setTtsEngine(event.target.value as AudioEngine);
                }}
              >
                <option value="gemini" disabled={!hasGeminiKey}>
                  Gemini TTS
                </option>
                <option value="browser">Browser UK TTS</option>
              </select>
            </label>

            {ttsEngine === "gemini" ? (
              <label className="field">
                <span>Gemini voice</span>
                <select value={geminiVoice} onChange={(event) => setGeminiVoice(event.target.value)}>
                  {GEMINI_TTS_VOICES.map(([name, descriptor]) => (
                    <option key={name} value={name}>
                      {name} ({descriptor})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="field">
                <span>Browser voice</span>
                <select value={browserVoiceUri} onChange={(event) => setBrowserVoiceUri(event.target.value)}>
                  {browserVoices.length ? (
                    browserVoices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))
                  ) : (
                    <option value="">Best available voice</option>
                  )}
                </select>
              </label>
            )}

            <label className="field">
              <span>Playback rate</span>
              <input
                type="range"
                min="0.9"
                max="1.25"
                step="0.01"
                value={rate}
                onChange={(event) => setRate(Number(event.target.value))}
              />
              <strong className="field-value">{rate.toFixed(2)}×</strong>
            </label>
          </div>
          <p className="muted-copy">{displayedAudioNote}</p>
        </Panel>

        <Panel eyebrow="How this round works" title="Engine notes">
          <ul className="bullet-list">
            <li>Smart Review prefers due words, weak words and unseen words.</li>
            <li>Browser speech remains the offline fallback for UK English playback.</li>
            <li>Gemini audio is cached locally in IndexedDB after the first successful fetch.</li>
          </ul>
        </Panel>
      </aside>
    </div>
  );
}

function AnalyticsTab({
  practiceStats,
  liveStats,
  groupedWords,
  learnerState,
}: {
  practiceStats: ReturnType<typeof computePracticeStats>;
  liveStats: ReturnType<typeof computeLiveStats>;
  groupedWords: Array<{ key: string; title: string; words: SpellingWord[] }>;
  learnerState: LearnerState;
}) {
  return (
    <div className="tab-stack">
      <Panel eyebrow="Progress" title="Current spelling coverage" description="These numbers come from the same local learner record used by the engine.">
        <div className="stats-grid">
          <StatCard label="Official sets" value={practiceStats.officialSets} note="Families represented in this filter" />
          <StatCard label="Practice spellings" value={practiceStats.practiceSpellings} note="Expanded words in scope" />
          <StatCard label="Secure" value={practiceStats.secure} note="At two weeks or better" />
          <StatCard label="Due today" value={practiceStats.dueToday} note="Needs another pass now" />
          <StatCard label="Accuracy" value={practiceStats.accuracy === null ? "—" : `${practiceStats.accuracy}%`} note={practiceStats.attempts ? `${practiceStats.attempts} logged attempts` : "No scored attempts yet"} />
          <StatCard label="Trouble" value={liveStats.trouble} note="Frequently missed or still weak" />
        </div>
      </Panel>

      <Panel eyebrow="Visible bank" title="Stage by year group">
        <div className="word-group-stack">
          {groupedWords.map((group) => (
            <section key={group.key} className="word-group-card">
              <div className="panel-head compact-head">
                <div>
                  <h3>{group.title}</h3>
                  <p>
                    {group.words.filter((word) => (learnerState.progress[word.slug]?.stage ?? 0) >= 4).length} secure •{" "}
                    {group.words.length} total
                  </p>
                </div>
              </div>
              <div className="pill-grid">
                {group.words.map((word) => (
                  <span key={word.slug} className={`word-pill static-pill ${statusClassForWord(learnerState.progress, word)}`}>
                    {word.word}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ProfilesTab({
  practiceStats,
  liveStats,
}: {
  practiceStats: ReturnType<typeof computePracticeStats>;
  liveStats: ReturnType<typeof computeLiveStats>;
}) {
  return (
    <div className="tab-stack">
      <Panel eyebrow="Local learner" title="This first pass is still single-profile" description="Progress stays in the browser for now, which keeps the engine simple while the wider platform is being built.">
        <div className="stats-grid compact-stats">
          <StatCard label="Secure words" value={practiceStats.secure} note="Already retained" compact />
          <StatCard label="Due now" value={liveStats.due} note="Needs another pass" compact />
          <StatCard label="New words left" value={practiceStats.newLeft} note="Still unseen locally" compact />
        </div>
      </Panel>

      <Panel eyebrow="What comes next" title="Future profile layer">
        <ul className="bullet-list">
          <li>Multiple learner profiles can sit above the same spelling engine.</li>
          <li>The Cloudflare-hosted version can later move progress from browser-only storage to an account-backed model.</li>
          <li>The UI foundation already leaves room for cross-subject progress and collection rewards.</li>
        </ul>
      </Panel>
    </div>
  );
}

function SettingsTab({
  yearFilter,
  setYearFilter,
  sessionSize,
  setSessionSize,
  ttsEngine,
  setTtsEngine,
  hasGeminiKey,
  geminiVoice,
  setGeminiVoice,
  browserVoices,
  browserVoiceUri,
  setBrowserVoiceUri,
  rate,
  setRate,
  autoSpeak,
  setAutoSpeak,
  showCloze,
  setShowCloze,
  displayedAudioNote,
}: {
  yearFilter: YearFilter;
  setYearFilter: (value: YearFilter) => void;
  sessionSize: number;
  setSessionSize: (value: number) => void;
  ttsEngine: AudioEngine;
  setTtsEngine: (value: AudioEngine) => void;
  hasGeminiKey: boolean;
  geminiVoice: string;
  setGeminiVoice: (value: string) => void;
  browserVoices: SpeechSynthesisVoice[];
  browserVoiceUri: string;
  setBrowserVoiceUri: (value: string) => void;
  rate: number;
  setRate: (value: number) => void;
  autoSpeak: boolean;
  setAutoSpeak: (value: boolean) => void;
  showCloze: boolean;
  setShowCloze: (value: boolean) => void;
  displayedAudioNote: string;
}) {
  return (
    <div className="tab-stack">
      <Panel eyebrow="Session defaults" title="Review behaviour">
        <div className="setup-grid">
          <label className="field">
            <span>Default year group</span>
            <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value as YearFilter)}>
              <option value="all">All KS2 words</option>
              <option value="3-4">Years 3-4</option>
              <option value="5-6">Years 5-6</option>
            </select>
          </label>

          <label className="field">
            <span>Default round size</span>
            <select value={sessionSize} onChange={(event) => setSessionSize(Number(event.target.value))}>
              <option value={8}>8 words</option>
              <option value={12}>12 words</option>
              <option value={16}>16 words</option>
              <option value={20}>20 words</option>
            </select>
          </label>

          <label className="toggle-card">
            <span>Auto-play new cards</span>
            <input type="checkbox" checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} />
          </label>

          <label className="toggle-card">
            <span>Show cloze sentence</span>
            <input type="checkbox" checked={showCloze} onChange={(event) => setShowCloze(event.target.checked)} />
          </label>
        </div>
      </Panel>

      <Panel eyebrow="Audio" title="Formal UK English">
        <div className="setup-grid">
          <label className="field">
            <span>Audio engine</span>
            <select value={ttsEngine} onChange={(event) => setTtsEngine(event.target.value as AudioEngine)}>
              <option value="gemini" disabled={!hasGeminiKey}>
                Gemini TTS
              </option>
              <option value="browser">Browser UK TTS</option>
            </select>
          </label>

          {ttsEngine === "gemini" ? (
            <label className="field">
              <span>Gemini voice</span>
              <select value={geminiVoice} onChange={(event) => setGeminiVoice(event.target.value)}>
                {GEMINI_TTS_VOICES.map(([name, descriptor]) => (
                  <option key={name} value={name}>
                    {name} ({descriptor})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span>Browser voice</span>
              <select value={browserVoiceUri} onChange={(event) => setBrowserVoiceUri(event.target.value)}>
                {browserVoices.length ? (
                  browserVoices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))
                ) : (
                  <option value="">Best available voice</option>
                )}
              </select>
            </label>
          )}

          <label className="field">
            <span>Playback rate</span>
            <input
              type="range"
              min="0.9"
              max="1.25"
              step="0.01"
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
            />
            <strong className="field-value">{rate.toFixed(2)}×</strong>
          </label>
        </div>
        <p className="muted-copy">{displayedAudioNote}</p>
      </Panel>
    </div>
  );
}

function MethodTab({ hasGeminiKey }: { hasGeminiKey: boolean }) {
  return (
    <div className="tab-stack">
      <Panel eyebrow="Current architecture" title="What is already working">
        <ul className="bullet-list">
          <li>Next.js App Router runs the spelling engine in the browser and through server routes.</li>
          <li>Gemini TTS is proxied server-side, while browser UK TTS remains the offline fallback.</li>
          <li>Audio files are cached locally in IndexedDB so repeated prompts can be reused.</li>
          <li>Session logic, spacing and marking are already isolated from the shell UI.</li>
        </ul>
      </Panel>

      <Panel eyebrow="Cloudflare path" title="How this maps to deployment">
        <ul className="bullet-list">
          <li>The app is already shaped for OpenNext + Workers deployment.</li>
          <li>Cloudflare plugin access can inspect account resources without a global Wrangler install.</li>
          <li>{hasGeminiKey ? "Gemini secret is available in the current environment." : "Gemini still needs a Cloudflare secret for production deploys."}</li>
        </ul>
      </Panel>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  action,
  className,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel ${className ?? ""}`.trim()}>
      <div className="panel-head">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="panel-action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  note,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  note: string;
  compact?: boolean;
}) {
  return (
    <article className={`stat-card ${compact ? "compact" : ""}`}>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function ProgressBar({ value, accent }: { value: number; accent: string }) {
  return (
    <div className="progress-track">
      <span className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: accent }} />
    </div>
  );
}

function Chip({
  children,
  tone,
  accent,
  background,
}: {
  children: ReactNode;
  tone: "neutral" | "good" | "warn" | "accent";
  accent?: string;
  background?: string;
}) {
  return (
    <span
      className={`chip ${tone}`}
      style={
        tone === "accent"
          ? ({
              color: accent,
              background,
            } as CSSProperties)
          : undefined
      }
    >
      {children}
    </span>
  );
}

function SubjectGlyph({
  subject,
  size,
  filled,
}: {
  subject: SubjectCard;
  size: number;
  filled: boolean;
}) {
  return (
    <div
      className={`subject-glyph ${filled ? "filled" : ""}`}
      style={{
        width: size,
        height: size,
        background: filled ? subject.accent : subject.accentTint,
        color: filled ? "#ffffff" : subject.accent,
        borderColor: subject.accentSoft,
      }}
    >
      <Icon name={subject.icon} size={Math.round(size * 0.56)} />
    </div>
  );
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "pen":
      return (
        <svg {...common}>
          <path d="M4 20 L8 19 L19 8 L16 5 L5 16 Z" />
          <path d="M14 7 L17 10" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8.5 V15.5 M8.5 12 H15.5" />
        </svg>
      );
    case "brain":
      return (
        <svg {...common}>
          <path d="M9 6.5 C7 6.5 5.5 8 5.5 10 C5 11 5 12 6 13 C5 14 5.5 16 7.5 16.5 C8 18 10 18.5 11 17.5 L11 6.5 Z" />
          <path d="M15 6.5 C17 6.5 18.5 8 18.5 10 C19 11 19 12 18 13 C19 14 18.5 16 16.5 16.5 C16 18 14 18.5 13 17.5 L13 6.5 Z" />
        </svg>
      );
    case "speech":
      return (
        <svg {...common}>
          <path d="M4.5 6.5 H19.5 V15 H13 L9 18.5 V15 H4.5 Z" />
          <path d="M8 10 H16 M8 12.5 H13" />
        </svg>
      );
    case "quote":
      return (
        <svg {...common}>
          <path d="M6 9 C6 7.5 7 6.5 8.5 6.5 M6 9 L6 12 L9 12 L9 9 Z" />
          <path d="M14 9 C14 7.5 15 6.5 16.5 6.5 M14 9 L14 12 L17 12 L17 9 Z" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M4 5.5 C6.5 5 9.5 5.5 12 7 C14.5 5.5 17.5 5 20 5.5 V18 C17.5 17.5 14.5 18 12 19 C9.5 18 6.5 17.5 4 18 Z" />
          <path d="M12 7 V19" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="M8 6 L17 12 L8 18 Z" fill="currentColor" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19 H20" />
          <path d="M7 15 V11 M11 15 V7 M15 15 V13 M19 15 V9" />
        </svg>
      );
    case "people":
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="3" />
          <path d="M3.5 19 C4 15.5 6.5 14 9 14 C11.5 14 14 15.5 14.5 19" />
          <circle cx="17" cy="8" r="2.3" />
          <path d="M14.5 13 C16 12.5 17 12.5 18.5 13 C20 13.5 21 15 21 17" />
        </svg>
      );
    case "cog":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4 V6 M12 18 V20 M4 12 H6 M18 12 H20 M6.3 6.3 L7.7 7.7 M16.3 16.3 L17.7 17.7 M6.3 17.7 L7.7 16.3 M16.3 7.7 L17.7 6.3" />
        </svg>
      );
    case "method":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.5 9.5 C9.5 8.2 10.5 7.5 12 7.5 C13.5 7.5 14.5 8.3 14.5 9.5 C14.5 11 12 11.2 12 13" />
          <circle cx="12" cy="16.2" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="M4 11 L12 4.5 L20 11 V19 H14 V14 H10 V19 H4 Z" />
        </svg>
      );
    case "back":
      return (
        <svg {...common}>
          <path d="M15 6 L9 12 L15 18" />
        </svg>
      );
    case "next":
      return (
        <svg {...common}>
          <path d="M9 6 L15 12 L9 18" />
        </svg>
      );
    case "volume":
      return (
        <svg {...common}>
          <path d="M4 10 V14 H7 L11 17 V7 L7 10 Z" />
          <path d="M14 9 C15.5 10.5 15.5 13.5 14 15" />
          <path d="M16.5 7 C19 9.5 19 14.5 16.5 17" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M5 12.5 L10 17.5 L19 7" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M6 6 L18 18 M18 6 L6 18" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="M12 4 L13.5 10.5 L20 12 L13.5 13.5 L12 20 L10.5 13.5 L4 12 L10.5 10.5 Z" />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path d="M12 3.5 C12 6 9 7 9 10.5 C9 12 10 13 11 13 C10 11 12 10 12 8 C13.5 10 15 11.5 15 14 C15 16.5 13.5 18.5 12 18.5 C9.5 18.5 7.5 16.5 7.5 14 C7.5 10 12 8 12 3.5 Z" />
        </svg>
      );
    default:
      return null;
  }
}
