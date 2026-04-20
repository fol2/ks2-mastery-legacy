import { escapeHtml } from '../../platform/core/utils.js';

export function createPlaceholderSubject(meta) {
  return {
    ...meta,
    available: false,
    initState() {
      return {
        placeholder: true,
      };
    },
    getDashboardStats() {
      return {
        pct: 0,
        due: 0,
        streak: 0,
        nextUp: 'Planned in the rebuild',
      };
    },
    renderPractice() {
      return `
        <div class="three-col">
          <section class="card border-top" style="border-top-color:${meta.accent};">
            <div class="eyebrow">Future subject module</div>
            <h2 class="section-title">${escapeHtml(meta.name)} foundation</h2>
            <p class="subtitle">${escapeHtml(meta.blurb)}</p>
            <div class="callout" style="margin-top:14px;">
              This rebuild keeps the shell, subject identity, analytics slot, game hooks and API contract ready for <strong>${escapeHtml(meta.name)}</strong>, but leaves the question engine intentionally separate so the next team can build it without touching Spelling.
            </div>
          </section>
          <section class="card">
            <div class="eyebrow">Extension points already reserved</div>
            <div class="chip-row">
              <span class="chip">subject module contract</span>
              <span class="chip">practice renderer</span>
              <span class="chip">analytics renderer</span>
              <span class="chip">game event adapter</span>
              <span class="chip">Cloudflare API route</span>
            </div>
          </section>
          <section class="card">
            <div class="eyebrow">Recommended next build slice</div>
            <div class="code-block">1. Content model\n2. Deterministic engine\n3. Local repository\n4. Subject analytics\n5. Game event mapping\n6. Worker API route</div>
          </section>
        </div>
      `;
    },
    renderAnalytics() {
      return `
        <section class="card">
          <div class="eyebrow">Placeholder analytics</div>
          <h2 class="section-title">${escapeHtml(meta.name)} analytics slot</h2>
          <p class="subtitle">No learner data yet. The new platform keeps a dedicated analytics surface for each subject so reporting does not have to live inside the practice engine.</p>
        </section>
      `;
    },
    renderProfiles() {
      return `
        <section class="card">
          <div class="eyebrow">Learner targeting</div>
          <h2 class="section-title">${escapeHtml(meta.name)} learner profile hooks</h2>
          <p class="subtitle">Year group, goal, difficulty routing and misconceptions can all be attached to this subject without changing the core shell.</p>
        </section>
      `;
    },
    renderSettings() {
      return `
        <section class="card">
          <div class="eyebrow">Subject settings</div>
          <h2 class="section-title">${escapeHtml(meta.name)} settings stub</h2>
          <p class="subtitle">Future subject-specific controls belong here rather than inside a giant shared settings file.</p>
        </section>
      `;
    },
    renderMethod() {
      return `
        <section class="card">
          <div class="eyebrow">Method</div>
          <h2 class="section-title">How ${escapeHtml(meta.name)} should plug in</h2>
          <div class="code-block">subject module → deterministic engine → local/API gateway → analytics → game events</div>
        </section>
      `;
    },
    handleAction() {
      return false;
    },
  };
}
