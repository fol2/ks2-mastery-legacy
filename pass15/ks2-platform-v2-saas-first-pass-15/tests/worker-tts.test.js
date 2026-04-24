import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkerRepositoryServer } from './helpers/worker-server.js';

function ttsRequest(body = {}) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      word: 'early',
      sentence: 'The birds sang early in the day.',
      ...body,
    }),
  };
}

test('TTS route requires an authenticated account session', async () => {
  const server = createWorkerRepositoryServer({
    env: { OPENAI_API_KEY: 'test-openai-key' },
  });
  try {
    const response = await server.fetchRaw('https://repo.test/api/tts', ttsRequest());
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.code, 'unauthenticated');
  } finally {
    server.close();
  }
});

test('TTS route proxies dictation audio through OpenAI without exposing the key', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({
      url,
      headers: init.headers,
      body: JSON.parse(init.body),
    });
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
    });
  };

  const server = createWorkerRepositoryServer({
    env: { OPENAI_API_KEY: 'test-openai-key' },
  });
  try {
    const response = await server.fetch('https://repo.test/api/tts', ttsRequest());
    const bytes = new Uint8Array(await response.arrayBuffer());

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual([...bytes], [1, 2, 3]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.openai.com/v1/audio/speech');
    assert.equal(calls[0].headers.authorization, 'Bearer test-openai-key');
    assert.equal(calls[0].body.model, 'gpt-4o-mini-tts');
    assert.equal(calls[0].body.voice, 'marin');
    assert.equal(calls[0].body.response_format, 'mp3');
    assert.equal(calls[0].body.input, 'The word is early. The birds sang early in the day. The word is early.');
    assert.match(calls[0].body.instructions, /British English pronunciation/);
  } finally {
    globalThis.fetch = originalFetch;
    server.close();
  }
});

test('TTS route reports missing OpenAI configuration clearly', async () => {
  const server = createWorkerRepositoryServer();
  try {
    const response = await server.fetch('https://repo.test/api/tts', ttsRequest());
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.code, 'tts_not_configured');
  } finally {
    server.close();
  }
});
