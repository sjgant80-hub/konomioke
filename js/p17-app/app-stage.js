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

    // Sync toggle visual state from current settings (defaults may have been
    // overridden by GitHub-issues config). The HTML provides initial guesses
    // but settings is the source of truth.
    $$('.toggle-switch').forEach(el => {
      const key = el.dataset.key;
      if (key in this.settings) {
        el.classList.toggle('on', !!this.settings[key]);
      }
    });

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
          case 'noiseGate':
            // Rebuild the audio chain with/without the gate
            this._getMicrophone();
            break;
          case 'selfMonitor':
            // Connect or silence the self path without re-grabbing mic
            if (this.vocal && this.gatedSource) {
              if (this.settings.selfMonitor) {
                this.vocal.connectSelf(this.gatedSource);
              } else if (this.vocal.selfGain) {
                this.vocal.selfGain.gain.setTargetAtTime(0, this.vocal.ctx.currentTime, 0.02);
              }
            }
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

