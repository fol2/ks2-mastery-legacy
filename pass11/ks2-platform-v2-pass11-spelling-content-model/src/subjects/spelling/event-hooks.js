import { recordMonsterMastery } from '../../platform/game/monster-system.js';
import { SPELLING_EVENT_TYPES } from './events.js';

function monsterIdForYearBand(yearBand) {
  return yearBand === '5-6' ? 'glimmerbug' : 'inklet';
}

export function createSpellingRewardSubscriber({ gameStateRepository } = {}) {
  return function spellingRewardSubscriber(events = []) {
    const rewardEvents = [];

    for (const event of Array.isArray(events) ? events : []) {
      if (!event || event.type !== SPELLING_EVENT_TYPES.WORD_SECURED) continue;
      rewardEvents.push(
        ...recordMonsterMastery(
          event.learnerId,
          monsterIdForYearBand(event.yearBand),
          event.wordSlug,
          gameStateRepository,
        ),
      );
    }

    return rewardEvents;
  };
}

export function rewardEventsFromSpellingEvents(events, { gameStateRepository } = {}) {
  return createSpellingRewardSubscriber({ gameStateRepository })(events);
}
