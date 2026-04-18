// Shared UI primitives. These match 1:1 to components you'd build in Next.js.

function Panel({ children, style, title, eyebrow, action, soft, padded = true }) {
  return (
    <section style={{
      background: soft ? TOKENS.panelSoft : TOKENS.panel,
      border: `1px solid ${TOKENS.line}`,
      borderRadius: TOKENS.radius,
      boxShadow: TOKENS.shadow,
      padding: padded ? 22 : 0,
      ...style,
    }}>
      {(title || eyebrow || action) && (
        <header style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 16, marginBottom: padded ? 16 : 0,
        }}>
          <div>
            {eyebrow && <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: TOKENS.muted, marginBottom: 4,
            }}>{eyebrow}</div>}
            {title && <h2 style={{
              margin: 0, fontSize: 18, fontWeight: 700, color: TOKENS.ink,
              fontFamily: TOKENS.fontSans, letterSpacing: '-0.01em',
            }}>{title}</h2>}
          </div>
          {action && <div>{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

function Btn({ variant = 'primary', icon, iconRight, children, accent, onClick, size = 'md', disabled, style, title }) {
  const accentColor = accent || TOKENS.ink;
  const sizes = {
    sm: { pad: '7px 12px', font: 13, iconSize: 14, height: 32 },
    md: { pad: '10px 16px', font: 14, iconSize: 16, height: 40 },
    lg: { pad: '13px 20px', font: 15, iconSize: 18, height: 48 },
  }[size];

  const variants = {
    primary: {
      background: accentColor, color: '#fff',
      border: `1px solid ${accentColor}`,
      fontWeight: 700,
    },
    secondary: {
      background: TOKENS.panel, color: TOKENS.ink,
      border: `1px solid ${TOKENS.line}`,
      fontWeight: 600,
    },
    ghost: {
      background: 'transparent', color: TOKENS.ink2,
      border: '1px solid transparent',
      fontWeight: 600,
    },
    accent: {
      background: 'transparent', color: accentColor,
      border: `1.5px solid ${accentColor}`,
      fontWeight: 700,
    },
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: sizes.pad, height: sizes.height,
        fontFamily: TOKENS.fontSans, fontSize: sizes.font,
        borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 0.08s ease, box-shadow 0.15s ease, background 0.15s ease',
        whiteSpace: 'nowrap',
        ...variants, ...style,
      }}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = 'translateY(1px)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'translateY(0)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {icon && <Icon name={icon} size={sizes.iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={sizes.iconSize} />}
    </button>
  );
}

function Chip({ children, tone = 'neutral', icon, style }) {
  const tones = {
    neutral: { bg: TOKENS.lineSoft, fg: TOKENS.ink2, bd: TOKENS.line },
    good:    { bg: TOKENS.goodSoft, fg: TOKENS.good, bd: '#B9E3CC' },
    warn:    { bg: TOKENS.warnSoft, fg: TOKENS.warn, bd: '#F0D8A8' },
    bad:     { bg: TOKENS.badSoft,  fg: TOKENS.bad,  bd: '#F3C4C1' },
    accent:  { bg: style?.accentTint || TOKENS.lineSoft, fg: style?.accent || TOKENS.ink, bd: 'transparent' },
  }[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      background: tones.bg, color: tones.fg, border: `1px solid ${tones.bd}`,
      fontSize: 12, fontWeight: 700, letterSpacing: '0.01em',
      fontFamily: TOKENS.fontSans,
      ...style,
    }}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

function Stat({ label, value, tone, small, accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      padding: small ? '10px 12px' : '14px 16px',
      background: TOKENS.panelSoft,
      border: `1px solid ${TOKENS.line}`,
      borderRadius: TOKENS.radiusSm,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: TOKENS.muted, marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: small ? 20 : 26, fontWeight: 800,
        fontFamily: TOKENS.fontSerif,
        color: tone === 'accent' ? (accent || TOKENS.ink) : TOKENS.ink,
        lineHeight: 1,
      }}>{value}</div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }}>
      <span style={{
        fontSize: 12, fontWeight: 700, color: TOKENS.ink2,
        letterSpacing: '0.02em',
      }}>{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options, accent }) {
  return (
    <select
      value={value}
      onChange={e => onChange && onChange(e.target.value)}
      style={{
        appearance: 'none',
        padding: '10px 34px 10px 12px',
        background: `${TOKENS.panel} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237a8697' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") no-repeat right 12px center`,
        border: `1px solid ${TOKENS.line}`,
        borderRadius: 12,
        fontFamily: TOKENS.fontSans, fontSize: 14,
        color: TOKENS.ink, cursor: 'pointer',
        minHeight: 40,
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ProgressBar({ value, max = 100, accent = TOKENS.ink, height = 8 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{
      width: '100%', height, background: TOKENS.lineSoft,
      borderRadius: height, overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: accent,
        borderRadius: height, transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

function Divider({ vertical, style }) {
  return (
    <div style={{
      background: TOKENS.line,
      width: vertical ? 1 : '100%',
      height: vertical ? '100%' : 1,
      ...style,
    }} />
  );
}

Object.assign(window, { Panel, Btn, Chip, Stat, Field, Select, ProgressBar, Divider });
