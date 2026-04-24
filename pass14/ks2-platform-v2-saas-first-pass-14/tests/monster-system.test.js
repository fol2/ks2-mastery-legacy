import test from 'node:test';
import assert from 'node:assert/strict';

import { derivePhaeton, progressForMonster } from '../src/platform/game/monster-system.js';

function masteredWords(count, prefix = 'word') {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

test('direct spelling monsters evolve at 10, 30, 60 and 90 secure words', () => {
  const cases = [
    [0, 0],
    [9, 0],
    [10, 1],
    [29, 1],
    [30, 2],
    [59, 2],
    [60, 3],
    [89, 3],
    [90, 4],
  ];

  for (const [secureWords, expectedStage] of cases) {
    const state = {
      inklet: {
        caught: secureWords > 0,
        mastered: masteredWords(secureWords),
      },
    };

    assert.equal(progressForMonster(state, 'inklet').stage, expectedStage, `${secureWords} secure words`);
  }
});

test('Phaeton evolves from combined secure spelling words without requiring both pools', () => {
  const cases = [
    [{ inklet: 24, glimmerbug: 0 }, 0],
    [{ inklet: 25, glimmerbug: 0 }, 1],
    [{ inklet: 94, glimmerbug: 0 }, 1],
    [{ inklet: 95, glimmerbug: 0 }, 2],
    [{ inklet: 144, glimmerbug: 0 }, 2],
    [{ inklet: 145, glimmerbug: 0 }, 3],
    [{ inklet: 199, glimmerbug: 0 }, 3],
    [{ inklet: 200, glimmerbug: 0 }, 4],
  ];

  for (const [{ inklet, glimmerbug }, expectedStage] of cases) {
    const state = {
      inklet: { caught: inklet > 0, mastered: masteredWords(inklet, 'inklet') },
      glimmerbug: { caught: glimmerbug > 0, mastered: masteredWords(glimmerbug, 'glimmerbug') },
    };
    const combined = inklet + glimmerbug;

    assert.equal(derivePhaeton(state).stage, expectedStage, `${combined} combined secure words`);
  }
});
