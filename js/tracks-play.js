    this.isPlaying = true;
    this.pauseOffset = offset;

    if (this.onPlayStateChange) this.onPlayStateChange(true);
  }

  _startMediaPlayback(offset) {
    if (!this._mediaElement) return;
    const el = this._mediaElement;

    // Connect element to Web Audio graph (only once per element)
    if (!this._mediaSourceNode) {
      this._mediaSourceNode = this.ctx.createMediaElementSource(el);
      this._mediaSourceNode.connect(this.vocal.trackGain);
    }

    el.currentTime = offset;
    el.play();

    el.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        if (this.onTrackEnd) this.onTrackEnd();
      }
    };

    this.startTime = this.ctx.currentTime - offset;
    this.isPlaying = true;
    this.pauseOffset = offset;

    if (this.onPlayStateChange) this.onPlayStateChange(true);
  }

  pause() {
    if (!this.isPlaying) return;
    if (this._mediaElement) {
      this.pauseOffset = this._mediaElement.currentTime;
      this._mediaElement.pause();
    } else if (this.sourceNode) {
      this.pauseOffset = this.ctx.currentTime - this.startTime;
      this.sourceNode.stop();
      this.sourceNode = null;
    }
    this.isPlaying = false;
    if (this.onPlayStateChange) this.onPlayStateChange(false);
  }

  resume() {
    if (this.isPlaying) return;
    if (this._mediaElement) {
      this._startMediaPlayback(this.pauseOffset);
    } else if (this.audioBuffer) {
      this._startPlayback(this.pauseOffset);
    }
  }

  stop() {
    if (this._mediaElement) {
      this._mediaElement.pause();
      this._mediaElement.currentTime = 0;
    }
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch {}
      this.sourceNode = null;
    }
    this.isPlaying = false;
    this.pauseOffset = 0;
    this.currentLyricIdx = -1;
    if (this.onPlayStateChange) this.onPlayStateChange(false);
  }

  togglePlay() {
    if (this.isPlaying) this.pause();
    else if (this.audioBuffer || this._mediaElement) this.resume();
  }

  seek(fraction) {
    const time = fraction * this.duration;
    const wasPlaying = this.isPlaying;
    this.stop();
    this.pauseOffset = time;
    if (wasPlaying) {
      if (this._mediaElement) this._startMediaPlayback(time);
      else this._startPlayback(time);
    }
  }

  getCurrentTime() {
    if (this._mediaElement && this.isPlaying) return this._mediaElement.currentTime;
    if (this.isPlaying) return this.ctx.currentTime - this.startTime;
    return this.pauseOffset;
  }

  // Update lyrics based on current playback time
  updateLyrics() {
    if (this.lyrics.length === 0) return;

    const time = this.getCurrentTime();
    let idx = -1;
    for (let i = this.lyrics.length - 1; i >= 0; i--) {
      if (time >= this.lyrics[i].time) { idx = i; break; }
    }

    if (idx !== this.currentLyricIdx) {
      this.currentLyricIdx = idx;
      if (this.onLyricChange) {
        const prev = idx > 0 ? this.lyrics[idx - 1].text : '';
        const current = idx >= 0 ? this.lyrics[idx].text : '';
        const next = idx < this.lyrics.length - 1 ? this.lyrics[idx + 1].text : '';
        this.onLyricChange(prev, current, next);
      }
    }
  }

  // Play next in queue
  playNext() {
    const ordered = this.queue.getOrdered();
    if (ordered.length === 0) return;

    let idx = 0;
    if (this.currentTrack) {
      const curIdx = ordered.findIndex(i => i.id === this.currentTrack.id);
      idx = (curIdx + 1) % ordered.length;
    }
    this.playTrack(ordered[idx]);
  }

  // Play previous in queue
  playPrev() {
    const ordered = this.queue.getOrdered();
    if (ordered.length === 0) return;

    let idx = ordered.length - 1;
    if (this.currentTrack) {
      const curIdx = ordered.findIndex(i => i.id === this.currentTrack.id);
      idx = (curIdx - 1 + ordered.length) % ordered.length;
    }
    this.playTrack(ordered[idx]);
  }

  removeTrack(id) {
    if (this.currentTrack && this.currentTrack.id === id) {
      this.stop();
      this.currentTrack = null;
    }
    this.queue.remove(id);
    if (this.onQueueUpdate) this.onQueueUpdate(this.queue.getOrdered());
  }
}

// ─────────────────────────────────────────────────────────
// p=13  VISUALIZATION ENGINE — Three.js 127D vagal orb
// ─────────────────────────────────────────────────────────
