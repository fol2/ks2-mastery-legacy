// Profile setup — first-run onboarding + edit-in-place dialog.
// Persists to localStorage under 'ks2-profile'.

const PROFILE_KEY = 'ks2-profile';

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch { return null; }
}
function saveProfile(p) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('');
}

const AVATAR_COLORS = [
  '#3E6FA8', '#C06B3E', '#8A5A9D', '#2E8479', '#B8873F', '#4B7A4A',
  '#D25757', '#B53F87',
];
const YEAR_GROUPS = [
  { v: 'Y3', label: 'Year 3' },
  { v: 'Y4', label: 'Year 4' },
  { v: 'Y5', label: 'Year 5' },
  { v: 'Y6', label: 'Year 6' },
];
const GOALS = [
  { v: 'sats',    label: 'Preparing for SATs' },
  { v: 'catch',   label: 'Catching up on tricky bits' },
  { v: 'stretch', label: 'Getting ahead of class' },
  { v: 'fun',     label: 'Just learning at my own pace' },
];

function ProfileOnboarding({ onDone }) {
  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState({
    name: '',
    yearGroup: 'Y5',
    avatarColor: AVATAR_COLORS[0],
    goal: 'sats',
    dailyMinutes: 15,
    weakSubjects: [],
  });

  const update = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const toggleWeak = (id) =>
    update('weakSubjects',
      draft.weakSubjects.includes(id)
        ? draft.weakSubjects.filter(x => x !== id)
        : [...draft.weakSubjects, id]);

  const steps = [
    {
      title: "Let's set up your study space",
      sub: "A quick 4-step setup so we can tune things to you.",
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Your name">
            <input value={draft.name} onChange={e => update('name', e.target.value)}
              placeholder="e.g. Maya Hudson"
              style={{
                padding: '12px 14px', border: `2px solid ${TOKENS.line}`,
                borderRadius: 12, fontSize: 16, color: TOKENS.ink,
              }} autoFocus />
          </Field>
          <Field label="Pick an avatar colour">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AVATAR_COLORS.map(c => (
                <button key={c} onClick={() => update('avatarColor', c)}
                  style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: c,
                    border: draft.avatarColor === c ? `3px solid ${TOKENS.ink}` : `3px solid transparent`,
                    cursor: 'pointer',
                  }} />
              ))}
            </div>
          </Field>
        </div>
      ),
      valid: draft.name.trim().length >= 2,
    },
    {
      title: "Which year are you in?",
      sub: "This picks the right word lists and question difficulty.",
      body: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {YEAR_GROUPS.map(y => {
            const active = draft.yearGroup === y.v;
            return (
              <button key={y.v} onClick={() => update('yearGroup', y.v)}
                style={{
                  padding: '20px 10px',
                  border: `2px solid ${active ? TOKENS.ink : TOKENS.line}`,
                  background: active ? TOKENS.panelSoft : TOKENS.panel,
                  borderRadius: 16, cursor: 'pointer',
                  fontFamily: TOKENS.fontSerif, fontSize: 18, fontWeight: 700,
                  color: TOKENS.ink,
                }}>
                {y.label}
              </button>
            );
          })}
        </div>
      ),
      valid: true,
    },
    {
      title: "What's your goal?",
      sub: "Pick the one that fits you best — you can change it later.",
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {GOALS.map(g => {
            const active = draft.goal === g.v;
            return (
              <button key={g.v} onClick={() => update('goal', g.v)}
                style={{
                  textAlign: 'left', padding: '14px 16px',
                  border: `2px solid ${active ? TOKENS.ink : TOKENS.line}`,
                  background: active ? TOKENS.panelSoft : TOKENS.panel,
                  borderRadius: 14, cursor: 'pointer',
                  fontSize: 15, color: TOKENS.ink,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: `2px solid ${active ? TOKENS.ink : TOKENS.line}`,
                  background: active ? TOKENS.ink : 'transparent',
                  flexShrink: 0,
                }} />
                {g.label}
              </button>
            );
          })}
          <Field label="Daily target (minutes)" style={{ marginTop: 8 }}>
            <input type="range" min="5" max="60" step="5"
              value={draft.dailyMinutes}
              onChange={e => update('dailyMinutes', parseInt(e.target.value))}
              style={{ accentColor: TOKENS.ink }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TOKENS.muted }}>
              <span>5 min</span>
              <strong style={{ color: TOKENS.ink }}>{draft.dailyMinutes} min/day</strong>
              <span>60 min</span>
            </div>
          </Field>
        </div>
      ),
      valid: true,
    },
    {
      title: "Which subjects feel tricky?",
      sub: "We'll weight Smart Review towards these. Pick any (or none).",
      body: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {SUBJECT_ORDER.map(id => {
            const s = SUBJECTS[id];
            const active = draft.weakSubjects.includes(id);
            return (
              <button key={id} onClick={() => toggleWeak(id)}
                style={{
                  textAlign: 'left', padding: '14px 16px',
                  border: `2px solid ${active ? s.accent : TOKENS.line}`,
                  background: active ? s.accentTint : TOKENS.panel,
                  borderRadius: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                  color: TOKENS.ink,
                }}>
                <SubjectGlyph subject={s} size={36} filled={active} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: TOKENS.muted }}>{active ? 'Marked as tricky' : 'Tap to mark'}</div>
                </div>
              </button>
            );
          })}
        </div>
      ),
      valid: true,
    },
  ];

  const cur = steps[step];
  const last = step === steps.length - 1;

  const commit = () => {
    const profile = { ...draft, createdAt: Date.now() };
    saveProfile(profile);
    onDone(profile);
  };

  return (
    <div style={{
      minHeight: '100vh', background: TOKENS.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: TOKENS.fontSans,
    }}>
      <div style={{
        width: '100%', maxWidth: 560, background: TOKENS.panel,
        border: `1px solid ${TOKENS.line}`, borderRadius: TOKENS.radiusLg,
        boxShadow: TOKENS.shadowLg, padding: '32px 36px',
      }}>
        {/* Step pips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 5, borderRadius: 5,
              background: i <= step ? TOKENS.ink : TOKENS.line,
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: TOKENS.muted, marginBottom: 6,
        }}>Step {step + 1} of {steps.length}</div>

        <h1 style={{
          margin: 0, fontFamily: TOKENS.fontSerif, fontWeight: 800,
          fontSize: 28, letterSpacing: '-0.02em', color: TOKENS.ink,
          lineHeight: 1.1,
        }}>{cur.title}</h1>
        <p style={{ margin: '8px 0 22px', color: TOKENS.ink2, fontSize: 15 }}>{cur.sub}</p>

        <div style={{ marginBottom: 24 }}>{cur.body}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          {step > 0
            ? <Btn variant="secondary" icon="back" onClick={() => setStep(step - 1)}>Back</Btn>
            : <span />}
          {last
            ? <Btn variant="primary" icon="check" disabled={!cur.valid} onClick={commit}>Finish setup</Btn>
            : <Btn variant="primary" iconRight="next" disabled={!cur.valid} onClick={() => setStep(step + 1)}>Continue</Btn>}
        </div>
      </div>
    </div>
  );
}

function ProfileEditDialog({ profile, onSave, onClose }) {
  const [draft, setDraft] = React.useState(profile);
  const update = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(29,43,58,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: TOKENS.panel, borderRadius: TOKENS.radiusLg,
        boxShadow: TOKENS.shadowLg, padding: 28, width: '100%', maxWidth: 480,
      }}>
        <h2 style={{ margin: '0 0 16px', fontFamily: TOKENS.fontSerif, fontSize: 22 }}>Edit profile</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Name">
            <input value={draft.name} onChange={e => update('name', e.target.value)}
              style={{ padding: '10px 12px', border: `2px solid ${TOKENS.line}`, borderRadius: 10, fontSize: 14 }} />
          </Field>
          <Field label="Year group">
            <Select value={draft.yearGroup} onChange={v => update('yearGroup', v)}
              options={YEAR_GROUPS.map(y => ({ value: y.v, label: y.label }))} />
          </Field>
          <Field label="Goal">
            <Select value={draft.goal} onChange={v => update('goal', v)}
              options={GOALS.map(g => ({ value: g.v, label: g.label }))} />
          </Field>
          <Field label="Avatar colour">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AVATAR_COLORS.map(c => (
                <button key={c} onClick={() => update('avatarColor', c)}
                  style={{
                    width: 32, height: 32, borderRadius: 10, background: c,
                    border: draft.avatarColor === c ? `3px solid ${TOKENS.ink}` : `3px solid transparent`,
                    cursor: 'pointer',
                  }} />
              ))}
            </div>
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon="check" onClick={() => { saveProfile(draft); onSave(draft); }}>Save</Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  ProfileOnboarding, ProfileEditDialog,
  loadProfile, saveProfile, initials, AVATAR_COLORS, YEAR_GROUPS, GOALS,
});
