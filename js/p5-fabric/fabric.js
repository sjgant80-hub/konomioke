class AudioFabricEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.fftSize = 2048;
    this.rings = new Float32Array(7);     // [R0..R6] current values
    this.smoothRings = new Float32Array(7);
    this.peerAnalysers = new Map();       // peerId -> { analyser, rings }
    this.compositeRings = new Float32Array(7);
    this.coherence = 0;
    this.vagalTone = 0;
    this.mode = 'silent';
    this.exhaleRatio = 0;
    this.psiLevel = 0;
    this.droneOscillators = [];
    this.droneGains = [];
    this.masterDroneGain = null;

    // Analysis buffers
    this._freqData = null;
    this._timeData = null;
    this._prevAmplitude = 0;
    this._silenceFrames = 0;
    this._sustainedFrames = 0;
    this._breathHistory = [];
    this._PHI = (1 + Math.sqrt(5)) / 2;
  }

  async boot() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000,
      latencyHint: 'interactive'
    });

    // Create analyser for local mic
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;

    this._freqData = new Float32Array(this.analyser.frequencyBinCount);
    this._timeData = new Float32Array(this.analyser.fftSize);

    // Initialize prime drones: primes × 55Hz
    this._initDrones();

    return this;
  }

  _initDrones() {
    const primes = [2, 3, 5, 7, 11, 13, 17];
    const baseFreq = 55;

    this.masterDroneGain = this.ctx.createGain();
    this.masterDroneGain.gain.value = 0.03; // very subtle
    this.masterDroneGain.connect(this.ctx.destination);

    for (let i = 0; i < 7; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = primes[i] * baseFreq;

      const gain = this.ctx.createGain();
      gain.gain.value = 0;

      osc.connect(gain);
      gain.connect(this.masterDroneGain);
      osc.start();

      this.droneOscillators.push(osc);
      this.droneGains.push(gain);
    }
  }

  setDroneVolume(vol) {
    if (this.masterDroneGain) {
      this.masterDroneGain.gain.setTargetAtTime(vol * 0.08, this.ctx.currentTime, 0.1);
    }
  }

  connectSource(sourceNode) {
    sourceNode.connect(this.analyser);
  }

  createPeerAnalyser(peerId) {
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = this.fftSize;
    analyser.smoothingTimeConstant = 0.8;
    const rings = new Float32Array(7);
    const freqData = new Float32Array(analyser.frequencyBinCount);
    const timeData = new Float32Array(analyser.fftSize);
    this.peerAnalysers.set(peerId, { analyser, rings, freqData, timeData });
    return analyser;
  }

  removePeerAnalyser(peerId) {
    this.peerAnalysers.delete(peerId);
  }

  // Main analysis loop — called at ~60Hz
  analyze() {
    if (!this.analyser) return;

    this.analyser.getFloatFrequencyData(this._freqData);
    this.analyser.getFloatTimeDomainData(this._timeData);

    // R0: Diaphragm — amplitude envelope
    this.rings[0] = this._calcAmplitude(this._timeData);

    // R1: Larynx — F0 pitch tracking
    const f0 = this._detectPitch(this._timeData);
    this.rings[1] = f0 > 0 ? Math.min(1, f0 / 800) : 0;

    // R2: Breath gate — fricative/high-freq energy
    this.rings[2] = this._calcFricativeEnergy(this._freqData);

    // R3: Thoracic — low formant (100-400Hz)
    this.rings[3] = this._calcBandEnergy(this._freqData, 100, 400);

    // R4: Nasopharyngeal — mid formant (800-2500Hz)
    this.rings[4] = this._calcBandEnergy(this._freqData, 800, 2500);

    // R5: Oral — high formant (2500-4000Hz)
    this.rings[5] = this._calcBandEnergy(this._freqData, 2500, 4000);

    // R6: Observer — silence tracking
    this.rings[6] = this._calcSilence(this.rings[0]);

    // Smooth
    for (let i = 0; i < 7; i++) {
      this.smoothRings[i] += (this.rings[i] - this.smoothRings[i]) * 0.3;
    }

    // Update drones based on ring activity
    for (let i = 0; i < 7; i++) {
      const target = this.smoothRings[i] * 0.5;
      this.droneGains[i].gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }

    // Analyze peers
    for (const [pid, pa] of this.peerAnalysers) {
      pa.analyser.getFloatFrequencyData(pa.freqData);
      pa.analyser.getFloatTimeDomainData(pa.timeData);
      pa.rings[0] = this._calcAmplitude(pa.timeData);
      const pf0 = this._detectPitch(pa.timeData);
      pa.rings[1] = pf0 > 0 ? Math.min(1, pf0 / 800) : 0;
      pa.rings[2] = this._calcFricativeEnergy(pa.freqData);
      pa.rings[3] = this._calcBandEnergy(pa.freqData, 100, 400);
      pa.rings[4] = this._calcBandEnergy(pa.freqData, 800, 2500);
      pa.rings[5] = this._calcBandEnergy(pa.freqData, 2500, 4000);
      pa.rings[6] = this._calcSilence(pa.rings[0]);
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

