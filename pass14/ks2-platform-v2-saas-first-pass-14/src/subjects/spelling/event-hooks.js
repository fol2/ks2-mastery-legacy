import { monsterIdForSpellingYearBand, recordMonsterMastery } from '../../platform/game/monster-system.js';
import { SPELLING_EVENT_TYPES } from './events.js';

export function createSpellingRewardSubscriber({ gameStateRepository } = {}) {
  return function spellingRewardSubscriber(events = []) {
    const rewardEvents = [];

    for (const event of Array.isArray(events) ? events : []) {
      if (!event || event.type !== SPELLING_EVENT_TYPES.WORD_SECURED) continue;
      rewardEvents.push(
        ...recordMonsterMastery(
          event.learnerId,
          monsterIdForSpellingYearBand(event.yearBand),
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
