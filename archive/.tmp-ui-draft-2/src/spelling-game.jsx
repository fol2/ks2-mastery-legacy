// SpellingGame — the real, working Practice experience for Spelling.
// Plug into PracticeScreen via QuestionBody switch.

function SpellingGame({ subject, profile, onMonsterEvent }) {
  const E = window.SpellingEngine;
  const pid = profile?.id || 'default';
  const [session, setSession] = React.useState(() => E.createSession({ length: 10 }));
  const [typed, setTyped] = React.useState('');
  const [state, setState] = React.useState('answering'); // answering | marked | done
  const [lastMark, setLastMark] = React.useState(null);  // { correct, typed }
  const [showWord, setShowWord] = React.useState(false);
  const [masteredThisSession, setMasteredThisSession] = React.useState([]);
  const inputRef = React.useRef(null);

  const cur = session.items[session.index];
  const isDone = state === 'done';

  // Auto-speak when a new word appears
  React.useEffect(() => {
    if (!cur || state !== 'answering') return;
    const id = setTimeout(() => E.speak(cur.word), 250);
    return () => clearTimeout(id);
  }, [session.index, state]);

  // Focus input on new question
  React.useEffect(() => {
    if (state === 'answering') inputRef.current?.focus();
  }, [session.index, state]);

  const submit = () => {
    if (state !== 'answering' || !typed.trim()) return;
    const m = E.grade(cur, typed);
    setLastMark(m);
    setState('marked');
    const results = [...session.results, { word: cur.word, ...m, skipped: false }];
    setSession(s => ({ ...s, results }));

    // Update spaced-repetition mastery. If newly secure, feed the monster.
    const prog = E.recordAnswer(pid, cur.word, m.correct);
    if (prog.justMastered) {
      const monsterId = E.monsterForWord(cur.word);
      const ev = window.MonsterEngine.recordMastery(pid, monsterId, cur.word);
      setMasteredThisSession(arr => [...arr, { word: cur.word, monsterId }]);
      if (ev && onMonsterEvent) onMonsterEvent(ev);
    }
  };

  const skip = () => {
    if (state !== 'answering') return;
    setLastMark({ correct: false, typed: '' });
    setState('marked');
    const results = [...session.results, { word: cur.word, typed: '', correct: false, skipped: true }];
    setSession(s => ({ ...s, results }));
  };

  const next = () => {
    const nextIdx = session.index + 1;
    if (nextIdx >= session.items.length) {
      setState('done');
    } else {
      setSession(s => ({ ...s, index: nextIdx }));
      setTyped('');
      setLastMark(null);
      setShowWord(false);
      setState('answering');
    }
  };

  const restart = () => {
    setSession(E.createSession({ length: 10 }));
    setTyped(''); setLastMark(null); setShowWord(false); setState('answering');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (state === 'answering') submit();
      else if (state === 'marked') next();
    }
  };

  // End-of-session summary
  if (isDone) {
    const correct = session.results.filter(r => r.correct).length;
    const total = session.results.length;
    const pct = Math.round((correct / total) * 100);
    const masteredCount = masteredThisSession.length;
    return (
      <div>
        <div style={{
          textAlign: 'center', padding: '20px 0 28px',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 92, height: 92, borderRadius: '50%',
            background: subject.accentTint, color: subject.accent,
            marginBottom: 16,
          }}>
            <Icon name={pct >= 80 ? 'spark' : pct >= 50 ? 'check' : 'target'} size={46} />
          </div>
          <h2 style={{
            margin: 0, fontFamily: TOKENS.fontSerif, fontSize: 32, fontWeight: 800,
            color: TOKENS.ink, letterSpacing: '-0.02em',
          }}>
            {correct} of {total} correct
          </h2>
          <p style={{ margin: '6px 0 0', color: TOKENS.muted, fontSize: 15 }}>
            {pct >= 80 ? "Brilliant session — ready for a stretch?" :
             pct >= 50 ? "Solid work. Review the tricky ones and try again." :
             "Good effort. Let's do these again with the hints on."}
          </p>
          {masteredCount > 0 && (
            <div style={{
              marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', background: '#FFF6DA', border: '1.5px solid #F0D897',
              borderRadius: 999, fontSize: 13, fontWeight: 700, color: '#7A5A0F',
            }}>
              <Icon name="spark" size={14} /> {masteredCount} new word{masteredCount > 1 ? 's' : ''} mastered ·
              your monster grew
            </div>
          )}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10, marginBottom: 22,
        }}>
          {session.results.map((r, i) => (
            <div key={i} style={{
              padding: '10px 12px', borderRadius: 12,
              border: `1px solid ${r.correct ? '#B9E3CC' : '#F3C4C1'}`,
              background: r.correct ? TOKENS.goodSoft : TOKENS.badSoft,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Icon name={r.correct ? 'check' : 'close'} size={16}
                color={r.correct ? TOKENS.good : TOKENS.bad} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: TOKENS.fontSerif, fontSize: 16, fontWeight: 700,
                  color: TOKENS.ink,
                }}>{r.word}</div>
                {!r.correct && r.typed && (
                  <div style={{ fontSize: 12, color: TOKENS.bad, fontFamily: TOKENS.fontMono }}>
                    you wrote: {r.typed}
                  </div>
                )}
                {r.skipped && <div style={{ fontSize: 12, color: TOKENS.muted }}>skipped</div>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Btn variant="secondary" icon="back" onClick={restart}>Try again</Btn>
          <Btn variant="primary" accent={subject.accent} icon="spark" onClick={restart}>New session</Btn>
        </div>
      </div>
    );
  }

  // Answer / marked view
  const marked = state === 'marked';
  const correct = marked && lastMark?.correct;
  const wrong = marked && !lastMark?.correct;

  return (
    <div>
      {/* Progress strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        fontSize: 13, color: TOKENS.muted, fontWeight: 600,
      }}>
        <span>Word {session.index + 1} of {session.items.length}</span>
        <div style={{ flex: 1 }}>
          <ProgressBar value={session.index} max={session.items.length} accent={subject.accent} height={6} />
        </div>
      </div>

      {/* Audio card */}
      <div style={{
        display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14,
        padding: '14px 16px', background: subject.accentTint,
        border: `1px solid ${subject.accentSoft}`, borderRadius: 14,
      }}>
        <button
          onClick={() => E.speak(cur.word)}
          title="Hear the word"
          style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: subject.accent, color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}><Icon name="volume" size={22} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: subject.accent, marginBottom: 2,
          }}>Spell this word</div>
          <div style={{
            fontFamily: TOKENS.fontSerif, fontSize: 18, color: TOKENS.ink, lineHeight: 1.45,
          }}>
            "{cur.masked}"
          </div>
        </div>
        <button
          onClick={() => E.speak(cur.sentence, 0.9)}
          title="Hear in a sentence"
          style={{
            padding: '8px 12px', borderRadius: 999,
            background: 'transparent', color: subject.accent,
            border: `1.5px solid ${subject.accent}`, cursor: 'pointer',
            fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
          <Icon name="volume" size={14} /> In context
        </button>
      </div>

      {/* Input */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={marked ? (lastMark.typed || '(skipped)') : typed}
          onChange={e => setTyped(e.target.value)}
          onKeyDown={handleKey}
          readOnly={marked}
          placeholder="Type the word…"
          autoComplete="off"
          spellCheck="false"
          style={{
            width: '100%', padding: '18px 20px',
            fontFamily: TOKENS.fontSerif, fontSize: 28, fontWeight: 500,
            border: `2px solid ${correct ? TOKENS.good : wrong ? TOKENS.bad : TOKENS.line}`,
            borderRadius: 16,
            background: correct ? TOKENS.goodSoft : wrong ? TOKENS.badSoft : TOKENS.panel,
            color: TOKENS.ink,
            letterSpacing: '0.02em',
            transition: 'all 0.2s',
          }}
        />
        {marked && (
          <div style={{
            position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
            width: 36, height: 36, borderRadius: '50%',
            background: correct ? TOKENS.good : TOKENS.bad, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={correct ? 'check' : 'close'} size={18} />
          </div>
        )}
      </div>

      {/* Feedback */}
      {marked && (
        <div style={{
          marginTop: 14, padding: '14px 16px',
          background: correct ? TOKENS.goodSoft : TOKENS.badSoft,
          border: `1px solid ${correct ? '#B9E3CC' : '#F3C4C1'}`,
          borderRadius: 14, display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <div style={{ flex: 1, fontSize: 14, color: TOKENS.ink2 }}>
            {correct ? (
              <>
                <strong style={{ color: TOKENS.good }}>Correct!</strong> The word is{' '}
                <strong style={{ fontFamily: TOKENS.fontSerif, fontSize: 17 }}>{cur.word}</strong>.
              </>
            ) : (
              <>
                <strong style={{ color: TOKENS.bad }}>Not quite.</strong> The word is{' '}
                <strong style={{ fontFamily: TOKENS.fontSerif, fontSize: 17 }}>{cur.word}</strong>.
                {' '}You wrote "{lastMark.typed || 'nothing'}".
              </>
            )}
          </div>
          <button onClick={() => E.speak(cur.word)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: TOKENS.ink2, display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 700,
          }}>
            <Icon name="volume" size={14} /> Hear again
          </button>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
        {!marked ? (
          <>
            <Btn variant="ghost" icon="hint" onClick={() => setShowWord(s => !s)}>
              {showWord ? `Hide: ${cur.word}` : 'Show the word'}
            </Btn>
            <Btn variant="secondary" onClick={skip}>Skip</Btn>
            <Btn variant="primary" accent={subject.accent} iconRight="check" onClick={submit} disabled={!typed.trim()}>
              Check
            </Btn>
          </>
        ) : (
          <Btn variant="primary" accent={subject.accent} iconRight="next" onClick={next}>
            {session.index === session.items.length - 1 ? 'Finish' : 'Next word'}
          </Btn>
        )}
      </div>
    </div>
  );
}

window.SpellingGame = SpellingGame;
