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

      // Optional adaptive noise gate — measures ambient floor and ducks anything
      // close to it. Sits between the raw mic and everything downstream (analyser,
      // self-monitor, peer broadcast).
      if (typeof NoiseGate === 'function' && this.settings.noiseGate) {
        this.noiseGate = new NoiseGate(this.fabric.ctx, {
          floorOffsetDb: this.settings.noiseGateDb,
          attackMs: this.settings.noiseGateAttackMs,
          releaseMs: this.settings.noiseGateReleaseMs
        });
        this.noiseGate.connect(this.micSourceNode);
        this.gatedSource = this.noiseGate.output;
        this.gatedStream = this.noiseGate.outputStream;
      } else {
        this.gatedSource = this.micSourceNode;
        this.gatedStream = this.micStream;
      }

      this.fabric.connectSource(this.gatedSource);

      // Self-monitor: only route mic to local speakers when explicitly enabled.
      // Off by default so users don't hear themselves; peers still hear them.
      if (this.settings.selfMonitor) {
        this.vocal.connectSelf(this.gatedSource);
      }

      // Set as local stream for WebRTC (gated when noiseGate active)
      this.mesh.setLocalStream(this.gatedStream);

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
    this._setState('stage');
    $('#stage-room-code').textContent = roomCode;
    this._startLoop();
  }

