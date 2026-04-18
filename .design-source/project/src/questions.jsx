// Subject-specific question bodies. Each implements a realistic mini interaction
// so the unified shell is believable across all 6 subjects. These are the ONLY
// part of the shared layout that varies — everything else is the same shell.

function QuestionBody({ subject }) {
  switch (subject.id) {
    case 'spelling':    return <SpellingGame subject={subject} />;
    case 'arithmetic':  return <ArithmeticQ subject={subject} />;
    case 'reasoning':   return <ReasoningQ subject={subject} />;
    case 'grammar':     return <GrammarQ subject={subject} />;
    case 'punctuation': return <PunctuationQ subject={subject} />;
    case 'reading':     return <ReadingQ subject={subject} />;
    default:            return null;
  }
}

function QStem({ children }) {
  return (
    <div style={{
      fontFamily: TOKENS.fontSerif, fontSize: 22, fontWeight: 500,
      color: TOKENS.ink, lineHeight: 1.4, letterSpacing: '-0.01em',
      marginBottom: 18,
    }}>{children}</div>
  );
}

function QLabel({ children }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: TOKENS.muted, marginBottom: 8,
    }}>{children}</div>
  );
}

// ─────────────── Spelling ───────────────
function SpellingQ({ subject }) {
  return (
    <>
      <QLabel>Listen, then type</QLabel>
      <QStem>
        The word means: <em>a building where things are made or assembled.</em>
      </QStem>
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16,
        padding: '14px 16px', background: subject.accentTint,
        border: `1px solid ${subject.accentSoft}`, borderRadius: 14,
      }}>
        <button style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none',
          background: subject.accent, color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name="volume" size={20} /></button>
        <div style={{ fontSize: 14, color: TOKENS.ink2 }}>
          <div style={{ fontWeight: 700 }}>Hear the word</div>
          <div style={{ color: TOKENS.muted, fontSize: 12.5 }}>Used in: "The bike was made in a <u>factory</u> in Bristol."</div>
        </div>
      </div>
      <input
        placeholder="Type the word…"
        style={{
          width: '100%', padding: '14px 16px',
          fontFamily: TOKENS.fontSerif, fontSize: 22,
          border: `2px solid ${TOKENS.line}`, borderRadius: 14,
          background: TOKENS.panel, color: TOKENS.ink,
          letterSpacing: '0.02em',
        }}
      />
    </>
  );
}

// ─────────────── Arithmetic ───────────────
function ArithmeticQ({ subject }) {
  return (
    <>
      <QLabel>Long multiplication</QLabel>
      <div style={{
        display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{
          fontFamily: TOKENS.fontMono, fontSize: 40, fontWeight: 700,
          color: TOKENS.ink, lineHeight: 1.1,
          padding: '20px 28px', background: subject.accentTint,
          borderRadius: 16, minWidth: 240, textAlign: 'right',
        }}>
          <div>&nbsp;&nbsp;348</div>
          <div style={{ borderBottom: `2px solid ${subject.accent}`, paddingBottom: 4 }}>× &nbsp;26</div>
          <div style={{ paddingTop: 4, color: subject.accent }}>= ?</div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <QLabel>Your answer</QLabel>
          <input
            placeholder="Type the answer"
            style={{
              width: '100%', padding: '14px 16px',
              fontFamily: TOKENS.fontMono, fontSize: 26, fontWeight: 700,
              border: `2px solid ${TOKENS.line}`, borderRadius: 14,
              background: TOKENS.panel, color: TOKENS.ink, textAlign: 'right',
            }}
          />
          <div style={{ marginTop: 10, fontSize: 13, color: TOKENS.muted }}>
            Tip: estimate first — 350 × 25 is roughly 8 750.
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────── Reasoning ───────────────
function ReasoningQ({ subject }) {
  return (
    <>
      <QLabel>Multi-step problem</QLabel>
      <QStem>
        A shop sells pencils in packs of 12 for £1.80. Mia buys 4 packs and pays with a £10 note.
        How much change does she get?
      </QStem>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 4,
      }}>
        <div>
          <QLabel>Step 1 · Working</QLabel>
          <textarea placeholder="Show your working…" rows={4} style={{
            width: '100%', padding: 14, border: `2px solid ${TOKENS.line}`,
            borderRadius: 14, fontFamily: TOKENS.fontMono, fontSize: 15,
            resize: 'vertical', color: TOKENS.ink,
          }} />
        </div>
        <div>
          <QLabel>Step 2 · Answer</QLabel>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontFamily: TOKENS.fontSerif, fontSize: 24, color: TOKENS.muted }}>£</span>
            <input placeholder="0.00" style={{
              flex: 1, padding: '14px 16px', fontFamily: TOKENS.fontMono,
              fontSize: 22, fontWeight: 700,
              border: `2px solid ${TOKENS.line}`, borderRadius: 14,
              background: TOKENS.panel, color: TOKENS.ink, textAlign: 'right',
            }} />
          </div>
          <div style={{ marginTop: 14, padding: 12, background: subject.accentTint,
            border: `1px solid ${subject.accentSoft}`, borderRadius: 12,
            fontSize: 13, color: TOKENS.ink2,
          }}>
            <strong style={{ color: subject.accent }}>Check:</strong> did you include the <em>total cost</em> before subtracting from £10?
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────── Grammar ───────────────
function GrammarQ({ subject }) {
  const choices = [
    { id: 'a', text: 'was', correct: false },
    { id: 'b', text: 'were', correct: true },
    { id: 'c', text: "weren't", correct: false },
    { id: 'd', text: 'is', correct: false },
  ];
  const [picked, setPicked] = React.useState(null);
  return (
    <>
      <QLabel>Choose the correct verb</QLabel>
      <QStem>
        If I <span style={{
          padding: '2px 10px', background: subject.accentTint, borderRadius: 6,
          color: subject.accent, fontWeight: 700,
        }}>____</span> a bird, I would fly to the mountains.
      </QStem>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {choices.map(c => {
          const active = picked === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setPicked(c.id)}
              style={{
                textAlign: 'left', padding: '14px 16px',
                border: `2px solid ${active ? subject.accent : TOKENS.line}`,
                background: active ? subject.accentTint : TOKENS.panel,
                borderRadius: 14, cursor: 'pointer',
                fontFamily: TOKENS.fontSerif, fontSize: 18, fontWeight: 500,
                color: TOKENS.ink,
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 8,
                background: active ? subject.accent : TOKENS.lineSoft,
                color: active ? '#fff' : TOKENS.muted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: TOKENS.fontSans, fontSize: 13, fontWeight: 700,
              }}>{c.id.toUpperCase()}</span>
              {c.text}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 14, fontSize: 13, color: TOKENS.muted }}>
        This is the <strong style={{ color: TOKENS.ink2 }}>subjunctive mood</strong> — used for hypothetical situations.
      </div>
    </>
  );
}

// ─────────────── Punctuation ───────────────
function PunctuationQ({ subject }) {
  const words = ['After', 'the', 'long', 'walk', 'through', 'the', 'woods', 'the', 'children', 'were', 'hungry'];
  const [commaAt, setCommaAt] = React.useState(7);
  return (
    <>
      <QLabel>Drop the comma in the correct place</QLabel>
      <QStem>Tap between words to place a single comma.</QStem>
      <div style={{
        padding: '20px 18px', background: subject.accentTint,
        border: `1px solid ${subject.accentSoft}`, borderRadius: 16,
        fontFamily: TOKENS.fontSerif, fontSize: 24, lineHeight: 1.8,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0,
      }}>
        {words.map((w, i) => (
          <React.Fragment key={i}>
            <span>{w}</span>
            {i === commaAt && (
              <span style={{
                color: subject.accent, fontWeight: 800, fontSize: 28,
                padding: '0 2px', animation: 'pulse 1.5s infinite',
              }}>,</span>
            )}
            {i < words.length - 1 && (
              <button
                onClick={() => setCommaAt(i)}
                style={{
                  width: 22, height: 28, margin: '0 2px', border: 'none',
                  background: 'transparent', cursor: 'pointer', borderRadius: 6,
                  opacity: commaAt === i ? 0 : 0.35,
                }}
                title="Place comma here"
              >
                <div style={{
                  width: 3, height: 18, background: subject.accent, borderRadius: 2,
                  margin: '0 auto',
                }} />
              </button>
            )}
          </React.Fragment>
        ))}
        <span>.</span>
      </div>
      <div style={{ marginTop: 14, fontSize: 13, color: TOKENS.muted }}>
        <strong style={{ color: TOKENS.ink2 }}>Fronted adverbial</strong> — needs a comma after the opening phrase.
      </div>
    </>
  );
}

// ─────────────── Reading ───────────────
function ReadingQ({ subject }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
      <div style={{
        padding: 20, background: subject.accentTint,
        border: `1px solid ${subject.accentSoft}`, borderRadius: 16,
        fontFamily: TOKENS.fontSerif, fontSize: 16, lineHeight: 1.65,
        color: TOKENS.ink, maxHeight: 300, overflowY: 'auto',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: subject.accent, marginBottom: 8,
          fontFamily: TOKENS.fontSans,
        }}>Fiction · extract</div>
        <p style={{ margin: '0 0 10px' }}>
          The harbour was empty by the time Eleanor reached the jetty. A single gull
          circled overhead, its cry sharp against the hush of the water. She had
          expected the boat to be waiting — her grandfather always said he would
          come on the first tide after a storm — but there was only the slow creak
          of rope on wood and the taste of salt on the wind.
        </p>
        <p style={{ margin: 0 }}>
          She sat down on the damp planks and pulled her coat tighter. Perhaps, she
          thought, perhaps he had simply slept late.
        </p>
      </div>
      <div>
        <QLabel>Question 3 · 2 marks</QLabel>
        <div style={{
          fontFamily: TOKENS.fontSerif, fontSize: 17, color: TOKENS.ink,
          lineHeight: 1.45, marginBottom: 12,
        }}>
          How does Eleanor feel when she arrives at the harbour? Give <strong>two</strong> pieces of evidence from the text.
        </div>
        <textarea placeholder="Type your answer, using quotes from the passage…" rows={5} style={{
          width: '100%', padding: 14, border: `2px solid ${TOKENS.line}`,
          borderRadius: 14, fontFamily: TOKENS.fontSans, fontSize: 14,
          resize: 'vertical', color: TOKENS.ink, lineHeight: 1.5,
        }} />
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip tone="neutral" icon="hint">Retrieval</Chip>
          <Chip tone="neutral" icon="hint">Inference</Chip>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { QuestionBody });
