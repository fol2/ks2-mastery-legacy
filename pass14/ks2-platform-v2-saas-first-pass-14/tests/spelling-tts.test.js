import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDictationTranscript, createPlatformTts } from '../src/subjects/spelling/tts.js';

test('dictation transcript matches the spelling audio contract', () => {
  assert.equal(
    buildDictationTranscript({
      word: 'early',
      sentence: 'The birds sang early in the day.',
    }),
    'The word is early. The birds sang early in the day. The word is early.',
  );
});

test('platform TTS calls the Worker audio proxy before browser fallback', async () => {
  const originalAudio = globalThis.Audio;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const played = [];

  globalThis.Audio = class MockAudio {
    constructor(src) {
      this.src = src;
      this.onended = null;
      this.onerror = null;
    }

    play() {
      played.push(this.src);
      setTimeout(() => this.onended?.(), 0);
      return Promise.resolve();
    }

    pause() {}
    removeAttribute() {}
    load() {}
  };
  URL.createObjectURL = () => 'blob:tts-audio';
  URL.revokeObjectURL = () => {};

  const calls = [];
  const tts = createPlatformTts({
    remoteEnabled: true,
    fetchFn: async (url, init = {}) => {
      calls.push({
        url,
        credentials: init.credentials,
        headers: init.headers,
        body: JSON.parse(init.body),
      });
      return new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }), {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      });
    },
  });

  try {
    const result = await tts.speak({
      word: { word: 'early' },
      sentence: 'The birds sang early in the day.',
      slow: true,
    });

    assert.equal(result, true);
    assert.deepEqual(played, ['blob:tts-audio']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/tts');
    assert.equal(calls[0].credentials, 'include');
    assert.equal(calls[0].headers.accept, 'audio/mpeg');
    assert.deepEqual(calls[0].body, {
      word: { word: 'early' },
      sentence: 'The birds sang early in the day.',
      slow: true,
    });
  } finally {
    tts.stop();
    globalThis.Audio = originalAudio;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});
