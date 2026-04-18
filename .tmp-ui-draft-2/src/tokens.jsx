// Design tokens — the shared visual language.
// When porting to Next.js: drop these into a Tailwind theme config or CSS variables.

const TOKENS = {
  // Neutral surface
  bg: '#F6F5F1',          // warm off-white page background
  panel: '#FFFFFF',
  panelSoft: '#FAF9F4',
  ink: '#1D2B3A',         // primary text — warm navy
  ink2: '#3B4A5C',        // secondary text
  muted: '#7A8697',       // tertiary text / labels
  line: '#E5E1D6',        // warm dividers
  lineSoft: '#EFEBE0',

  // States (semantic)
  good: '#2F9E6A',
  goodSoft: '#E4F5EC',
  warn: '#D08A2C',
  warnSoft: '#FBEFD9',
  bad: '#D25757',
  badSoft: '#FCE5E3',

  // Type
  fontSans: '"Nunito", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  fontSerif: '"Fraunces", Georgia, serif',
  fontMono: '"JetBrains Mono", ui-monospace, monospace',

  // Shape
  radius: 20,
  radiusSm: 12,
  radiusLg: 28,
  shadow: '0 1px 2px rgba(29,43,58,0.04), 0 8px 24px rgba(29,43,58,0.06)',
  shadowLg: '0 2px 4px rgba(29,43,58,0.05), 0 16px 40px rgba(29,43,58,0.10)',
};

// Each subject gets its own accent — shared shell, distinct identity.
// Colours are grown-up but warm; icons are hand-drawn monoline glyphs.
const SUBJECTS = {
  spelling: {
    id: 'spelling',
    name: 'Spelling',
    blurb: 'Learn tricky words by sound, sight and meaning.',
    accent: '#3E6FA8',       // inky blue
    accentSoft: '#DCE6F3',
    accentTint: '#EEF3FA',
    icon: 'pen',
  },
  arithmetic: {
    id: 'arithmetic',
    name: 'Arithmetic',
    blurb: 'Build speed and fluency with the four operations.',
    accent: '#C06B3E',       // terracotta
    accentSoft: '#F5DDCE',
    accentTint: '#FBEEE4',
    icon: 'plus',
  },
  reasoning: {
    id: 'reasoning',
    name: 'Reasoning',
    blurb: 'Multi‑step maths: plan, work it out, check.',
    accent: '#8A5A9D',       // heather
    accentSoft: '#E6D9ED',
    accentTint: '#F1E9F4',
    icon: 'brain',
  },
  grammar: {
    id: 'grammar',
    name: 'Grammar',
    blurb: 'Word classes, clauses, tenses & sentence shape.',
    accent: '#2E8479',       // teal
    accentSoft: '#CFE8E3',
    accentTint: '#E3F1EE',
    icon: 'speech',
  },
  punctuation: {
    id: 'punctuation',
    name: 'Punctuation',
    blurb: 'Commas, apostrophes, speech marks & more.',
    accent: '#B8873F',       // amber ochre
    accentSoft: '#F0E1C4',
    accentTint: '#F7EEDC',
    icon: 'quote',
  },
  reading: {
    id: 'reading',
    name: 'Reading',
    blurb: 'Retrieve, infer and explain from passages.',
    accent: '#4B7A4A',       // moss green
    accentSoft: '#D9E7D7',
    accentTint: '#E8F0E6',
    icon: 'book',
  },
};

const SUBJECT_ORDER = ['spelling', 'arithmetic', 'reasoning', 'grammar', 'punctuation', 'reading'];

// Vivid variant — punchier saturated accents for the 'vivid' accent style.
const SUBJECTS_VIVID = {
  spelling:    { ...SUBJECTS.spelling,    accent: '#2E5CFF', accentSoft: '#CFDAFF', accentTint: '#E8EEFF' },
  arithmetic:  { ...SUBJECTS.arithmetic,  accent: '#F0541E', accentSoft: '#FCD2C0', accentTint: '#FFE7DC' },
  reasoning:   { ...SUBJECTS.reasoning,   accent: '#B43CD9', accentSoft: '#ECCBF5', accentTint: '#F6E4FB' },
  grammar:     { ...SUBJECTS.grammar,     accent: '#00A890', accentSoft: '#BAE9DF', accentTint: '#D6F2EB' },
  punctuation: { ...SUBJECTS.punctuation, accent: '#E0A31F', accentSoft: '#F7DFAA', accentTint: '#FCEFCB' },
  reading:     { ...SUBJECTS.reading,     accent: '#2FB14A', accentSoft: '#C6E8CB', accentTint: '#DEF2E1' },
};

function getSubjects(style) {
  return style === 'vivid' ? SUBJECTS_VIVID : SUBJECTS;
}

Object.assign(window, { TOKENS, SUBJECTS, SUBJECTS_VIVID, SUBJECT_ORDER, getSubjects });
