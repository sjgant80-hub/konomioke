// boot-loader.js — fetches UI templates, then concatenates phase fragments
// and evaluates each phase as a single script. Some modules (p5-fabric,
// p11-tracks, p13-viz, p17-app) are split mid-class across multiple files
// (fabric-init.js opens `class AudioFabricEngine {`, fabric-analyze.js
// continues with more methods + closing `}`). Loading those via separate
// <script src> tags produces SyntaxErrors. Concatenating per-phase preserves
// the "every file under 250 lines" goal AND parses correctly.

(function () {
  if (window.__konomiokeBooting) return;   // guard against double-boot
  window.__konomiokeBooting = true;

  // ── ON-SCREEN LOG PANEL ────────────────────────────────────────────────
  // Maps the boot/state-machine sequence and streams every rlog() entry live.
  // State machine: init → booting → lobby → stage → ended
  var _SM_STATES = ['init','booting','lobby','stage','ended'];
  var _logList = null;
  var _logCollapsed = false;

  function _createLogPanel() {
    var panel = document.createElement('div');
    panel.id = 'k-log-panel';
    panel.style.cssText = 'position:fixed;bottom:0;right:0;width:340px;max-height:38vh;background:#080810;border:1px solid #22223a;border-radius:8px 0 0 0;font-family:monospace;font-size:11px;color:#8888aa;z-index:99999;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -2px 14px #000c';

    // Header: state machine chips + collapse toggle
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;gap:3px;padding:4px 8px;border-bottom:1px solid #16162a;flex-shrink:0;cursor:pointer;user-select:none';
    _SM_STATES.forEach(function (s, i) {
      var chip = document.createElement('span');
      chip.id = 'k-sm-' + s;
      chip.textContent = s;
      chip.style.cssText = 'padding:1px 5px;border-radius:3px;font-size:10px;border:1px solid #2a2a44;color:#44445a;transition:all .25s';
      hdr.appendChild(chip);
      if (i < _SM_STATES.length - 1) {
        var arr = document.createElement('span');
        arr.textContent = '→';
        arr.style.color = '#2a2a44';
        hdr.appendChild(arr);
      }
    });
    var tog = document.createElement('span');
    tog.id = 'k-log-tog';
    tog.textContent = '▾';
    tog.style.cssText = 'margin-left:auto;color:#ff2d75;font-size:12px';
    hdr.appendChild(tog);
    hdr.onclick = function () {
      _logCollapsed = !_logCollapsed;
      tog.textContent = _logCollapsed ? '▸' : '▾';
      list.style.display = _logCollapsed ? 'none' : '';
      panel.style.maxHeight = _logCollapsed ? '26px' : '38vh';
    };

    var list = document.createElement('div');
    list.style.cssText = 'overflow-y:auto;flex:1;padding:4px 8px';
    _logList = list;

    panel.appendChild(hdr);
    panel.appendChild(list);
    document.body.appendChild(panel);
    _setLogState('init');
  }

  function _setLogState(s) {
    var idx = _SM_STATES.indexOf(s);
    _SM_STATES.forEach(function (name, i) {
      var el = document.getElementById('k-sm-' + name);
      if (!el) return;
      if (i < idx) {
        el.style.cssText = 'padding:1px 5px;border-radius:3px;font-size:10px;border:1px solid #226644;color:#44cc88;transition:all .25s';
      } else if (i === idx) {
        el.style.cssText = 'padding:1px 5px;border-radius:3px;font-size:10px;border:1px solid #ff2d75;color:#ff2d75;background:#1a0010;transition:all .25s';
      } else {
        el.style.cssText = 'padding:1px 5px;border-radius:3px;font-size:10px;border:1px solid #2a2a44;color:#44445a;transition:all .25s';
      }
    });
  }

  function _appendLog(msg) {
    if (!_logList) return;
    var ts = new Date().toISOString().slice(11, 23);
    var isState = msg.indexOf('STATE:') === 0;
    var isErr   = /^(ERR|FAIL):/.test(msg);
    var isMic   = msg.indexOf('mic') !== -1;
    var row = document.createElement('div');
    row.style.cssText = 'padding:1px 0;line-height:1.55;white-space:pre-wrap;color:' +
      (isErr ? '#ff3344' : isState ? '#ffaa33' : isMic ? '#33aaff' : '#7777aa');
    if (isState) row.style.fontWeight = 'bold';
    row.textContent = ts + '  ' + msg;
    _logList.appendChild(row);
    _logList.scrollTop = _logList.scrollHeight;
    // Advance state machine indicator
    if (isState) {
      var m = msg.match(/STATE:\s*\w+\s*→\s*(\w+)/);
      if (m) _setLogState(m[1]);
    }
  }

  _createLogPanel();
  // ─────────────────────────────────────────────────────────────────────────

  function rlog(msg) {
    console.log('[K]', msg);
    _appendLog(msg);
    fetch('https://onlybrains.onrender.com/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'konomioke-debug', message: msg, role: 'system' }),
    }).catch(function () {});
  }
  window.rlog = rlog;
  window.addEventListener('error', function (e) {
    rlog('ERR: ' + e.message + ' @ ' + e.filename + ':' + e.lineno);
  });

  function fetchText(src) {
    return fetch(src).then(function (r) {
      if (!r.ok) throw new Error('fetch ' + src + ' -> ' + r.status);
      return r.text();
    });
  }

  // Inject blob of JS as one <script> so the whole phase parses together.
  function injectScript(code, label) {
    return new Promise(function (ok, fail) {
      var blob = new Blob([code + '\n//# sourceURL=' + label + '\n'],
        { type: 'application/javascript' });
      var url = URL.createObjectURL(blob);
      var s = document.createElement('script');
      s.src = url;
      s.onload  = function () { URL.revokeObjectURL(url); ok(); };
      s.onerror = function () { URL.revokeObjectURL(url); fail(new Error('load ' + label)); };
      document.body.appendChild(s);
    });
  }

  function loadScript(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src;
      s.onload  = ok;
      s.onerror = function () { fail(new Error('load ' + src)); };
      document.body.appendChild(s);
    });
  }

  var TEMPLATES = [
    'html-canvas',
    'html-boot',
    'html-lobby',
    'html-stage',
    'html-modals',
  ];

  // Phases. Single-file phases load via <script src>. Multi-file phases are
  // concatenated and injected as one script (split-class fragments).
  var PHASES = [
    { label: 'p1-globals',  files: ['js/globals.js'] },
    { label: 'p2-identity', files: ['js/p2-identity/identity.js'] },
    { label: 'p3-mesh',     files: ['js/p3-mesh/mesh.js'] },
    { label: 'p11-crdt',    files: ['js/p11-tracks/crdt-queue.js'] },
    { label: 'p5-fabric',   files: [
        'js/p5-fabric/fabric-init.js',
        'js/p5-fabric/fabric-analyze.js',
    ]},
    { label: 'p7-vocal',    files: ['js/p7-vocal/vocal.js', 'js/p7-vocal/noise-gate.js'] },
    { label: 'p11-tracks',  files: [
        'js/p11-tracks/tracks-load.js',
        'js/p11-tracks/tracks-play.js',
    ]},
    { label: 'p13-viz',     files: [
        'js/p13-viz/viz-scene.js',
        'js/p13-viz/viz-extras.js',
        'js/p13-viz/viz-render.js',
    ]},
    { label: 'p17-app',     files: [
        'js/p17-app/app-core.js',
        'js/p17-app/app-lobby.js',
        'js/p17-app/app-stage.js',
        'js/p17-app/app-mesh.js',
        'js/p17-app/app-loop.js',
        'js/p17-app/gh-config.js',
    ]},
    { label: 'p17-boot',    files: ['js/p17-app/boot.js'] },
  ];

  async function loadPhase(phase) {
    if (phase.files.length === 1) {
      await loadScript(phase.files[0]);
      return;
    }
    var parts = await Promise.all(phase.files.map(fetchText));
    await injectScript(parts.join('\n'), phase.label + '.js');
  }

  async function boot() {
    rlog('boot');
    var app = document.getElementById('app');
    app.innerHTML = '';

    for (var i = 0; i < TEMPLATES.length; i++) {
      var t = TEMPLATES[i];
      var r = await fetch('ui/' + t + '.html');
      if (r.ok) app.insertAdjacentHTML('beforeend', await r.text());
    }
    rlog('templates:' + app.children.length);

    for (var j = 0; j < PHASES.length; j++) {
      await loadPhase(PHASES[j]);
    }
    rlog('all ' + PHASES.length + ' phases loaded');

    // Apply GitHub Issues tag.db
    if (typeof applyKonomiTags === 'function') {
      var n = await applyKonomiTags();
      rlog('tags:' + n + ' applied');
    }
  }

  boot().catch(function (e) {
    rlog('FAIL:' + e.message);
    console.error(e);
    document.getElementById('app').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#ff2244;font-family:monospace">' +
      '<div><h1>好みオケ</h1><p>' + e.message + '</p></div></div>';
  });
})();
