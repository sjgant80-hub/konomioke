export class KonomiApp {
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
  }

  // ── LOBBY EVENTS ───────────────────────────────────────
  _bindLobbyEvents() {
    // Save display name
    $('#save-name').onclick = async () => {
      const name = $('#display-name').value.trim();
      if (name) await this.identity.setDisplayName(name);
    };

    // Create room
    $('#btn-create-room').onclick = async () => {
      try {
        await this.fabric.resume();
        const signalUrl = $('#signal-url').value.trim();
        let connected = false;
        if (signalUrl) {
          try {
            this.mesh.signalUrl = signalUrl;
            await this.mesh.connectSignal();
            const code = await this.mesh.createRoom();
            connected = true;
            await this._getMicrophone();
            this._enterStage(code);
          } catch {
            console.warn('Signal server unreachable, entering solo mode');
          }
        }
        if (!connected) {
          // Solo mode
          const code = await this.identity.createRoomCode();
          this.mesh.roomCode = code;
          this.mesh.isHost = true;
          await this._getMicrophone();
          this._enterStage(code);
        }
      } catch (err) {
        alert('Failed to create room: ' + err.message);
      }
    };

    // Join room
    const joinFn = async () => {
      const code = $('#join-code').value.trim().toUpperCase();
      if (!code) return;
      const signalUrl = $('#signal-url').value.trim();
      if (!signalUrl) {
        alert('A signaling server URL is needed to join a room with peers.\nLeave blank and use CREATE ROOM for solo mode.');
        return;
      }
      try {
        await this.fabric.resume();
        this.mesh.signalUrl = signalUrl;
        await this.mesh.connectSignal();
        await this.mesh.joinRoom(code);
        await this._getMicrophone();
        this._enterStage(code);
      } catch (err) {
        alert('Failed to join room: ' + err.message);
      }
    };

    $('#btn-join-room').onclick = joinFn;
    $('#join-code').onkeydown = (e) => { if (e.key === 'Enter') joinFn(); };

    // Check URL for room code
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      $('#join-code').value = roomParam;
    }
  }

  async _getMicrophone() {
    try {
      // Stop previous mic stream if re-requesting (e.g. AEC toggle)
      if (this.micStream) {
        for (const track of this.micStream.getTracks()) track.stop();
      }
      if (this.micSourceNode) {
        this.micSourceNode.disconnect();
        this.micSourceNode = null;
      }

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.settings.aec,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      // Connect mic to Audio Fabric for analysis
      this.micSourceNode = this.fabric.ctx.createMediaStreamSource(this.micStream);
      this.fabric.connectSource(this.micSourceNode);

      // Connect to vocal processor for self-monitoring
      this.vocal.connectSelf(this.micSourceNode);

      // Set as local stream for WebRTC
      this.mesh.setLocalStream(this.micStream);

      // Preserve mute state
      if (this.micMuted) {
        for (const track of this.micStream.getAudioTracks()) {
          track.enabled = false;
        }
      }
    } catch (err) {
      console.warn('Microphone not available:', err.message);
    }
  }

  _enterStage(roomCode) {
    $('#lobby-screen').style.display = 'none';
    $('#stage-screen').style.display = 'block';
    $('#stage-room-code').textContent = roomCode;

    // Start the render/analysis loop
    this._startLoop();
  }

  // ── STAGE EVENTS ───────────────────────────────────────
  _bindStageEvents() {
    // Mic toggle
    $('#btn-mic').onclick = () => {
      this.micMuted = !this.micMuted;
      if (this.micStream) {
        for (const track of this.micStream.getAudioTracks()) {
          track.enabled = !this.micMuted;
        }
      }
      $('#btn-mic').classList.toggle('muted', this.micMuted);
    };

    // Leave room
    $('#btn-leave').onclick = () => {
      this._stopLoop();
      this.mesh.leaveRoom();
      this.tracks.stop();
      $('#stage-screen').style.display = 'none';
      $('#lobby-screen').style.display = 'flex';

      // Clear singer clusters
      for (const [pid] of this.viz.singerClusters) {
        this.viz.removeSingerCluster(pid);
      }
    };

    // Settings
    $('#btn-settings').onclick = () => {
      $('#settings-modal').style.display = 'flex';
    };

    // Mix sliders
    $('#mix-self').oninput = (e) => this.vocal.setMix('self', e.target.value);
    $('#mix-track').oninput = (e) => this.vocal.setMix('track', e.target.value);
    $('#mix-others').oninput = (e) => this.vocal.setMix('others', e.target.value);
    $('#mix-drones').oninput = (e) => this.fabric.setDroneVolume(e.target.value / 100);
    $('#mix-harmony').oninput = (e) => this.vocal.setMix('harmony', e.target.value);

    // Playback controls
    $('#btn-play-pause').onclick = () => {
      if (this.tracks.audioBuffer || this.tracks._mediaElement) {
        this.tracks.togglePlay();
      } else {
        // If no track loaded, try first in queue
        const ordered = this.tracks.queue.getOrdered();
        if (ordered.length > 0) this.tracks.playTrack(ordered[0]);
      }
    };

    $('#btn-next-track').onclick = () => this.tracks.playNext();
    $('#btn-prev-track').onclick = () => this.tracks.playPrev();

    // Progress bar seeking
    $('#progress-bar').onclick = (e) => {
      const rect = e.target.getBoundingClientRect();
      const fraction = (e.clientX - rect.left) / rect.width;
      this.tracks.seek(Math.max(0, Math.min(1, fraction)));
    };
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

  // ── TRACK + LYRICS EVENTS ─────────────────────────────
  _bindTrackEvents() {
    // Track upload
    $('#track-upload').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await this.fabric.resume();
      const entry = await this.tracks.loadTrack(file);
      // Auto-play if nothing is playing
      if (!this.tracks.isPlaying) {
        this.tracks.playTrack(entry);
      }
    };

    // LRC import
    $('#btn-import-lrc').onclick = () => {
      $('#lrc-modal').style.display = 'flex';
    };

    $('#btn-lrc-cancel').onclick = () => {
      $('#lrc-modal').style.display = 'none';
    };

    $('#btn-lrc-import').onclick = () => {
      const text = $('#lrc-text').value;
      if (text.trim()) {
        this.tracks.parseLRC(text);
      }
      $('#lrc-modal').style.display = 'none';
    };

    // Track engine callbacks
    this.tracks.onQueueUpdate = (ordered) => this._renderQueue(ordered);
    this.tracks.onPlayStateChange = (playing) => {
      $('#btn-play-pause').innerHTML = playing ? '&#9646;&#9646;' : '&#9654;';
    };
    this.tracks.onLyricChange = (prev, current, next) => {
      $('#lyrics-prev').textContent = prev;
      $('#lyrics-current').textContent = current || '~ ~ ~';
      $('#lyrics-next').textContent = next;
    };
    this.tracks.onTrackEnd = () => this.tracks.playNext();
  }

  _renderQueue(ordered) {
    const el = $('#queue-list');
    el.innerHTML = '';
    ordered.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'queue-item' + (this.tracks.currentTrack && this.tracks.currentTrack.id === item.id ? ' playing' : '');
      div.innerHTML = `
        <span class="queue-num">${i + 1}</span>
        <span class="queue-title">${item.data.name}</span>
        <span class="queue-artist">${formatTime(item.data.duration)}</span>
      `;
      div.onclick = () => this.tracks.playTrack(item);
      el.appendChild(div);
    });
  }

  // ── CHAT ───────────────────────────────────────────────
  _bindChatEvents() {
    const send = () => {
      const input = $('#chat-input');
      const text = input.value.trim();
      if (!text) return;

      // Broadcast via mesh
      this.mesh.broadcast({
        type: 'chat',
        from: this.identity.displayName,
        text: text
      });

      // Show locally
      this._addChatMessage(this.identity.displayName, text, peerColor(this.identity.publicKeyHex));
      input.value = '';
    };

    $('#btn-chat-send').onclick = send;
    $('#chat-input').onkeydown = (e) => { if (e.key === 'Enter') send(); };
  }

  _addChatMessage(author, text, color) {
    const container = $('#chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-author" style="color:${color}">${author}:</span>${this._escapeHtml(text)}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // Keep only last 50 messages
    while (container.children.length > 50) container.removeChild(container.firstChild);
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── MESH CALLBACKS ─────────────────────────────────────
  _bindMeshCallbacks() {
    this.mesh.onRoomJoined = (code, peers) => {
      this._updatePeersList();
    };

    this.mesh.onPeerJoined = (peerId, displayName) => {
      this._addChatMessage('SYSTEM', `${displayName || shortId(peerId)} joined`, '#d4af37');
      this.viz.addSingerCluster(peerId, peerColor(peerId));
      this._updatePeersList();
    };

    this.mesh.onPeerLeft = (peerId) => {
      this._addChatMessage('SYSTEM', `${shortId(peerId)} left`, '#ff2244');
      this.viz.removeSingerCluster(peerId);
      this.fabric.removePeerAnalyser(peerId);
      this._updatePeersList();
    };

    this.mesh.onPeerAudio = (peerId, stream) => {
      // Connect peer audio to vocal processor and fabric
      const source = this.vocal.connectPeer(stream);
      const analyser = this.fabric.createPeerAnalyser(peerId);
      source.connect(analyser);
    };

    this.mesh.onPeerData = (peerId, data) => {
      if (data.type === 'chat') {
        this._addChatMessage(data.from || shortId(peerId), data.text, peerColor(peerId));
      }
      if (data.type === 'queue') {
        this.tracks.queue.merge(data.queue);
        if (this.tracks.onQueueUpdate) {
          this.tracks.onQueueUpdate(this.tracks.queue.getOrdered());
        }
      }
    };
  }

  _updatePeersList() {
    const el = $('#peers-list');
    el.innerHTML = '';

    // Self
    const selfDiv = document.createElement('div');
    selfDiv.className = 'peer-item';
    selfDiv.innerHTML = `
      <div class="peer-dot" style="background:${peerColor(this.identity.publicKeyHex)}"></div>
      <span class="peer-name">${this.identity.displayName} (you)</span>
      <span class="peer-role">${this.mesh.isHost ? 'host' : ''}</span>
    `;
    el.appendChild(selfDiv);

    // Peers
    for (const [pid, peer] of this.mesh.peers) {
      const div = document.createElement('div');
      div.className = 'peer-item';
      div.innerHTML = `
        <div class="peer-dot" style="background:${peerColor(pid)}"></div>
        <span class="peer-name">${peer.displayName || shortId(pid)}</span>
        <span class="peer-role"></span>
      `;
      el.appendChild(div);
    }

    $('#stage-peers-count').textContent = `${this.mesh.peers.size + 1} peers`;
  }

  // ── MAIN LOOP ──────────────────────────────────────────
  _startLoop() {
    this._lastTime = performance.now();
    const loop = (now) => {
      const dt = (now - this._lastTime) / 1000;
      this._lastTime = now;

      // Audio Fabric analysis (p=5)
      this.fabric.analyze();

      // Vocal harmony update (p=7)
      if (this.settings.harmony) this.vocal.updateHarmony();

      // Track lyrics update (p=11)
      if (this.tracks.isPlaying) this.tracks.updateLyrics();

      // Visualization (p=13)
      if (this.settings.viz) this.viz.update(dt);

      // UI updates
      this._updateUI();

      this._animFrame = requestAnimationFrame(loop);
    };
    this._animFrame = requestAnimationFrame(loop);
  }

  _stopLoop() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  _updateUI() {
    // Ring bars
    const bars = $$('#ring-bars .ring-bar');
    for (let i = 0; i < 7; i++) {
      const val = this.fabric.smoothRings[i];
      bars[i].style.height = `${Math.max(2, val * 58)}px`;
    }

    // Vagal metrics
    $('#vm-tone').textContent = this.fabric.vagalTone.toFixed(2);
    $('#vm-mode').textContent = this.fabric.mode;
    $('#vm-coher').textContent = this.fabric.coherence.toFixed(3);
    $('#vm-exhale').textContent = this.fabric.exhaleRatio.toFixed(2);

    // Coherence display
    const coherEl = $('#stage-coherence');
    coherEl.textContent = `coherence: ${this.fabric.coherence.toFixed(3)}`;
    coherEl.classList.toggle('golden', this.fabric.coherence > 0.618);

    // Pitch display
    if (this.settings.pitch) {
      const pitchInfo = this.vocal.getPitchInfo();
      const indicator = $('#pitch-indicator');
      if (pitchInfo) {
        const position = 50 + (pitchInfo.cents / 50) * 40;
        indicator.style.left = `${Math.max(5, Math.min(95, position))}%`;
        if (Math.abs(pitchInfo.cents) < 10) {
          indicator.style.background = 'var(--r3)';  // green = on pitch
        } else if (Math.abs(pitchInfo.cents) < 30) {
          indicator.style.background = 'var(--r2)';  // amber = close
        } else {
          indicator.style.background = 'var(--text-dim)';
        }
      }
    }

    // Playback progress
    if (this.tracks.isPlaying || this.tracks.pauseOffset > 0) {
      const current = this.tracks.getCurrentTime();
      const total = this.tracks.duration;
      $('#playback-time').textContent = `${formatTime(current)} / ${formatTime(total)}`;
      if (total > 0) {
        $('#progress-fill').style.width = `${(current / total) * 100}%`;
      }
    }
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
