export class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(String(key), String(value));
  }

  removeItem(key) {
    this.map.delete(String(key));
  }

  key(index) {
    return [...this.map.keys()][index] ?? null;
  }

  clear() {
    this.map.clear();
  }

  get length() {
    return this.map.size;
  }
}

export function installMemoryStorage() {
  const storage = new MemoryStorage();
  globalThis.localStorage = storage;
  return storage;
}
