import { sha256 } from './auth.js';
import { first, requireDatabase } from './d1.js';
import { BadRequestError, BackendUnavailableError } from './errors.js';
import { readJson } from './http.js';

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';
const TTS_WINDOW_MS = 10 * 60 * 1000;
const TTS_ACCOUNT_LIMIT = 120;
const TTS_IP_LIMIT = 240;
const DEFAULT_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_VOICE = 'marin';
const DEFAULT_FORMAT = 'mp3';
const MAX_WORD_LENGTH = 80;
const MAX_SENTENCE_LENGTH = 320;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function clientIp(request) {
  return cleanText(
    request.headers.get('cf-connecting-ip')
      || request.headers.get('x-forwarded-for')?.split(',')[0]
      || request.headers.get('x-real-ip'),
  ) || 'unknown';
}

function currentWindowStart(timestamp, windowMs) {
  return Math.floor(timestamp / windowMs) * windowMs;
}

async function consumeRateLimit(env, { bucket, identifier, limit, windowMs, now }) {
  if (!bucket || !identifier || !limit || !windowMs) return { allowed: true, retryAfterSeconds: 0 };
  const db = requireDatabase(env);
  const windowStartedAt = currentWindowStart(now, windowMs);
  const limiterKey = `${bucket}:${await sha256(identifier)}`;
  const row = await first(db, `
    INSERT INTO request_limits (limiter_key, window_started_at, request_count, updated_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(limiter_key) DO UPDATE SET
      request_count = CASE
        WHEN request_limits.window_started_at = excluded.window_started_at
          THEN request_limits.request_count + 1
        ELSE 1
      END,
      window_started_at = excluded.window_started_at,
      updated_at = excluded.updated_at
    RETURNING request_count, window_started_at
  `, [limiterKey, windowStartedAt, now]);
  const count = Number(row?.request_count || 1);
  const storedWindow = Number(row?.window_started_at || windowStartedAt);
  return {
    allowed: count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil(((storedWindow + windowMs) - now) / 1000)),
  };
}

async function protectTts(env, request, session, now) {
  const accountLimit = await consumeRateLimit(env, {
    bucket: 'tts-account',
    identifier: session.accountId,
    limit: TTS_ACCOUNT_LIMIT,
    windowMs: TTS_WINDOW_MS,
    now,
  });
  const ipLimit = await consumeRateLimit(env, {
    bucket: 'tts-ip',
    identifier: clientIp(request),
    limit: TTS_IP_LIMIT,
    windowMs: TTS_WINDOW_MS,
    now,
  });

  if (!accountLimit.allowed || !ipLimit.allowed) {
    throw new BadRequestError('Too many dictation audio requests. Please wait a few minutes and try again.', {
      code: 'tts_rate_limited',
      retryAfterSeconds: Math.max(accountLimit.retryAfterSeconds, ipLimit.retryAfterSeconds),
    });
  }
}

function normaliseTtsPayload(body) {
  const word = cleanText(typeof body?.word === 'string' ? body.word : body?.word?.word);
  const sentence = cleanText(body?.sentence);

  if (!word) {
    throw new BadRequestError('A spelling word is required for dictation audio.', { code: 'tts_word_required' });
  }
  if (word.length > MAX_WORD_LENGTH || sentence.length > MAX_SENTENCE_LENGTH) {
    throw new BadRequestError('Dictation audio request is too long.', { code: 'tts_input_too_long' });
  }

  const transcript = sentence
    ? `The word is ${word}. ${sentence} The word is ${word}.`
    : `The word is ${word}. The word is ${word}.`;

  return {
    transcript,
    slow: Boolean(body?.slow),
  };
}

function ttsInstructions(slow = false) {
  const pace = slow
    ? 'Speak slightly slower than normal, with clear pauses between the word and sentence.'
    : 'Speak at a calm classroom pace, with clear pauses between the word and sentence.';
  return `${pace} Use natural British English pronunciation for a KS2 spelling dictation. Read exactly the supplied text and do not add extra words.`;
}

function openAiConfig(env = {}) {
  return {
    apiKey: cleanText(env.OPENAI_API_KEY),
    model: cleanText(env.OPENAI_TTS_MODEL) || DEFAULT_MODEL,
    voice: cleanText(env.OPENAI_TTS_VOICE) || DEFAULT_VOICE,
    responseFormat: cleanText(env.OPENAI_TTS_FORMAT) || DEFAULT_FORMAT,
  };
}

export async function handleTextToSpeechRequest({
  env,
  request,
  session,
  now = Date.now(),
  fetchFn = fetch,
} = {}) {
  const config = openAiConfig(env);
  if (!config.apiKey) {
    throw new BackendUnavailableError('OpenAI TTS is not configured.', { code: 'tts_not_configured' });
  }

  await protectTts(env, request, session, now);
  const payload = normaliseTtsPayload(await readJson(request));

  const response = await fetchFn(OPENAI_SPEECH_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      model: config.model,
      voice: config.voice,
      input: payload.transcript,
      instructions: ttsInstructions(payload.slow),
      response_format: config.responseFormat,
    }),
  });

  if (!response.ok) {
    throw new BackendUnavailableError('OpenAI TTS request failed.', {
      code: 'tts_provider_error',
      providerStatus: response.status,
    });
  }

  const contentType = response.headers.get('content-type') || 'audio/mpeg';
  return new Response(response.body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
      'x-ks2-tts-provider': 'openai',
      'x-ks2-tts-model': config.model,
      'x-ks2-tts-voice': config.voice,
    },
  });
}
