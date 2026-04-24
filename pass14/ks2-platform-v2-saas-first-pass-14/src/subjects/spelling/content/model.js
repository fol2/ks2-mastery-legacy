import { cloneSerialisable } from '../../../platform/core/repositories/helpers.js';

export const SPELLING_CONTENT_SUBJECT_ID = 'spelling';
export const SPELLING_CONTENT_MODEL_VERSION = 1;
export const SPELLING_CONTENT_EXPORT_KIND = 'ks2-spelling-content';
export const SPELLING_CONTENT_EXPORT_VERSION = 1;

const VALID_YEAR_GROUPS = new Set(['Y3', 'Y4', 'Y5', 'Y6']);
const VALID_DRAFT_STATES = new Set(['draft']);
const VALID_RELEASE_STATES = new Set(['published']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normaliseString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function normaliseTimestamp(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function normalisePositiveInteger(value, fallback = 1) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function uniqueStrings(values, { lowerCase = false } = {}) {
  const list = Array.isArray(values) ? values : [];
  const seen = new Set();
  const output = [];
  for (const value of list) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const next = lowerCase ? trimmed.toLowerCase() : trimmed;
    if (seen.has(next)) continue;
    seen.add(next);
    output.push(next);
  }
  return output;
}

function slugifyWord(value) {
  return normaliseString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normaliseYearGroups(value, fallback = []) {
  const list = uniqueStrings(value);
  return list.filter((entry) => VALID_YEAR_GROUPS.has(entry)).length
    ? list.filter((entry) => VALID_YEAR_GROUPS.has(entry))
    : cloneSerialisable(fallback);
}

function normaliseTags(value) {
  return uniqueStrings(value, { lowerCase: true });
}

function normaliseProvenance(rawValue, fallbackSource = '') {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  return {
    source: normaliseString(raw.source, fallbackSource),
    note: normaliseString(raw.note),
    importedAt: normaliseTimestamp(raw.importedAt, 0),
  };
}

function yearBandFromGroups(yearGroups) {
  const groups = normaliseYearGroups(yearGroups);
  const y34 = groups.filter((entry) => entry === 'Y3' || entry === 'Y4');
  const y56 = groups.filter((entry) => entry === 'Y5' || entry === 'Y6');
  if (y34.length && !y56.length) return '3-4';
  if (y56.length && !y34.length) return '5-6';
  return '3-4';
}

function yearLabelFromBand(yearBand) {
  return yearBand === '5-6' ? 'Years 5-6' : 'Years 3-4';
}

function familyKeyForRuntime(word) {
  return `${word.year}::${word.family}`;
}

function normaliseWordList(rawValue, index = 0) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  return {
    id: normaliseString(raw.id, `list-${index + 1}`),
    title: normaliseString(raw.title, `Word list ${index + 1}`),
    yearGroups: normaliseYearGroups(raw.yearGroups),
    tags: normaliseTags(raw.tags),
    wordSlugs: uniqueStrings(raw.wordSlugs, { lowerCase: true }),
    sourceNote: normaliseString(raw.sourceNote),
    provenance: normaliseProvenance(raw.provenance, raw.sourceNote || 'spelling word list'),
    sortIndex: Number.isInteger(Number(raw.sortIndex)) && Number(raw.sortIndex) >= 0 ? Number(raw.sortIndex) : index,
  };
}

function normaliseWordEntry(rawValue, index = 0) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const word = normaliseString(raw.word);
  const slug = normaliseString(raw.slug, slugifyWord(word));
  const accepted = uniqueStrings(raw.accepted, { lowerCase: true });
  if (slug && !accepted.includes(slug)) accepted.unshift(slug);

  return {
    slug,
    word,
    family: normaliseString(raw.family),
    listId: normaliseString(raw.listId),
    yearGroups: normaliseYearGroups(raw.yearGroups),
    tags: normaliseTags(raw.tags),
    accepted,
    sentenceEntryIds: uniqueStrings(raw.sentenceEntryIds),
    sourceNote: normaliseString(raw.sourceNote),
    provenance: normaliseProvenance(raw.provenance, raw.sourceNote || 'spelling word'),
    sortIndex: Number.isInteger(Number(raw.sortIndex)) && Number(raw.sortIndex) >= 0 ? Number(raw.sortIndex) : index,
  };
}

function normaliseSentenceEntry(rawValue, index = 0) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  return {
    id: normaliseString(raw.id, `sentence-${index + 1}`),
    wordSlug: normaliseString(raw.wordSlug, '').toLowerCase(),
    text: normaliseString(raw.text),
    variantLabel: normaliseString(raw.variantLabel, `variant-${index + 1}`),
    tags: normaliseTags(raw.tags),
    sourceNote: normaliseString(raw.sourceNote),
    provenance: normaliseProvenance(raw.provenance, raw.sourceNote || 'spelling sentence'),
    sortIndex: Number.isInteger(Number(raw.sortIndex)) && Number(raw.sortIndex) >= 0 ? Number(raw.sortIndex) : index,
  };
}

function normaliseRuntimeWord(rawValue, index = 0) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const word = normaliseString(raw.word);
  const slug = normaliseString(raw.slug, slugifyWord(word));
  const year = raw.year === '5-6' ? '5-6' : '3-4';
  const accepted = uniqueStrings(raw.accepted, { lowerCase: true });
  if (slug && !accepted.includes(slug)) accepted.unshift(slug);
  const sentences = uniqueStrings(raw.sentences);
  const sentence = normaliseString(raw.sentence, sentences[0] || '');
  if (sentence && !sentences.includes(sentence)) sentences.unshift(sentence);

  return {
    year,
    family: normaliseString(raw.family),
    word,
    slug,
    yearLabel: normaliseString(raw.yearLabel, yearLabelFromBand(year)),
    familyWords: uniqueStrings(raw.familyWords),
    sentence,
    sentences,
    accepted,
    listId: normaliseString(raw.listId),
    yearGroups: normaliseYearGroups(raw.yearGroups, year === '5-6' ? ['Y5', 'Y6'] : ['Y3', 'Y4']),
    tags: normaliseTags(raw.tags),
    sourceNote: normaliseString(raw.sourceNote),
    provenance: normaliseProvenance(raw.provenance, raw.sourceNote || 'published spelling word'),
    sortIndex: Number.isInteger(Number(raw.sortIndex)) && Number(raw.sortIndex) >= 0 ? Number(raw.sortIndex) : index,
  };
}

function normalisePublishedSnapshot(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const inputWords = Array.isArray(raw.words)
    ? raw.words
    : (isPlainObject(raw.wordBySlug) ? Object.values(raw.wordBySlug) : []);

  const wordOrder = [];
  const bySlug = {};
  for (const [index, entry] of inputWords.entries()) {
    const word = normaliseRuntimeWord(entry, index);
    if (!word.slug || !word.word) continue;
    if (!bySlug[word.slug]) wordOrder.push(word.slug);
    bySlug[word.slug] = word;
  }

  const words = wordOrder.map((slug) => bySlug[slug]);
  return {
    generatedAt: normaliseTimestamp(raw.generatedAt, 0),
    words,
    wordBySlug: Object.fromEntries(words.map((word) => [word.slug, word])),
  };
}

function normaliseDraft(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const updatedAt = normaliseTimestamp(raw.updatedAt, 0);
  return {
    id: normaliseString(raw.id, 'main'),
    state: VALID_DRAFT_STATES.has(raw.state) ? raw.state : normaliseString(raw.state, 'draft'),
    version: normalisePositiveInteger(raw.version, 1),
    title: normaliseString(raw.title, 'Main spelling draft'),
    notes: normaliseString(raw.notes),
    sourceNote: normaliseString(raw.sourceNote),
    provenance: normaliseProvenance(raw.provenance, raw.sourceNote || 'spelling draft'),
    createdAt: normaliseTimestamp(raw.createdAt, updatedAt),
    updatedAt,
    wordLists: (Array.isArray(raw.wordLists) ? raw.wordLists : []).map((entry, index) => normaliseWordList(entry, index)),
    words: (Array.isArray(raw.words) ? raw.words : []).map((entry, index) => normaliseWordEntry(entry, index)),
    sentences: (Array.isArray(raw.sentences) ? raw.sentences : []).map((entry, index) => normaliseSentenceEntry(entry, index)),
  };
}

function normaliseRelease(rawValue, index = 0) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const version = normalisePositiveInteger(raw.version, index + 1);
  const publishedAt = normaliseTimestamp(raw.publishedAt, 0);
  return {
    id: normaliseString(raw.id, `spelling-r${version}`),
    state: VALID_RELEASE_STATES.has(raw.state) ? raw.state : normaliseString(raw.state, 'published'),
    version,
    title: normaliseString(raw.title, `Release ${version}`),
    notes: normaliseString(raw.notes),
    sourceDraftId: normaliseString(raw.sourceDraftId, 'main'),
    sourceNote: normaliseString(raw.sourceNote),
    provenance: normaliseProvenance(raw.provenance, raw.sourceNote || 'spelling release'),
    publishedAt,
    snapshot: normalisePublishedSnapshot(raw.snapshot),
  };
}

function normalisePublication(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  return {
    currentReleaseId: normaliseString(raw.currentReleaseId),
    publishedVersion: Math.max(0, Number.isFinite(Number(raw.publishedVersion)) ? Number(raw.publishedVersion) : 0),
    updatedAt: normaliseTimestamp(raw.updatedAt, 0),
  };
}

export function normaliseSpellingContentBundle(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const releases = (Array.isArray(raw.releases) ? raw.releases : []).map((entry, index) => normaliseRelease(entry, index));
  return {
    modelVersion: normalisePositiveInteger(raw.modelVersion, SPELLING_CONTENT_MODEL_VERSION),
    subjectId: normaliseString(raw.subjectId, SPELLING_CONTENT_SUBJECT_ID),
    draft: normaliseDraft(raw.draft),
    releases,
    publication: normalisePublication(raw.publication),
  };
}

function issue(severity, code, path, message) {
  return { severity, code, path, message };
}

export function validateSpellingContentBundle(rawBundle) {
  const bundle = normaliseSpellingContentBundle(rawBundle);
  const errors = [];
  const warnings = [];
  const wordListsById = new Map();
  const wordsBySlug = new Map();
  const wordTextKeys = new Set();
  const sentencesById = new Map();
  const releasesById = new Map();
  const releaseVersions = new Set();

  if (bundle.subjectId !== SPELLING_CONTENT_SUBJECT_ID) {
    errors.push(issue('error', 'invalid_subject', 'subjectId', 'The spelling content bundle must target the spelling subject.'));
  }

  if (!VALID_DRAFT_STATES.has(bundle.draft.state)) {
    errors.push(issue('error', 'invalid_publish_state', 'draft.state', 'Draft content must use the state "draft".'));
  }

  if (!bundle.draft.wordLists.length) {
    warnings.push(issue('warn', 'missing_word_lists', 'draft.wordLists', 'No word lists are defined in the draft.'));
  }

  bundle.draft.wordLists.forEach((list, index) => {
    if (wordListsById.has(list.id)) {
      errors.push(issue('error', 'duplicate_word_list', `draft.wordLists[${index}]`, `Duplicate word list id "${list.id}".`));
      return;
    }
    wordListsById.set(list.id, list);
    if (!list.yearGroups.length) {
      errors.push(issue('error', 'missing_year_group_metadata', `draft.wordLists[${index}].yearGroups`, `Word list "${list.id}" is missing year-group metadata.`));
    }
  });

  bundle.draft.words.forEach((word, index) => {
    if (!word.slug || !word.word || !word.family) {
      errors.push(issue('error', 'malformed_entry', `draft.words[${index}]`, 'Each word entry must include slug, word, and family fields.'));
    }
    if (wordsBySlug.has(word.slug)) {
      errors.push(issue('error', 'duplicate_word', `draft.words[${index}].slug`, `Duplicate word slug "${word.slug}".`));
    }
    wordsBySlug.set(word.slug, word);
    const duplicateTextKey = `${word.word.toLowerCase()}::${word.listId || 'unlisted'}`;
    if (wordTextKeys.has(duplicateTextKey)) {
      errors.push(issue('error', 'duplicate_word', `draft.words[${index}].word`, `Duplicate canonical word "${word.word}" in list "${word.listId || 'unlisted'}".`));
    }
    wordTextKeys.add(duplicateTextKey);
    if (!word.yearGroups.length) {
      errors.push(issue('error', 'missing_year_group_metadata', `draft.words[${index}].yearGroups`, `Word "${word.slug}" is missing year-group metadata.`));
    }
    if (!word.listId || !wordListsById.has(word.listId)) {
      errors.push(issue('error', 'malformed_entry', `draft.words[${index}].listId`, `Word "${word.slug}" must point at a valid word list.`));
    }
    if (!word.sentenceEntryIds.length) {
      errors.push(issue('error', 'broken_sentence_reference', `draft.words[${index}].sentenceEntryIds`, `Word "${word.slug}" must reference at least one sentence entry.`));
    }
  });

  bundle.draft.sentences.forEach((sentence, index) => {
    if (!sentence.id || !sentence.wordSlug || !sentence.text) {
      errors.push(issue('error', 'malformed_entry', `draft.sentences[${index}]`, 'Each sentence entry must include id, wordSlug, and text.'));
    }
    if (sentencesById.has(sentence.id)) {
      errors.push(issue('error', 'malformed_entry', `draft.sentences[${index}].id`, `Duplicate sentence id "${sentence.id}".`));
    }
    sentencesById.set(sentence.id, sentence);
    if (sentence.wordSlug && !wordsBySlug.has(sentence.wordSlug)) {
      errors.push(issue('error', 'broken_sentence_reference', `draft.sentences[${index}].wordSlug`, `Sentence "${sentence.id}" points at missing word slug "${sentence.wordSlug}".`));
    }
  });

  bundle.draft.wordLists.forEach((list, index) => {
    list.wordSlugs.forEach((slug, position) => {
      if (!wordsBySlug.has(slug)) {
        errors.push(issue('error', 'malformed_entry', `draft.wordLists[${index}].wordSlugs[${position}]`, `Word list "${list.id}" references missing word slug "${slug}".`));
      }
    });
  });

  bundle.draft.words.forEach((word, index) => {
    word.sentenceEntryIds.forEach((sentenceId, position) => {
      const sentence = sentencesById.get(sentenceId);
      if (!sentence) {
        errors.push(issue('error', 'broken_sentence_reference', `draft.words[${index}].sentenceEntryIds[${position}]`, `Word "${word.slug}" references missing sentence id "${sentenceId}".`));
        return;
      }
      if (sentence.wordSlug !== word.slug) {
        errors.push(issue('error', 'broken_sentence_reference', `draft.words[${index}].sentenceEntryIds[${position}]`, `Sentence "${sentenceId}" belongs to word "${sentence.wordSlug}", not "${word.slug}".`));
      }
    });
  });

  bundle.releases.forEach((release, index) => {
    if (!VALID_RELEASE_STATES.has(release.state)) {
      errors.push(issue('error', 'invalid_publish_state', `releases[${index}].state`, `Release "${release.id}" must use the state "published".`));
    }
    if (releasesById.has(release.id)) {
      errors.push(issue('error', 'invalid_publish_state', `releases[${index}].id`, `Duplicate release id "${release.id}".`));
    }
    releasesById.set(release.id, release);
    if (releaseVersions.has(release.version)) {
      errors.push(issue('error', 'invalid_publish_state', `releases[${index}].version`, `Duplicate release version ${release.version}.`));
    }
    releaseVersions.add(release.version);
    if (!release.snapshot.words.length) {
      errors.push(issue('error', 'malformed_entry', `releases[${index}].snapshot`, `Release "${release.id}" does not contain a runtime snapshot.`));
    }
  });

  if (bundle.publication.currentReleaseId) {
    const published = releasesById.get(bundle.publication.currentReleaseId);
    if (!published) {
      errors.push(issue('error', 'invalid_publish_state', 'publication.currentReleaseId', `Publication points at missing release "${bundle.publication.currentReleaseId}".`));
    } else if (bundle.publication.publishedVersion && bundle.publication.publishedVersion !== published.version) {
      errors.push(issue('error', 'invalid_publish_state', 'publication.publishedVersion', 'Publication version does not match the current release version.'));
    }
  } else if (bundle.releases.length) {
    warnings.push(issue('warn', 'missing_publication_pointer', 'publication.currentReleaseId', 'Releases exist but no current publication pointer has been set.'));
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      wordListCount: bundle.draft.wordLists.length,
      wordCount: bundle.draft.words.length,
      sentenceCount: bundle.draft.sentences.length,
      releaseCount: bundle.releases.length,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
    bundle,
  };
}

function orderedDraftWords(draft) {
  const wordsBySlug = new Map(draft.words.map((word) => [word.slug, word]));
  const ordered = [];
  const seen = new Set();
  const lists = [...draft.wordLists].sort((a, b) => a.sortIndex - b.sortIndex);

  for (const list of lists) {
    for (const slug of list.wordSlugs) {
      const word = wordsBySlug.get(slug);
      if (!word || seen.has(slug)) continue;
      ordered.push(word);
      seen.add(slug);
    }
  }

  for (const word of [...draft.words].sort((a, b) => a.sortIndex - b.sortIndex)) {
    if (seen.has(word.slug)) continue;
    ordered.push(word);
    seen.add(word.slug);
  }

  return ordered;
}

export function buildPublishedSnapshotFromDraft(rawDraft, { generatedAt = Date.now() } = {}) {
  const draft = normaliseDraft(rawDraft);
  const sentenceById = new Map(draft.sentences.map((entry) => [entry.id, entry]));
  const familyMap = new Map();
  const orderedWords = orderedDraftWords(draft);

  const runtimeWords = orderedWords.map((word, index) => {
    const sentences = word.sentenceEntryIds
      .map((id) => sentenceById.get(id))
      .filter(Boolean)
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((sentence) => sentence.text);
    const year = yearBandFromGroups(word.yearGroups);
    const familyKey = `${year}::${word.family}`;
    if (!familyMap.has(familyKey)) familyMap.set(familyKey, []);
    familyMap.get(familyKey).push(word.word);
    return normaliseRuntimeWord({
      year,
      family: word.family,
      word: word.word,
      slug: word.slug,
      yearLabel: yearLabelFromBand(year),
      familyWords: [],
      sentence: sentences[0] || '',
      sentences,
      accepted: word.accepted,
      listId: word.listId,
      yearGroups: word.yearGroups,
      tags: word.tags,
      sourceNote: word.sourceNote,
      provenance: word.provenance,
      sortIndex: index,
    }, index);
  });

  const words = runtimeWords.map((word) => ({
    ...word,
    familyWords: familyMap.get(familyKeyForRuntime(word)) || [word.word],
  }));

  return {
    generatedAt: normaliseTimestamp(generatedAt, Date.now()),
    words,
    wordBySlug: Object.fromEntries(words.map((word) => [word.slug, word])),
  };
}

export function resolvePublishedRelease(rawBundle, { fallbackToLatest = true } = {}) {
  const bundle = normaliseSpellingContentBundle(rawBundle);
  const byId = new Map(bundle.releases.map((release) => [release.id, release]));
  const selected = bundle.publication.currentReleaseId ? byId.get(bundle.publication.currentReleaseId) : null;
  if (selected && VALID_RELEASE_STATES.has(selected.state)) return cloneSerialisable(selected);
  if (!fallbackToLatest) return null;
  const latest = [...bundle.releases]
    .filter((release) => VALID_RELEASE_STATES.has(release.state))
    .sort((a, b) => b.version - a.version || b.publishedAt - a.publishedAt)[0] || null;
  return latest ? cloneSerialisable(latest) : null;
}

export function resolvePublishedSnapshot(rawBundle) {
  const release = resolvePublishedRelease(rawBundle, { fallbackToLatest: true });
  return release ? cloneSerialisable(release.snapshot) : null;
}

function nextReleaseId(bundle, version) {
  return `spelling-r${version}`;
}

export function publishSpellingContentBundle(rawBundle, { notes = '', publishedAt = Date.now(), title = '' } = {}) {
  const validation = validateSpellingContentBundle(rawBundle);
  if (!validation.ok) {
    const error = new Error(`Cannot publish spelling content with ${validation.errors.length} validation error(s).`);
    error.validation = validation;
    throw error;
  }

  const bundle = validation.bundle;
  const nextVersion = bundle.releases.reduce((max, release) => Math.max(max, release.version), 0) + 1;
  const snapshot = buildPublishedSnapshotFromDraft(bundle.draft, { generatedAt: publishedAt });
  const release = normaliseRelease({
    id: nextReleaseId(bundle, nextVersion),
    state: 'published',
    version: nextVersion,
    title: title || `Release ${nextVersion}`,
    notes,
    sourceDraftId: bundle.draft.id,
    sourceNote: bundle.draft.sourceNote,
    provenance: bundle.draft.provenance,
    publishedAt,
    snapshot,
  }, bundle.releases.length);

  return normaliseSpellingContentBundle({
    ...bundle,
    releases: [...bundle.releases, release],
    publication: {
      currentReleaseId: release.id,
      publishedVersion: release.version,
      updatedAt: publishedAt,
    },
  });
}

export function buildSpellingContentSummary(rawBundle) {
  const validation = validateSpellingContentBundle(rawBundle);
  const published = resolvePublishedRelease(validation.bundle, { fallbackToLatest: true });
  return {
    ...validation.summary,
    publishedReleaseId: published?.id || '',
    publishedVersion: published?.version || 0,
    publishedAt: published?.publishedAt || 0,
    runtimeWordCount: published?.snapshot?.words?.length || 0,
    runtimeSentenceCount: published?.snapshot?.words?.reduce((total, word) => total + (Array.isArray(word.sentences) ? word.sentences.length : 0), 0) || 0,
    ok: validation.ok,
  };
}

export function createPortableSpellingContentExport(rawBundle) {
  return {
    kind: SPELLING_CONTENT_EXPORT_KIND,
    version: SPELLING_CONTENT_EXPORT_VERSION,
    exportedAt: Date.now(),
    content: normaliseSpellingContentBundle(rawBundle),
  };
}

export function extractPortableSpellingContent(rawPayload) {
  if (isPlainObject(rawPayload) && rawPayload.kind === SPELLING_CONTENT_EXPORT_KIND) {
    return normaliseSpellingContentBundle(rawPayload.content);
  }
  return normaliseSpellingContentBundle(rawPayload);
}
