class KonomiApp {
  constructor() {
    this.identity = null;
    this.mesh = null;
    this.fabric = null;
    this.vocal = null;
    this.tracks = null;
    this.viz = null;

    this.micStream = null;
    this.micMuted = false;
    this.micSourceNode = null;

    this.settings = {
      pitch: true,
      harmony: false,
      drones: false,        // off — primes were too loud by default
      viz: true,
      aec: true,            // echo cancellation ON by default
      noiseGate: true,      // adaptive ambient-noise gate ON by default
      selfMonitor: false,
      noiseGateDb: -18,     // gap (dB) above ambient floor required to open gate — gentler so normal speech passes
      noiseGateAttackMs: 8,
      noiseGateReleaseMs: 120
    };

    // Loaded once at boot from GitHub issues (label: engine-config), merged into settings.
    this._ghConfigRepo = 'teslasolar/konomioke';
    this._ghConfigLabel = 'engine-config';

    this._animFrame = null;
    this._lastTime = 0;
    this._state = 'init'; // init → booting → lobby → stage → ended
  }

  _setState(s) {
    const prev = this._state;
    if (typeof rlog === 'function') rlog('STATE: ' + prev + ' → ' + s);
    this._state = s;
    const screens = { init:'none', booting:'none', lobby:'none', stage:'none', ended:'none' };
    screens[s] = s === 'lobby' ? 'flex' : 'block';
    if ($('#boot-screen')) $('#boot-screen').style.display = s === 'booting' ? 'flex' : 'none';
    if ($('#lobby-screen')) $('#lobby-screen').style.display = screens.lobby;
    if ($('#stage-screen')) $('#stage-screen').style.display = screens.stage;
    console.log(`STATE: ${prev} → ${s}`);
  }

  // ── BOOT SEQUENCE ──────────────────────────────────────
  async boot() {
    this._setState('booting');
    const phases = [
      { prime: 2, label: 'IDENTITY + ROOMS', fn: () => this._bootIdentity() },
      { prime: 3, label: 'P2P MESH', fn: () => this._bootMesh() },
      { prime: 5, label: 'AUDIO FABRIC', fn: () => this._bootFabric() },
      { prime: 7, label: 'VOCAL PROCESSING', fn: () => this._bootVocal() },
      { prime: 11, label: 'TRACK + LYRICS', fn: () => this._bootTracks() },
      { prime: 13, label: 'VISUALIZATION', fn: () => this._bootViz() },
      { prime: 17, label: 'LAUNCHER', fn: () => this._bootUI() },
    ];

    for (const phase of phases) {
      const el = $(`.boot-phase[data-phase="${phase.prime}"]`);
      el.classList.add('active');
      el.querySelector('.phase-status').textContent = 'booting...';

      try {
        await phase.fn();
        el.classList.remove('active');
        el.classList.add('done');
        el.querySelector('.phase-status').textContent = 'ok';
        await this._delay(200);
      } catch (err) {
        console.error(`Phase p=${phase.prime} failed:`, err);
        el.classList.remove('active');
        el.classList.add('fail');
        el.querySelector('.phase-status').textContent = err.message || 'failed';
        // Continue booting — degrade gracefully
        await this._delay(300);
      }
    }

    await this._delay(600);
    if (this._state !== 'stage') this._armStart();
  }

  async _bootIdentity() {
    this.identity = new KonomiIdentity();
    await this.identity.boot();
  }

  async _bootMesh() {
    this.mesh = new KonomiMesh(this.identity);
    await this.mesh.boot('');
  }

  async _bootFabric() {
    this.fabric = new AudioFabricEngine();
    await this.fabric.boot();
  }

  async _bootVocal() {
    this.vocal = new VocalProcessor(this.fabric);
    await this.vocal.boot();
  }

  async _bootTracks() {
    this.tracks = new TrackEngine(this.fabric, this.vocal);
    await this.tracks.boot();
  }

  async _bootViz() {
    this.viz = new VizEngine(this.fabric);
    await this.viz.boot();
  }

  async _bootUI() {
    this._bindLobbyEvents();
    this._bindStageEvents();
    this._bindSettingsEvents();
    this._bindTrackEvents();
    this._bindChatEvents();
    this._bindMeshCallbacks();
    this._registerServiceWorker();

    // Display identity in lobby
    $('#lobby-pubkey').textContent = this.identity.shortId;
    const savedName = this.identity.displayName;
    if (savedName && savedName !== 'Singer') {
      $('#display-name').value = savedName;
    }
    // LAUNCHER finishes here — mic + AudioContext.resume() require a user
    // gesture (especially when embedded in an iframe), so we arm a tap-to-start
    // handler instead of blocking the boot phase on getUserMedia.

    // Register callback so the parent SCADA page can push the shared mic
    // stream in after boot (in case injection races ahead of _startMicRetry).
    window.__onSharedMicStream = (stream) => {
      if (this.micStream) return; // already have one
      window.__sharedMicStream = stream;
      if (typeof rlog === 'function') rlog('shared mic injected by parent');
      this._getMicrophone();
    };

    // Tab audio injected by the parent SCADA Tab button (stream=null → disconnect)
    window.__onSharedTabStream = (stream) => {
      if (typeof rlog === 'function') rlog('shared tab stream ' + (stream ? 'injected' : 'stopped') + ' by parent');
      this._connectTabStream(stream);
    };
  }

  // ── TAP TO START ───────────────────────────────────────
  // Called after all phases complete. Shows a prompt on the boot screen and
  // waits for the first user gesture, then resumes audio, grabs the mic, and
  // auto-enters the public room.
  _armStart() {
    const screen = $('#boot-screen');
    if (!screen) { this._autoEnter(); return; }

    // Inject a tap-to-start hint if not already present
    let hint = screen.querySelector('.boot-start-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'boot-start-hint';
      hint.textContent = 'tap anywhere to start';
      hint.style.cssText = 'margin-top:1.5rem;padding:0.6rem 1.2rem;border:1px solid #ff2d75;border-radius:6px;color:#ff2d75;font-family:monospace;font-size:0.85rem;letter-spacing:0.2em;text-transform:uppercase;cursor:pointer;animation:konomiPulse 1.4s ease-in-out infinite';
      screen.appendChild(hint);
      const style = document.createElement('style');
      style.textContent = '@keyframes konomiPulse{0%,100%{opacity:0.55}50%{opacity:1}}';
      document.head.appendChild(style);
    }

    const start = async (ev) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      window.removeEventListener('pointerdown', start, true);
      window.removeEventListener('keydown', start, true);
      hint.textContent = 'starting…';
      await this._autoEnter();
    };
    window.addEventListener('pointerdown', start, true);
    window.addEventListener('keydown', start, true);
  }

  async _autoEnter() {
    if (typeof rlog === 'function') rlog('auto-enter starting');
    try {
      try { await this.fabric.resume(); if (typeof rlog === 'function') rlog('fabric resumed'); } catch (e) { if (typeof rlog === 'function') rlog('fabric resume fail: ' + e.message); }

      // Join default KONOMI room (8 users max, FIFO overflow)
      var code;
      if (typeof joinDefaultRoom === 'function') {
        var uid = this.identity.publicKeyHex || 'anon';
        var name = this.identity.displayName || 'Singer';
        code = await joinDefaultRoom(uid, name);
        if (typeof rlog === 'function') rlog('room-mgr: joined ' + code);
      } else {
        code = 'KONOMI';
      }

      this.mesh.roomCode = code;
      this.mesh.isHost = (code === 'KONOMI' && (!ROOM_MGR.rooms.length || ROOM_MGR.rooms[0]?.users?.length <= 1));

      // Peer signaling handled by parent dock via postMessage
      var self = this;
      window.addEventListener('message', function(e) {
        if (!e.data || !e.data.type) return;
        if (e.data.type === 'peer-joined') {
          self._addChatMessage('SYSTEM', (e.data.displayName || e.data.peerId?.slice(0,8)) + ' joined', '#d4af37');
          if (self.viz) self.viz.addSingerCluster(e.data.peerId, peerColor(e.data.peerId));
        }
        if (e.data.type === 'peer-left') {
          self._addChatMessage('SYSTEM', (e.data.peerId?.slice(0,8) || '?') + ' left', '#ff2244');
          if (self.viz) self.viz.removeSingerCluster(e.data.peerId);
        }
        if (e.data.type === 'poll-chat') {
          self._addChatMessage(e.data.from || '?', e.data.text, e.data.color || '#8898b4');
          if (typeof chatPush === 'function') chatPush(e.data.from || '?', e.data.text, e.data.color, self.mesh.roomCode);
        }
        if (e.data.type === 'peer-count') {
          var el = document.getElementById('stage-peers-count');
          if (el) el.textContent = e.data.count + ' peers';
        }
      });

      this._enterStage(code);
      this._startMicRetry();
      if (typeof rlog === 'function') rlog('entered stage: ' + code);
    } catch (err) {
      if (typeof rlog === 'function') rlog('auto-enter fail: ' + err.message);
      this._setState('lobby');
    }
  }

  // Background poller: tries getUserMedia every 5s until it succeeds, then
  // stops. Idempotent — calling twice does nothing.
  _startMicRetry() {
    if (this._micRetryTimer || this.micStream) return;
    let attempt = 0;
    const tick = async () => {
      if (this.micStream) { this._stopMicRetry(); return; }
      attempt++;
      if (typeof rlog === 'function') rlog('mic attempt #' + attempt);
      try {
        await this._getMicrophone();
        if (this.micStream) {
          if (typeof rlog === 'function') rlog('mic acquired on attempt #' + attempt);
          this._stopMicRetry();
          return;
        }
        if (typeof rlog === 'function') rlog('mic attempt #' + attempt + ': getUserMedia resolved but no stream');
      } catch (e) {
        if (typeof rlog === 'function') rlog('mic attempt #' + attempt + ' failed: ' + e.message);
      }
    };
    // Try once immediately, then every 5s.
    tick();
    this._micRetryTimer = setInterval(tick, 5000);
  }

  _stopMicRetry() {
    if (this._micRetryTimer) { clearInterval(this._micRetryTimer); this._micRetryTimer = null; }
  }

