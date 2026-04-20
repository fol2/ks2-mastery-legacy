import { cloneSerialisable } from '../../../platform/core/repositories/helpers.js';
import {
  buildSpellingContentSummary,
  createPortableSpellingContentExport,
  extractPortableSpellingContent,
  normaliseSpellingContentBundle,
  publishSpellingContentBundle,
  resolvePublishedSnapshot,
  validateSpellingContentBundle,
} from './model.js';
import { SEEDED_SPELLING_CONTENT_BUNDLE, SEEDED_SPELLING_PUBLISHED_SNAPSHOT } from '../data/content-data.js';

export function createSpellingContentService({ repository, seededBundle = SEEDED_SPELLING_CONTENT_BUNDLE } = {}) {
  if (!repository || typeof repository.read !== 'function' || typeof repository.write !== 'function' || typeof repository.clear !== 'function') {
    throw new TypeError('Spelling content service requires a repository with read/write/clear methods.');
  }

  const seeded = normaliseSpellingContentBundle(seededBundle);

  function readBundle() {
    return normaliseSpellingContentBundle(repository.read() || seeded);
  }

  function writeBundle(rawBundle) {
    const bundle = normaliseSpellingContentBundle(rawBundle);
    repository.write(bundle);
    return bundle;
  }

  function validation() {
    return validateSpellingContentBundle(readBundle());
  }

  function getRuntimeSnapshot() {
    const current = readBundle();
    const published = resolvePublishedSnapshot(current);
    if (published?.words?.length) return cloneSerialisable(published);
    return cloneSerialisable(SEEDED_SPELLING_PUBLISHED_SNAPSHOT);
  }

  return {
    readBundle,
    writeBundle,
    validate() {
      return validation();
    },
    getSummary() {
      const current = readBundle();
      return buildSpellingContentSummary(current);
    },
    getRuntimeSnapshot,
    exportPortable() {
      return createPortableSpellingContentExport(readBundle());
    },
    importPortable(rawPayload) {
      const bundle = extractPortableSpellingContent(rawPayload);
      const checked = validateSpellingContentBundle(bundle);
      if (!checked.ok) {
        const error = new Error(`Imported spelling content has ${checked.errors.length} validation error(s).`);
        error.validation = checked;
        throw error;
      }
      return writeBundle(checked.bundle);
    },
    publishDraft({ notes = '', title = '' } = {}) {
      const next = publishSpellingContentBundle(readBundle(), { notes, title, publishedAt: Date.now() });
      return writeBundle(next);
    },
    resetToSeeded() {
      repository.clear();
      return normaliseSpellingContentBundle(seeded);
    },
  };
}
