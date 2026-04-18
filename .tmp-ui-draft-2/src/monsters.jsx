// Monster catalog — 5 stages each. Stage 0=egg, 1=baby, 2=teen, 3=adult, 4=mega.
// Each subject has 1..N monsters tied to word-pools / skill-groups.
// Mastery = unique words / skills at engine "secure" stage (spelling: stage >= 4).
// 10 mastered = catch. Every +10 = level. 50 = evolve to teen. 80 = evolve to adult. 100 = mega.

// Drawn inline as hand-crafted SVGs — monoline + flat fill, no gradients-to-nowhere.
// Each stage gets more detail, richer body, new features.

const MONSTER_STAGES = [
  { id: 0, label: 'Egg',    threshold: 0,   needed: 10 },
  { id: 1, label: 'Baby',   threshold: 10,  needed: 50 },  // Level 1-4
  { id: 2, label: 'Teen',   threshold: 50,  needed: 80 },  // Level 5-7
  { id: 3, label: 'Adult',  threshold: 80,  needed: 100 }, // Level 8-9
  { id: 4, label: 'Mega',   threshold: 100, needed: 100 }, // max
];

// Stage from mastered count
function stageFor(mastered) {
  if (mastered >= 100) return 4;
  if (mastered >= 80)  return 3;
  if (mastered >= 50)  return 2;
  if (mastered >= 10)  return 1;
  return 0;
}
// Level 0-10 inside the journey (cosmetic)
function levelFor(mastered) {
  return Math.min(10, Math.floor(mastered / 10));
}

// ----- Monster art -----
// Each monster has 5 stages of inline SVG. Hand-made, not generated.

// ====== SPELLING · INKLET (Y3-4) — quill/bookworm theme, deep ink blue ======
const INKLET = {
  id: 'inklet',
  name: 'Inklet',
  nameByStage: ['Inklet Egg', 'Inklet', 'Scribbla', 'Quillorn', 'Mega Quillorn'],
  subjectId: 'spelling',
  pool: 'y3-4',
  subtitle: 'Year 3–4 word list',
  primary: '#3E6FA8',
  secondary: '#9FC1E8',
  pale: '#E8F0FA',
  // SVG art — each returns JSX
  art: {
    0: (size) => (
      // Egg — inky blue with quill-feather pattern
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <ellipse cx="60" cy="66" rx="36" ry="44" fill="#3E6FA8"/>
        <ellipse cx="52" cy="54" rx="8" ry="12" fill="#6C94C2" opacity="0.5"/>
        <path d="M42 56 q6 -10 14 -4" stroke="#1F4470" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M66 62 q6 -8 12 -2" stroke="#1F4470" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M50 86 q8 -6 16 0" stroke="#1F4470" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M38 68 q10 -4 12 4 q4 -8 14 -2 q4 -8 14 0" stroke="#FFFFFF" strokeWidth="1.5" fill="none" opacity="0.4"/>
        {/* tiny crack */}
        <path d="M56 40 L60 46 L56 50 L62 55" stroke="#1F4470" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    1: (size) => (
      // Baby — small round blob with quill-tail and one big eye
      <svg viewBox="0 0 120 120" width={size} height={size}>
        {/* tail quill */}
        <path d="M92 74 q12 -14 20 -8 q-6 6 -18 14" fill="#9FC1E8" stroke="#1F4470" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M94 72 l14 -8 M96 78 l14 -6 M98 84 l12 -4" stroke="#3E6FA8" strokeWidth="1.2"/>
        {/* body */}
        <ellipse cx="58" cy="72" rx="34" ry="30" fill="#3E6FA8"/>
        <ellipse cx="50" cy="66" rx="10" ry="8" fill="#6C94C2" opacity="0.55"/>
        {/* feet */}
        <ellipse cx="44" cy="100" rx="8" ry="4" fill="#1F4470"/>
        <ellipse cx="68" cy="100" rx="8" ry="4" fill="#1F4470"/>
        {/* big eye */}
        <circle cx="64" cy="68" r="12" fill="#fff"/>
        <circle cx="66" cy="70" r="7" fill="#1F4470"/>
        <circle cx="68" cy="68" r="2.2" fill="#fff"/>
        {/* smaller eye */}
        <circle cx="44" cy="70" r="6" fill="#fff"/>
        <circle cx="45" cy="71" r="3" fill="#1F4470"/>
        {/* mouth */}
        <path d="M50 84 q6 4 14 0" stroke="#1F4470" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    2: (size) => (
      // Teen — stands upright, quill tufts, holding a tiny scroll
      <svg viewBox="0 0 120 120" width={size} height={size}>
        {/* quill tufts on head */}
        <path d="M46 22 q4 -14 12 -10 q-2 8 -6 18" fill="#9FC1E8" stroke="#1F4470" strokeWidth="2"/>
        <path d="M70 22 q4 -14 12 -10 q-2 8 -6 18" fill="#6C94C2" stroke="#1F4470" strokeWidth="2"/>
        {/* body */}
        <path d="M30 64 q0 -28 30 -28 q30 0 30 28 v28 q0 8 -8 8 h-44 q-8 0 -8 -8 Z" fill="#3E6FA8"/>
        <path d="M44 56 q16 -10 32 0 q-2 8 -16 8 q-14 0 -16 -8 Z" fill="#6C94C2" opacity="0.45"/>
        {/* feet */}
        <ellipse cx="42" cy="104" rx="10" ry="5" fill="#1F4470"/>
        <ellipse cx="78" cy="104" rx="10" ry="5" fill="#1F4470"/>
        {/* scroll in hand */}
        <rect x="86" y="66" width="10" height="16" rx="3" fill="#F4E9CC" stroke="#1F4470" strokeWidth="2"/>
        <path d="M88 70 h6 M88 74 h6" stroke="#3E6FA8" strokeWidth="1.2"/>
        {/* arms */}
        <path d="M32 64 q-6 6 -2 16" stroke="#3E6FA8" strokeWidth="8" fill="none" strokeLinecap="round"/>
        <path d="M88 64 q8 0 4 12" stroke="#3E6FA8" strokeWidth="8" fill="none" strokeLinecap="round"/>
        {/* eyes */}
        <circle cx="50" cy="62" r="5.5" fill="#fff"/>
        <circle cx="51" cy="63" r="3" fill="#1F4470"/>
        <circle cx="70" cy="62" r="5.5" fill="#fff"/>
        <circle cx="71" cy="63" r="3" fill="#1F4470"/>
        {/* mouth */}
        <path d="M54 76 q6 4 12 0" stroke="#1F4470" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    3: (size) => (
      // Adult — taller, robed, full crown of quills, glowing ink spot
      <svg viewBox="0 0 120 120" width={size} height={size}>
        {/* crown of quills */}
        <path d="M36 28 q4 -18 12 -12 M50 20 q0 -18 10 -14 M70 20 q0 -18 10 -14 M72 28 q4 -18 12 -12"
              fill="none" stroke="#1F4470" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M36 28 q4 -18 12 -12" fill="#9FC1E8" stroke="#1F4470" strokeWidth="2"/>
        <path d="M50 18 q2 -14 10 -12 q1 10 -2 20" fill="#6C94C2" stroke="#1F4470" strokeWidth="2"/>
        <path d="M70 20 q2 -14 10 -12 q1 10 -2 20" fill="#6C94C2" stroke="#1F4470" strokeWidth="2"/>
        <path d="M84 30 q4 -14 10 -8" fill="#9FC1E8" stroke="#1F4470" strokeWidth="2"/>
        {/* robe body */}
        <path d="M26 70 q0 -34 34 -34 q34 0 34 34 l6 36 q-16 6 -40 6 q-24 0 -40 -6 Z" fill="#3E6FA8"/>
        {/* robe collar */}
        <path d="M40 60 q20 -14 40 0 q-4 8 -20 8 q-16 0 -20 -8" fill="#1F4470"/>
        {/* glowing ink orb */}
        <circle cx="60" cy="82" r="10" fill="#FFD88A" opacity="0.3"/>
        <circle cx="60" cy="82" r="6" fill="#FFD88A"/>
        <circle cx="58" cy="80" r="2" fill="#fff"/>
        {/* sleeves */}
        <path d="M26 70 q-10 10 -6 28" stroke="#3E6FA8" strokeWidth="10" fill="none" strokeLinecap="round"/>
        <path d="M94 70 q10 10 6 28" stroke="#3E6FA8" strokeWidth="10" fill="none" strokeLinecap="round"/>
        {/* eyes */}
        <circle cx="50" cy="56" r="5" fill="#fff"/>
        <circle cx="51" cy="57" r="3" fill="#1F4470"/>
        <circle cx="70" cy="56" r="5" fill="#fff"/>
        <circle cx="71" cy="57" r="3" fill="#1F4470"/>
        {/* mouth */}
        <path d="M54 70 q6 4 12 0" stroke="#1F4470" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    4: (size) => (
      // Mega — wings of quills, glowing aura, regal robe
      <svg viewBox="0 0 120 120" width={size} height={size}>
        {/* aura */}
        <circle cx="60" cy="60" r="56" fill="#FFD88A" opacity="0.2"/>
        <circle cx="60" cy="60" r="44" fill="#FFD88A" opacity="0.25"/>
        {/* wings of quills */}
        <path d="M28 54 q-22 -8 -24 12 q16 -4 26 6 Z" fill="#9FC1E8" stroke="#1F4470" strokeWidth="2"/>
        <path d="M92 54 q22 -8 24 12 q-16 -4 -26 6 Z" fill="#9FC1E8" stroke="#1F4470" strokeWidth="2"/>
        <path d="M6 62 L24 62 M6 68 L24 66 M8 74 L26 70" stroke="#1F4470" strokeWidth="1.3"/>
        <path d="M114 62 L96 62 M114 68 L96 66 M112 74 L94 70" stroke="#1F4470" strokeWidth="1.3"/>
        {/* crown */}
        <path d="M38 22 L48 8 L54 22 L60 6 L66 22 L72 8 L82 22 Z" fill="#FFD88A" stroke="#1F4470" strokeWidth="2"/>
        <circle cx="60" cy="14" r="3" fill="#D25757"/>
        {/* robe body */}
        <path d="M28 68 q0 -32 32 -32 q32 0 32 32 l6 36 q-16 6 -38 6 q-22 0 -38 -6 Z" fill="#3E6FA8"/>
        <path d="M40 58 q20 -14 40 0 q-4 8 -20 8 q-16 0 -20 -8" fill="#1F4470"/>
        {/* chest orb */}
        <circle cx="60" cy="80" r="12" fill="#FFD88A" opacity="0.4"/>
        <circle cx="60" cy="80" r="8" fill="#FFD88A"/>
        <circle cx="57" cy="77" r="2.5" fill="#fff"/>
        {/* eyes — fiercer, half lidded */}
        <path d="M44 50 q6 -4 12 0" stroke="#1F4470" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <path d="M64 50 q6 -4 12 0" stroke="#1F4470" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <circle cx="50" cy="54" r="3" fill="#1F4470"/>
        <circle cx="70" cy="54" r="3" fill="#1F4470"/>
        {/* mouth */}
        <path d="M52 66 q8 6 16 0" stroke="#1F4470" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* sparkles */}
        <path d="M14 30 l2 -4 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 Z" fill="#FFD88A"/>
        <path d="M104 98 l1.5 -3 l1.5 3 l3 1.5 l-3 1.5 l-1.5 3 l-1.5 -3 l-3 -1.5 Z" fill="#FFD88A"/>
      </svg>
    ),
  },
};

// ====== SPELLING · GLIMMERBUG (Y5-6) — firefly/lantern theme, magenta-rose ======
const GLIMMERBUG = {
  id: 'glimmerbug',
  name: 'Glimmerbug',
  nameByStage: ['Glimmer Egg', 'Glimmerbug', 'Lumisprite', 'Lanternwing', 'Mega Lanternwing'],
  subjectId: 'spelling',
  pool: 'y5-6',
  subtitle: 'Year 5–6 word list',
  primary: '#B53F87',
  secondary: '#EAB3D7',
  pale: '#F8E7F1',
  art: {
    0: (size) => (
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <ellipse cx="60" cy="66" rx="34" ry="42" fill="#B53F87"/>
        <ellipse cx="50" cy="54" rx="8" ry="12" fill="#EAB3D7" opacity="0.6"/>
        {/* glow dots */}
        <circle cx="46" cy="76" r="3" fill="#FFE9A8" opacity="0.8"/>
        <circle cx="70" cy="82" r="4" fill="#FFE9A8" opacity="0.8"/>
        <circle cx="58" cy="64" r="2.5" fill="#FFE9A8" opacity="0.8"/>
        <path d="M54 42 L58 48 L54 52 L60 58" stroke="#7A2D5A" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    1: (size) => (
      // Baby — round bug with little wings and glowing tail
      <svg viewBox="0 0 120 120" width={size} height={size}>
        {/* wings behind */}
        <ellipse cx="34" cy="60" rx="14" ry="20" fill="#EAB3D7" opacity="0.85" stroke="#7A2D5A" strokeWidth="2"/>
        <ellipse cx="86" cy="60" rx="14" ry="20" fill="#EAB3D7" opacity="0.85" stroke="#7A2D5A" strokeWidth="2"/>
        {/* body */}
        <ellipse cx="60" cy="72" rx="28" ry="26" fill="#B53F87"/>
        {/* stripes */}
        <path d="M42 78 q18 8 36 0" stroke="#7A2D5A" strokeWidth="2" fill="none"/>
        <path d="M44 86 q16 6 32 0" stroke="#7A2D5A" strokeWidth="2" fill="none"/>
        {/* glow belly */}
        <circle cx="60" cy="92" r="7" fill="#FFE9A8" opacity="0.5"/>
        <circle cx="60" cy="92" r="4" fill="#FFE9A8"/>
        {/* antennae */}
        <path d="M52 48 q-4 -12 -10 -12" stroke="#7A2D5A" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M68 48 q4 -12 10 -12" stroke="#7A2D5A" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="42" cy="36" r="2.5" fill="#FFE9A8"/>
        <circle cx="78" cy="36" r="2.5" fill="#FFE9A8"/>
        {/* eyes */}
        <circle cx="50" cy="64" r="5" fill="#fff"/>
        <circle cx="51" cy="65" r="3" fill="#1F2036"/>
        <circle cx="70" cy="64" r="5" fill="#fff"/>
        <circle cx="71" cy="65" r="3" fill="#1F2036"/>
        <path d="M54 76 q6 4 12 0" stroke="#7A2D5A" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    2: (size) => (
      // Teen — more insectile, bigger wings, holding lantern
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <ellipse cx="26" cy="52" rx="20" ry="28" fill="#EAB3D7" opacity="0.85" stroke="#7A2D5A" strokeWidth="2" transform="rotate(-18 26 52)"/>
        <ellipse cx="94" cy="52" rx="20" ry="28" fill="#EAB3D7" opacity="0.85" stroke="#7A2D5A" strokeWidth="2" transform="rotate(18 94 52)"/>
        {/* body */}
        <path d="M36 62 q0 -24 24 -24 q24 0 24 24 v24 q0 10 -24 10 q-24 0 -24 -10 Z" fill="#B53F87"/>
        <path d="M40 66 q20 -8 40 0" stroke="#7A2D5A" strokeWidth="2" fill="none"/>
        <path d="M42 78 q18 -6 36 0" stroke="#7A2D5A" strokeWidth="2" fill="none"/>
        {/* legs */}
        <path d="M38 86 l-6 10 M60 94 l0 8 M82 86 l6 10" stroke="#7A2D5A" strokeWidth="2.5" strokeLinecap="round"/>
        {/* lantern */}
        <circle cx="86" cy="78" r="9" fill="#FFE9A8"/>
        <circle cx="86" cy="78" r="5" fill="#FFD26B"/>
        <path d="M86 68 v-6 M82 70 l-4 -4 M90 70 l4 -4" stroke="#FFD26B" strokeWidth="2" strokeLinecap="round"/>
        {/* antennae */}
        <path d="M50 40 q-2 -14 -10 -16" stroke="#7A2D5A" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M70 40 q2 -14 10 -16" stroke="#7A2D5A" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="40" cy="24" r="3" fill="#FFE9A8"/>
        <circle cx="80" cy="24" r="3" fill="#FFE9A8"/>
        {/* eyes */}
        <circle cx="50" cy="54" r="5" fill="#fff"/>
        <circle cx="51" cy="55" r="3" fill="#1F2036"/>
        <circle cx="70" cy="54" r="5" fill="#fff"/>
        <circle cx="71" cy="55" r="3" fill="#1F2036"/>
        <path d="M54 68 q6 4 12 0" stroke="#7A2D5A" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    3: (size) => (
      // Adult — graceful, large wings, glowing aura
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="62" r="50" fill="#FFE9A8" opacity="0.18"/>
        {/* wings */}
        <path d="M36 60 q-32 -14 -34 10 q-2 14 10 20 q12 -14 26 -20" fill="#EAB3D7" stroke="#7A2D5A" strokeWidth="2"/>
        <path d="M84 60 q32 -14 34 10 q2 14 -10 20 q-12 -14 -26 -20" fill="#EAB3D7" stroke="#7A2D5A" strokeWidth="2"/>
        <path d="M6 70 q8 -4 22 -2 M6 80 q8 2 20 6" stroke="#7A2D5A" strokeWidth="1.4" fill="none"/>
        <path d="M114 70 q-8 -4 -22 -2 M114 80 q-8 2 -20 6" stroke="#7A2D5A" strokeWidth="1.4" fill="none"/>
        {/* body */}
        <path d="M40 58 q0 -22 20 -22 q20 0 20 22 v30 q0 8 -20 8 q-20 0 -20 -8 Z" fill="#B53F87"/>
        <path d="M44 66 q16 -6 32 0" stroke="#7A2D5A" strokeWidth="2" fill="none"/>
        <path d="M46 76 q14 -4 28 0" stroke="#7A2D5A" strokeWidth="2" fill="none"/>
        {/* glow belly */}
        <circle cx="60" cy="86" r="10" fill="#FFE9A8" opacity="0.6"/>
        <circle cx="60" cy="86" r="6" fill="#FFE9A8"/>
        <circle cx="58" cy="84" r="2" fill="#fff"/>
        {/* antennae with orbs */}
        <path d="M50 40 q-4 -18 -12 -20" stroke="#7A2D5A" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M70 40 q4 -18 12 -20" stroke="#7A2D5A" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <circle cx="38" cy="20" r="4" fill="#FFE9A8"/>
        <circle cx="82" cy="20" r="4" fill="#FFE9A8"/>
        {/* eyes */}
        <circle cx="50" cy="54" r="5" fill="#fff"/>
        <circle cx="51" cy="55" r="3" fill="#1F2036"/>
        <circle cx="70" cy="54" r="5" fill="#fff"/>
        <circle cx="71" cy="55" r="3" fill="#1F2036"/>
        <path d="M54 68 q6 4 12 0" stroke="#7A2D5A" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    4: (size) => (
      // Mega — huge wings, radiant aura, crown-of-light
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="60" r="58" fill="#FFE9A8" opacity="0.22"/>
        <circle cx="60" cy="60" r="46" fill="#FFE9A8" opacity="0.3"/>
        {/* double wings */}
        <path d="M38 58 q-38 -18 -38 14 q0 16 14 22 q14 -16 28 -20" fill="#EAB3D7" stroke="#7A2D5A" strokeWidth="2"/>
        <path d="M34 72 q-30 -2 -32 20 q10 6 22 2 q2 -10 12 -16" fill="#F3D3E7" stroke="#7A2D5A" strokeWidth="2"/>
        <path d="M82 58 q38 -18 38 14 q0 16 -14 22 q-14 -16 -28 -20" fill="#EAB3D7" stroke="#7A2D5A" strokeWidth="2"/>
        <path d="M86 72 q30 -2 32 20 q-10 6 -22 2 q-2 -10 -12 -16" fill="#F3D3E7" stroke="#7A2D5A" strokeWidth="2"/>
        {/* crown of light */}
        <path d="M42 24 L50 10 L54 22 L60 6 L66 22 L70 10 L78 24 Z" fill="#FFE9A8" stroke="#7A2D5A" strokeWidth="2"/>
        <circle cx="60" cy="14" r="3" fill="#B53F87"/>
        {/* body */}
        <path d="M40 60 q0 -20 20 -20 q20 0 20 20 v30 q0 8 -20 8 q-20 0 -20 -8 Z" fill="#B53F87"/>
        <path d="M44 68 q16 -6 32 0 M46 78 q14 -4 28 0" stroke="#7A2D5A" strokeWidth="2" fill="none"/>
        {/* giant glow belly */}
        <circle cx="60" cy="88" r="14" fill="#FFE9A8" opacity="0.5"/>
        <circle cx="60" cy="88" r="9" fill="#FFE9A8"/>
        <circle cx="57" cy="85" r="3" fill="#fff"/>
        {/* fierce eyes */}
        <path d="M44 50 q6 -4 12 0" stroke="#1F2036" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <path d="M64 50 q6 -4 12 0" stroke="#1F2036" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <circle cx="50" cy="54" r="3" fill="#1F2036"/>
        <circle cx="70" cy="54" r="3" fill="#1F2036"/>
        <path d="M52 68 q8 6 16 0" stroke="#7A2D5A" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* floating sparkles */}
        <circle cx="16" cy="24" r="3" fill="#FFE9A8"/>
        <circle cx="104" cy="32" r="2.5" fill="#FFE9A8"/>
        <circle cx="108" cy="100" r="3" fill="#FFE9A8"/>
        <circle cx="12" cy="98" r="2" fill="#FFE9A8"/>
      </svg>
    ),
  },
};

// ----- Registry -----
const MONSTERS = {
  inklet: INKLET,
  glimmerbug: GLIMMERBUG,
};

// Monsters listed per subject (in order). Stubs for non-spelling — coming soon.
const MONSTERS_BY_SUBJECT = {
  spelling:    ['inklet', 'glimmerbug'],
  arithmetic:  [],
  reasoning:   [],
  grammar:     [],
  punctuation: [],
  reading:     [],
};

// ----- Small art helper: draws a silhouette version of a monster (for "not yet caught") -----
function MonsterArt({ monster, stage, size = 120, silhouette = false }) {
  const art = monster.art[stage] ? monster.art[stage](size) : monster.art[0](size);
  if (!silhouette) return art;
  return (
    <div style={{
      width: size, height: size, position: 'relative',
      filter: 'brightness(0.1) opacity(0.35)',
    }}>{art}</div>
  );
}

Object.assign(window, {
  MONSTERS, MONSTERS_BY_SUBJECT, MONSTER_STAGES,
  stageFor, levelFor, MonsterArt,
});
