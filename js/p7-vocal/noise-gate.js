// NoiseGate — adaptive ambient-noise gate for the mic chain.
//
// Strategy: measure RMS over a short rolling window. The lowest sustained
// percentile becomes the "ambient floor". Anything within `floorOffsetDb`
// of that floor is faded to silence; anything above passes through. The
// floor adapts continuously (slow upward, fast downward) so changing rooms
// or AC kicking in is tracked. Sits between the raw mic source and the rest
// of the audio graph (analyser, self-monitor, peer broadcast).
class NoiseGate {
  constructor(ctx, opts) {
    opts = opts || {};
    this.ctx = ctx;
    this.floorOffsetDb = opts.floorOffsetDb != null ? opts.floorOffsetDb : -50;
    this.attack = (opts.attackMs || 8) / 1000;
    this.release = (opts.releaseMs || 120) / 1000;

    this.input = ctx.createGain();
    this.gate = ctx.createGain();
    this.gate.gain.value = 0;
    this.output = ctx.createGain();
    this.input.connect(this.gate);
    this.gate.connect(this.output);

    // Tap an analyser off the raw input for level detection (does not affect graph).
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.0;
    this.input.connect(this.analyser);
    this._buf = new Float32Array(this.analyser.fftSize);

    // Floor estimator state: very slow upward EMA, fast downward.
    this._floorRms = 0.001;          // start tiny so initial speech opens the gate
    this._everSeenAudio = false;
    this._open = false;

    // Peer-facing MediaStreamDestination so WebRTC can transmit gated audio.
    this._dest = ctx.createMediaStreamDestination();
    this.output.connect(this._dest);
    this.outputStream = this._dest.stream;

    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  connect(srcNode) { srcNode.connect(this.input); return this.output; }

  destroy() {
    cancelAnimationFrame(this._raf);
    try { this.input.disconnect(); this.gate.disconnect(); this.output.disconnect(); } catch (_) {}
  }

  setFloorOffsetDb(db) { this.floorOffsetDb = db; }

  _rms() {
    this.analyser.getFloatTimeDomainData(this._buf);
    let s = 0;
    for (let i = 0; i < this._buf.length; i++) s += this._buf[i] * this._buf[i];
    return Math.sqrt(s / this._buf.length);
  }

  _tick() {
    this._raf = requestAnimationFrame(this._tick);
    const rms = this._rms();
    if (rms <= 0) return;

    // Adapt floor: rise slowly toward current level if we're below it,
    // fall quickly toward current level if we suddenly see quieter audio.
    if (rms < this._floorRms) {
      this._floorRms = this._floorRms * 0.7 + rms * 0.3;     // fast track downward
    } else {
      this._floorRms = this._floorRms * 0.998 + rms * 0.002; // slow track upward
    }
    if (rms > this._floorRms * 4) this._everSeenAudio = true;

    // Gate threshold: floor + offsetDb (offset is negative, e.g. -50dB below
    // current level means anything within 50dB of the floor is muted).
    // Convert: threshold = floorRms * 10^((|offset|)/20)? No — we want anything
    // within `gap` dB above the floor to be muted, gap = -floorOffsetDb. So
    // threshold linear = floorRms * 10^(gap/20). With offsetDb=-50, gap=50,
    // threshold = floorRms * ~316. Anything quieter than that = noise = gate
    // closed.
    const gapDb = Math.max(0, -this.floorOffsetDb);
    const thresh = this._floorRms * Math.pow(10, gapDb / 20);

    const shouldOpen = this._everSeenAudio && rms > thresh;
    if (shouldOpen !== this._open) {
      this._open = shouldOpen;
      const target = shouldOpen ? 1 : 0;
      const tc = shouldOpen ? this.attack : this.release;
      this.gate.gain.setTargetAtTime(target, this.ctx.currentTime, tc);
    }
  }
}
