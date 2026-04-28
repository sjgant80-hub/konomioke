// GhConfig — load engine settings from GitHub Issues so the deployed page
// can be reconfigured without a redeploy. Mirrors the moosic/grid pattern.
//
// Usage: open an issue on the konomioke repo with label `engine-config`.
// Body must contain a fenced ```json block, e.g.:
//
//   ```json
//   { "drones": true, "noiseGateDb": -45, "selfMonitor": false }
//   ```
//
// Open issues are merged in order; later issues win on key collision.
// Anything matching a key in `app.settings` overrides the default.
class GhConfig {
  constructor(repo, label) {
    this.repo = repo || 'teslasolar/konomioke';
    this.label = label || 'engine-config';
    this.url = 'https://api.github.com/repos/' + this.repo + '/issues' +
      '?labels=' + encodeURIComponent(this.label) + '&state=open&per_page=30';
  }

  async load() {
    try {
      const r = await fetch(this.url, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(4000)
      });
      if (!r.ok) return {};
      const issues = await r.json();
      const merged = {};
      for (const issue of issues) {
        const m = issue.body && issue.body.match(/```json\s*([\s\S]*?)```/);
        if (!m) continue;
        try {
          const obj = JSON.parse(m[1]);
          Object.assign(merged, obj);
        } catch (_) { /* skip malformed */ }
      }
      return merged;
    } catch (_) { return {}; }
  }

  async applyTo(app) {
    const cfg = await this.load();
    let applied = 0;
    for (const k in cfg) {
      if (k in app.settings) { app.settings[k] = cfg[k]; applied++; }
    }
    if (typeof rlog === 'function') rlog('gh-config: ' + applied + ' keys');
    return applied;
  }
}
