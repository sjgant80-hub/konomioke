class VocalProcessor {
  constructor(audioFabric) {
    this.fabric = audioFabric;
    this.ctx = audioFabric.ctx;
    this.selfGain = null;
    this.trackGain = null;
    this.othersGain = null;
    this.harmonyGain = null;
    this.masterGain = null;
    this.harmonyOsc = null;
    this.harmonyEnabled = false;
    this.currentPitch = -1;
    this.targetPitch = -1;

    // Note names for display
    this._noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  }

  async boot() {
    // Create gain nodes for mix control
    this.selfGain = this.ctx.createGain();
    this.selfGain.gain.value = 0.8;

    this.trackGain = this.ctx.createGain();
    this.trackGain.gain.value = 0.7;

    this.othersGain = this.ctx.createGain();
    this.othersGain.gain.value = 0.6;

    this.harmonyGain = this.ctx.createGain();
    this.harmonyGain.gain.value = 0;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);

    // Connect gains to master
    this.selfGain.connect(this.masterGain);
    this.trackGain.connect(this.masterGain);
    this.othersGain.connect(this.masterGain);
    this.harmonyGain.connect(this.masterGain);

    // Harmony oscillator
    this.harmonyOsc = this.ctx.createOscillator();
    this.harmonyOsc.type = 'sine';
    this.harmonyOsc.frequency.value = 0;
    const harmGain2 = this.ctx.createGain();
    harmGain2.gain.value = 0.15;
    this.harmonyOsc.connect(harmGain2);
    harmGain2.connect(this.harmonyGain);
    this.harmonyOsc.start();

    return this;
  }

  // Connect local mic to self-monitor
  connectSelf(sourceNode) {
    sourceNode.connect(this.selfGain);
  }

  // Connect a peer's audio stream
  connectPeer(stream) {
    const source = this.ctx.createMediaStreamSource(stream);
    source.connect(this.othersGain);
    return source;
  }

  // Connect track audio
  connectTrack(sourceNode) {
    sourceNode.connect(this.trackGain);
  }

  // Update mix levels
  setMix(channel, value) {
    const vol = value / 100;
    switch (channel) {
      case 'self': this.selfGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05); break;
      case 'track': this.trackGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05); break;
      case 'others': this.othersGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05); break;
      case 'harmony': this.harmonyGain.gain.setTargetAtTime(vol * 0.3, this.ctx.currentTime, 0.05); break;
    }
  }

  // Update harmony tracking
  updateHarmony() {
    if (!this.harmonyEnabled) return;
    const f0 = this.fabric.getF0();
    if (f0 > 0) {
      // Generate a major third harmony
      const harmFreq = f0 * (5 / 4); // major third
      this.harmonyOsc.frequency.setTargetAtTime(harmFreq, this.ctx.currentTime, 0.02);
      this.harmonyGain.gain.setTargetAtTime(0.1, this.ctx.currentTime, 0.05);
    } else {
      this.harmonyGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }

  setHarmonyEnabled(on) {
    this.harmonyEnabled = on;
    if (!on) {
      this.harmonyGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }

  // Get pitch info for display
  getPitchInfo() {
    const f0 = this.fabric.getF0();
    if (f0 <= 0) return null;

    const noteNum = 12 * Math.log2(f0 / 440) + 69;
    const roundedNote = Math.round(noteNum);
    const cents = Math.round((noteNum - roundedNote) * 100);
    const noteName = this._noteNames[((roundedNote % 12) + 12) % 12];
    const octave = Math.floor(roundedNote / 12) - 1;

    return { frequency: f0, note: noteName, octave, cents };
  }
}

// ─────────────────────────────────────────────────────────
// p=11  TRACK + LYRICS ENGINE — Track loading, LRC, queue
// ─────────────────────────────────────────────────────────
