// PracticeScreen — the shared layout for all 6 subjects' Practice tab.
// It renders subject-specific content via <QuestionBody subject={id} />.

function PracticeScreen({ subject, profile, onMonsterEvent }) {
  const [mode, setMode] = React.useState('smart');
  const [answered, setAnswered] = React.useState(7);
  const [correct, setCorrect] = React.useState(5);
  const [timer, setTimer] = React.useState('04:12');

  const modes = {
    spelling:    [['smart','Smart Review'],['sound','Sound-out'],['sight','Sight words'],['test','Spelling test']],
    arithmetic:  [['smart','Smart Review'],['skill','Skill Builder'],['speed','Speed Drill'],['clinic','Error Clinic'],['test','True Test Mode']],
    reasoning:   [['smart','Smart Review'],['skill','Skill Practice'],['worked','Worked Examples'],['faded','Faded Guidance'],['sats','SATs Single'],['satsset','SATs Mini-Set']],
    grammar:     [['learn','Learn a concept'],['smart','Smart mixed review'],['trouble','Weak concepts drill'],['surgery','Sentence surgery'],['builder','Sentence builder'],['worked','Worked examples'],['satsset','KS2-style test']],
    punctuation: [['smart','Smart Review'],['comma','Comma clinic'],['speech','Speech marks'],['apostrophe','Apostrophes'],['test','KS2-style test']],
    reading:     [['guided','Guided practice'],['core','Core practice'],['smart','Smart review'],['evidence','Evidence hunt'],['vocab','Vocabulary in context'],['inference','Inference lab'],['stamina','Stamina builder'],['test','True SATs-style paper']],
  }[subject.id];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Setup panel */}
        <Panel eyebrow="Today's session" title="Practice setup">
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
          }}>
            <Field label="Mode">
              <Select
                value={mode}
                onChange={setMode}
                options={modes.map(([v, l]) => ({ value: v, label: l }))}
              />
            </Field>
            <Field label="Focus">
              <Select
                value="auto"
                options={[
                  { value: 'auto', label: 'Adaptive (recommended)' },
                  { value: 'weak', label: 'My weakest skills' },
                  { value: 'new', label: 'Introduce new skill' },
                ]}
              />
            </Field>
            <Field label="Session goal">
              <Select
                value="10m"
                options={[
                  { value: '5m', label: '5 minutes' },
                  { value: '10m', label: '10 minutes' },
                  { value: '20q', label: '20 questions' },
                  { value: 'due', label: 'Clear due items' },
                ]}
              />
            </Field>
            <Field label="Difficulty">
              <Select
                value="adapt"
                options={[
                  { value: 'adapt', label: 'Adaptive' },
                  { value: '2', label: 'Level 2 · Ease in' },
                  { value: '3', label: 'Level 3 · On track' },
                  { value: '4', label: 'Level 4 · Stretch' },
                ]}
              />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <Btn variant="primary" accent={subject.accent} icon="play">Start session</Btn>
            <Btn variant="secondary" icon="spark">AI fresh set</Btn>
            <Btn variant="ghost" icon="volume">Read aloud</Btn>
          </div>
        </Panel>

        {/* Question card — subject-specific */}
        <Panel padded={false} style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '14px 22px', background: subject.accentTint,
            borderBottom: `1px solid ${subject.accentSoft}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Chip tone="accent" style={{ accent: subject.accent, accentTint: '#fff' }}>
                Question 8 of 12
              </Chip>
              <Chip tone="neutral">{modes.find(m => m[0] === mode)?.[1] || 'Practice'}</Chip>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: TOKENS.muted, fontSize: 13 }}>
              <Icon name="clock" size={14} /> {timer}
            </div>
          </div>
          <div style={{ padding: '28px 32px 24px' }}>
            <QuestionBody subject={subject} profile={profile} onMonsterEvent={onMonsterEvent} />
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '14px 22px', background: TOKENS.panelSoft,
            borderTop: `1px solid ${TOKENS.line}`,
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" icon="hint" size="sm">Hint</Btn>
              <Btn variant="ghost" icon="volume" size="sm">Hear again</Btn>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" icon="back" size="sm">Skip</Btn>
              <Btn variant="primary" accent={subject.accent} iconRight="next" size="sm">Submit</Btn>
            </div>
          </div>
        </Panel>
      </div>

      {/* Session rail */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Panel eyebrow="This session" title="Live stats">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Stat label="Answered" value={answered} small />
            <Stat label="Correct" value={`${correct}/${answered}`} small tone="accent" accent={subject.accent} />
            <Stat label="Goal" value="58%" small />
            <Stat label="Timer" value={timer} small />
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 12, color: TOKENS.ink2, fontWeight: 600, marginBottom: 6,
            }}>
              <span>Goal progress</span><span>7 / 12</span>
            </div>
            <ProgressBar value={58} accent={subject.accent} />
          </div>
        </Panel>

        <Panel eyebrow="What's in this mix" title="Smart Review">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Due for review', count: 5, tone: 'warn' },
              { label: 'Weak spots', count: 3, tone: 'bad' },
              { label: 'New this week', count: 2, tone: 'neutral' },
              { label: 'Recently missed', count: 2, tone: 'good' },
            ].map(r => (
              <li key={r.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 13.5, color: TOKENS.ink2,
              }}>
                <span>{r.label}</span>
                <Chip tone={r.tone}>{r.count}</Chip>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel eyebrow="Keyboard" title="Shortcuts">
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 14px', fontSize: 13 }}>
            {[
              ['↵', 'Submit'],
              ['Tab', 'Next field'],
              ['S', 'Skip'],
              ['H', 'Hint'],
              ['R', 'Read aloud'],
            ].map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>
                  <kbd style={{
                    fontFamily: TOKENS.fontMono, fontSize: 11, fontWeight: 700,
                    padding: '3px 7px', background: TOKENS.lineSoft,
                    border: `1px solid ${TOKENS.line}`, borderRadius: 6,
                    color: TOKENS.ink2,
                  }}>{k}</kbd>
                </dt>
                <dd style={{ margin: 0, color: TOKENS.ink2 }}>{v}</dd>
              </React.Fragment>
            ))}
          </dl>
        </Panel>
      </aside>
    </div>
  );
}

window.PracticeScreen = PracticeScreen;
