export function createManualScheduler() {
  let nextId = 1;
  const pending = new Map();

  function setTimeout(fn, delay = 0) {
    const id = nextId += 1;
    pending.set(id, { fn, delay, cleared: false });
    return id;
  }

  function clearTimeout(id) {
    const entry = pending.get(id);
    if (!entry) return;
    entry.cleared = true;
    pending.delete(id);
  }

  function flushNext() {
    const [id, entry] = pending.entries().next().value || [];
    if (!id || !entry) return false;
    pending.delete(id);
    if (entry.cleared) return false;
    entry.fn();
    return true;
  }

  function flushAll() {
    while (flushNext()) {
      // continue until empty
    }
  }

  function count() {
    return pending.size;
  }

  return {
    setTimeout,
    clearTimeout,
    flushNext,
    flushAll,
    count,
  };
}
