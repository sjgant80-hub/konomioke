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

