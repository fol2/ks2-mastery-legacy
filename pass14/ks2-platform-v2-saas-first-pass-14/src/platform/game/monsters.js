export const MONSTERS = {
  inklet: {
    id: 'inklet',
    name: 'Inklet',
    blurb: 'Grows as Year 3-4 spellings become secure.',
    accent: '#3E6FA8',
  },
  glimmerbug: {
    id: 'glimmerbug',
    name: 'Glimmerbug',
    blurb: 'Appears as Year 5-6 spellings settle into memory.',
    accent: '#B43CD9',
  },
  phaeton: {
    id: 'phaeton',
    name: 'Phaeton',
    blurb: 'The aggregate creature that rises when both spelling pools grow strong.',
    accent: '#D08A2C',
  },
};

export const MONSTERS_BY_SUBJECT = {
  spelling: ['inklet', 'glimmerbug', 'phaeton'],
};

export function stageFor(mastered) {
  if (mastered >= 90) return 4;
  if (mastered >= 60) return 3;
  if (mastered >= 30) return 2;
  if (mastered >= 10) return 1;
  return 0;
}

export function levelFor(mastered) {
  return Math.min(10, Math.floor(mastered / 10));
}

export function monsterAsset(monsterId, stage) {
  const safeStage = Math.max(0, Math.min(4, Number(stage) || 0));
  return `./assets/monsters/${monsterId}-${safeStage}.320.webp`;
}
