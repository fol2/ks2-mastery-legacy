// MonsterOverlay — full-screen celebration when a monster is caught / levels / evolves / megas.
// Queue-based: show one event at a time, auto-dismissable via button.

function MonsterOverlay({ event, onClose }) {
  if (!event) return null;
  const { kind, monster, stage, level, mastered } = event;

  const title = {
    caught:  "You caught a new friend!",
    levelup: "Level up!",
    evolve:  "Your friend is evolving!",
    mega:    "MEGA EVOLUTION!",
  }[kind];

  const sub = {
    caught:  `${monster.name} joined your collection.`,
    levelup: `${monster.name} reached level ${level}.`,
    evolve:  `${monster.name} evolved into ${monster.nameByStage[stage]}.`,
    mega:    `${monster.name} achieved its mega form!`,
  }[kind];

  const bg = kind === 'mega' ? '#1F2036' : '#1D2B3A';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: `radial-gradient(circle at 50% 40%, ${monster.primary}E6 0%, ${bg}F5 70%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', color: '#fff',
      fontFamily: TOKENS.fontSans,
      animation: 'monster-fade-in 0.35s ease-out',
    }}>
      <style>{`
        @keyframes monster-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes monster-pop { 0% { transform: scale(0.3) rotate(-8deg); opacity: 0; }
          60% { transform: scale(1.08) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); } }
        @keyframes sparkle-rise { 0% { transform: translateY(0) scale(0.5); opacity: 0; }
          30% { opacity: 1; } 100% { transform: translateY(-60px) scale(1.2); opacity: 0; } }
        @keyframes aura-pulse { 0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.15); opacity: 0.6; } }
      `}</style>

      {/* decorative sparkles */}
      {Array.from({ length: 14 }).map((_, i) => {
        const x = (i * 73) % 100;
        const delay = (i * 0.15) % 2;
        return (
          <div key={i} style={{
            position: 'absolute', left: `${x}%`, bottom: '10%',
            width: 8, height: 8, borderRadius: '50%',
            background: '#FFE9A8',
            animation: `sparkle-rise 2.2s ${delay}s infinite ease-out`,
          }} />
        );
      })}

      {/* label */}
      <div style={{
        fontSize: 13, letterSpacing: '0.3em', textTransform: 'uppercase',
        color: monster.secondary, fontWeight: 800, marginBottom: 14, opacity: 0.9,
      }}>
        {kind === 'caught'  && '✦ new discovery ✦'}
        {kind === 'levelup' && '+ level up +'}
        {kind === 'evolve'  && '✦ ✦ evolving ✦ ✦'}
        {kind === 'mega'    && '★ ★ ★ MEGA FORM ★ ★ ★'}
      </div>

      {/* monster art with aura */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <div style={{
          position: 'absolute', inset: -30, borderRadius: '50%',
          background: `radial-gradient(circle, ${monster.secondary}55 0%, transparent 70%)`,
          animation: 'aura-pulse 2s ease-in-out infinite',
        }} />
        <div style={{ position: 'relative', animation: 'monster-pop 0.8s cubic-bezier(.3,1.4,.5,1) both' }}>
          <MonsterArt monster={monster} stage={stage} size={240} />
        </div>
      </div>

      <h1 style={{
        margin: 0, fontFamily: TOKENS.fontSerif, fontWeight: 800,
        fontSize: 44, letterSpacing: '-0.02em', textAlign: 'center',
      }}>{title}</h1>
      <p style={{
        margin: '10px 0 4px', fontSize: 18, opacity: 0.9, textAlign: 'center',
        maxWidth: 520, padding: '0 20px', lineHeight: 1.4,
      }}>{sub}</p>
      <p style={{
        margin: '4px 0 28px', fontSize: 14, opacity: 0.7,
      }}>
        {mastered} / 100 words mastered · Level {level}
      </p>

      <button onClick={onClose} style={{
        padding: '14px 32px', borderRadius: 999,
        border: 'none', cursor: 'pointer',
        background: monster.secondary, color: monster.primary,
        fontFamily: TOKENS.fontSans, fontSize: 16, fontWeight: 800,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      }}>
        {kind === 'mega' ? "Incredible!" : "Continue"}
      </button>
    </div>
  );
}

window.MonsterOverlay = MonsterOverlay;
