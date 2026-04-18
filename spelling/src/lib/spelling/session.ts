import { DAY_MS, DEFAULT_SESSION_SIZE, SECURE_STAGE, STAGE_INTERVALS, TEST_SESSION_SIZE } from "./constants";
import type {
  LearnerState,
  LearningMode,
  LearningSession,
  LearningSubmitResult,
  LiveStats,
  PracticeSession,
  PracticeStats,
  SessionSummary,
  SessionWordStatus,
  SpellingWord,
  TestSession,
  TestSubmitResult,
  WordProgress,
  YearBand,
} from "./types";

export type YearFilter = YearBand | "all";

export function todayDay(now = Date.now()) {
  return Math.floor(now / DAY_MS);
}

export function defaultProgress(): WordProgress {
  return {
    stage: 0,
    attempts: 0,
    correct: 0,
    wrong: 0,
    dueDay: todayDay(),
    lastDay: null,
    lastResult: null,
  };
}

export function getProgress(progressMap: LearnerState["progress"], slug: string) {
  return progressMap[slug] ? { ...defaultProgress(), ...progressMap[slug] } : defaultProgress();
}

export function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildCloze(sentence: string, word: string) {
  const blanks = "_".repeat(Math.max(word.length, 5));
  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
  return sentence.replace(pattern, blanks);
}

export function stageLabel(stage: number) {
  if (stage >= SECURE_STAGE) {
    return "Secure";
  }
  if (stage <= 0) {
    return "New / due today";
  }

  const interval = STAGE_INTERVALS[Math.min(stage, STAGE_INTERVALS.length - 1)];
  return `Next review in ${interval} day${interval === 1 ? "" : "s"}`;
}

export function statusClassForWord(progressMap: LearnerState["progress"], word: SpellingWord) {
  const progress = getProgress(progressMap, word.slug);
  const total = progress.correct + progress.wrong;
  if (progress.attempts === 0) return "new";
  if (progress.wrong > 0 && (progress.wrong >= progress.correct || (progress.dueDay <= todayDay() && total > 0))) return "trouble";
  if (progress.dueDay <= todayDay()) return "due";
  if (progress.stage >= SECURE_STAGE) return "secure";
  return "learning";
}

export function filteredWords(words: SpellingWord[], yearFilter: YearFilter) {
  return words.filter((word) => (yearFilter === "all" ? true : word.year === yearFilter));
}

function shuffle<T>(items: T[]) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function shuffledSentenceOrder(length: number, lastIndex: number | null = null) {
  const order = Array.from({ length }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }

  if (lastIndex !== null && order.length > 1 && order[0] === lastIndex) {
    const swapIndex = 1 + Math.floor(Math.random() * (order.length - 1));
    [order[0], order[swapIndex]] = [order[swapIndex], order[0]];
  }

  return order;
}

function getOrCreateSentenceHistory(session: PracticeSession, word: SpellingWord) {
  const sentences = word.sentences.length ? word.sentences : [word.sentence].filter(Boolean);
  let history = session.sentenceHistory[word.slug];

  if (!history || !Array.isArray(history.remaining) || !history.remaining.length) {
    const lastIndex = history && Number.isInteger(history.lastIndex) ? history.lastIndex : null;
    history = {
      remaining: shuffledSentenceOrder(sentences.length, lastIndex),
      lastIndex,
    };
    session.sentenceHistory[word.slug] = history;
  }

  return history;
}

function choosePromptSentence(session: PracticeSession, word: SpellingWord) {
  const sentences = word.sentences.length ? word.sentences : [word.sentence].filter(Boolean);
  if (!sentences.length) {
    return "";
  }

  if (sentences.length === 1) {
    session.sentenceHistory[word.slug] = { remaining: [0], lastIndex: 0 };
    return sentences[0];
  }

  const history = getOrCreateSentenceHistory(session, word);
  const nextIndex = history.remaining.shift() ?? 0;
  history.lastIndex = nextIndex;
  session.sentenceHistory[word.slug] = history;
  return sentences[nextIndex] ?? sentences[0];
}

function setCurrentPrompt(session: PracticeSession, slug: string, wordsBySlug: Record<string, SpellingWord>) {
  const word = wordsBySlug[slug];
  if (!word) {
    return;
  }

  const sentence = choosePromptSentence(session, word);
  session.currentSlug = slug;
  session.currentPrompt = {
    slug,
    sentence,
    cloze: buildCloze(sentence, word.word),
  };
}

export function currentWord(session: PracticeSession | null, wordsBySlug: Record<string, SpellingWord>) {
  if (!session?.currentSlug) {
    return null;
  }

  return wordsBySlug[session.currentSlug] ?? null;
}

export function currentPrompt(session: PracticeSession | null) {
  return session?.currentPrompt ?? null;
}

function weightedPick<T>(items: T[], weightFn: (item: T) => number) {
  if (!items.length) {
    return null;
  }

  const weights = items.map((item) => Math.max(0, Number(weightFn(item)) || 0));
  const total = weights.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return items[Math.floor(Math.random() * items.length)] ?? null;
  }

  let roll = Math.random() * total;
  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) {
      return items[index] ?? null;
    }
  }

  return items[items.length - 1] ?? null;
}

function scoreForSmart(word: SpellingWord, progressMap: LearnerState["progress"]) {
  const progress = getProgress(progressMap, word.slug);
  const today = todayDay();
  const total = progress.correct + progress.wrong;
  let score = 0;

  if (progress.attempts === 0) score += 65;
  if (progress.attempts > 0 && progress.dueDay <= today) score += 140 + (today - progress.dueDay) * 4;
  if (progress.wrong > 0) score += progress.wrong * 18;
  if (total > 0) score += (progress.wrong / total) * 22;
  score += Math.max(0, 3 - progress.stage) * 6;
  score += Math.random();

  return score;
}

function scoreForTrouble(word: SpellingWord, progressMap: LearnerState["progress"]) {
  const progress = getProgress(progressMap, word.slug);
  const total = progress.correct + progress.wrong;
  let score = 10;

  if (progress.wrong > 0) score += progress.wrong * 24;
  if (progress.attempts > 0 && progress.dueDay <= todayDay()) score += 40 + (todayDay() - progress.dueDay) * 3;
  if (progress.stage < SECURE_STAGE) score += (SECURE_STAGE - progress.stage) * 10;
  if (total > 0) score += (progress.wrong / total) * 28;
  score += Math.random();

  return score;
}

function smartBucket(word: SpellingWord, progressMap: LearnerState["progress"]) {
  const progress = getProgress(progressMap, word.slug);
  const today = todayDay();

  if (progress.wrong > 0 && progress.dueDay <= today) return "urgent";
  if (progress.wrong > 0) return "fragile";
  if (progress.attempts > 0 && progress.dueDay <= today) return "due";
  if (progress.attempts === 0) return "new";
  if (progress.stage < SECURE_STAGE) return "growing";
  return "secure";
}

function selectionWeight(word: SpellingWord, selected: SpellingWord[], baseScore: number) {
  let weight = Math.max(0.4, baseScore);
  const last = selected[selected.length - 1];
  const secondLast = selected[selected.length - 2];
  const familyCount = selected.filter((item) => item.family === word.family).length;
  const yearCount = selected.filter((item) => item.year === word.year).length;

  if (last && last.family === word.family) weight *= 0.16;
  if (last && secondLast && last.year === word.year && secondLast.year === word.year) weight *= 0.72;
  if (familyCount > 0) weight *= Math.max(0.28, 1 / (familyCount + 1));
  if (selected.length >= 4 && yearCount / selected.length > 0.75) weight *= 0.78;

  return weight;
}

function chooseCount(size: number | "all", availableLength: number) {
  return size === "all" ? availableLength : Math.min(size, availableLength);
}

export function chooseSmartWords(
  words: SpellingWord[],
  progressMap: LearnerState["progress"],
  yearFilter: YearFilter,
  size: number | "all" = DEFAULT_SESSION_SIZE,
) {
  const available = filteredWords(words, yearFilter).slice();
  const target = chooseCount(size, available.length);
  const bucketWeights = { urgent: 7, fragile: 5, due: 4, new: 3, growing: 2, secure: 0.7 };
  const selected: SpellingWord[] = [];

  while (selected.length < target && available.length) {
    const bucketChoices = Object.entries(bucketWeights)
      .map(([name, baseWeight]) => {
        const bucketWords = available.filter((word) => smartBucket(word, progressMap) === name);
        if (!bucketWords.length) {
          return null;
        }

        const recentBuckets = selected.slice(-3).map((item) => smartBucket(item, progressMap));
        const repeatPenalty = recentBuckets.filter((bucket) => bucket === name).length >= 2 ? 0.5 : 1;

        return { name, words: bucketWords, weight: baseWeight * repeatPenalty };
      })
      .filter(Boolean) as Array<{ name: string; words: SpellingWord[]; weight: number }>;

    const chosenBucket = weightedPick(bucketChoices, (bucket) => bucket.weight);
    if (!chosenBucket) {
      break;
    }

    const chosenWord = weightedPick(
      chosenBucket.words,
      (word) => selectionWeight(word, selected, scoreForSmart(word, progressMap)),
    );
    if (!chosenWord) {
      break;
    }

    selected.push(chosenWord);
    const chosenIndex = available.findIndex((word) => word.slug === chosenWord.slug);
    if (chosenIndex >= 0) {
      available.splice(chosenIndex, 1);
    }
  }

  return selected;
}

export function chooseTroubleWords(
  words: SpellingWord[],
  progressMap: LearnerState["progress"],
  yearFilter: YearFilter,
  size: number | "all" = DEFAULT_SESSION_SIZE,
) {
  const candidates = filteredWords(words, yearFilter).filter((word) => {
    const progress = getProgress(progressMap, word.slug);
    return progress.wrong > 0 || (progress.attempts > 0 && progress.dueDay <= todayDay() && progress.stage < SECURE_STAGE);
  });

  if (!candidates.length) {
    return {
      words: chooseSmartWords(words, progressMap, yearFilter, size),
      fallback: true,
    };
  }

  const target = chooseCount(size, candidates.length);
  const available = candidates.slice();
  const selected: SpellingWord[] = [];

  while (selected.length < target && available.length) {
    const chosenWord = weightedPick(
      available,
      (word) => selectionWeight(word, selected, scoreForTrouble(word, progressMap)),
    );
    if (!chosenWord) {
      break;
    }

    selected.push(chosenWord);
    const chosenIndex = available.findIndex((word) => word.slug === chosenWord.slug);
    if (chosenIndex >= 0) {
      available.splice(chosenIndex, 1);
    }
  }

  return {
    words: selected,
    fallback: false,
  };
}

export function chooseTestWords(
  words: SpellingWord[],
  yearFilter: YearFilter,
) {
  return shuffle(filteredWords(words, yearFilter)).slice(0, Math.min(TEST_SESSION_SIZE, filteredWords(words, yearFilter).length));
}

export function createLearningSession(
  selectedWords: SpellingWord[],
  progressMap: LearnerState["progress"],
  mode: LearningMode,
  usedSmartFallback = false,
): LearningSession {
  const status: Record<string, SessionWordStatus> = {};

  for (const word of selectedWords) {
    const progress = getProgress(progressMap, word.slug);
    status[word.slug] = {
      attempts: 0,
      successes: 0,
      needed: progress.attempts === 0 ? 2 : 1,
      hadWrong: false,
      wrongAnswers: [],
      done: false,
      applied: false,
    };
  }

  const actualMode = usedSmartFallback ? "smart" : mode;

  return {
    type: "learning",
    mode: actualMode,
    label: actualMode === "trouble" ? "Trouble drill" : actualMode === "single" ? "Single-word drill" : "Smart review",
    uniqueWords: selectedWords.map((word) => word.slug),
    queue: selectedWords.map((word) => word.slug),
    status,
    currentSlug: null,
    currentPrompt: null,
    sentenceHistory: {},
    phase: "question",
    promptCount: 0,
    lastFamily: null,
    lastYear: null,
    notes: {
      description: usedSmartFallback
        ? "No saved trouble words yet, so this round is using a smart review mix instead."
        : actualMode === "trouble"
          ? "This round keeps pressure on weak spellings, but mixes them so the order is less predictable."
          : actualMode === "single"
            ? "This round drills one word until it can be recalled cleanly again."
            : "This round uses weighted random interleaving to mix due words, weak words and unseen words for faster revision.",
      hint: "Hear the word and sentence, then type the spelling from memory. The live card hides the word family on purpose.",
      footer:
        "New words need two clean recalls in one round. A missed word gets one blind retry; if it is still wrong, the answer appears, then the word returns once later for a clean check.",
    },
  };
}

export function createTestSession(selectedWords: SpellingWord[]): TestSession {
  return {
    type: "test",
    mode: "test",
    label: "SATs 20 test",
    uniqueWords: selectedWords.map((word) => word.slug),
    queue: selectedWords.map((word) => word.slug),
    currentSlug: null,
    currentPrompt: null,
    sentenceHistory: {},
    results: [],
    notes: {
      description: "This round uses one attempt per word and reveals the score at the end.",
      hint: "There is no instant marking in this mode. Spell each word once and move on.",
      footer: "The audio follows the KS2 pattern: the word, then the sentence, then the word again. Wrong answers are marked due again for this learner after the test.",
    },
  };
}

function enqueueLater(session: LearningSession, slug: string, wordsBySlug: Record<string, SpellingWord>, gap = 2) {
  session.queue = session.queue.filter((item) => item !== slug);
  const word = wordsBySlug[slug];
  if (!word) {
    return;
  }

  const minPosition = Math.min(gap, session.queue.length);
  const maxPosition = Math.min(session.queue.length, minPosition + 3);
  let position = minPosition + Math.floor(Math.random() * (Math.max(0, maxPosition - minPosition) + 1));

  while (
    position < session.queue.length &&
    wordsBySlug[session.queue[position]] &&
    wordsBySlug[session.queue[position]].family === word.family
  ) {
    position += 1;
  }

  session.queue.splice(Math.min(position, session.queue.length), 0, slug);
}

function candidateWeightForQueueSlug(
  session: LearningSession,
  slug: string,
  index: number,
  wordsBySlug: Record<string, SpellingWord>,
  progressMap: LearnerState["progress"],
) {
  const word = wordsBySlug[slug];
  const progress = getProgress(progressMap, slug);
  const info = session.status[slug];
  let weight = Math.max(1, 10 - index);

  if (!word) {
    return weight;
  }

  if (progress.dueDay <= todayDay()) weight += 14;
  if (progress.wrong > 0) weight += 8;
  if (progress.attempts === 0) weight += 4;
  if (info?.hadWrong) weight += 12;
  if (session.lastFamily && session.lastFamily === word.family) weight *= 0.18;
  if (session.lastYear && session.lastYear === word.year) weight *= 0.76;

  return Math.max(0.2, weight);
}

function chooseNextQueueSlug(
  session: LearningSession,
  wordsBySlug: Record<string, SpellingWord>,
  progressMap: LearnerState["progress"],
) {
  if (!session.queue.length) {
    return null;
  }

  const windowSize = Math.min(8, session.queue.length);
  const candidates = session.queue.slice(0, windowSize).map((slug, index) => ({
    slug,
    index,
    weight: candidateWeightForQueueSlug(session, slug, index, wordsBySlug, progressMap),
  }));

  const picked = weightedPick(candidates, (candidate) => candidate.weight);
  if (!picked) {
    return session.queue.shift() ?? null;
  }

  session.queue.splice(picked.index, 1);
  return picked.slug;
}

function completedCount(session: LearningSession) {
  return Object.values(session.status).filter((info) => info.done).length;
}

function buildLearningSummary(session: LearningSession, wordsBySlug: Record<string, SpellingWord>): SessionSummary {
  const statuses = Object.entries(session.status);
  const total = statuses.length;
  const firstTime = statuses.filter(([, info]) => !info.hadWrong).length;
  const mistakes = statuses
    .filter(([, info]) => info.hadWrong)
    .map(([slug]) => slug)
    .filter((slug) => Boolean(wordsBySlug[slug]));

  return {
    title: session.label,
    cards: [
      { label: "Words in round", value: total, sub: "Unique words selected" },
      { label: "Correct without a miss", value: firstTime, sub: "Strong on the first go" },
      { label: "Needed correction", value: mistakes.length, sub: "These words came back again" },
      { label: "Prompts heard", value: session.promptCount, sub: "Includes repeats of weak words" },
    ],
    text: mistakes.length
      ? "Good. The weak words were caught quickly and are now marked due again for this learner."
      : "Excellent. Every selected word was correct without needing a correction step.",
    mistakes,
  };
}

function buildTestSummary(session: TestSession, wordsBySlug: Record<string, SpellingWord>): SessionSummary {
  const total = session.results.length;
  const correct = session.results.filter((result) => result.correct).length;
  const mistakes = session.results
    .filter((result) => !result.correct)
    .map((result) => result.slug)
    .filter((slug) => Boolean(wordsBySlug[slug]));

  return {
    title: session.label,
    cards: [
      { label: "Score", value: `${correct}/${total}`, sub: "Correct spellings" },
      { label: "Accuracy", value: `${total ? Math.round((correct / total) * 100) : 0}%`, sub: "Single attempt per word" },
      { label: "Correct", value: correct, sub: "Strong on the day" },
      { label: "Needs more work", value: mistakes.length, sub: "Marked due again today" },
    ],
    text: mistakes.length
      ? "The missed words have been pushed back into the learner's due queue, ready for another review today."
      : "Excellent. This learner scored full marks on this SATs-style round.",
    mistakes,
  };
}

function applyLearningOutcome(progressMap: LearnerState["progress"], slug: string, info: SessionWordStatus) {
  if (info.applied) {
    return;
  }

  const progress = getProgress(progressMap, slug);
  progress.attempts += 1;
  progress.lastDay = todayDay();

  if (info.hadWrong) {
    progress.wrong += 1;
    progress.stage = Math.max(0, progress.stage - 1);
    progress.dueDay = todayDay();
    progress.lastResult = "wrong";
  } else {
    progress.correct += 1;
    progress.stage = Math.min(progress.stage + 1, STAGE_INTERVALS.length - 1);
    progress.dueDay = todayDay() + STAGE_INTERVALS[progress.stage];
    progress.lastResult = "correct";
  }

  progressMap[slug] = progress;
  info.applied = true;
}

function applyTestOutcome(progressMap: LearnerState["progress"], slug: string, correct: boolean) {
  const progress = getProgress(progressMap, slug);
  progress.attempts += 1;
  progress.lastDay = todayDay();

  if (correct) {
    progress.correct += 1;
    progress.stage = Math.min(progress.stage + 1, STAGE_INTERVALS.length - 1);
    progress.dueDay = todayDay() + STAGE_INTERVALS[progress.stage];
    progress.lastResult = "correct";
  } else {
    progress.wrong += 1;
    progress.stage = Math.max(0, progress.stage - 1);
    progress.dueDay = todayDay();
    progress.lastResult = "wrong";
  }

  progressMap[slug] = progress;
}

export function advanceSession(
  session: PracticeSession,
  wordsBySlug: Record<string, SpellingWord>,
  progressMap: LearnerState["progress"],
) {
  if (session.type === "test") {
    const nextSlug = session.queue.shift();
    if (!nextSlug) {
      return buildTestSummary(session, wordsBySlug);
    }
    setCurrentPrompt(session, nextSlug, wordsBySlug);
    return null;
  }

  session.phase = "question";

  while (session.queue.length) {
    const slug = chooseNextQueueSlug(session, wordsBySlug, progressMap);
    if (!slug) {
      break;
    }

    if (!session.status[slug]?.done) {
      setCurrentPrompt(session, slug, wordsBySlug);
      session.lastFamily = wordsBySlug[slug]?.family ?? null;
      session.lastYear = wordsBySlug[slug]?.year ?? null;
      return null;
    }
  }

  if (completedCount(session) >= session.uniqueWords.length) {
    return buildLearningSummary(session, wordsBySlug);
  }

  return buildLearningSummary(session, wordsBySlug);
}

export function skipCurrentLearningWord(session: LearningSession, wordsBySlug: Record<string, SpellingWord>) {
  if (!session.currentSlug) {
    return;
  }

  enqueueLater(session, session.currentSlug, wordsBySlug, 5);
  session.phase = "question";
}

export function submitLearningAnswer(
  session: LearningSession,
  typedAnswer: string,
  wordsBySlug: Record<string, SpellingWord>,
  progressMap: LearnerState["progress"],
): LearningSubmitResult {
  const word = currentWord(session, wordsBySlug);
  if (!word) {
    return {
      kind: "done",
      tone: "info",
      title: "Round complete",
      message: "There are no more words in this round.",
      summary: buildLearningSummary(session, wordsBySlug),
    };
  }

  const info = session.status[word.slug];
  const typed = typedAnswer.trim();
  const correct = word.accepted.includes(normalizeAnswer(typed));

  if (!typed) {
    return {
      kind: "retry",
      tone: "error",
      title: "Type the spelling",
      message: "Enter an answer before you submit this word.",
    };
  }

  if (session.phase === "correction") {
    if (correct) {
      session.phase = "question";
      enqueueLater(session, word.slug, wordsBySlug, 2);
      return {
        kind: "locked-in",
        tone: "info",
        title: "Locked in",
        message: "Good. This word will come back once later for a clean blind check.",
        answer: word.word,
      };
    }

    return {
      kind: "correction",
      tone: "error",
      title: "Try again",
      message: "Type the correct spelling exactly once before moving on.",
      answer: word.word,
    };
  }

  session.promptCount += 1;
  info.attempts += 1;

  if (session.phase === "retry") {
    if (correct) {
      session.phase = "question";
      enqueueLater(session, word.slug, wordsBySlug, 3);
      return {
        kind: "correct",
        tone: "info",
        title: "Good recovery",
        message: "You pulled it back from memory. This word will return later for one clean check.",
        answer: word.word,
      };
    }

    info.wrongAnswers.push(typed);
    session.phase = "correction";
    return {
      kind: "correction",
      tone: "error",
      title: "Still not quite",
      message: "The correct spelling is shown below. Type it once correctly, then it will come back later in this round.",
      answer: word.word,
    };
  }

  if (correct) {
    info.successes += 1;

    if (info.successes >= info.needed) {
      info.done = true;
      applyLearningOutcome(progressMap, word.slug, info);
      return {
        kind: "correct",
        tone: info.hadWrong ? "info" : "success",
        title: info.hadWrong ? "Correct now" : "Correct",
        message: info.hadWrong
          ? "This word is fixed for this round and will stay due for future review."
          : "This word is secure for today.",
        answer: word.word,
      };
    }

    enqueueLater(session, word.slug, wordsBySlug, 3);
    return {
      kind: "correct",
      tone: "info",
      title: "Good first hit",
      message: "This word is new for this learner, so it will come back once more in this round.",
      answer: word.word,
    };
  }

  info.hadWrong = true;
  info.successes = 0;
  info.needed = 1;
  info.wrongAnswers.push(typed);
  session.phase = "retry";

  return {
    kind: "retry",
    tone: "error",
    title: "Not quite",
    message: "No answer is shown yet. Hear it again and try once more from memory.",
  };
}

export function submitTestAnswer(
  session: TestSession,
  typedAnswer: string,
  wordsBySlug: Record<string, SpellingWord>,
  progressMap: LearnerState["progress"],
): TestSubmitResult {
  const word = currentWord(session, wordsBySlug);
  if (!word) {
    return {
      kind: "done",
      tone: "success",
      title: "Test complete",
      message: "There are no more words in this test.",
      summary: buildTestSummary(session, wordsBySlug),
    };
  }

  const typed = typedAnswer.trim();
  const correct = word.accepted.includes(normalizeAnswer(typed));

  session.results.push({
    slug: word.slug,
    answer: typed,
    correct,
  });

  applyTestOutcome(progressMap, word.slug, correct);

  return {
    kind: "saved",
    tone: "info",
    title: "Saved",
    message: "Moving to the next word.",
  };
}

export function computePracticeStats(
  words: SpellingWord[],
  progressMap: LearnerState["progress"],
  yearFilter: YearFilter,
): PracticeStats {
  const visibleWords = filteredWords(words, yearFilter);
  const familyCount = new Set(visibleWords.map((word) => `${word.year}||${word.family}`)).size;
  let secure = 0;
  let due = 0;
  let fresh = 0;
  let attempts = 0;
  let correct = 0;

  for (const word of visibleWords) {
    const progress = getProgress(progressMap, word.slug);
    attempts += progress.attempts;
    correct += progress.correct;
    if (progress.attempts === 0) fresh += 1;
    if (progress.stage >= SECURE_STAGE) secure += 1;
    if (progress.attempts > 0 && progress.dueDay <= todayDay()) due += 1;
  }

  const accuracy = attempts ? Math.round((correct / attempts) * 100) : null;

  return {
    officialSets: familyCount,
    practiceSpellings: visibleWords.length,
    secure,
    dueToday: due,
    newLeft: fresh,
    accuracy,
    attempts,
  };
}

export function computeLiveStats(
  words: SpellingWord[],
  progressMap: LearnerState["progress"],
  yearFilter: YearFilter,
): LiveStats {
  const visibleWords = filteredWords(words, yearFilter);
  let secure = 0;
  let due = 0;
  let trouble = 0;

  for (const word of visibleWords) {
    const progress = getProgress(progressMap, word.slug);
    if (progress.stage >= SECURE_STAGE) secure += 1;
    if (progress.attempts > 0 && progress.dueDay <= todayDay()) due += 1;
    if (progress.wrong > 0 && (progress.wrong >= progress.correct || progress.stage < SECURE_STAGE)) trouble += 1;
  }

  return {
    secure,
    due,
    trouble,
    bankSize: visibleWords.length,
  };
}
