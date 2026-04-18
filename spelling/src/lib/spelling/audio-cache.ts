import { AUDIO_CACHE_DB, AUDIO_CACHE_STORE } from "./constants";
import type { AudioCacheEntry } from "./types";

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

async function openAudioDatabase() {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(AUDIO_CACHE_DB, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(AUDIO_CACHE_STORE)) {
        const store = database.createObjectStore(AUDIO_CACHE_STORE, { keyPath: "cacheKey" });
        store.createIndex("createdAt", "createdAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open audio cache database."));
  });
}

export async function getCachedAudio(cacheKey: string) {
  const database = await openAudioDatabase();
  if (!database) {
    return null;
  }

  const transaction = database.transaction(AUDIO_CACHE_STORE, "readonly");
  const store = transaction.objectStore(AUDIO_CACHE_STORE);
  const entry = await requestToPromise(store.get(cacheKey) as IDBRequest<AudioCacheEntry | undefined>);
  database.close();
  return entry?.blob ?? null;
}

export async function putCachedAudio(cacheKey: string, blob: Blob) {
  const database = await openAudioDatabase();
  if (!database) {
    return;
  }

  const transaction = database.transaction(AUDIO_CACHE_STORE, "readwrite");
  const store = transaction.objectStore(AUDIO_CACHE_STORE);
  store.put({
    cacheKey,
    blob,
    createdAt: Date.now(),
  } satisfies AudioCacheEntry);

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Failed to write audio cache entry."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Audio cache transaction aborted."));
  });

  database.close();
}

