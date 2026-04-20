const TOP_LEVEL_METHODS = ['hydrate', 'flush', 'clearAll'];

const SECTION_METHODS = {
  persistence: ['read', 'subscribe', 'retry'],
  learners: ['read', 'write'],
  subjectStates: ['read', 'readForLearner', 'writeUi', 'writeData', 'writeRecord', 'clear', 'clearLearner'],
  practiceSessions: ['latest', 'list', 'write', 'clear', 'clearLearner'],
  gameState: ['read', 'readForLearner', 'write', 'clear', 'clearLearner'],
  eventLog: ['append', 'list', 'clearLearner'],
};

function expectMethods(label, value, methods) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  for (const method of methods) {
    if (typeof value[method] !== 'function') {
      throw new TypeError(`${label} is missing required method ${method}().`);
    }
  }
}

export function validatePlatformRepositories(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError('Platform repositories must be an object.');
  }

  for (const method of TOP_LEVEL_METHODS) {
    if (typeof candidate[method] !== 'function') {
      throw new TypeError(`Platform repositories are missing top-level method ${method}().`);
    }
  }

  for (const [section, methods] of Object.entries(SECTION_METHODS)) {
    expectMethods(`Platform repositories.${section}`, candidate[section], methods);
  }

  return candidate;
}
