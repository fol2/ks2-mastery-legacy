import test from 'node:test';
import assert from 'node:assert/strict';

import { createLocalPlatformRepositories } from '../src/platform/core/repositories/index.js';
import { cloneSerialisable } from '../src/platform/core/repositories/helpers.js';
import { uid } from '../src/platform/core/utils.js';
import { createSpellingPersistence } from '../src/subjects/spelling/repository.js';
import { createSpellingService } from '../src/subjects/spelling/service.js';
import { createLocalSpellingContentRepository } from '../src/subjects/spelling/content/repository.js';
import { createSpellingContentService } from '../src/subjects/spelling/content/service.js';
import {
  extractPortableSpellingContent,
  publishSpellingContentBundle,
  validateSpellingContentBundle,
} from '../src/subjects/spelling/content/model.js';
import { SEEDED_SPELLING_CONTENT_BUNDLE } from '../src/subjects/spelling/data/content-data.js';
import { installMemoryStorage } from './helpers/memory-storage.js';

function makeTts() {
  return {
    speak() {},
    stop() {},
    warmup() {},
  };
}

function addDraftOnlyWord(bundle) {
  const next = cloneSerialisable(bundle);
  next.draft.words.push({
    slug: 'draftonly',
    word: 'draftonly',
    family: 'draftonly',
    listId: 'statutory-y3-4',
    yearGroups: ['Y3', 'Y4'],
    tags: ['draft-only'],
    accepted: ['draftonly'],
    sentenceEntryIds: ['draftonly__01'],
    sourceNote: 'Draft-only test word',
    provenance: { source: 'tests', note: 'Added inside tests.' },
    sortIndex: 9999,
  });
  next.draft.sentences.push({
    id: 'draftonly__01',
    wordSlug: 'draftonly',
    text: 'The draftonly word exists only in the draft.',
    variantLabel: 'baseline',
    tags: ['draft-only'],
    sourceNote: 'Draft-only test sentence',
    provenance: { source: 'tests', note: 'Added inside tests.' },
    sortIndex: 9999,
  });
  next.draft.wordLists[0].wordSlugs.push('draftonly');
  return next;
}

function ensureLearner(repositories) {
  const snapshot = repositories.learners.read();
  if (snapshot?.selectedId) return snapshot.selectedId;

  const learnerId = uid('learner');
  repositories.learners.write({
    byId: {
      [learnerId]: {
        id: learnerId,
        name: 'Learner 1',
        yearGroup: 'Y5',
        avatarColor: '#3E6FA8',
        goal: 'sats',
        dailyMinutes: 15,
        weakSubjects: [],
        createdAt: Date.now(),
      },
    },
    allIds: [learnerId],
    selectedId: learnerId,
  });

  return learnerId;
}

test('seeded spelling content validates and round-trips through the portable export format', () => {
  const storage = installMemoryStorage();
  const repository = createLocalSpellingContentRepository({ storage });
  const content = createSpellingContentService({ repository });

  const validation = content.validate();
  assert.equal(validation.ok, true);
  assert.equal(validation.errors.length, 0);
  assert.equal(validation.bundle.releases.length, 1);
  assert.equal(validation.bundle.publication.publishedVersion, 1);

  const exported = content.exportPortable();
  const roundTripped = extractPortableSpellingContent(exported);
  assert.equal(roundTripped.draft.words.length, validation.bundle.draft.words.length);
  assert.equal(roundTripped.releases[0].version, 1);
});

test('validation catches duplicate words and broken sentence references', () => {
  const broken = cloneSerialisable(SEEDED_SPELLING_CONTENT_BUNDLE);
  broken.draft.words.push(cloneSerialisable(broken.draft.words[0]));
  broken.draft.sentences[0].wordSlug = 'missing-word';

  const validation = validateSpellingContentBundle(broken);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((issue) => issue.code === 'duplicate_word'));
  assert.ok(validation.errors.some((issue) => issue.code === 'broken_sentence_reference'));
});

test('validation catches invalid publish state pointers', () => {
  const broken = cloneSerialisable(SEEDED_SPELLING_CONTENT_BUNDLE);
  broken.releases[0].state = 'draft';
  broken.publication.currentReleaseId = 'missing-release';

  const validation = validateSpellingContentBundle(broken);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((issue) => issue.code === 'invalid_publish_state'));
});

test('runtime stays pinned to the published spelling release until a new draft is published', async () => {
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });
  await repositories.hydrate();

  const contentRepository = createLocalSpellingContentRepository({ storage });
  const content = createSpellingContentService({ repository: contentRepository });
  const learnerId = ensureLearner(repositories);

  const draftOnlyBundle = addDraftOnlyWord(content.readBundle());
  content.writeBundle(draftOnlyBundle);

  let service = createSpellingService({
    repository: createSpellingPersistence({ repositories }),
    tts: makeTts(),
    contentSnapshot: content.getRuntimeSnapshot(),
  });

  let transition = service.startSession(learnerId, {
    mode: 'single',
    words: ['draftonly'],
    yearFilter: 'all',
    length: 1,
  });
  assert.equal(transition.ok, false);
  assert.match(transition.state.error, /Could not start a spelling session/);

  transition = service.startSession(learnerId, {
    mode: 'single',
    words: ['possess'],
    yearFilter: 'all',
    length: 1,
  });
  assert.equal(transition.ok, true);
  assert.equal(transition.state.session.currentCard.word.slug, 'possess');

  content.publishDraft({ notes: 'Publish the draft-only word for runtime use.' });
  service = createSpellingService({
    repository: createSpellingPersistence({ repositories }),
    tts: makeTts(),
    contentSnapshot: content.getRuntimeSnapshot(),
  });

  transition = service.startSession(learnerId, {
    mode: 'single',
    words: ['draftonly'],
    yearFilter: 'all',
    length: 1,
  });
  assert.equal(transition.ok, true);
  assert.equal(transition.state.session.currentCard.word.slug, 'draftonly');
  assert.equal(content.getSummary().publishedVersion, 2);
});

test('publishing a valid spelling draft increments release versions and updates the publication pointer', () => {
  const published = publishSpellingContentBundle(SEEDED_SPELLING_CONTENT_BUNDLE, {
    notes: 'Regression publish test.',
    publishedAt: 12345,
  });

  assert.equal(published.releases.length, 2);
  assert.equal(published.publication.currentReleaseId, 'spelling-r2');
  assert.equal(published.publication.publishedVersion, 2);
  assert.equal(published.releases.at(-1).snapshot.words.length, SEEDED_SPELLING_CONTENT_BUNDLE.releases[0].snapshot.words.length);
});
