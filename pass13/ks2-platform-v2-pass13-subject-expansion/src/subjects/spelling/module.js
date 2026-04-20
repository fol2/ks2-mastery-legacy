import { monsterSummary } from '../../platform/game/monster-system.js';
import { monsterAsset } from '../../platform/game/monsters.js';
import { escapeHtml, formatElapsed } from '../../platform/core/utils.js';
import { createInitialSpellingState } from './service-contract.js';
import {
  spellingSessionContextNote,
  spellingSessionFooterNote,
  spellingSessionInfoChips,
  spellingSessionInputPlaceholder,
  spellingSessionProgressLabel,
  spellingSessionSubmitLabel,
} from './session-ui.js';

const SPELLING_ACCENT = '#3E6FA8';

function accentFor(subject) {
  return subject?.accent || SPELLING_ACCENT;
}


function summaryCards(cards = []) {
  return `
    <div class="stat-grid">
      ${cards.map((card) => `
        <div class="stat">
          <div class="stat-label">${escapeHtml(card.label)}</div>
          <div class="stat-value">${escapeHtml(card.value)}</div>
          <div class="stat-sub">${escapeHtml(card.sub || '')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function sessionStatusChip(service, session) {
  if (!session?.currentCard?.slug) return '';
  return `<span class="chip">${escapeHtml(service.stageLabel(session.currentStage || 0))}</span>`;
}

function renderCodex(learnerId, gameStateRepository) {
  const monsters = monsterSummary(learnerId, gameStateRepository);
  return `
    <div class="codex-grid">
      ${monsters.map(({ monster, progress }) => `
        <div class="monster-tile">
          <img alt="${escapeHtml(monster.name)}" src="${monsterAsset(monster.id, progress.stage)}" />
          <div>
            <p class="monster-name">${escapeHtml(monster.name)}</p>
            <div class="monster-meta">${escapeHtml(monster.blurb)}</div>
          </div>
          <div class="chip-row" style="justify-content:center;">
            <span class="chip">Stage ${progress.stage}</span>
            <span class="chip">${progress.mastered} secure</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPracticeDashboard({ learner, service, subject, repositories }) {
  const accent = accentFor(subject);
  const prefs = service.getPrefs(learner.id);
  const stats = service.getStats(learner.id, prefs.yearFilter);
  const modeOptions = [
    ['smart', 'Smart Review', 'Weighted mix of due, weak and new words.'],
    ['trouble', 'Trouble Drill', 'Keeps pressure on weak spellings.'],
    ['test', 'SATs Test', 'Twenty words, one attempt each.'],
  ];
  return `
    <div class="two-col">
      <section class="card border-top" style="border-top-color:${accent};">
        <div class="eyebrow">English spelling</div>
        <h2 class="section-title">Practice setup</h2>
        <p class="subtitle">This is the preserved spelling engine inside the new platform structure. The learning loop stays deterministic and subject-specific; the shell, analytics and game hooks sit around it.</p>
        <div style="margin-top:16px; display:grid; gap:12px;">
          ${modeOptions.map(([id, title, hint]) => `
            <label class="card soft" style="padding:14px; cursor:pointer; border-color:${prefs.mode === id ? accent : 'var(--line)'};">
              <div class="inline-row spread">
                <strong>${escapeHtml(title)}</strong>
                <input type="radio" name="spelling-mode" value="${id}" ${prefs.mode === id ? 'checked' : ''} data-action="spelling-set-mode" />
              </div>
              <div class="small muted" style="margin-top:6px;">${escapeHtml(hint)}</div>
            </label>
          `).join('')}
        </div>
        <div class="field-row" style="margin-top:16px;">
          <div class="field">
            <label for="spelling-year-filter">Year group</label>
            <select class="select" id="spelling-year-filter" data-action="spelling-set-pref" data-pref="yearFilter">
              <option value="all" ${prefs.yearFilter === 'all' ? 'selected' : ''}>Years 3-4 and 5-6</option>
              <option value="y3-4" ${prefs.yearFilter === 'y3-4' ? 'selected' : ''}>Years 3-4 only</option>
              <option value="y5-6" ${prefs.yearFilter === 'y5-6' ? 'selected' : ''}>Years 5-6 only</option>
            </select>
          </div>
          <div class="field">
            <label for="spelling-round-length">Round length</label>
            <select class="select" id="spelling-round-length" data-action="spelling-set-pref" data-pref="roundLength" ${prefs.mode === 'test' ? 'disabled' : ''}>
              <option value="10" ${prefs.roundLength === '10' ? 'selected' : ''}>10 words</option>
              <option value="20" ${prefs.roundLength === '20' ? 'selected' : ''}>20 words</option>
              <option value="40" ${prefs.roundLength === '40' ? 'selected' : ''}>40 words</option>
              <option value="all" ${prefs.roundLength === 'all' ? 'selected' : ''}>All available</option>
            </select>
          </div>
        </div>
        <div class="chip-row" style="margin-top:14px;">
          <label class="chip"><input type="checkbox" data-action="spelling-toggle-pref" data-pref="showCloze" ${prefs.showCloze ? 'checked' : ''}/> Show sentence blank</label>
          <label class="chip"><input type="checkbox" data-action="spelling-toggle-pref" data-pref="autoSpeak" ${prefs.autoSpeak ? 'checked' : ''}/> Auto-play dictation</label>
        </div>
        <div class="actions" style="margin-top:18px;">
          <button class="btn primary lg" style="background:#3E6FA8;" data-action="spelling-start">Start ${prefs.mode === 'test' ? 'SATs test' : prefs.mode === 'trouble' ? 'trouble drill' : 'Smart Review'}</button>
        </div>
      </section>
      <section class="card">
        <div class="eyebrow">Current learner</div>
        <h2 class="section-title">${escapeHtml(learner.name)}</h2>
        <p class="subtitle">${escapeHtml(learner.yearGroup)} · ${escapeHtml(learner.goal)}</p>
        ${summaryCards([
          { label: 'Total spellings', value: stats.total, sub: 'KS2 statutory list' },
          { label: 'Secure', value: stats.secure, sub: 'Stable recall' },
          { label: 'Due today', value: stats.due, sub: 'Needs a return visit' },
          { label: 'Weak spots', value: stats.trouble, sub: 'Wrong more than right' },
          { label: 'Unseen', value: stats.fresh, sub: 'Not yet introduced' },
          { label: 'Accuracy', value: stats.accuracy == null ? '—' : `${stats.accuracy}%`, sub: 'Across stored attempts' },
        ])}
        <div class="card soft" style="margin-top:16px;">
          <div class="eyebrow">Game layer placeholder</div>
          <h3 class="section-title" style="font-size:1.15rem;">Codex progress</h3>
          ${renderCodex(learner.id, repositories?.gameState)}
        </div>
      </section>
    </div>
  `;
}

function renderFeedback(feedback) {
  if (!feedback) return '';
  const tone = feedback.kind === 'success' ? 'good' : feedback.kind === 'error' ? 'bad' : 'warn';
  return `
    <div class="feedback ${tone}">
      <strong>${escapeHtml(feedback.headline || '')}</strong>
      ${feedback.answer ? `<div class="prompt-word" style="font-size:2rem;">${escapeHtml(feedback.answer)}</div>` : ''}
      ${feedback.body ? `<div>${escapeHtml(feedback.body)}</div>` : ''}
      ${feedback.footer ? `<div class="small muted">${escapeHtml(feedback.footer)}</div>` : ''}
      ${Array.isArray(feedback.familyWords) && feedback.familyWords.length > 1 ? `<div class="chip-row">${feedback.familyWords.map((word) => `<span class="chip mono">${escapeHtml(word)}</span>`).join('')}</div>` : ''}
    </div>
  `;
}

function renderSession({ learner, service, ui, subject }) {
  const accent = accentFor(subject);
  const prefs = service.getPrefs(learner.id);
  const session = ui.session;
  const card = session?.currentCard;
  const showCloze = prefs.showCloze && session?.type !== 'test';
  const awaitingAdvance = Boolean(ui.awaitingAdvance);
  const submitLabel = spellingSessionSubmitLabel(session, awaitingAdvance);
  const inputPlaceholder = spellingSessionInputPlaceholder(session);
  const contextNote = spellingSessionContextNote(session);
  const footerNote = spellingSessionFooterNote(session);
  const infoChips = spellingSessionInfoChips(session);
  if (!session || !card || !card.word) {
    return `
      <section class="card">
        <div class="eyebrow">No active session</div>
        <h2 class="section-title">Start a spelling round</h2>
        <button class="btn primary" style="background:#3E6FA8;" data-action="spelling-back">Back to spelling dashboard</button>
      </section>
    `;
  }

  return `
    <div class="practice-card">
      <section class="card border-top" style="border-top-color:${accent};">
        <div class="card-header">
          <div>
            <div class="eyebrow">${escapeHtml(session.label)}</div>
            <h2 class="section-title">${escapeHtml(learner.name)} · ${session.progress.done + 1} of ${session.progress.total}</h2>
          </div>
          <div class="chip-row">
            <span class="chip">Checked ${session.progress.checked}/${session.progress.total}</span>
            <span class="chip">${escapeHtml(spellingSessionProgressLabel(session))}</span>
            ${sessionStatusChip(service, session)}
          </div>
        </div>
        <div class="progress"><span style="width:${Math.min(100, Math.round((session.progress.done / Math.max(1, session.progress.total)) * 100))}%; background:${accent};"></span></div>
      </section>

      <section class="prompt-card">
        <div class="chip-row">
          ${infoChips.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join('')}
        </div>
        <h3 class="prompt-word">${session.type === 'test' ? 'Spell the dictated word' : 'Spell the word you hear'}</h3>
        <p class="subtitle">Use replay as often as you need. The answer only appears after the engine says so.</p>
        ${showCloze ? `<p class="prompt-sentence">${escapeHtml(card.prompt.cloze)}</p>` : `<p class="prompt-sentence muted">${escapeHtml(contextNote)}</p>`}
        <form data-action="spelling-submit-form" style="margin-top:16px; display:grid; gap:12px;">
          <label class="field">
            <span>Your answer</span>
            <input class="input" name="typed" data-autofocus="true" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${escapeHtml(inputPlaceholder)}" ${awaitingAdvance ? 'disabled' : ''} />
          </label>
          <div class="btn-row">
            <button class="btn primary" style="background:#3E6FA8;" type="submit" ${awaitingAdvance ? 'disabled' : ''}>${escapeHtml(submitLabel)}</button>
            <button class="btn secondary" type="button" data-action="spelling-replay">Replay</button>
            <button class="btn ghost" type="button" data-action="spelling-replay-slow">Slow replay</button>
            ${session.type !== 'test' && session.phase === 'question' ? '<button class="btn ghost" type="button" data-action="spelling-skip">Skip for now</button>' : ''}
            ${awaitingAdvance ? '<button class="btn good" type="button" data-action="spelling-continue">Continue</button>' : ''}
            <button class="btn bad" type="button" data-action="spelling-end-early">End session</button>
          </div>
        </form>
        <p class="small muted" style="margin-top:12px;">${escapeHtml(footerNote)}</p>
        ${renderFeedback(ui.feedback)}
      </section>
    </div>
  `;
}

function renderSummary({ learner, ui, service, subject, repositories }) {
  const accent = accentFor(subject);
  const summary = ui.summary;
  if (!summary) return '';
  return `
    <div class="summary-grid">
      <section class="card">
        <div class="summary-hero">
          <div class="summary-hero-icon" style="background:${summary.mistakes.length ? 'var(--warn-soft)' : 'var(--good-soft)'}; color:${summary.mistakes.length ? 'var(--warn)' : 'var(--good)'};">${summary.mistakes.length ? '!' : '✓'}</div>
          <div>
            <div class="eyebrow">${escapeHtml(summary.label)}</div>
            <h2 class="section-title">${escapeHtml(summary.message)}</h2>
            <p class="subtitle">Time on task: ${formatElapsed(summary.elapsedMs)}</p>
          </div>
        </div>
      </section>
      <section class="card">
        <div class="eyebrow">Round breakdown</div>
        <h2 class="section-title">Session summary</h2>
        ${summaryCards(summary.cards)}
      </section>
      ${summary.mistakes.length ? `
        <section class="card">
          <div class="card-header">
            <div>
              <div class="eyebrow">Mistake drill</div>
              <h2 class="section-title">Words that need another go</h2>
            </div>
            <button class="btn primary" style="background:#3E6FA8;" data-action="spelling-drill-all">Drill these ${summary.mistakes.length}</button>
          </div>
          <div class="chip-row">
            ${summary.mistakes.map((word) => `<button class="word-pill" data-action="spelling-drill-single" data-slug="${escapeHtml(word.slug)}">${escapeHtml(word.word)} <span class="muted">· ${escapeHtml(word.family)}</span></button>`).join('')}
          </div>
        </section>
      ` : ''}
      <section class="card soft">
        <div class="eyebrow">Codex after this round</div>
        <h2 class="section-title">Reward layer</h2>
        ${renderCodex(learner.id, repositories?.gameState)}
      </section>
      <div class="actions">
        <button class="btn secondary" data-action="spelling-back">Back to spelling dashboard</button>
        <button class="btn primary" style="background:#3E6FA8;" data-action="spelling-start-again">Start another round</button>
      </div>
    </div>
  `;
}

function renderAnalytics({ learner, service, repositories }) {
  const analytics = service.getAnalyticsSnapshot(learner.id);
  const all = analytics.pools.all;
  const y34 = analytics.pools.y34;
  const y56 = analytics.pools.y56;
  return `
    <div class="three-col">
      <section class="card">
        <div class="eyebrow">All spellings</div>
        <h2 class="section-title">Whole-list progress</h2>
        ${summaryCards([
          { label: 'Total', value: all.total, sub: 'Words on the list' },
          { label: 'Secure', value: all.secure, sub: 'Stage 4+' },
          { label: 'Due now', value: all.due, sub: 'Due today or overdue' },
          { label: 'Accuracy', value: all.accuracy == null ? '—' : `${all.accuracy}%`, sub: 'Across stored attempts' },
        ])}
      </section>
      <section class="card">
        <div class="eyebrow">Years 3-4</div>
        <h2 class="section-title">Lower KS2 spelling pool</h2>
        ${summaryCards([
          { label: 'Total', value: y34.total, sub: 'Words in pool' },
          { label: 'Secure', value: y34.secure, sub: 'Stable recall' },
          { label: 'Trouble', value: y34.trouble, sub: 'Weak or fragile' },
          { label: 'Unseen', value: y34.fresh, sub: 'Not yet introduced' },
        ])}
      </section>
      <section class="card">
        <div class="eyebrow">Years 5-6</div>
        <h2 class="section-title">Upper KS2 spelling pool</h2>
        ${summaryCards([
          { label: 'Total', value: y56.total, sub: 'Words in pool' },
          { label: 'Secure', value: y56.secure, sub: 'Stable recall' },
          { label: 'Trouble', value: y56.trouble, sub: 'Weak or fragile' },
          { label: 'Unseen', value: y56.fresh, sub: 'Not yet introduced' },
        ])}
      </section>
      <section class="card" style="grid-column:1/-1;">
        <div class="eyebrow">Game layer</div>
        <h2 class="section-title">Codex progress</h2>
        <p class="subtitle">This remains separate from the learning loop. The engine decides mastery; the game system reacts to secure words after the fact.</p>
        ${renderCodex(learner.id, repositories?.gameState)}
      </section>
    </div>
  `;
}

function renderProfiles({ learner }) {
  return `
    <div class="two-col">
      <section class="card">
        <div class="eyebrow">Current learner</div>
        <h2 class="section-title">Spelling profile hooks</h2>
        <p class="subtitle">This subject uses the shared learner profile rather than owning its own profile system.</p>
        <div class="stat-grid">
          <div class="stat"><div class="stat-label">Name</div><div class="stat-value" style="font-size:1.1rem;">${escapeHtml(learner.name)}</div></div>
          <div class="stat"><div class="stat-label">Year group</div><div class="stat-value" style="font-size:1.1rem;">${escapeHtml(learner.yearGroup)}</div></div>
          <div class="stat"><div class="stat-label">Goal</div><div class="stat-value" style="font-size:1.1rem;">${escapeHtml(learner.goal)}</div></div>
          <div class="stat"><div class="stat-label">Daily target</div><div class="stat-value" style="font-size:1.1rem;">${learner.dailyMinutes} min</div></div>
        </div>
      </section>
      <section class="card soft">
        <div class="eyebrow">Why this matters</div>
        <h2 class="section-title">Spelling routing</h2>
        <div class="callout">Year group controls pool filtering, the dashboard keeps the engine deterministic, and future personalisation can sit above the engine instead of inside it.</div>
      </section>
    </div>
  `;
}

function renderSettings({ learner, service, spellingContent }) {
  const prefs = service.getPrefs(learner.id);
  const contentSummary = spellingContent?.getSummary?.() || null;
  const validationTone = contentSummary?.ok ? 'good' : 'bad';
  const publishDisabled = contentSummary && !contentSummary.ok ? 'disabled' : '';
  return `
    <div class="two-col">
      <section class="card">
        <div class="eyebrow">Spelling settings</div>
        <h2 class="section-title">Current defaults</h2>
        <div class="chip-row">
          <span class="chip">Mode: ${escapeHtml(prefs.mode)}</span>
          <span class="chip">Year filter: ${escapeHtml(prefs.yearFilter)}</span>
          <span class="chip">Round length: ${escapeHtml(prefs.roundLength)}</span>
          <span class="chip">Cloze: ${prefs.showCloze ? 'on' : 'off'}</span>
          <span class="chip">Auto speak: ${prefs.autoSpeak ? 'on' : 'off'}</span>
        </div>
      </section>
      <section class="card soft">
        <div class="eyebrow">Deployment mode</div>
        <h2 class="section-title">Local-first adapter</h2>
        <p class="subtitle">The reference rebuild runs Spelling in the browser with deterministic local persistence. The worker folder defines the Cloudflare API shape that can replace this adapter later without changing the subject UI.</p>
      </section>
      <section class="card" style="grid-column:1/-1;">
        <div class="eyebrow">Content model</div>
        <h2 class="section-title">Draft, published release, and runtime snapshot</h2>
        <p class="subtitle">Spelling content now lives in a versioned draft/publish model. Runtime reads stay pinned to the current published release snapshot, so importing or editing draft content does not silently change live practice.</p>
        <div class="chip-row">
          <span class="chip ${validationTone}">Validation: ${contentSummary?.ok ? 'ready to publish' : 'needs fixes'}</span>
          <span class="chip">Word lists: ${contentSummary?.wordListCount || 0}</span>
          <span class="chip">Words: ${contentSummary?.wordCount || 0}</span>
          <span class="chip">Sentence variants: ${contentSummary?.sentenceCount || 0}</span>
          <span class="chip">Published release: ${contentSummary?.publishedVersion ? `v${contentSummary.publishedVersion}` : 'none'}</span>
          <span class="chip">Release id: ${escapeHtml(contentSummary?.publishedReleaseId || 'none')}</span>
          <span class="chip ${contentSummary?.errorCount ? 'bad' : 'good'}">Errors: ${contentSummary?.errorCount || 0}</span>
          <span class="chip ${contentSummary?.warningCount ? 'warn' : 'good'}">Warnings: ${contentSummary?.warningCount || 0}</span>
        </div>
        <div class="actions" style="margin-top:16px;">
          <button class="btn secondary" data-action="spelling-content-export">Export content JSON</button>
          <button class="btn secondary" data-action="spelling-content-import">Import content JSON</button>
          <button class="btn primary" style="background:#3E6FA8;" data-action="spelling-content-publish" ${publishDisabled}>Publish current draft</button>
          <button class="btn ghost" data-action="spelling-content-reset">Reset to bundled baseline</button>
        </div>
        <input id="spelling-content-import-file" type="file" accept="application/json,.json" hidden />
        <div class="callout" style="margin-top:16px;">This is a thin operator hook only. There is no in-app CMS yet: import/export handles content packages, publish creates an immutable release, and the learner-facing spelling engine stays isolated from editorial state.</div>
      </section>
    </div>
  `;
}

function renderMethod() {
  return `
    <div class="two-col">
      <section class="card">
        <div class="eyebrow">Learning system</div>
        <h2 class="section-title">What Spelling owns</h2>
        <div class="code-block">word data\ndeterministic scheduler\nsubmission flow\nprogress stages\nsummary generation</div>
      </section>
      <section class="card">
        <div class="eyebrow">Game layer</div>
        <h2 class="section-title">What the platform owns</h2>
        <div class="code-block">codex state\nreward events\nheader/dashboard surfaces\ncollection UI\nfuture quests and cosmetics</div>
      </section>
    </div>
  `;
}

export const spellingModule = {
  id: 'spelling',
  name: 'Spelling',
  blurb: 'Learn tricky words by sound, sight and meaning.',
  accent: '#3E6FA8',
  accentSoft: '#DCE6F3',
  accentTint: '#EEF3FA',
  icon: 'pen',
  available: true,
  initState() {
    return createInitialSpellingState();
  },
  getDashboardStats(appState, { service, repositories }) {
    const learner = appState.learners.byId[appState.learners.selectedId];
    const prefs = service.getPrefs(learner.id);
    const stats = service.getStats(learner.id, prefs.yearFilter);
    return {
      pct: stats.total ? Math.round((stats.secure / stats.total) * 100) : 0,
      due: stats.due,
      streak: monsterSummary(learner.id, repositories?.gameState).reduce((max, entry) => Math.max(max, entry.progress.level), 0),
      nextUp: stats.trouble ? 'Trouble drill' : stats.due ? 'Due review' : 'Fresh spellings',
    };
  },
  renderPractice(context) {
    const { appState } = context;
    const learner = appState.learners.byId[appState.learners.selectedId];
    const ui = context.service.initState(appState.subjectUi.spelling, learner.id);
    if (ui.phase === 'summary') return renderSummary({ ...context, learner, ui });
    if (ui.phase === 'session') return renderSession({ ...context, learner, ui });
    return renderPracticeDashboard({ ...context, learner });
  },
  renderAnalytics(context) {
    const learner = context.appState.learners.byId[context.appState.learners.selectedId];
    return renderAnalytics({ ...context, learner });
  },
  renderProfiles(context) {
    const learner = context.appState.learners.byId[context.appState.learners.selectedId];
    return renderProfiles({ ...context, learner });
  },
  renderSettings(context) {
    const learner = context.appState.learners.byId[context.appState.learners.selectedId];
    return renderSettings({ ...context, learner });
  },
  renderMethod() {
    return renderMethod();
  },
  handleAction(action, context) {
    const { appState, data, store, service, tts, repositories } = context;
    const learnerId = appState.learners.selectedId;
    const ui = service.initState(appState.subjectUi.spelling, learnerId);

    function applyTransition(transition) {
      if (!transition) return true;
      if (typeof context.applySubjectTransition === 'function') {
        return context.applySubjectTransition('spelling', transition);
      }
      store.updateSubjectUi('spelling', transition.state);
      if (transition.audio?.word) tts.speak(transition.audio);
      return true;
    }

    if (action === 'spelling-set-mode') {
      service.savePrefs(learnerId, { mode: data.value });
      store.updateSubjectUi('spelling', { phase: 'dashboard', error: '' });
      return true;
    }

    if (action === 'spelling-set-pref') {
      service.savePrefs(learnerId, { [data.pref]: data.value });
      store.updateSubjectUi('spelling', { phase: 'dashboard', error: '' });
      return true;
    }

    if (action === 'spelling-toggle-pref') {
      service.savePrefs(learnerId, { [data.pref]: data.checked === true });
      store.updateSubjectUi('spelling', { phase: 'dashboard', error: '' });
      return true;
    }

    if (action === 'spelling-start' || action === 'spelling-start-again') {
      const prefs = service.getPrefs(learnerId);
      tts.stop();
      return applyTransition(service.startSession(learnerId, {
        mode: prefs.mode,
        yearFilter: prefs.yearFilter,
        length: prefs.roundLength,
      }));
    }

    if (action === 'spelling-shortcut-start') {
      const mode = data.mode;
      if (!mode) return true;
      if (ui.phase === 'session') {
        const confirmed = globalThis.confirm?.('End the current spelling session and switch?');
        if (confirmed === false) return true;
      }
      service.savePrefs(learnerId, { mode });
      const prefs = service.getPrefs(learnerId);
      tts.stop();
      return applyTransition(service.startSession(learnerId, {
        mode: prefs.mode,
        yearFilter: prefs.yearFilter,
        length: prefs.roundLength,
      }));
    }

    if (action === 'spelling-submit-form') {
      const typed = data.formData.get('typed');
      return applyTransition(service.submitAnswer(learnerId, ui, typed));
    }

    if (action === 'spelling-continue') {
      return applyTransition(service.continueSession(learnerId, ui));
    }

    if (action === 'spelling-skip') {
      return applyTransition(service.skipWord(learnerId, ui));
    }

    if (action === 'spelling-replay') {
      if (ui.session?.currentCard?.word) {
        tts.speak({ word: ui.session.currentCard.word, sentence: ui.session.currentCard.prompt?.sentence });
      }
      return true;
    }

    if (action === 'spelling-replay-slow') {
      if (ui.session?.currentCard?.word) {
        tts.speak({ word: ui.session.currentCard.word, sentence: ui.session.currentCard.prompt?.sentence, slow: true });
      }
      return true;
    }

    if (action === 'spelling-end-early') {
      const confirmed = globalThis.confirm?.('End this session now?');
      if (confirmed === false) return true;
      tts.stop();
      return applyTransition(service.endSession(learnerId, ui));
    }

    if (action === 'spelling-back') {
      tts.stop();
      return applyTransition(service.endSession(learnerId, ui));
    }

    if (action === 'spelling-drill-all') {
      if (!ui.summary?.mistakes?.length) return true;
      tts.stop();
      return applyTransition(service.startSession(learnerId, {
        mode: 'trouble',
        words: ui.summary.mistakes.map((word) => word.slug),
        yearFilter: 'all',
        length: ui.summary.mistakes.length,
      }));
    }

    if (action === 'spelling-drill-single') {
      const slug = data.slug;
      if (!slug) return true;
      tts.stop();
      return applyTransition(service.startSession(learnerId, {
        mode: 'single',
        words: [slug],
        yearFilter: 'all',
        length: 1,
      }));
    }

    return false;
  },
};
