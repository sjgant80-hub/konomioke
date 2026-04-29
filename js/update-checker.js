/**
 * update-checker.js
 * Polls GitHub API for new commits on konomioke + moosic repos.
 * Optionally watches a local directory via File System Access API.
 *
 * Usage:
 *   updateChecker.init();                     // start polling
 *   updateChecker.pickDir();                  // prompt user to pick local dir
 *   updateChecker.check();                    // run manually
 */

(function () {
  'use strict';

  const REPOS = [
    { owner: 'teslasolar', repo: 'konomioke', label: 'konomioke' },
    { owner: 'teslasolar', repo: 'moosic',    label: 'moosic' },
  ];
  const POLL_MS = 5 * 60 * 1000; // 5 min
  const LS_KEY  = 'uc_shas_v1';

  // ── GitHub polling ────────────────────────────────────────────────

  async function fetchLatestSHA(owner, repo) {
    try {
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
        { headers: { Accept: 'application/vnd.github.v3+json' } }
      );
      if (!r.ok) return null;
      const data = await r.json();
      return data[0]?.sha ?? null;
    } catch { return null; }
  }

  async function checkGitHub() {
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    const updates = [];

    for (const { owner, repo, label } of REPOS) {
      const sha = await fetchLatestSHA(owner, repo);
      if (!sha) continue;
      if (stored[repo] && stored[repo] !== sha) {
        updates.push({ label, sha: sha.slice(0, 7) });
      }
      stored[repo] = sha;
    }

    localStorage.setItem(LS_KEY, JSON.stringify(stored));
    return updates;
  }

  // ── File System Access API (local directory watcher) ──────────────

  let _dirHandle   = null;
  let _dirSnapshot = null; // Map<name, lastModified>

  async function snapshotDir(handle) {
    const snap = new Map();
    for await (const [name, entry] of handle) {
      if (entry.kind === 'file') {
        const f = await entry.getFile();
        snap.set(name, f.lastModified);
      }
    }
    return snap;
  }

  async function pickDir() {
    if (!('showDirectoryPicker' in window)) {
      showBanner('⚠ File System Access API not supported in this browser', 'warn');
      return null;
    }
    try {
      _dirHandle   = await window.showDirectoryPicker({ mode: 'read' });
      _dirSnapshot = await snapshotDir(_dirHandle);
      showBanner(`📁 Watching <b>${_dirHandle.name}</b> for changes`, 'info');
      return _dirHandle.name;
    } catch { return null; } // user cancelled
  }

  async function checkDir() {
    if (!_dirHandle) return [];
    try {
      const snap  = await snapshotDir(_dirHandle);
      const added = [];
      for (const [name] of snap) {
        if (!_dirSnapshot.has(name)) added.push(name);
      }
      _dirSnapshot = snap;
      return added;
    } catch { return []; }
  }

  // ── Banner UI ─────────────────────────────────────────────────────

  function getBanner() {
    let el = document.getElementById('uc-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'uc-banner';
      el.style.cssText = [
        'position:fixed;bottom:0;left:0;right:0;z-index:10000',
        "background:#0d0a1e;border-top:1px solid #ff2d75",
        "color:#e8e8f0;font-size:11px;font-family:'Courier New',monospace",
        'display:flex;align-items:center;gap:10px;padding:7px 12px',
        'transform:translateY(100%);transition:transform .28s ease',
        'box-shadow:0 -4px 16px rgba(255,45,117,.15)',
      ].join(';');
      document.body.appendChild(el);
    }
    return el;
  }

  function showBanner(msg, type = 'update') {
    const el    = getBanner();
    const color = type === 'warn' ? '#f0a030' : type === 'info' ? '#38b5f9' : '#ff2d75';
    const icon  = type === 'warn' ? '⚠' : type === 'info' ? 'ℹ' : '↑';
    el.style.borderTopColor = color;
    el.innerHTML = `
      <span style="color:${color};font-weight:700">${icon}</span>
      <span style="flex:1">${msg}</span>
      ${type === 'update'
        ? `<button onclick="location.reload()" style="background:${color};color:#fff;border:none;border-radius:3px;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:10px">reload</button>`
        : ''}
      <button onclick="document.getElementById('uc-banner').style.transform='translateY(100%)'"
        style="background:transparent;color:#6666aa;border:none;cursor:pointer;font-size:16px;line-height:1">✕</button>
    `;
    requestAnimationFrame(() => el.style.transform = 'translateY(0)');
  }

  // ── Dir-watch button (injected into header if present) ───────────

  function injectDirBtn() {
    const hdr = document.querySelector('.hdr, header');
    if (!hdr || document.getElementById('uc-dir-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'uc-dir-btn';
    btn.className = 'btn';
    btn.title = 'Watch local directory for changes';
    btn.textContent = '📁';
    btn.onclick = () => pickDir();
    // insert before last child
    hdr.appendChild(btn);
  }

  // ── Polling loop ──────────────────────────────────────────────────

  async function runCheck() {
    const ghUpdates = await checkGitHub();
    if (ghUpdates.length) {
      showBanner(
        `New commits: ${ghUpdates.map(u => `${u.label}@${u.sha}`).join(', ')}`,
        'update'
      );
    }

    const newFiles = await checkDir();
    if (newFiles.length) {
      const preview = newFiles.slice(0, 3).join(', ') + (newFiles.length > 3 ? '…' : '');
      showBanner(
        `${newFiles.length} new file(s) in <b>${_dirHandle.name}</b>: ${preview}`,
        'info'
      );
    }
  }

  async function init() {
    // Seed SHAs silently on first run so we don't alert on page load
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if (REPOS.some(({ repo }) => !stored[repo])) {
      await checkGitHub();
    }

    injectDirBtn();
    setInterval(runCheck, POLL_MS);
  }

  window.updateChecker = { init, pickDir, check: runCheck };
})();
