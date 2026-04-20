function isLearningSession(session) {
  return Boolean(session) && session.type !== 'test';
}

export function spellingSessionSubmitLabel(session, awaitingAdvance = false) {
  if (!session) return 'Submit';
  if (awaitingAdvance) return 'Saved';
  if (session.type === 'test') return 'Save and next';
  if (session.phase === 'retry') return 'Try again';
  if (session.phase === 'correction') return 'Lock it in';
  return 'Submit';
}

export function spellingSessionInputPlaceholder(session) {
  if (!session) return 'Type the spelling here';
  if (session.type === 'test') return 'Type the spelling and move on';
  if (session.phase === 'retry') return 'Try once more from memory';
  if (session.phase === 'correction') return 'Type the correct spelling once';
  return 'Type the spelling here';
}

export function spellingSessionContextNote(session) {
  if (!session) return 'Family hidden during live recall.';
  if (session.type === 'test') return 'SATs mode uses audio only. Press Replay to hear the dictation again.';
  return 'Family hidden during live recall.';
}

export function spellingSessionFooterNote(session) {
  if (!session) return '';
  if (session.type === 'test') {
    return 'The audio follows the KS2 pattern: the word, then the sentence, then the word again. Wrong answers are marked due again for this learner after the test. Esc replays, and Shift+Esc replays slowly.';
  }
  return 'New words need two clean recalls in one round. A missed word gets one blind retry; if it is still wrong, the answer appears, then the word returns once later for a clean check. Esc replays, Shift+Esc replays slowly, Alt+S skips, and Alt+K focuses the answer box.';
}

export function spellingSessionProgressLabel(session) {
  if (!session) return '';
  if (session.type === 'test') return 'SATs one-shot';
  return `Phase: ${session.phase}`;
}

export function spellingSessionInfoChips(session) {
  if (!session) return [];
  const chips = [];
  if (session.currentCard?.word?.yearLabel) chips.push(session.currentCard.word.yearLabel);
  if (isLearningSession(session)) chips.push('Family hidden during live recall');
  return chips;
}
