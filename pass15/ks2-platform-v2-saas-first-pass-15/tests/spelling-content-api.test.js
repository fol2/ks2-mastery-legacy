import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createApiPlatformRepositories,
} from '../src/platform/core/repositories/index.js';
import { cloneSerialisable } from '../src/platform/core/repositories/helpers.js';
import { createApiSpellingContentRepository } from '../src/subjects/spelling/content/repository.js';
import { SEEDED_SPELLING_CONTENT_BUNDLE } from '../src/subjects/spelling/data/content-data.js';
import { installMemoryStorage } from './helpers/memory-storage.js';
import { createWorkerRepositoryServer } from './helpers/worker-server.js';

async function waitForPersistenceIdle(repositories, attempts = 60) {
  await Promise.resolve();
  for (let index = 0; index < attempts; index += 1) {
    if (repositories.persistence.read().inFlightWriteCount === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function learnerSnapshot(name = 'Ava') {
  return {
    byId: {
      'learner-a': {
        id: 'learner-a',
        name,
        yearGroup: 'Y5',
        goal: 'sats',
        dailyMinutes: 15,
        avatarColor: '#3E6FA8',
        createdAt: 1,
      },
    },
    allIds: ['learner-a'],
    selectedId: 'learner-a',
  };
}

test('api spelling content repository hydrates the seeded published bundle and persists valid content changes', async () => {
  const server = createWorkerRepositoryServer();
  try {
    const repository = createApiSpellingContentRepository({
      baseUrl: 'https://repo.test',
      fetch: server.fetch.bind(server),
      authSession: server.authSessionFor('adult-a'),
    });

    const bundle = await repository.hydrate();
    assert.equal(bundle.publication.publishedVersion, 1);
    assert.equal(repository.getAccountRevision(), 0);

    const updated = cloneSerialisable(bundle);
    updated.draft.notes = 'Operator note from API repository test.';
    const saved = await repository.write(updated);
    assert.equal(saved.draft.notes, 'Operator note from API repository test.');
    assert.equal(repository.getAccountRevision(), 1);

    const receipt = server.DB.db.prepare('SELECT request_hash, response_json FROM mutation_receipts WHERE mutation_kind = ?').get('subject_content.put');
    assert.ok(receipt);
    assert.ok(receipt.request_hash.length > 16);
    assert.ok(receipt.response_json.length < 100_000);
    assert.equal(JSON.parse(receipt.response_json).content, undefined);

    const fresh = createApiSpellingContentRepository({
      baseUrl: 'https://repo.test',
      fetch: server.fetch.bind(server),
      authSession: server.authSessionFor('adult-a'),
    });
    const reloaded = await fresh.hydrate();
    assert.equal(reloaded.draft.notes, 'Operator note from API repository test.');
  } finally {
    server.close();
  }
});

test('content writes share the account revision without leaving later learner writes degraded', async () => {
  const server = createWorkerRepositoryServer();
  try {
    const authSession = server.authSessionFor('adult-a');
    const platform = createApiPlatformRepositories({
      baseUrl: 'https://repo.test',
      fetch: server.fetch.bind(server),
      storage: installMemoryStorage(),
      authSession,
    });
    await platform.hydrate();
    platform.learners.write(learnerSnapshot());
    await platform.flush();

    const content = createApiSpellingContentRepository({
      baseUrl: 'https://repo.test',
      fetch: server.fetch.bind(server),
      authSession,
    });
    const bundle = await content.hydrate();
    assert.equal(content.getAccountRevision(), 1);

    const updatedContent = cloneSerialisable(bundle);
    updatedContent.draft.notes = 'This content write advances the shared account revision.';
    await content.write(updatedContent);
    assert.equal(content.getAccountRevision(), 2);

    platform.learners.write(learnerSnapshot('Ava Rebased'));
    await waitForPersistenceIdle(platform);

    const persistence = platform.persistence.read();
    assert.equal(persistence.mode, 'remote-sync');
    assert.equal(persistence.pendingWriteCount, 0);
    assert.equal(persistence.lastError, null);
    assert.equal(platform.learners.read().byId['learner-a'].name, 'Ava Rebased');

    const freshPlatform = createApiPlatformRepositories({
      baseUrl: 'https://repo.test',
      fetch: server.fetch.bind(server),
      storage: installMemoryStorage(),
      authSession,
    });
    await freshPlatform.hydrate();
    assert.equal(freshPlatform.learners.read().byId['learner-a'].name, 'Ava Rebased');
  } finally {
    server.close();
  }
});

test('worker spelling content receipt replay returns full content without storing the large bundle in receipts', async () => {
  const server = createWorkerRepositoryServer();
  try {
    const initialResponse = await server.fetch('https://repo.test/api/content/spelling');
    const initial = await initialResponse.json();
    const updated = cloneSerialisable(initial.content);
    updated.draft.notes = 'Replay-safe content write test.';
    const requestId = 'content-replay-safe-1';
    const body = {
      content: updated,
      mutation: {
        requestId,
        correlationId: requestId,
        expectedAccountRevision: initial.mutation.accountRevision,
      },
    };

    const firstResponse = await server.fetch('https://repo.test/api/content/spelling', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const firstPayload = await firstResponse.json();
    assert.equal(firstResponse.status, 200);
    assert.equal(firstPayload.content.draft.notes, 'Replay-safe content write test.');

    const receipt = server.DB.db.prepare('SELECT response_json FROM mutation_receipts WHERE request_id = ?').get(requestId);
    assert.ok(receipt);
    assert.ok(receipt.response_json.length < 100_000);
    assert.equal(JSON.parse(receipt.response_json).content, undefined);

    const replayResponse = await server.fetch('https://repo.test/api/content/spelling', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const replayPayload = await replayResponse.json();
    assert.equal(replayResponse.status, 200);
    assert.equal(replayPayload.content.draft.notes, 'Replay-safe content write test.');
    assert.equal(replayPayload.mutation.replayed, true);
  } finally {
    server.close();
  }
});

test('worker spelling content route rejects invalid bundles with explicit validation details', async () => {
  const server = createWorkerRepositoryServer();
  try {
    const invalid = cloneSerialisable(SEEDED_SPELLING_CONTENT_BUNDLE);
    invalid.draft.words[0].yearGroups = [];
    invalid.draft.words[0].sentenceEntryIds = ['missing-sentence'];

    const response = await server.fetch('https://repo.test/api/content/spelling', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: invalid,
        mutation: {
          requestId: 'content-invalid-1',
          correlationId: 'content-invalid-1',
          expectedAccountRevision: 0,
        },
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.code, 'content_validation_failed');
    assert.ok(Array.isArray(payload.validation.errors));
    assert.ok(payload.validation.errors.some((issue) => issue.code === 'missing_year_group_metadata'));
    assert.ok(payload.validation.errors.some((issue) => issue.code === 'broken_sentence_reference'));
  } finally {
    server.close();
  }
});
