// Progress / Profiles / Settings / Method — short versions that prove the shell works.
// Each follows the same layout grammar: Panels with eyebrow+title, consistent spacing.

function AnalyticsScreen({ subject }) {
  const skills = [
    { name: 'Smart Review',    mastery: 82, delta: '+4', status: 'strong' },
    { name: 'Core fluency',    mastery: 76, delta: '+2', status: 'strong' },
    { name: 'Applied problems',mastery: 58, delta: '-1', status: 'ok' },
    { name: 'Stretch topics',  mastery: 34, delta: '+8', status: 'weak' },
    { name: 'Recently missed', mastery: 41, delta: '+6', status: 'weak' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <Panel eyebrow="Last 30 days" title="Mastery over time" style={{ gridColumn: 'span 2' }}>
        <MasteryChart accent={subject.accent} />
      </Panel>
      <Panel eyebrow="Skill breakdown" title="Where you stand">
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {skills.map(s => (
            <li key={s.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13.5 }}>
                <span style={{ color: TOKENS.ink, fontWeight: 600 }}>{s.name}</span>
                <span style={{ color: TOKENS.muted }}>
                  {s.mastery}% <span style={{ color: s.delta.startsWith('+') ? TOKENS.good : TOKENS.bad, fontWeight: 700 }}>{s.delta}</span>
                </span>
              </div>
              <ProgressBar value={s.mastery} accent={
                s.status === 'strong' ? subject.accent :
                s.status === 'ok' ? TOKENS.warn : TOKENS.bad
              } />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel eyebrow="This week" title="Habits">
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Stat label="Sessions" value="11" small />
          <Stat label="Minutes" value="147" small />
          <Stat label="Questions" value="218" small tone="accent" accent={subject.accent} />
        </div>
        <div style={{ fontSize: 13.5, color: TOKENS.ink2, lineHeight: 1.55 }}>
          <strong style={{ color: TOKENS.ink }}>Strong point:</strong> Maya works best between 4pm and 5pm on weekdays.
          Consider scheduling harder material then.
        </div>
      </Panel>
    </div>
  );
}

function MasteryChart({ accent }) {
  const points = [32, 38, 36, 44, 52, 49, 58, 62, 64, 70, 68, 74, 78, 82];
  const w = 800, h = 160, pad = 24;
  const step = (w - pad * 2) / (points.length - 1);
  const maxV = 100;
  const pts = points.map((v, i) => [pad + i * step, h - pad - (v / maxV) * (h - pad * 2)]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const area = path + ` L ${pts[pts.length-1][0]} ${h-pad} L ${pad} ${h-pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 160 }}>
      {[25, 50, 75].map(y => (
        <line key={y} x1={pad} x2={w-pad}
          y1={h - pad - (y / maxV) * (h - pad * 2)}
          y2={h - pad - (y / maxV) * (h - pad * 2)}
          stroke={TOKENS.lineSoft} strokeDasharray="3 4" />
      ))}
      <path d={area} fill={accent} opacity="0.12" />
      <path d={path} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length-1 ? 5 : 3}
          fill={i === pts.length-1 ? accent : '#fff'} stroke={accent} strokeWidth="2" />
      ))}
    </svg>
  );
}

function ProfilesScreen({ subject, profile, onEditProfile }) {
  const name = profile?.name || 'Learner';
  const yr = profile?.yearGroup || 'Y5';
  const goalLabel = (GOALS.find(g => g.v === profile?.goal) || GOALS[0]).label;
  const daysSince = profile?.createdAt
    ? Math.max(1, Math.round((Date.now() - profile.createdAt) / 86400000))
    : 1;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <Panel eyebrow="Learner profile" title={name} action={
        <Btn variant="secondary" icon="cog" size="sm" onClick={onEditProfile}>Edit</Btn>
      }>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: profile?.avatarColor || subject.accentTint,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: TOKENS.fontSerif, fontWeight: 800, fontSize: 26,
          }}>{initials(name)}</div>
          <div>
            <div style={{ fontFamily: TOKENS.fontSerif, fontSize: 20, fontWeight: 700, color: TOKENS.ink }}>{name}</div>
            <div style={{ color: TOKENS.muted, fontSize: 13.5 }}>
              {yr} · {goalLabel} · {profile?.dailyMinutes || 15} min/day target · {daysSince} day{daysSince===1?'':'s'} here
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat label="Questions answered" value="2,418" small />
          <Stat label="Hours studied" value="38h" small />
          <Stat label="Best streak" value="24 days" small />
          <Stat label="Skills mastered" value="47" small tone="accent" accent={subject.accent} />
        </div>
        {profile?.weakSubjects?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: TOKENS.muted, marginBottom: 6,
            }}>Marked as tricky</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {profile.weakSubjects.map(id => (
                <Chip key={id} tone="accent" icon={SUBJECTS[id].icon}
                  style={{ accent: SUBJECTS[id].accent, accentTint: SUBJECTS[id].accentTint }}>
                  {SUBJECTS[id].name}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </Panel>
      <Panel eyebrow="Data" title="Export & manage">
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Export session log (CSV)', 'Every question, answer & time'],
            ['Export mastery snapshot (JSON)', 'Per-skill state for Next.js import'],
            ['Share progress with parent', 'Read-only weekly email'],
            ['Reset this subject', 'Keeps your streak, clears mastery'],
          ].map(([t, s], i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', background: TOKENS.panelSoft,
              border: `1px solid ${TOKENS.line}`, borderRadius: 12,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TOKENS.ink }}>{t}</div>
                <div style={{ fontSize: 12.5, color: TOKENS.muted }}>{s}</div>
              </div>
              <Btn variant="secondary" size="sm" iconRight="next">Open</Btn>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function SettingsScreen({ subject }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <Panel eyebrow="Appearance" title="Display">
        <SettingRow label="Text size" desc="Makes questions easier to read.">
          <Select value="m" options={[
            {value:'s',label:'Small'},{value:'m',label:'Medium'},{value:'l',label:'Large'},{value:'xl',label:'Extra large'}
          ]} />
        </SettingRow>
        <SettingRow label="Motion" desc="Reduce animations if they distract.">
          <Toggle defaultOn />
        </SettingRow>
        <SettingRow label="High-contrast mode" desc="Stronger outlines & colour.">
          <Toggle />
        </SettingRow>
      </Panel>
      <Panel eyebrow="Audio" title="Sound">
        <SettingRow label="Read aloud voice" desc="Which voice Maya hears.">
          <Select value="en-gb-f" options={[
            {value:'en-gb-f',label:'British English · Female'},
            {value:'en-gb-m',label:'British English · Male'},
            {value:'en-us-f',label:'American English · Female'},
          ]} />
        </SettingRow>
        <SettingRow label="Auto read questions" desc="Speaks each question on load.">
          <Toggle defaultOn />
        </SettingRow>
        <SettingRow label="Speech speed" desc="Slower helps new readers.">
          <Select value="1" options={[
            {value:'0.8',label:'0.8× · slower'},{value:'1',label:'1× · normal'},{value:'1.2',label:'1.2× · faster'}
          ]} />
        </SettingRow>
      </Panel>
      <Panel eyebrow="Practice" title="Session defaults" style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <Field label="Default mode">
            <Select value="smart" options={[{value:'smart',label:'Smart Review'},{value:'skill',label:'Skill Builder'}]} />
          </Field>
          <Field label="Default goal">
            <Select value="10m" options={[{value:'5m',label:'5 min'},{value:'10m',label:'10 min'},{value:'20m',label:'20 min'}]} />
          </Field>
          <Field label="Hints">
            <Select value="after" options={[{value:'after',label:'After first try'},{value:'always',label:'Always available'},{value:'never',label:'Never'}]} />
          </Field>
        </div>
      </Panel>
    </div>
  );
}

function SettingRow({ label, desc, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '12px 0',
      borderBottom: `1px solid ${TOKENS.lineSoft}`,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: TOKENS.ink }}>{label}</div>
        <div style={{ fontSize: 12.5, color: TOKENS.muted }}>{desc}</div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ defaultOn }) {
  const [on, setOn] = React.useState(!!defaultOn);
  return (
    <button
      onClick={() => setOn(!on)}
      style={{
        width: 44, height: 26, border: 'none', cursor: 'pointer',
        borderRadius: 999,
        background: on ? TOKENS.ink : TOKENS.line,
        position: 'relative', padding: 3,
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3,
        left: on ? 21 : 3, transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function MethodScreen({ subject }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
      <Panel eyebrow="How this works" title={`The ${subject.name.toLowerCase()} method`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            { n: 1, t: 'Assess', d: 'Every session starts with a tiny adaptive check. It places each skill on a mastery scale from 0 to 100.' },
            { n: 2, t: 'Mix', d: 'Smart Review weighs your due items, weak spots, and recent mistakes into a session balanced for 10-15 minutes.' },
            { n: 3, t: 'Space', d: "Items you've answered correctly return at growing intervals — the classic spaced repetition curve." },
            { n: 4, t: 'Repair', d: 'When something goes wrong, we drop difficulty, offer a worked example, then fade guidance.' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                background: subject.accentTint, color: subject.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: TOKENS.fontSerif, fontSize: 18, fontWeight: 800,
              }}>{s.n}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TOKENS.ink, marginBottom: 3 }}>{s.t}</div>
                <div style={{ fontSize: 14, color: TOKENS.ink2, lineHeight: 1.55 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel eyebrow="Curriculum" title="Based on">
        <ul style={{ margin: 0, paddingLeft: 18, color: TOKENS.ink2, fontSize: 13.5, lineHeight: 1.7 }}>
          <li>National Curriculum (England) — KS2 {subject.name}</li>
          <li>Statutory requirements for Year 5 &amp; 6</li>
          <li>Past SATs papers 2016 – 2024</li>
          <li>Research on retrieval practice &amp; interleaving</li>
        </ul>
        <div style={{
          marginTop: 16, padding: 12, background: TOKENS.panelSoft,
          border: `1px solid ${TOKENS.line}`, borderRadius: 12,
          fontSize: 12.5, color: TOKENS.muted, lineHeight: 1.55,
        }}>
          Each subject has its own engine under the hood — only the shell is shared.
          Swap engines without touching the UI layer.
        </div>
      </Panel>
    </div>
  );
}

Object.assign(window, { AnalyticsScreen, ProfilesScreen, SettingsScreen, MethodScreen });
