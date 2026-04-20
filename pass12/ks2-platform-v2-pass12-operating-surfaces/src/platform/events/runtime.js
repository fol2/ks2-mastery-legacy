function asEvents(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((event) => event && typeof event === 'object' && !Array.isArray(event));
}

function eventToken(event) {
  if (typeof event?.id === 'string' && event.id) return event.id;
  if (typeof event?.type === 'string') {
    return [
      event.type,
      event.learnerId || '',
      event.sessionId || '',
      event.wordSlug || '',
      event.monsterId || '',
      event.createdAt || '',
    ].join(':');
  }
  if (typeof event?.kind === 'string') {
    return [
      'reward',
      event.kind,
      event.learnerId || '',
      event.monsterId || '',
      event.createdAt || '',
    ].join(':');
  }
  return null;
}

function dedupeEvents(events, seenTokens) {
  const output = [];
  for (const event of asEvents(events)) {
    const token = eventToken(event);
    if (token && seenTokens.has(token)) continue;
    if (token) seenTokens.add(token);
    output.push(event);
  }
  return output;
}

function isToastEvent(event) {
  return Boolean(event?.toast?.title || event?.toast?.body || event?.monster?.name);
}

export function createEventRuntime({ repositories, subscribers = [], onError } = {}) {
  const listeners = Array.isArray(subscribers)
    ? subscribers.filter((subscriber) => typeof subscriber === 'function')
    : [];

  return {
    publish(events) {
      const existingEvents = repositories?.eventLog?.list?.() || [];
      const seenTokens = new Set(existingEvents.map(eventToken).filter(Boolean));
      const domainEvents = dedupeEvents(events, seenTokens);
      if (!domainEvents.length) {
        return {
          domainEvents: [],
          reactionEvents: [],
          toastEvents: [],
          errors: [],
        };
      }

      const reactionEvents = [];
      const errors = [];

      for (const subscriber of listeners) {
        try {
          const produced = subscriber(domainEvents, { repositories, existingEvents });
          reactionEvents.push(...dedupeEvents(produced, seenTokens));
        } catch (error) {
          errors.push(error);
          if (typeof onError === 'function') onError(error);
        }
      }

      domainEvents.forEach((event) => repositories?.eventLog?.append?.(event));
      reactionEvents.forEach((event) => repositories?.eventLog?.append?.(event));

      return {
        domainEvents,
        reactionEvents,
        toastEvents: reactionEvents.filter(isToastEvent),
        errors,
      };
    },
  };
}
