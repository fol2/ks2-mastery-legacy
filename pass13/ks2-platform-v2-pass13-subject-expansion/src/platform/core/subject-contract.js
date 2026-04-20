const REQUIRED_STRING_FIELDS = ['id', 'name', 'blurb'];
const REQUIRED_FUNCTION_FIELDS = [
  'initState',
  'getDashboardStats',
  'renderPractice',
  'renderAnalytics',
  'renderProfiles',
  'renderSettings',
  'renderMethod',
  'handleAction',
];

function describeCandidate(candidate) {
  if (candidate?.id) return `subject "${candidate.id}"`;
  if (candidate?.name) return `subject "${candidate.name}"`;
  return 'subject module';
}

export function validateSubjectModule(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError('Subject module must be a plain object.');
  }

  const label = describeCandidate(candidate);

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof candidate[field] !== 'string' || candidate[field].trim() === '') {
      throw new TypeError(`${label} is missing required string field "${field}".`);
    }
  }

  for (const field of REQUIRED_FUNCTION_FIELDS) {
    if (typeof candidate[field] !== 'function') {
      throw new TypeError(`${label} is missing required function "${field}()".`);
    }
  }

  if ('available' in candidate && typeof candidate.available !== 'boolean') {
    throw new TypeError(`${label} has invalid "available" flag. Expected a boolean.`);
  }

  return Object.freeze({
    ...candidate,
    id: candidate.id.trim(),
    name: candidate.name.trim(),
    blurb: candidate.blurb.trim(),
  });
}

export function buildSubjectRegistry(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new TypeError('Subject registry requires at least one subject module.');
  }

  const seenIds = new Set();
  const registry = subjects.map((subject) => {
    const validated = validateSubjectModule(subject);
    if (seenIds.has(validated.id)) {
      throw new TypeError(`Subject registry contains duplicate id "${validated.id}".`);
    }
    seenIds.add(validated.id);
    return validated;
  });

  return Object.freeze(registry);
}
