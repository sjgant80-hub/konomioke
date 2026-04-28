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
      drones: true,
      viz: true,
      aec: false
    };

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
    if (this._state !== 'stage') this._setState('lobby');
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

    // Auto-enter public room — skip lobby, mic optional
    if (typeof rlog === 'function') rlog('auto-enter starting');
    const code = await this.identity.createRoomCode();
    this.mesh.roomCode = code;
    this.mesh.isHost = true;
    try { await this.fabric.resume(); if (typeof rlog === 'function') rlog('fabric resumed'); } catch (e) { if (typeof rlog === 'function') rlog('fabric resume fail: ' + e.message); }
    try { await this._getMicrophone(); if (typeof rlog === 'function') rlog('mic acquired'); } catch (e) { if (typeof rlog === 'function') rlog('mic fail: ' + e.message); }
    this._enterStage(code);
    if (typeof rlog === 'function') rlog('entered stage: ' + code);
  }

