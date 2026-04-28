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

    // Browser autoplay policy: AudioContext starts suspended until a user
    // gesture. Resume on the first pointer/key event so the prime drones
    // and analyser actually run.
    if (this.ctx.state === 'suspended') {
      const resume = () => {
        this.ctx.resume().catch(() => {});
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
        window.removeEventListener('touchstart', resume);
      };
      window.addEventListener('pointerdown', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
      window.addEventListener('touchstart', resume, { once: true });
    }

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
