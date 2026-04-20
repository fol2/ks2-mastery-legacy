import { escapeHtml } from '../core/utils.js';
import { platformRoleLabel } from '../access/roles.js';
import { SUBJECTS, getSubject } from '../core/subject-registry.js';
import { subjectTabLabel } from '../core/subject-runtime.js';
import { monsterAsset } from '../game/monsters.js';
import { monsterSummary } from '../game/monster-system.js';

const TAB_META = [
  ['practice', 'Practice'],
  ['analytics', 'Analytics'],
  ['profiles', 'Profiles'],
  ['settings', 'Settings'],
  ['method', 'Method'],
];

function iconGlyph(icon) {
  return {
    pen: '✎',
    plus: '+',
    brain: '◈',
    speech: '✦',
    quote: '❝',
    book: '▣',
  }[icon] || '•';
}

function subjectContext(subject, context) {
  return {
    ...context,
    subject,
    service: context.services?.[subject.id] || null,
  };
}

function learnerSelect(appState) {
  const learners = appState.learners.allIds.map((id) => appState.learners.byId[id]).filter(Boolean);
  return `
    <label class="field" style="min-width:220px;">
      <span>Current learner</span>
      <select class="select" data-action="learner-select" name="learnerId">
        ${learners.map((learner) => `<option value="${escapeHtml(learner.id)}" ${learner.id === appState.learners.selectedId ? 'selected' : ''}>${escapeHtml(learner.name)} · ${escapeHtml(learner.yearGroup)}</option>`).join('')}
      </select>
    </label>
  `;
}
function registeredSubjects(context) {
  return Array.isArray(context?.subjects) && context.subjects.length ? context.subjects : SUBJECTS;
}

function resolveSubject(subjectId, context) {
  return registeredSubjects(context).find((subject) => subject.id === subjectId) || getSubject(subjectId);
}

function formatTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '—';
  try {
    return new Date(numeric).toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function renderSurfaceRoleSelect(context) {
  const currentRole = context?.shellAccess?.platformRole || 'parent';
  return `
    <label class="field" style="min-width:180px;">
      <span>Reference surface role</span>
      <select class="select" data-action="shell-set-role" name="platformRole">
        ${['parent', 'admin', 'ops'].map((role) => `<option value="${role}" ${role === currentRole ? 'selected' : ''}>${escapeHtml(platformRoleLabel(role))}</option>`).join('')}
      </select>
    </label>
  `;
}

function renderAccessDeniedCard(title, detail, backAction = 'navigate-home') {
  return `
    <section class="card">
      <div class="feedback warn">
        <strong>${escapeHtml(title)}</strong>
        <div style="margin-top:8px;">${escapeHtml(detail)}</div>
      </div>
      <div class="actions" style="margin-top:16px;">
        <button class="btn secondary" data-action="${escapeHtml(backAction)}">Back to dashboard</button>
      </div>
    </section>
  `;
}

function persistenceTone(snapshot) {
  if (snapshot?.mode === 'remote-sync') return 'good';
  if (snapshot?.mode === 'degraded') return 'warn';
  return '';
}

function persistenceLabel(snapshot) {
  if (snapshot?.mode === 'remote-sync') {
    const syncing = Number(snapshot?.inFlightWriteCount) || 0;
    return syncing > 0 ? `Remote sync · syncing ${syncing}` : 'Remote sync';
  }
  if (snapshot?.mode === 'degraded') return snapshot?.remoteAvailable ? 'Sync degraded' : 'Local storage degraded';
  return 'Local-only';
}

function persistenceTrustedLabel(snapshot) {
  if (snapshot?.trustedState === 'remote') return 'Trusted: remote';
  if (snapshot?.trustedState === 'local-cache') return 'Trusted: local cache';
  if (snapshot?.trustedState === 'memory') return 'Trusted: memory only';
  return 'Trusted: this browser';
}

function persistenceSummary(snapshot) {
  if (snapshot?.mode === 'remote-sync') {
    if ((Number(snapshot?.inFlightWriteCount) || 0) > 0) {
      return 'Remote sync is available. Changes are usable immediately and are being pushed to the server now.';
    }
    return 'Remote sync is available. The remote repository is the trusted durable copy.';
  }

  if (snapshot?.mode === 'degraded') {
    if (snapshot?.remoteAvailable) {
      if (snapshot?.lastError?.code === 'stale_write') {
        return 'Another tab or device changed this learner before this write reached the server. This browser is showing a local blocked branch. Retry sync will reload the latest remote state and discard the blocked local change.';
      }
      if (snapshot?.lastError?.code === 'idempotency_reuse') {
        return 'A retry reused an old mutation request id for different data. Retry sync will reload the latest remote state before any new write is accepted.';
      }
      if (snapshot?.cacheState === 'ahead-of-remote') {
        const count = Number(snapshot?.pendingWriteCount) || 0;
        return `Remote sync failed. This browser is continuing from its local cache. ${count} cached change${count === 1 ? '' : 's'} still need remote sync, so the server may be behind.`;
      }
      return 'Remote sync is unavailable right now. The platform is continuing from the last local cache for this browser.';
    }
    return 'Browser storage failed. Current changes only live in memory in this browser until persistence recovers.';
  }

  return 'This build is running local-only. This browser storage is the only trusted durable copy until a real backend is wired in.';
}

function persistenceDebug(snapshot) {
  return snapshot?.lastError?.message || 'No persistence error recorded.';
}

function renderPersistenceChip(snapshot) {
  return `<span class="chip ${persistenceTone(snapshot)}">${escapeHtml(persistenceLabel(snapshot))}</span>`;
}

function renderPersistenceBanner(snapshot) {
  if (snapshot?.mode !== 'degraded') return '';
  const pendingCount = Number(snapshot?.pendingWriteCount) || 0;
  return `
    <section class="card" style="margin-bottom:20px;">
      <div class="feedback warn">
        <strong>${escapeHtml(persistenceLabel(snapshot))}</strong>
        <div style="margin-top:8px;">${escapeHtml(persistenceSummary(snapshot))}</div>
      </div>
      <div class="chip-row" style="margin-top:14px;">
        <span class="chip warn">${escapeHtml(persistenceTrustedLabel(snapshot))}</span>
        <span class="chip">Cache: ${escapeHtml(snapshot?.cacheState || 'unknown')}</span>
        <span class="chip">Pending: ${pendingCount}</span>
      </div>
      ${snapshot?.remoteAvailable ? `<div class="actions" style="margin-top:16px;"><button class="btn secondary" data-action="persistence-retry">Retry sync</button></div>` : ''}
      <details style="margin-top:16px;">
        <summary>Persistence details</summary>
        <div class="small muted" style="margin-top:10px;">${escapeHtml(persistenceDebug(snapshot))}</div>
      </details>
    </section>
  `;
}

function renderPersistenceInline(snapshot) {
  return `
    <div class="chip-row" style="margin-top:12px; align-items:center;">
      ${renderPersistenceChip(snapshot)}
      <span class="chip">${escapeHtml(persistenceTrustedLabel(snapshot))}</span>
    </div>
    <p class="small muted" style="margin-top:12px;">${escapeHtml(persistenceSummary(snapshot))}</p>
    ${snapshot?.mode === 'degraded' && snapshot?.remoteAvailable ? '<div class="actions" style="margin-top:12px;"><button class="btn secondary" data-action="persistence-retry">Retry sync</button></div>' : ''}
  `;
}

function safeDashboardStats(subject, appState, context) {
  try {
    return subject.getDashboardStats
      ? subject.getDashboardStats(appState, subjectContext(subject, context))
      : { pct: 0, due: 0, streak: 0, nextUp: 'Planned' };
  } catch (error) {
    context.runtimeBoundary?.capture?.({
      learnerId: appState.learners.selectedId,
      subject,
      tab: 'dashboard',
      phase: 'dashboard-stats',
      methodName: 'getDashboardStats',
      error,
    });
    return {
      pct: 0,
      due: '—',
      streak: '—',
      nextUp: 'Temporarily unavailable',
      unavailable: true,
    };
  }
}

function subjectRenderFallback(subject, runtimeEntry, activeTab) {
  const accent = subject.accent || '#3E6FA8';
  const phaseLabel = runtimeEntry?.phase === 'action' ? 'Action failure' : 'Render failure';
  const technicalSource = runtimeEntry?.phase === 'action'
    ? runtimeEntry?.action || runtimeEntry?.methodName || 'handleAction'
    : runtimeEntry?.methodName || `render${subjectTabLabel(activeTab)}`;
  return `
    <section class="card border-top" style="border-top-color:${accent};">
      <div class="feedback bad">
        <strong>${escapeHtml(subject.name)} · ${escapeHtml(subjectTabLabel(activeTab))} temporarily unavailable</strong>
        <div style="margin-top:8px;">${escapeHtml(runtimeEntry?.message || `${subject.name} hit an unexpected error.`)}</div>
      </div>
      <div class="chip-row" style="margin-top:14px;">
        <span class="chip warn">Contained to this tab</span>
        <span class="chip">${escapeHtml(phaseLabel)}</span>
      </div>
      <div class="actions" style="margin-top:16px;">
        <button class="btn secondary" data-action="subject-runtime-retry">Try this tab again</button>
        <button class="btn ghost" data-action="navigate-home">Back to dashboard</button>
      </div>
      <details style="margin-top:16px;">
        <summary>Technical details</summary>
        <div class="small muted" style="margin-top:10px;">${escapeHtml(technicalSource)}</div>
        <div class="code-block" style="margin-top:10px;">${escapeHtml(runtimeEntry?.debugMessage || 'Unknown error')}</div>
      </details>
    </section>
  `;
}

function subjectTabContent(subject, activeTab, appState, contentContext, runtimeEntry) {
  if (runtimeEntry) {
    const fallback = subjectRenderFallback(subject, runtimeEntry, activeTab);
    return activeTab === 'profiles'
      ? `${renderLearnerManager(appState)}<div style="height:20px"></div>${fallback}`
      : fallback;
  }

  if (activeTab === 'practice') return subject.renderPractice(contentContext);
  if (activeTab === 'analytics') return subject.renderAnalytics(contentContext);
  if (activeTab === 'profiles') return `${renderLearnerManager(appState)}<div style="height:20px"></div>${subject.renderProfiles(contentContext)}`;
  if (activeTab === 'settings') return subject.renderSettings(contentContext);
  if (activeTab === 'method') return subject.renderMethod(contentContext);
  return '';
}


function renderHeader(appState, context) {
  const routeScreen = appState.route?.screen || 'dashboard';
  return `
    <header class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <div>
          <div class="eyebrow">KS2 Mastery platform rebuild</div>
          <h1 class="title">Stable foundation for all 6 KS2 exam subjects</h1>
          <p class="subtitle">The platform shell, learner model, reward layer and deployment boundary are now shared. Subject engines plug in through a clear contract instead of through window globals and special cases.</p>
        </div>
        <div class="actions" style="align-items:flex-end; justify-content:flex-end;">
          ${learnerSelect(appState)}
          ${renderSurfaceRoleSelect(context)}
          ${renderPersistenceChip(appState.persistence)}
          <button class="btn ${routeScreen === 'dashboard' ? 'ghost' : 'secondary'}" data-action="navigate-home">Dashboard</button>
          <button class="btn ${routeScreen === 'parent-hub' ? 'primary' : 'secondary'}" data-action="open-parent-hub">Parent Hub</button>
          <button class="btn ${routeScreen === 'admin-hub' ? 'primary' : 'secondary'}" data-action="open-admin-hub">Operations</button>
        </div>
      </div>
    </header>
  `;
}

function renderHero(context) {
  const learner = context.appState.learners.byId[context.appState.learners.selectedId];
  const monsters = monsterSummary(learner.id, context.repositories?.gameState);
  const secureTotal = monsters.reduce((sum, entry) => sum + entry.progress.mastered, 0);
  return `
    <section class="hero-grid" style="margin-bottom:20px;">
      <article class="card" style="position:relative; overflow:hidden;">
        <div class="eyebrow">Product direction kept intact</div>
        <h2 class="title" style="font-size:clamp(1.7rem, 3vw, 2.4rem);">Learning engine first. Game layer second. Both compound each other.</h2>
        <p class="subtitle">English Spelling is working in the rebuilt structure now. The other subjects already have a reserved place in the shell, API, analytics surfaces and reward system, so future work expands sideways instead of rewriting the whole app again.</p>
        <div class="actions" style="margin-top:18px;">
          <button class="btn primary lg" style="background:#3E6FA8;" data-action="open-subject" data-subject-id="spelling">Open English Spelling</button>
          <button class="btn secondary lg" data-action="open-subject" data-subject-id="reasoning">View subject placeholders</button>
        </div>
        <div class="hero-playground">
          ${monsters.map(({ monster, progress }) => `<img ${monster.id === 'phaeton' ? 'class="big"' : ''} alt="${escapeHtml(monster.name)}" src="${monsterAsset(monster.id, progress.stage)}" />`).join('')}
        </div>
      </article>
      <article class="card soft">
        <div class="eyebrow">Selected learner</div>
        <h2 class="section-title">${escapeHtml(learner.name)}</h2>
        <p class="subtitle">${escapeHtml(learner.yearGroup)} · goal: ${escapeHtml(learner.goal)} · ${learner.dailyMinutes} minutes daily</p>
        <div class="stat-grid" style="margin-top:16px;">
          <div class="stat"><div class="stat-label">Secure words</div><div class="stat-value">${secureTotal}</div><div class="stat-sub">Across unlocked codex creatures</div></div>
          <div class="stat"><div class="stat-label">Subjects live</div><div class="stat-value">1</div><div class="stat-sub">Spelling preserved and rebuilt</div></div>
          <div class="stat"><div class="stat-label">Subjects wired</div><div class="stat-value">6</div><div class="stat-sub">All KS2 exam slots reserved</div></div>
          <div class="stat"><div class="stat-label">Deployment target</div><div class="stat-value" style="font-size:1.1rem;">Cloudflare-ready</div><div class="stat-sub">Static app now, Worker boundary next</div></div>
        </div>
      </article>
    </section>
  `;
}

function renderSubjectCards(context) {
  const { appState } = context;
  return `
    <section class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <div>
          <div class="eyebrow">Subject registry</div>
          <h2 class="section-title">One product, six subject modules</h2>
        </div>
        <div class="chip-row">
          <span class="chip good">Shared learner profile</span>
          <span class="chip good">Shared reward layer</span>
          <span class="chip good">Shared deployment shell</span>
        </div>
      </div>
      <div class="dashboard-grid">
        ${registeredSubjects(context).map((subject) => {
          const stats = safeDashboardStats(subject, appState, context);
          const accent = subject.accent || '#3E6FA8';
          const accentSoft = subject.accentSoft || '#EEF3FA';
          const available = subject.available !== false;
          return `
            <button class="card subject-card" data-action="open-subject" data-subject-id="${escapeHtml(subject.id)}" style="border-color:${accent};">
              <div class="subject-card-top" style="background:${accentSoft}; color:${accent};">
                <div class="chip-row" style="justify-content:space-between; align-items:center;">
                  <span class="chip" style="background:white; color:${accent}; border-color:transparent;">${escapeHtml(iconGlyph(subject.icon))} ${escapeHtml(subject.name)}</span>
                  <span class="chip ${stats.unavailable ? 'bad' : available ? 'good' : 'warn'}">${stats.unavailable ? 'Temporarily unavailable' : available ? 'Live / ready' : 'Placeholder wired'}</span>
                </div>
                <h3 style="margin-top:14px;">${escapeHtml(subject.name)}</h3>
                <p>${escapeHtml(subject.blurb)}</p>
              </div>
              <div class="subject-card-body">
                <div class="progress-wrap">
                  <div class="progress-top"><span>Progress</span><span>${stats.pct}%</span></div>
                  <div class="progress"><span style="width:${Math.max(0, Math.min(100, stats.pct || 0))}%; background:${accent};"></span></div>
                </div>
                <div class="chip-row" style="margin-top:12px;">
                  <span class="chip">Due: ${escapeHtml(stats.due)}</span>
                  <span class="chip">Depth: ${escapeHtml(stats.streak)}</span>
                </div>
                <p class="small muted" style="margin-top:12px;">Next up: ${escapeHtml(stats.nextUp)}</p>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderLearnerManager(appState) {
  const learner = appState.learners.byId[appState.learners.selectedId];
  return `
    <section class="card">
      <div class="card-header">
        <div>
          <div class="eyebrow">Shared learner model</div>
          <h2 class="section-title">Profiles belong to the platform, not to one subject</h2>
        </div>
        <div class="actions">
          <button class="btn secondary" data-action="learner-create">Add learner</button>
          <button class="btn bad" data-action="learner-delete">Delete current learner</button>
          <button class="btn warn" data-action="learner-reset-progress">Reset learner progress</button>
          <button class="btn ghost" data-action="platform-reset-all">Reset all app data</button>
        </div>
      </div>
      <form data-action="learner-save-form">
        <div class="field-row">
          <label class="field">
            <span>Name</span>
            <input class="input" name="name" value="${escapeHtml(learner.name)}" />
          </label>
          <label class="field">
            <span>Year group</span>
            <select class="select" name="yearGroup">
              ${['Y3','Y4','Y5','Y6'].map((value) => `<option value="${value}" ${learner.yearGroup === value ? 'selected' : ''}>${value}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Primary goal</span>
            <select class="select" name="goal">
              ${[
                ['confidence', 'Confidence and habit'],
                ['sats', 'KS2 SATs prep'],
                ['catch-up', 'Catch-up and recovery'],
              ].map(([value, label]) => `<option value="${value}" ${learner.goal === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Daily minutes</span>
            <input class="input" type="number" min="5" max="60" name="dailyMinutes" value="${escapeHtml(String(learner.dailyMinutes || 15))}" />
          </label>
          <label class="field">
            <span>Accent colour</span>
            <input class="input" type="color" name="avatarColor" value="${escapeHtml(learner.avatarColor || '#3E6FA8')}" />
          </label>
        </div>
        <div class="actions" style="margin-top:14px;">
          <button class="btn primary" style="background:${escapeHtml(learner.avatarColor || '#3E6FA8')};" type="submit">Save learner profile</button>
        </div>
      </form>
      <section class="card soft" style="margin-top:16px;">
        <div class="eyebrow">Data safety</div>
        <h3 class="section-title" style="font-size:1.15rem;">Import / export</h3>
        <p class="subtitle">Exports use portable JSON snapshots. Full-app imports replace the current browser dataset. Learner imports keep existing learners and add an imported copy if the id already exists.</p>
        ${renderPersistenceInline(appState.persistence)}
        <div class="actions">
          <button class="btn secondary" data-action="platform-export-learner">Export current learner</button>
          <button class="btn secondary" data-action="platform-export-app">Export full app</button>
          <button class="btn ghost" data-action="platform-import">Import JSON</button>
        </div>
        <input id="platform-import-file" style="display:none;" type="file" accept=".json,application/json" />
      </section>
    </section>
  `;
}

function renderArchitectureStrip() {
  return `
    <section class="three-col" style="margin-top:20px;">
      <article class="card">
        <div class="eyebrow">Subject contract</div>
        <h2 class="section-title">Module per subject</h2>
        <div class="code-block">renderPractice()
renderAnalytics()
renderProfiles()
renderSettings()
renderMethod()
handleAction()</div>
      </article>
      <article class="card">
        <div class="eyebrow">Learning engine boundary</div>
        <h2 class="section-title">Deterministic core</h2>
        <div class="code-block">content data
scheduler / marking
progress model
summary builder
API adapter</div>
      </article>
      <article class="card">
        <div class="eyebrow">Game boundary</div>
        <h2 class="section-title">Reacts after mastery</h2>
        <div class="code-block">collectibles
quests
cosmetics
notifications
seasonal systems</div>
      </article>
    </section>
  `;
}

function renderDashboard(context) {
  return `${renderHero(context)}${renderSubjectCards(context)}<div class="two-col">${renderLearnerManager(context.appState)}<section class="card soft"><div class="eyebrow">Rebuild intent</div><h2 class="section-title">What changed under the surface</h2><div class="callout">The old proof-of-concept mixed UI, subject logic, persistence and reward behavior in the same flow. This rebuild separates those concerns so new subjects can drop in without destabilising the spelling slice.</div>${renderArchitectureStrip()}</section></div>`;
}

function renderHubStrengthList(title, items = [], emptyText = 'No signal yet.') {
  return `
    <section class="card">
      <div class="eyebrow">${escapeHtml(title)}</div>
      ${items.length ? items.map((item) => `
        <div class="skill-row">
          <div><strong>${escapeHtml(item.label || 'Untitled')}</strong></div>
          <div class="small muted">${escapeHtml(item.detail || '')}</div>
          <div>${escapeHtml(String(item.secureCount ?? item.count ?? '—'))}</div>
          <div class="small muted">${escapeHtml(item.troubleCount != null ? `${item.troubleCount} trouble` : '')}</div>
        </div>
      `).join('') : `<p class="small muted">${escapeHtml(emptyText)}</p>`}
    </section>
  `;
}

function renderParentHub(context) {
  const model = context.parentHub;
  if (!model?.permissions?.canViewParentHub) {
    return renderAccessDeniedCard(
      'Parent Hub is not available for the current surface role',
      'This pass keeps Parent Hub and Admin / Operations separate. In the Worker path, Parent Hub requires the parent platform role plus readable learner membership.',
    );
  }

  const overview = model.learnerOverview || {};
  const dueWork = Array.isArray(model.dueWork) ? model.dueWork : [];
  const recentSessions = Array.isArray(model.recentSessions) ? model.recentSessions : [];
  const strengths = Array.isArray(model.strengths) ? model.strengths : [];
  const weaknesses = Array.isArray(model.weaknesses) ? model.weaknesses : [];
  const patterns = Array.isArray(model.misconceptionPatterns) ? model.misconceptionPatterns : [];
  const snapshot = Array.isArray(model.progressSnapshots) ? model.progressSnapshots[0] : null;

  return `
    <section class="subject-header card border-top" style="border-top-color:#3E6FA8; margin-bottom:18px;">
      <div class="subject-title-row">
        <div>
          <div class="eyebrow">Parent Hub thin slice</div>
          <h2 class="title" style="font-size:clamp(1.6rem, 3vw, 2.2rem);">${escapeHtml(model.learner.name)}</h2>
          <p class="subtitle">Read model built from durable learner state, practice sessions and event log. No hidden client-only analytics store is used.</p>
        </div>
        <div class="chip-row">
          <span class="chip good">${escapeHtml(model.permissions.platformRoleLabel)}</span>
          <span class="chip">${escapeHtml(model.permissions.membershipRoleLabel)}</span>
          <span class="chip">Last activity: ${escapeHtml(formatTimestamp(model.learner.lastActivityAt))}</span>
        </div>
      </div>
    </section>
    <section class="two-col" style="margin-bottom:20px;">
      <article class="card">
        <div class="eyebrow">Learner overview</div>
        <h3 class="section-title" style="font-size:1.2rem;">Current picture</h3>
        <div class="stat-grid" style="margin-top:16px;">
          <div class="stat"><div class="stat-label">Secure words</div><div class="stat-value">${escapeHtml(String(overview.secureWords ?? 0))}</div><div class="stat-sub">Spelling snapshot</div></div>
          <div class="stat"><div class="stat-label">Due now</div><div class="stat-value">${escapeHtml(String(overview.dueWords ?? 0))}</div><div class="stat-sub">Needs spaced return</div></div>
          <div class="stat"><div class="stat-label">Trouble load</div><div class="stat-value">${escapeHtml(String(overview.troubleWords ?? 0))}</div><div class="stat-sub">Recent difficulty</div></div>
          <div class="stat"><div class="stat-label">Accuracy</div><div class="stat-value">${escapeHtml(overview.accuracyPercent == null ? '—' : `${overview.accuracyPercent}%`)}</div><div class="stat-sub">Across durable progress</div></div>
        </div>
        <div class="callout" style="margin-top:16px;">
          <strong>Current focus</strong>
          ${dueWork.length ? dueWork.map((entry) => `<div style="margin-top:8px;"><strong>${escapeHtml(entry.label)}</strong><div class="small muted">${escapeHtml(entry.detail || '')}</div></div>`).join('') : '<div class="small muted" style="margin-top:8px;">No due work is surfaced yet.</div>'}
        </div>
      </article>
      <article class="card soft">
        <div class="eyebrow">Progress snapshot / export</div>
        <h3 class="section-title" style="font-size:1.2rem;">Portable recovery points</h3>
        <p class="subtitle">Parent Hub only surfaces export entry points. It does not invent a separate reporting store.</p>
        <div class="chip-row" style="margin-top:14px;">
          <span class="chip">Tracked: ${escapeHtml(String(snapshot?.trackedWords ?? 0))}</span>
          <span class="chip">Published pool: ${escapeHtml(String(snapshot?.totalPublishedWords ?? 0))}</span>
          <span class="chip">Subject: spelling</span>
        </div>
        <div class="actions" style="margin-top:16px;">
          ${model.exportEntryPoints.map((entry) => `<button class="btn secondary" data-action="${escapeHtml(entry.action)}">${escapeHtml(entry.label)}</button>`).join('')}
        </div>
      </article>
    </section>
    <section class="two-col" style="margin-bottom:20px;">
      <article class="card">
        <div class="eyebrow">Recent sessions</div>
        <h3 class="section-title" style="font-size:1.2rem;">Latest durable session records</h3>
        ${recentSessions.length ? recentSessions.map((entry) => `
          <details style="margin-top:12px;">
            <summary>${escapeHtml(entry.label)} · ${escapeHtml(formatTimestamp(entry.updatedAt))}</summary>
            <div class="small muted" style="margin-top:10px;">${escapeHtml(entry.status)} · ${escapeHtml(entry.sessionKind)} · mistakes: ${escapeHtml(String(entry.mistakeCount || 0))}</div>
            ${entry.headline ? `<div class="small muted" style="margin-top:6px;">Summary card: ${escapeHtml(entry.headline)}</div>` : ''}
          </details>
        `).join('') : '<p class="small muted">No completed or active sessions are stored yet.</p>'}
      </article>
      <article class="card">
        <div class="eyebrow">Misconception patterns</div>
        <h3 class="section-title" style="font-size:1.2rem;">Where correction is clustering</h3>
        ${patterns.length ? patterns.map((entry) => `
          <div class="skill-row">
            <div><strong>${escapeHtml(entry.label)}</strong></div>
            <div class="small muted">${escapeHtml(entry.source || 'pattern')}</div>
            <div>${escapeHtml(String(entry.count || 0))}</div>
            <div class="small muted">${escapeHtml(formatTimestamp(entry.lastSeenAt))}</div>
          </div>
        `).join('') : '<p class="small muted">No durable mistake patterns have been recorded yet.</p>'}
      </article>
    </section>
    <section class="two-col">
      ${renderHubStrengthList('Broad strengths', strengths, 'No broad strengths have emerged yet.')}
      ${renderHubStrengthList('Broad weaknesses', weaknesses, 'No broad weaknesses have surfaced yet.')}
    </section>
  `;
}

function renderAdminHub(context) {
  const model = context.adminHub;
  if (!model?.permissions?.canViewAdminHub) {
    return renderAccessDeniedCard(
      'Admin / Operations is not available for the current surface role',
      'This pass makes the split explicit. In the Worker path, Admin / Operations requires the admin or operations platform role.',
    );
  }

  const selectedDiagnostics = model.learnerSupport?.selectedDiagnostics || null;
  const accessibleLearners = Array.isArray(model.learnerSupport?.accessibleLearners) ? model.learnerSupport.accessibleLearners : [];
  const auditEntries = Array.isArray(model.auditLogLookup?.entries) ? model.auditLogLookup.entries : [];

  return `
    <section class="subject-header card border-top" style="border-top-color:#8A4FFF; margin-bottom:18px;">
      <div class="subject-title-row">
        <div>
          <div class="eyebrow">Admin / operations skeleton</div>
          <h2 class="title" style="font-size:clamp(1.6rem, 3vw, 2.2rem);">First SaaS operating surfaces</h2>
          <p class="subtitle">Thin and honest. Content release status and learner diagnostics are real. Audit lookup is only live on the Worker path in this pass.</p>
        </div>
        <div class="chip-row">
          <span class="chip good">${escapeHtml(model.permissions.platformRoleLabel)}</span>
          <span class="chip">Repo revision: ${escapeHtml(String(model.account.repoRevision || 0))}</span>
          <span class="chip">Selected learner: ${escapeHtml(model.account.selectedLearnerId || '—')}</span>
        </div>
      </div>
    </section>
    <section class="two-col" style="margin-bottom:20px;">
      <article class="card">
        <div class="eyebrow">Content release status</div>
        <h3 class="section-title" style="font-size:1.2rem;">Published spelling snapshot</h3>
        <div class="chip-row" style="margin-top:14px;">
          <span class="chip good">Release ${escapeHtml(String(model.contentReleaseStatus.publishedVersion || 0))}</span>
          <span class="chip">${escapeHtml(model.contentReleaseStatus.publishedReleaseId || 'unpublished')}</span>
          <span class="chip">${escapeHtml(String(model.contentReleaseStatus.runtimeWordCount || 0))} words</span>
          <span class="chip">${escapeHtml(String(model.contentReleaseStatus.runtimeSentenceCount || 0))} sentences</span>
        </div>
        <p class="small muted" style="margin-top:12px;">Draft ${escapeHtml(model.contentReleaseStatus.currentDraftId)} · version ${escapeHtml(String(model.contentReleaseStatus.currentDraftVersion || 1))} · updated ${escapeHtml(formatTimestamp(model.contentReleaseStatus.draftUpdatedAt))}</p>
        <div class="actions" style="margin-top:16px;">
          <button class="btn secondary" data-action="open-subject" data-subject-id="spelling">Open Spelling</button>
          <button class="btn secondary" data-action="open-subject" data-subject-id="spelling" data-tab="settings">Open settings tab</button>
          <button class="btn ghost" data-action="spelling-content-export">Export content</button>
        </div>
      </article>
      <article class="card soft">
        <div class="eyebrow">Import / validation status</div>
        <h3 class="section-title" style="font-size:1.2rem;">Draft versus published safety</h3>
        <div class="feedback ${model.importValidationStatus.ok ? 'good' : 'bad'}">
          <strong>${escapeHtml(model.importValidationStatus.ok ? 'Validation clean' : 'Validation problems present')}</strong>
          <div style="margin-top:8px;">Errors: ${escapeHtml(String(model.importValidationStatus.errorCount || 0))} · warnings: ${escapeHtml(String(model.importValidationStatus.warningCount || 0))}</div>
        </div>
        <p class="small muted" style="margin-top:12px;">Import provenance source: ${escapeHtml(model.importValidationStatus.source || 'bundled baseline')} · imported at ${escapeHtml(formatTimestamp(model.importValidationStatus.importedAt))}</p>
        ${(model.importValidationStatus.errors || []).length ? `<details style="margin-top:12px;"><summary>Validation issues</summary><div class="small muted" style="margin-top:10px;">${model.importValidationStatus.errors.map((issue) => `${escapeHtml(issue.code)} — ${escapeHtml(issue.message)}`).join('<br>')}</div></details>` : ''}
      </article>
    </section>
    <section class="two-col" style="margin-bottom:20px;">
      <article class="card">
        <div class="eyebrow">Audit-log lookup</div>
        <h3 class="section-title" style="font-size:1.2rem;">Mutation receipt stream</h3>
        <p class="small muted">${escapeHtml(model.auditLogLookup.note || '')}</p>
        ${model.auditLogLookup.available ? (auditEntries.length ? auditEntries.map((entry) => `
          <div class="skill-row">
            <div><strong>${escapeHtml(entry.mutationKind || 'mutation')}</strong></div>
            <div class="small muted">${escapeHtml(entry.scopeType || '')} · ${escapeHtml(entry.scopeId || 'account')}</div>
            <div>${escapeHtml(entry.requestId || '')}</div>
            <div class="small muted">${escapeHtml(formatTimestamp(entry.appliedAt))}</div>
          </div>
        `).join('') : '<p class="small muted">No audit entries matched the current lookup.</p>') : '<div class="callout warn" style="margin-top:12px;">The local reference build keeps this surface visible, but the live lookup itself is only wired on the Worker API path in this pass.</div>'}
      </article>
      <article class="card">
        <div class="eyebrow">Learner support / diagnostics</div>
        <h3 class="section-title" style="font-size:1.2rem;">Accessible learners</h3>
        ${accessibleLearners.length ? accessibleLearners.map((entry) => `
          <div class="skill-row">
            <div>
              <strong>${escapeHtml(entry.learnerName)}</strong>
              <div class="small muted">${escapeHtml(entry.yearGroup)} · ${escapeHtml(entry.membershipRoleLabel)}</div>
            </div>
            <div class="small muted">Focus: ${escapeHtml(entry.currentFocus?.label || '—')}</div>
            <div>${escapeHtml(String(entry.overview?.dueWords ?? 0))} due</div>
            <div><button class="btn ghost" data-action="learner-select" value="${escapeHtml(entry.learnerId)}">Select</button></div>
          </div>
        `).join('') : '<p class="small muted">No learner diagnostics are accessible from this account scope yet.</p>'}
        ${selectedDiagnostics ? `
          <div class="callout" style="margin-top:16px;">
            <strong>${escapeHtml(selectedDiagnostics.learnerName)}</strong>
            <div style="margin-top:8px;">Secure: ${escapeHtml(String(selectedDiagnostics.overview?.secureWords ?? 0))} · Due: ${escapeHtml(String(selectedDiagnostics.overview?.dueWords ?? 0))} · Trouble: ${escapeHtml(String(selectedDiagnostics.overview?.troubleWords ?? 0))}</div>
            <div class="small muted" style="margin-top:8px;">${escapeHtml(selectedDiagnostics.currentFocus?.detail || 'No current focus surfaced.')}</div>
          </div>
        ` : ''}
        <div class="actions" style="margin-top:16px;">
          ${model.learnerSupport.entryPoints.map((entry) => {
            if (entry.subjectId || entry.tab) {
              return `<button class="btn secondary" data-action="${escapeHtml(entry.action)}" ${entry.subjectId ? `data-subject-id="${escapeHtml(entry.subjectId)}"` : ''} ${entry.tab ? `data-tab="${escapeHtml(entry.tab)}"` : ''}>${escapeHtml(entry.label)}</button>`;
            }
            return `<button class="btn secondary" data-action="${escapeHtml(entry.action)}">${escapeHtml(entry.label)}</button>`;
          }).join('')}
        </div>
      </article>
    </section>
  `;
}

function renderSubjectScreen(context) {
  const { appState } = context;
  const subject = resolveSubject(appState.route.subjectId, context);
  const ui = appState.subjectUi[subject.id] || {};
  const activeTab = appState.route.tab || 'practice';
  const accent = subject.accent || '#3E6FA8';
  const contentContext = subjectContext(subject, context);
  const runtimeEntry = context.runtimeBoundary?.read?.({
    learnerId: appState.learners.selectedId,
    subjectId: subject.id,
    tab: activeTab,
  });

  let mainContent = '';
  if (runtimeEntry) {
    mainContent = subjectTabContent(subject, activeTab, appState, contentContext, runtimeEntry);
  } else {
    try {
      mainContent = subjectTabContent(subject, activeTab, appState, contentContext, null);
    } catch (error) {
      const methodName = activeTab === 'practice'
        ? 'renderPractice'
        : activeTab === 'analytics'
          ? 'renderAnalytics'
          : activeTab === 'profiles'
            ? 'renderProfiles'
            : activeTab === 'settings'
              ? 'renderSettings'
              : 'renderMethod';
      const captured = context.runtimeBoundary?.capture?.({
        learnerId: appState.learners.selectedId,
        subject,
        tab: activeTab,
        phase: 'render',
        methodName,
        error,
      }) || {
        message: `${subject.name} could not render the ${subjectTabLabel(activeTab)} tab right now.`,
        debugMessage: error?.message || String(error),
        phase: 'render',
        methodName,
      };
      mainContent = subjectTabContent(subject, activeTab, appState, contentContext, captured);
    }
  }

  return `
    <section class="subject-header card border-top" style="border-top-color:${accent}; margin-bottom:18px;">
      <div class="subject-title-row">
        <div>
          <div class="eyebrow">Subject module</div>
          <h2 class="title" style="font-size:clamp(1.6rem, 3vw, 2.3rem);">${escapeHtml(subject.name)}</h2>
          <p class="subtitle">${escapeHtml(subject.blurb)}</p>
        </div>
        <div class="actions">
          <button class="btn secondary" data-action="navigate-home">All subjects</button>
        </div>
      </div>
      <div class="subject-tabs" style="margin-top:16px;">
        ${TAB_META.map(([tabId, label]) => `<button class="tab ${tabId === activeTab ? 'active' : ''}" style="${tabId === activeTab ? `background:${accent}; border-color:${accent};` : ''}" data-action="subject-set-tab" data-tab="${tabId}">${escapeHtml(label)}</button>`).join('')}
      </div>
    </section>
    ${ui.error ? `<section class="card" style="margin-bottom:18px;"><div class="feedback bad"><strong>Subject message</strong><div>${escapeHtml(ui.error)}</div></div></section>` : ''}
    <section class="shell-grid">${mainContent}</section>
  `;
}

function toastTitle(toast) {
  return toast?.toast?.title || toast?.monster?.name || 'Reward update';
}

function toastText(toast) {
  if (toast?.toast?.body) return toast.toast.body;
  if (toast?.kind === 'caught') return 'New creature unlocked.';
  if (toast?.kind === 'mega') return 'Maximum evolution reached.';
  if (toast?.kind === 'evolve') return 'Creature evolved.';
  return 'Level increased.';
}

function renderToasts(appState) {
  if (!appState.toasts.length) return '';
  return `
    <div class="toast-host">
      ${appState.toasts.map((toast, index) => `
        <aside class="toast">
          <div class="toast-title">${escapeHtml(toastTitle(toast))}</div>
          <div class="toast-text">${escapeHtml(toastText(toast))}</div>
          <button class="dismiss" data-action="toast-dismiss" data-index="${index}">Dismiss</button>
        </aside>
      `).join('')}
    </div>
  `;
}

export function renderApp(appState, context) {
  let body = renderDashboard(context);
  if (appState.route.screen === 'subject') body = renderSubjectScreen(context);
  if (appState.route.screen === 'parent-hub') body = renderParentHub(context);
  if (appState.route.screen === 'admin-hub') body = renderAdminHub(context);
  return `
    <div class="app-shell">
      ${renderHeader(appState, context)}
      ${renderPersistenceBanner(appState.persistence)}
      ${body}
      ${renderToasts(appState)}
    </div>
  `;
}
