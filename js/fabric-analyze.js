    }

    // Composite: weighted average of all singers
    this._calcComposite();
    this._calcMetrics();
  }

  // DSP functions below have testable copies in lib/dsp.js — keep in sync
  _calcAmplitude(timeData) {
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
    return Math.min(1, Math.sqrt(sum / timeData.length) * 4);
  }

  _detectPitch(timeData) {
    // Autocorrelation pitch detection
    const SIZE = timeData.length;
    const MAX = Math.floor(SIZE / 2);
    let bestOffset = -1;
    let bestCorrelation = 0;
    let found = false;

    // Check if signal is strong enough
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += timeData[i] * timeData[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

    for (let offset = 40; offset < MAX; offset++) {
      let correlation = 0;
      for (let i = 0; i < MAX; i++) {
        correlation += Math.abs(timeData[i] - timeData[i + offset]);
      }
      correlation = 1 - (correlation / MAX);

      if (correlation > 0.9 && correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
        found = true;
      } else if (found && correlation < bestCorrelation * 0.8) {
        break;
      }
    }

    return (bestCorrelation > 0.01 && bestOffset > 0) ? this.ctx.sampleRate / bestOffset : -1;
  }

  _calcFricativeEnergy(freqData) {
    // High-frequency energy (4kHz+) for fricatives like sh, s, f
    const binSize = this.ctx.sampleRate / this.fftSize;
    const startBin = Math.floor(4000 / binSize);
    let sum = 0;
    let count = 0;
    for (let i = startBin; i < freqData.length; i++) {
      const val = Math.pow(10, freqData[i] / 20);
      sum += val;
      count++;
    }
    return count > 0 ? Math.min(1, (sum / count) * 10) : 0;
  }

  _calcBandEnergy(freqData, lowHz, highHz) {
    const binSize = this.ctx.sampleRate / this.fftSize;
    const lo = Math.floor(lowHz / binSize);
    const hi = Math.min(Math.floor(highHz / binSize), freqData.length - 1);
    let sum = 0;
    let count = 0;
    for (let i = lo; i <= hi; i++) {
      const val = Math.pow(10, freqData[i] / 20);
      sum += val;
      count++;
    }
    return count > 0 ? Math.min(1, (sum / count) * 8) : 0;
  }

  _calcSilence(amplitude) {
    if (amplitude < 0.02) {
      this._silenceFrames = Math.min(120, this._silenceFrames + 1);
    } else {
      this._silenceFrames = Math.max(0, this._silenceFrames - 2);
    }
    return Math.min(1, this._silenceFrames / 60);
  }

  _calcComposite() {
    const allRings = [this.smoothRings];
    for (const [, pa] of this.peerAnalysers) allRings.push(pa.rings);

    const n = allRings.length;
    for (let r = 0; r < 7; r++) {
      let sum = 0;
      for (const rings of allRings) sum += rings[r];
      this.compositeRings[r] = sum / n;
    }
  }

  _calcMetrics() {
    // Vagal Tone = weighted ring sum
    const weights = [0.2, 0.25, 0.1, 0.15, 0.1, 0.1, 0.1];
    this.vagalTone = 0;
    for (let i = 0; i < 7; i++) this.vagalTone += this.compositeRings[i] * weights[i];

    // Mode
    if (this.compositeRings[6] > 0.5) {
      this.mode = 'silent';
    } else if (this.compositeRings[0] > 0.3 && this.compositeRings[1] > 0.2) {
      this._sustainedFrames++;
      this.mode = this._sustainedFrames > 30 ? 'sustained' : 'pulsed';
    } else {
      this._sustainedFrames = Math.max(0, this._sustainedFrames - 1);
      this.mode = 'pulsed';
    }

    // Coherence = phi-ratio between adjacent rings
    let phiSum = 0;
    for (let i = 0; i < 6; i++) {
      const a = this.compositeRings[i];
      const b = this.compositeRings[i + 1];
      if (a > 0.01 && b > 0.01) {
        const ratio = Math.max(a, b) / Math.min(a, b);
        phiSum += 1 - Math.abs(ratio - this._PHI) / this._PHI;
      }
    }
    this.coherence = Math.max(0, Math.min(1, phiSum / 6));

    // Exhale ratio
    this._breathHistory.push(this.compositeRings[0]);
    if (this._breathHistory.length > 120) this._breathHistory.shift();
    if (this._breathHistory.length > 20) {
      let exhaleFrames = 0;
      let total = 0;
      for (let i = 1; i < this._breathHistory.length; i++) {
        if (this._breathHistory[i] < this._breathHistory[i - 1]) exhaleFrames++;
        total++;
      }
      this.exhaleRatio = total > 0 ? exhaleFrames / total : 0;
    }

    // Psi level
    this.psiLevel = this.vagalTone * this.coherence;
  }

  getF0() {
    return this._detectPitch(this._timeData);
  }

  resume() {
    if (this.ctx.state === 'suspended') return this.ctx.resume();
  }
}

// ─────────────────────────────────────────────────────────
// p=7  VOCAL PROCESSING — Pitch display, harmony, mixing
// ─────────────────────────────────────────────────────────
