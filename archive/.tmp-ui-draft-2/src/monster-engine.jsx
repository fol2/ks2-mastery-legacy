// MonsterEngine — tracks mastery per monster pool, catches, levels, evolves.
// Persists in localStorage under 'ks2-monsters-<profileId>' (or default key).
//
// Contract used by spelling-game:
//   MonsterEngine.recordMastery(profileId, monsterId, wordSlug) -> event | null
//     returns { kind: 'caught'|'levelup'|'evolve'|'mega'|null, monster, stage, level, mastered }
//     the word slug ensures we only count each unique word once toward the pool.
//   MonsterEngine.getState(profileId) -> { [monsterId]: { mastered: Set-as-Array, stage, level, caught } }
//   MonsterEngine.getMonsterProgress(profileId, monsterId) -> { mastered, stage, level, caught }

(function () {
  const BASE_KEY = 'ks2-monsters';

  function keyFor(profileId) {
    return `${BASE_KEY}-${profileId || 'default'}`;
  }

  function loadState(profileId) {
    try {
      const raw = localStorage.getItem(keyFor(profileId));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      // mastered stored as array; keep as array, dedupe-check on write
      return parsed || {};
    } catch { return {}; }
  }

  function saveState(profileId, state) {
    localStorage.setItem(keyFor(profileId), JSON.stringify(state));
  }

  function getMonsterProgress(profileId, monsterId) {
    const all = loadState(profileId);
    const m = all[monsterId] || { mastered: [], caught: false };
    const mastered = (m.mastered || []).length;
    return {
      mastered,
      stage: window.stageFor(mastered),
      level: window.levelFor(mastered),
      caught: !!m.caught || mastered >= 10,
      masteredList: m.mastered || [],
    };
  }

  // Record a mastered word for a monster. Returns event if a milestone was hit.
  function recordMastery(profileId, monsterId, wordSlug) {
    const all = loadState(profileId);
    const m = all[monsterId] || { mastered: [], caught: false };
    if (m.mastered.includes(wordSlug)) {
      // already counted — no event
      return null;
    }
    const prevMastered = m.mastered.length;
    const prevStage = window.stageFor(prevMastered);
    const prevLevel = window.levelFor(prevMastered);
    m.mastered = [...m.mastered, wordSlug];
    const newMastered = m.mastered.length;
    const newStage = window.stageFor(newMastered);
    const newLevel = window.levelFor(newMastered);

    // First catch
    let kind = null;
    if (!m.caught && newMastered >= 10) {
      m.caught = true;
      kind = 'caught';
    } else if (newStage > prevStage) {
      kind = newStage === 4 ? 'mega' : 'evolve';
    } else if (newLevel > prevLevel) {
      kind = 'levelup';
    }

    all[monsterId] = m;
    saveState(profileId, all);

    if (!kind) return null;
    return {
      kind,
      monsterId,
      monster: window.MONSTERS[monsterId],
      stage: newStage,
      level: newLevel,
      mastered: newMastered,
    };
  }

  // Dev / demo helper — reset
  function resetAll(profileId) {
    localStorage.removeItem(keyFor(profileId));
  }

  window.MonsterEngine = {
    getState: loadState,
    getMonsterProgress,
    recordMastery,
    resetAll,
  };
})();
