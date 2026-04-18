// AppShell — the unified chrome that wraps every subject.
// Three nav patterns, toggled by `navPattern` prop: 'sidebar' | 'topbar' | 'dashboard'.

const TAB_DEFS = [
  { id: 'practice', label: 'Practice', icon: 'play' },
  { id: 'analytics', label: 'Progress', icon: 'chart' },
  { id: 'profiles', label: 'Profiles', icon: 'people' },
  { id: 'settings', label: 'Settings', icon: 'cog' },
  { id: 'method', label: 'Method', icon: 'method' },
];

// Compact subject glyph — used in sidebar, dashboard cards, topbar subject-pill
function SubjectGlyph({ subject, size = 36, filled = false }) {
  return (
    <div style={{
      width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: size * 0.33,
      background: filled ? subject.accent : subject.accentTint,
      color: filled ? '#fff' : subject.accent,
      flexShrink: 0,
      border: filled ? 'none' : `1.5px solid ${subject.accentSoft}`,
    }}>
      <Icon name={subject.icon} size={size * 0.55} />
    </div>
  );
}

function Sidebar({ activeSubject, onGoHome, onNavigate, profile, onEditProfile }) {
  const avatarColor = profile?.avatarColor || TOKENS.ink;
  const avatarInits = profile ? initials(profile.name) : 'K';
  return (
    <aside style={{
      width: 88, flexShrink: 0,
      background: TOKENS.panel,
      borderRight: `1px solid ${TOKENS.line}`,
      padding: '18px 0',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 10,
      position: 'sticky', top: 0, height: '100vh',
    }}>
      {/* Profile / home button — aligned with subject glyphs below */}
      <button
        onClick={profile ? onEditProfile : onGoHome}
        title={profile ? `${profile.name} · edit profile` : 'Home'}
        style={{
          width: 48, height: 48, borderRadius: '50%',
          background: avatarColor, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer',
          fontFamily: TOKENS.fontSerif, fontWeight: 800, fontSize: 16,
          marginBottom: 2,
          boxShadow: '0 0 0 3px #fff, 0 0 0 4px ' + TOKENS.line,
        }}
      >{avatarInits}</button>

      <button
        onClick={onGoHome}
        title="Home"
        style={{
          width: 48, height: 40, borderRadius: 12,
          background: activeSubject ? 'transparent' : TOKENS.panelSoft,
          color: activeSubject ? TOKENS.muted : TOKENS.ink,
          border: `1px solid ${activeSubject ? 'transparent' : TOKENS.line}`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      ><Icon name="home" size={18} /></button>

      <div style={{ width: 40, height: 1, background: TOKENS.line, margin: '4px 0 8px' }} />

      {SUBJECT_ORDER.map(id => {
        const s = SUBJECTS[id];
        const active = activeSubject === id;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            title={s.name}
            style={{
              width: 60, padding: '8px 0', border: 'none', background: 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              cursor: 'pointer', position: 'relative',
            }}
          >
            {active && <div style={{
              position: 'absolute', left: -18, top: '50%', transform: 'translateY(-50%)',
              width: 4, height: 28, background: s.accent, borderRadius: '0 4px 4px 0',
            }} />}
            <SubjectGlyph subject={s} size={40} filled={active} />
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              color: active ? s.accent : TOKENS.muted,
              letterSpacing: '0.02em',
            }}>{s.name}</span>
          </button>
        );
      })}
    </aside>
  );
}

function Topbar({ activeSubject, onGoHome, onNavigate }) {
  return (
    <div style={{
      background: TOKENS.panel,
      borderBottom: `1px solid ${TOKENS.line}`,
      padding: '14px 28px',
      display: 'flex', alignItems: 'center', gap: 16,
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <button
        onClick={onGoHome}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: TOKENS.ink, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: TOKENS.fontSerif, fontWeight: 900, fontSize: 16,
        }}>K</div>
        <span style={{
          fontFamily: TOKENS.fontSerif, fontWeight: 800, fontSize: 18,
          color: TOKENS.ink, letterSpacing: '-0.01em',
        }}>KS2 Study</span>
      </button>

      <div style={{ width: 1, height: 24, background: TOKENS.line, margin: '0 4px' }} />

      <nav style={{ display: 'flex', gap: 4, flex: 1, overflowX: 'auto' }}>
        {SUBJECT_ORDER.map(id => {
          const s = SUBJECTS[id];
          const active = activeSubject === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 999,
                border: `1px solid ${active ? s.accent : 'transparent'}`,
                background: active ? s.accentTint : 'transparent',
                color: active ? s.accent : TOKENS.ink2,
                cursor: 'pointer', fontFamily: TOKENS.fontSans,
                fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              <Icon name={s.icon} size={16} />
              {s.name}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function SubjectHeader({ subject, activeTab, onTabChange, streak = 7, xp = 1240, profile, onEditProfile }) {
  return (
    <header style={{
      background: TOKENS.panel,
      border: `1px solid ${TOKENS.line}`,
      borderTop: `4px solid ${subject.accent}`,
      borderRadius: TOKENS.radiusLg,
      padding: '22px 26px 0',
      boxShadow: TOKENS.shadow,
      marginBottom: 20,
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 18,
        justifyContent: 'space-between', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <SubjectGlyph subject={subject} size={56} filled />
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: subject.accent, marginBottom: 4,
            }}>KS2 · Year 5/6</div>
            <h1 style={{
              margin: 0, fontFamily: TOKENS.fontSerif, fontWeight: 800,
              fontSize: 30, letterSpacing: '-0.02em', color: TOKENS.ink,
              lineHeight: 1.05,
            }}>{subject.name}</h1>
            <p style={{
              margin: '6px 0 0', color: TOKENS.muted, fontSize: 14,
              fontFamily: TOKENS.fontSans,
            }}>{subject.blurb}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Chip tone="accent" icon="flame" style={{ accent: subject.accent, accentTint: subject.accentTint }}>
            {streak} day streak
          </Chip>
          <Chip tone="accent" icon="spark" style={{ accent: subject.accent, accentTint: subject.accentTint }}>
            {xp.toLocaleString()} XP
          </Chip>
          {profile && (
            <button onClick={onEditProfile} title="Edit profile" style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              background: profile.avatarColor || TOKENS.ink, color: '#fff',
              cursor: 'pointer', fontFamily: TOKENS.fontSerif, fontWeight: 800, fontSize: 13,
              marginLeft: 4,
            }}>{(profile.name || '?').trim().split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase()).join('')}</button>
          )}
        </div>
      </div>

      {/* Tab strip */}
      <nav style={{
        display: 'flex', gap: 4, marginTop: 22,
        borderTop: `1px solid ${TOKENS.lineSoft}`, paddingTop: 0,
      }}>
        {TAB_DEFS.map(t => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '14px 18px', border: 'none',
                borderBottom: `3px solid ${active ? subject.accent : 'transparent'}`,
                background: 'transparent',
                color: active ? subject.accent : TOKENS.muted,
                cursor: 'pointer',
                fontFamily: TOKENS.fontSans, fontSize: 14,
                fontWeight: active ? 800 : 600,
                marginBottom: -1,
              }}
            >
              <Icon name={t.icon} size={15} />
              {t.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

Object.assign(window, { Sidebar, Topbar, SubjectHeader, SubjectGlyph, TAB_DEFS });
