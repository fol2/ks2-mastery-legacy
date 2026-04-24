function isTypingElement(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tagName = String(target.tagName || '').toUpperCase();
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

function isAnswerInput(target) {
  return String(target?.name || '') === 'typed';
}

export function resolveSpellingShortcut(event, appState) {
  const subjectId = appState?.route?.subjectId || null;
  const tab = appState?.route?.tab || 'practice';
  if (subjectId !== 'spelling' || tab !== 'practice') return null;

  const spellingUi = appState?.subjectUi?.spelling || null;
  const target = event?.target || null;
  const typing = isTypingElement(target);
  const answerInput = isAnswerInput(target);

  if (event?.key === 'Escape' && !event.altKey && !event.ctrlKey && !event.metaKey) {
    if (spellingUi?.phase !== 'session') return null;
    if (typing && !answerInput) return null;
    return {
      action: event.shiftKey ? 'spelling-replay-slow' : 'spelling-replay',
      preventDefault: true,
    };
  }

  if (!(event?.altKey && !event.ctrlKey && !event.metaKey)) return null;
  if (typing && !answerInput) return null;

  const key = String(event.key || '').toLowerCase();
  if (key === '1') {
    return { action: 'spelling-shortcut-start', data: { mode: 'smart' }, preventDefault: true };
  }
  if (key === '2') {
    return { action: 'spelling-shortcut-start', data: { mode: 'trouble' }, preventDefault: true };
  }
  if (key === '3') {
    return { action: 'spelling-shortcut-start', data: { mode: 'test' }, preventDefault: true };
  }
  if (key === 's') {
    if (spellingUi?.phase === 'session' && spellingUi.session?.type !== 'test' && spellingUi.session?.phase === 'question' && !spellingUi.awaitingAdvance) {
      return { action: 'spelling-skip', preventDefault: true };
    }
    return null;
  }
  if (key === 'k') {
    return { focusSelector: 'input[name="typed"]', preventDefault: true };
  }

  return null;
}
