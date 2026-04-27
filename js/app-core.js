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
  }

  // ── BOOT SEQUENCE ──────────────────────────────────────
  async boot() {
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

    // Transition to lobby
    await this._delay(600);
    $('#boot-screen').style.display = 'none';
    $('#lobby-screen').style.display = 'flex';
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

    // Auto-enter public room — skip lobby
    try {
      await this.fabric.resume();
      const code = await this.identity.createRoomCode();
      this.mesh.roomCode = code;
      this.mesh.isHost = true;
      await this._getMicrophone();
      this._enterStage(code);
    } catch (e) {
      console.warn('Auto-enter failed, showing lobby:', e.message);
    }
  }

  // ── SETTINGS ───────────────────────────────────────────
  _bindSettingsEvents() {
    $('#btn-close-settings').onclick = () => {
      $('#settings-modal').style.display = 'none';
    };

    $$('.toggle-switch').forEach(el => {
      el.onclick = () => {
        el.classList.toggle('on');
        const key = el.dataset.key;
        this.settings[key] = el.classList.contains('on');

        switch (key) {
          case 'harmony':
            this.vocal.setHarmonyEnabled(this.settings.harmony);
            break;
          case 'drones':
            this.fabric.setDroneVolume(this.settings.drones ? $('#mix-drones').value / 100 : 0);
            break;
          case 'viz':
            this.viz.setEnabled(this.settings.viz);
            break;
          case 'aec':
            // Re-request mic with new echo cancellation setting
            this._getMicrophone();
            break;
        }
      };
    });
  }

  // ── SERVICE WORKER ─────────────────────────────────────
  _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

// ─────────────────────────────────────────────────────────
// IGNITION
// ─────────────────────────────────────────────────────────
