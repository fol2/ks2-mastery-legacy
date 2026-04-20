const DEFAULT_STREAK_MILESTONES = Object.freeze([3, 7, 14, 30]);

function utcDayKey(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function dayDiff(start, end) {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return Number.NaN;
  return Math.round((endMs - startMs) / 86400000);
}

function uniqueSortedDays(events, learnerId) {
  return [...new Set(
    (Array.isArray(events) ? events : [])
      .filter((event) => event?.learnerId === learnerId && typeof event?.type === 'string' && event.type.endsWith('.session-completed'))
      .map((event) => utcDayKey(event.createdAt))
      .filter(Boolean),
  )].sort();
}

function streakLengthEndingOn(days, targetDay) {
  const ordered = Array.isArray(days) ? days.slice().sort() : [];
  let streak = 0;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const currentDay = ordered[index];
    if (streak === 0) {
      if (currentDay !== targetDay) break;
      streak = 1;
      continue;
    }
    const nextDay = ordered[index + 1];
    if (dayDiff(currentDay, nextDay) === 1) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function buildStreakEvent(event, streakDays) {
  const dayKey = utcDayKey(event.createdAt);
  return {
    id: `platform.practice-streak-hit:${event.learnerId || 'default'}:${streakDays}:${dayKey || 'unknown'}`,
    type: 'platform.practice-streak-hit',
    learnerId: event.learnerId || 'default',
    subjectId: event.subjectId || null,
    streakDays,
    milestone: streakDays,
    createdAt: Number(event.createdAt) || Date.now(),
  };
}

export function createPracticeStreakSubscriber({ milestones = DEFAULT_STREAK_MILESTONES } = {}) {
  const allowedMilestones = new Set(
    (Array.isArray(milestones) ? milestones : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  );

  return function practiceStreakSubscriber(events, { repositories } = {}) {
    const reactions = [];
    const entries = Array.isArray(events) ? events : [];

    for (const event of entries) {
      if (!event || typeof event.type !== 'string' || !event.type.endsWith('.session-completed')) continue;
      const today = utcDayKey(event.createdAt);
      if (!today) continue;

      const previousDays = uniqueSortedDays(repositories?.eventLog?.list?.(event.learnerId) || [], event.learnerId);
      if (previousDays.includes(today)) continue;

      const nextDays = [...previousDays, today].sort();
      const streakDays = streakLengthEndingOn(nextDays, today);
      if (!allowedMilestones.has(streakDays)) continue;
      reactions.push(buildStreakEvent(event, streakDays));
    }

    return reactions;
  };
}
