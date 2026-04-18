// Root App — orchestrates navigation, nav pattern, and the Tweaks panel.
// State is intentionally tiny so each piece maps 1:1 to a Next.js page or layout.

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "navPattern": "dashboard",
  "density": "comfortable",
  "accentStyle": "muted"
}/*EDITMODE-END*/;

function App() {
  // Route = 'home' | 'collection' | subjectId
  const [route, setRoute] = React.useState(() => localStorage.getItem('ks2-route') || 'home');
  const [tab, setTab]     = React.useState(() => localStorage.getItem('ks2-tab')   || 'practice');
  const [tweaks, setTweaks] = React.useState(DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [profile, setProfile] = React.useState(() => loadProfile());
  const [editingProfile, setEditingProfile] = React.useState(false);
  // Queue of monster events to show one-at-a-time
  const [monsterQueue, setMonsterQueue] = React.useState([]);
  const enqueueMonsterEvent = (ev) => setMonsterQueue(q => [...q, ev]);
  const dismissMonsterEvent = () => setMonsterQueue(q => q.slice(1));

  // Swap subject palette based on accent style
  const subjectsMap = getSubjects(tweaks.accentStyle);
  // Keep global SUBJECTS pointing at the active palette so deep components see it
  window.SUBJECTS = subjectsMap;

  React.useEffect(() => { localStorage.setItem('ks2-route', route); }, [route]);
  React.useEffect(() => { localStorage.setItem('ks2-tab', tab); },   [tab]);

  // Host edit-mode protocol
  React.useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === '__activate_edit_mode')   setTweaksOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const updateTweak = (key, value) => {
    setTweaks(t => {
      const next = { ...t, [key]: value };
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*');
      return next;
    });
  };

  const subject = route !== 'home' && route !== 'collection' ? subjectsMap[route] : null;

  // First-run onboarding
  if (!profile) {
    return <ProfileOnboarding onDone={p => setProfile(p)} />;
  }
  const navPattern = tweaks.navPattern;

  // In 'dashboard' mode there's NO persistent switcher — back to home to change subject.
  const showSidebar = navPattern === 'sidebar' && route !== 'home' && route !== 'collection';
  const showTopbar  = navPattern === 'topbar'  && route !== 'home' && route !== 'collection';

  return (
    <div style={{
      minHeight: '100vh',
      background: TOKENS.bg,
      fontFamily: TOKENS.fontSans,
      color: TOKENS.ink,
      display: 'flex',
    }}>
      {showSidebar && (
        <Sidebar
          activeSubject={route}
          onGoHome={() => setRoute('home')}
          onNavigate={setRoute}
          profile={profile}
          onEditProfile={() => setEditingProfile(true)}
        />
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {showTopbar && (
          <Topbar
            activeSubject={route}
            onGoHome={() => setRoute('home')}
            onNavigate={setRoute}
          />
        )}

        {route === 'home' ? (
          <Dashboard
            onOpenSubject={setRoute}
            onOpenCollection={() => setRoute('collection')}
            profile={profile}
            onEditProfile={() => setEditingProfile(true)}
          />
        ) : route === 'collection' ? (
          <CollectionScreen profile={profile} onBack={() => setRoute('home')} />
        ) : (
          <SubjectView
            subject={subject}
            activeTab={tab}
            onTabChange={setTab}
            navPattern={navPattern}
            onGoHome={() => setRoute('home')}
            onOpenCollection={() => setRoute('collection')}
            density={tweaks.density}
            profile={profile}
            onEditProfile={() => setEditingProfile(true)}
            onMonsterEvent={enqueueMonsterEvent}
          />
        )}
      </div>

      <TweaksPanel
        open={tweaksOpen}
        tweaks={tweaks}
        onChange={updateTweak}
        onClose={() => setTweaksOpen(false)}
      />

      {editingProfile && (
        <ProfileEditDialog
          profile={profile}
          onSave={p => { setProfile(p); setEditingProfile(false); }}
          onClose={() => setEditingProfile(false)}
        />
      )}

      {monsterQueue.length > 0 && (
        <MonsterOverlay event={monsterQueue[0]} onClose={dismissMonsterEvent} />
      )}
    </div>
  );
}

function SubjectView({ subject, activeTab, onTabChange, navPattern, onGoHome, onOpenCollection, density, profile, onEditProfile, onMonsterEvent }) {
  const padding = density === 'compact' ? '16px 18px' : '24px 28px';
  const max = density === 'compact' ? 1180 : 1280;
  return (
    <main style={{ padding, maxWidth: max, width: '100%', margin: '0 auto' }}>
      {navPattern === 'dashboard' && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <Btn variant="ghost" icon="back" onClick={onGoHome} size="sm">Back to dashboard</Btn>
          <Btn variant="ghost" icon="spark" onClick={onOpenCollection} size="sm">Monster Codex</Btn>
        </div>
      )}
      <SubjectHeader subject={subject} activeTab={activeTab} onTabChange={onTabChange} profile={profile} onEditProfile={onEditProfile} onOpenCollection={onOpenCollection} />
      {activeTab === 'practice'  && <PracticeScreen subject={subject} profile={profile} onMonsterEvent={onMonsterEvent} />}
      {activeTab === 'analytics' && <AnalyticsScreen subject={subject} />}
      {activeTab === 'profiles'  && <ProfilesScreen subject={subject} profile={profile} onEditProfile={onEditProfile} />}
      {activeTab === 'settings'  && <SettingsScreen subject={subject} />}
      {activeTab === 'method'    && <MethodScreen subject={subject} />}
    </main>
  );
}

function TweaksPanel({ open, tweaks, onChange, onClose }) {
  if (!open) return null;

  const options = {
    navPattern: [
      { v: 'sidebar',   label: 'Sidebar',   desc: 'Persistent left rail with subject icons.' },
      { v: 'topbar',    label: 'Top tabs',  desc: 'Subject tabs in the top bar.' },
      { v: 'dashboard', label: 'Dashboard', desc: 'No persistent switcher — go via home.' },
    ],
    density: [
      { v: 'comfortable', label: 'Comfortable' },
      { v: 'compact',     label: 'Compact' },
    ],
    accentStyle: [
      { v: 'muted', label: 'Muted (current)' },
      { v: 'vivid', label: 'Vivid' },
    ],
  };

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, width: 320, zIndex: 1000,
      background: TOKENS.panel, border: `1px solid ${TOKENS.line}`,
      borderRadius: TOKENS.radius, boxShadow: TOKENS.shadowLg,
      padding: 18, fontFamily: TOKENS.fontSans,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="tweak" size={18} />
          <strong style={{ fontSize: 15, color: TOKENS.ink }}>Tweaks</strong>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: TOKENS.muted, padding: 4,
        }}><Icon name="close" size={16} /></button>
      </div>

      <TweakSection title="Navigation pattern" options={options.navPattern}
        value={tweaks.navPattern} onChange={v => onChange('navPattern', v)} showDesc />

      <TweakSection title="Density" options={options.density}
        value={tweaks.density} onChange={v => onChange('density', v)} />

      <TweakSection title="Accent style" options={options.accentStyle}
        value={tweaks.accentStyle} onChange={v => onChange('accentStyle', v)} />

      <div style={{
        marginTop: 12, padding: '10px 12px', background: TOKENS.panelSoft,
        border: `1px solid ${TOKENS.line}`, borderRadius: 10,
        fontSize: 11.5, color: TOKENS.muted, lineHeight: 1.5,
      }}>
        Changes persist in this file — when you port to Next.js, these become layout props.
      </div>
    </div>
  );
}

function TweakSection({ title, options, value, onChange, showDesc }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: TOKENS.muted, marginBottom: 8,
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map(o => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              onClick={() => onChange(o.v)}
              style={{
                textAlign: 'left', padding: '10px 12px',
                border: `1.5px solid ${active ? TOKENS.ink : TOKENS.line}`,
                background: active ? TOKENS.panelSoft : TOKENS.panel,
                borderRadius: 10, cursor: 'pointer',
                fontFamily: TOKENS.fontSans, color: TOKENS.ink,
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: active ? 700 : 600 }}>{o.label}</div>
              {showDesc && <div style={{ fontSize: 11.5, color: TOKENS.muted, marginTop: 2 }}>{o.desc}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Mount
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
