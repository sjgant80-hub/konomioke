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

