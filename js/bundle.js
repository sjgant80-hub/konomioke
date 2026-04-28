/* ═══════════════════════════════════════════════════════════
   KONOMIOKE — 好みオケ — JavaScript Engine
   fold(konomioke) = 2 × 3 × 5 × 7 × 11 × 13 × 17 = 510,510
   ═══════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes.buffer;
}

function shortId(hex) {
  return hex.slice(0, 8) + hex.slice(-6);
}

function peerColor(pubkeyHex) {
  let h = 0;
  for (let i = 0; i < 8; i++) h = (h * 31 + pubkeyHex.charCodeAt(i)) & 0xffffff;
  return `hsl(${h % 360}, 70%, 60%)`;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────
// p=2  IDENTITY + ROOMS — Ed25519 keypair, IndexedDB
// ─────────────────────────────────────────────────────────

class KonomiIdentity {
  constructor() {
    this.keyPair = null;
    this.publicKeyHex = '';
    this.shortId = '';
    this.displayName = 'Singer';
    this.db = null;
  }

  async boot() {
    await this._openDB();
    const stored = await this._loadKey();
    if (stored && stored.publicKeyHex) {
      this.keyPair = stored.keyPair;
      this.publicKeyHex = stored.publicKeyHex;
    } else {
      await this._generateKey();
      await this._saveKey();
    }
    this.shortId = shortId(this.publicKeyHex);
    const name = await this._loadMeta('displayName');
    if (name) this.displayName = name;
    return this;
  }

  async _generateKey() {
    if (!crypto.subtle) {
      // Insecure context fallback — random identity, no real signing
      const rand = new Uint8Array(32);
      crypto.getRandomValues(rand);
      this.publicKeyHex = bufToHex(rand);
      this.keyPair = null;
      return;
    }
    try {
      this.keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
      const raw = await crypto.subtle.exportKey('raw', this.keyPair.publicKey);
      this.publicKeyHex = bufToHex(raw);
    } catch {
      // Fallback to ECDSA if Ed25519 not supported
      this.keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
      );
      const raw = await crypto.subtle.exportKey('raw', this.keyPair.publicKey);
      this.publicKeyHex = bufToHex(raw);
    }
  }

  async sign(data) {
    if (!this.keyPair) return new ArrayBuffer(0);
    const encoded = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    try {
      return await crypto.subtle.sign('Ed25519', this.keyPair.privateKey, encoded);
    } catch {
      return await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' }, this.keyPair.privateKey, encoded
      );
    }
  }

  async createRoomCode() {
    const seed = this.publicKeyHex + Date.now().toString();
    if (crypto.subtle) {
      const data = new TextEncoder().encode(seed);
      const hash = await crypto.subtle.digest('SHA-256', data);
      return bufToHex(hash).slice(0, 8).toUpperCase();
    }
    // Fallback: use random bytes
    const rand = new Uint8Array(4);
    crypto.getRandomValues(rand);
    return bufToHex(rand).toUpperCase();
  }

  async setDisplayName(name) {
    this.displayName = name || 'Singer';
    await this._saveMeta('displayName', this.displayName);
  }

  // ── IndexedDB ──
  _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('konomioke', 2);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('keystore')) db.createObjectStore('keystore');
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks');
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions');
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  }

  _dbGet(store, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  _dbPut(store, key, val) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async _saveKey() {
    if (!this.keyPair) {
      // Insecure context — persist only the random hex
      await this._dbPut('keystore', 'identity', { publicKeyHex: this.publicKeyHex });
      return;
    }
    const privJwk = await crypto.subtle.exportKey('jwk', this.keyPair.privateKey);
    const pubJwk = await crypto.subtle.exportKey('jwk', this.keyPair.publicKey);
    await this._dbPut('keystore', 'identity', { privJwk, pubJwk, publicKeyHex: this.publicKeyHex });
  }

  async _loadKey() {
    const stored = await this._dbGet('keystore', 'identity');
    if (!stored) return null;
    if (!stored.privJwk) {
      // Insecure context stored identity
      return { keyPair: null, publicKeyHex: stored.publicKeyHex };
    }
    try {
      // Try Ed25519 first
      const privateKey = await crypto.subtle.importKey('jwk', stored.privJwk, 'Ed25519', true, ['sign']);
      const publicKey = await crypto.subtle.importKey('jwk', stored.pubJwk, 'Ed25519', true, ['verify']);
      return { keyPair: { privateKey, publicKey }, publicKeyHex: stored.publicKeyHex };
    } catch {
      try {
        const privateKey = await crypto.subtle.importKey(
          'jwk', stored.privJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']
        );
        const publicKey = await crypto.subtle.importKey(
          'jwk', stored.pubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']
        );
        return { keyPair: { privateKey, publicKey }, publicKeyHex: stored.publicKeyHex };
      } catch {
        return null;
      }
    }
  }

  async _saveMeta(key, val) { await this._dbPut('meta', key, val); }
  async _loadMeta(key) { return this._dbGet('meta', key); }

  async saveTrack(hash, data) { await this._dbPut('tracks', hash, data); }
  async loadTrack(hash) { return this._dbGet('tracks', hash); }
}

// ─────────────────────────────────────────────────────────
// CRDT Queue — Conflict-free queue for song ordering
// NOTE: Canonical testable copy in lib/crdt-queue.js — keep in sync
// ─────────────────────────────────────────────────────────

class CRDTQueue {
  constructor() {
    this.items = new Map();
  }

  add(data) {
    const id = crypto.randomUUID();
    const maxPos = this.getOrdered().reduce((m, i) => Math.max(m, i.position), 0);
    const entry = { id, data, position: maxPos + 1, timestamp: Date.now(), deleted: false };
    this.items.set(id, entry);
    return entry;
  }

  remove(id) {
    const item = this.items.get(id);
    if (item) { item.deleted = true; item.timestamp = Date.now(); }
  }

  merge(remote) {
    for (const [id, rEntry] of Object.entries(remote)) {
      const local = this.items.get(id);
      if (!local || rEntry.timestamp > local.timestamp) {
        this.items.set(id, rEntry);
      }
    }
  }

  getOrdered() {
    return [...this.items.values()].filter(i => !i.deleted).sort((a, b) => a.position - b.position);
  }

  serialize() {
    return Object.fromEntries(this.items);
  }
}

// ─────────────────────────────────────────────────────────
// p=3  P2P MESH LAYER — WebRTC + WebSocket signaling
// ─────────────────────────────────────────────────────────

class KonomiMesh {
  constructor(identity) {
    this.identity = identity;
    this.ws = null;
    this.peers = new Map();      // peerId -> { conn, dataChannel, audioStream, displayName, rings }
    this.roomCode = null;
    this.isHost = false;
    this.onPeerJoined = null;
    this.onPeerLeft = null;
    this.onPeerAudio = null;
    this.onPeerData = null;
    this.onRoomJoined = null;
    this.localStream = null;
  }

  async boot(signalUrl) {
    this.signalUrl = signalUrl;
    return this;
  }

  async connectSignal() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('Signaling connection timed out'));
      }, 4000);
      this.ws = new WebSocket(this.signalUrl);
      this.ws.onopen = () => { clearTimeout(timeout); resolve(); };
      this.ws.onerror = () => { clearTimeout(timeout); reject(new Error('Signaling connection failed')); };
      this.ws.onclose = () => { /* reconnect logic could go here */ };
      this.ws.onmessage = (e) => this._onSignalMessage(JSON.parse(e.data));
    });
  }

  async createRoom() {
    this.roomCode = await this.identity.createRoomCode();
    this.isHost = true;
    this.ws.send(JSON.stringify({
      type: 'join',
      room: this.roomCode,
      peerId: this.identity.publicKeyHex,
      displayName: this.identity.displayName
    }));
    return this.roomCode;
  }

  async joinRoom(code) {
    this.roomCode = code.toUpperCase();
    this.isHost = false;
    this.ws.send(JSON.stringify({
      type: 'join',
      room: this.roomCode,
      peerId: this.identity.publicKeyHex,
      displayName: this.identity.displayName
    }));
  }

  leaveRoom() {
    for (const [pid, peer] of this.peers) {
      if (peer.conn) peer.conn.close();
    }
    this.peers.clear();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.roomCode = null;
  }

  setLocalStream(stream) {
    this.localStream = stream;
    // Add to existing connections
    for (const [pid, peer] of this.peers) {
      if (peer.conn && this.localStream) {
        for (const track of this.localStream.getTracks()) {
          peer.conn.addTrack(track, this.localStream);
        }
      }
    }
  }

  broadcast(data) {
    const msg = JSON.stringify(data);
    for (const [pid, peer] of this.peers) {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(msg);
      }
    }
  }

  broadcastState(state) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'state', state }));
    }
  }

  _onSignalMessage(msg) {
    switch (msg.type) {
      case 'room-peers':
        if (this.onRoomJoined) this.onRoomJoined(this.roomCode, msg.peers);
        // Connect to existing peers
        for (const p of msg.peers) {
          this._createPeerConnection(p.peerId, p.displayName, true);
        }
        break;
      case 'peer-joined':
        this._createPeerConnection(msg.peerId, msg.displayName, false);
        if (this.onPeerJoined) this.onPeerJoined(msg.peerId, msg.displayName);
        break;
      case 'peer-left':
        this._removePeer(msg.peerId);
        if (this.onPeerLeft) this.onPeerLeft(msg.peerId);
        break;
      case 'signal':
        this._handleSignal(msg.from, msg.signal);
        break;
      case 'state':
        if (this.onPeerData) this.onPeerData(msg.from, msg.state);
        break;
    }
  }

  async _createPeerConnection(peerId, displayName, initiator) {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const conn = new RTCPeerConnection(config);
    const peer = { conn, dataChannel: null, audioStream: null, displayName: displayName || 'Peer', rings: new Float32Array(7) };
    this.peers.set(peerId, peer);

    // Add local audio tracks
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        conn.addTrack(track, this.localStream);
      }
    }

    // Handle remote audio
    conn.ontrack = (e) => {
      peer.audioStream = e.streams[0];
      if (this.onPeerAudio) this.onPeerAudio(peerId, e.streams[0]);
    };

    // ICE candidates
    conn.onicecandidate = (e) => {
      if (e.candidate) {
        this.ws.send(JSON.stringify({
          type: 'signal',
          target: peerId,
          signal: { ice: e.candidate }
        }));
      }
    };

    // Data channel
    if (initiator) {
      const dc = conn.createDataChannel('konomi');
      this._setupDataChannel(peerId, dc);
      peer.dataChannel = dc;

      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      this.ws.send(JSON.stringify({
        type: 'signal',
        target: peerId,
        signal: { sdp: conn.localDescription }
      }));
    } else {
      conn.ondatachannel = (e) => {
        peer.dataChannel = e.channel;
        this._setupDataChannel(peerId, e.channel);
      };
    }

    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'failed' || conn.connectionState === 'closed') {
        this._removePeer(peerId);
      }
    };
  }

  _setupDataChannel(peerId, dc) {
    dc.onopen = () => {};
    dc.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (this.onPeerData) this.onPeerData(peerId, data);
      } catch {}
    };
  }

  async _handleSignal(from, signal) {
    let peer = this.peers.get(from);
    if (!peer) {
      await this._createPeerConnection(from, null, false);
      peer = this.peers.get(from);
    }

    if (signal.sdp) {
      await peer.conn.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      if (signal.sdp.type === 'offer') {
        const answer = await peer.conn.createAnswer();
        await peer.conn.setLocalDescription(answer);
        this.ws.send(JSON.stringify({
          type: 'signal',
          target: from,
          signal: { sdp: peer.conn.localDescription }
        }));
      }
    }

    if (signal.ice) {
      await peer.conn.addIceCandidate(new RTCIceCandidate(signal.ice));
    }
  }

  _removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      if (peer.conn) peer.conn.close();
      this.peers.delete(peerId);
    }
  }
}

// ─────────────────────────────────────────────────────────
// p=5  AUDIO FABRIC ENGINE — Vagal phoneme detection, 7 rings
// ─────────────────────────────────────────────────────────

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

class TrackEngine {
  constructor(audioFabric, vocalProcessor) {
    this.fabric = audioFabric;
    this.vocal = vocalProcessor;
    this.ctx = audioFabric.ctx;
    this.queue = new CRDTQueue();
    this.currentTrack = null;       // { id, name, buffer, source, lrc }
    this.audioBuffer = null;
    this.sourceNode = null;
    this._mediaElement = null;
    this._mediaSourceNode = null;
    this.isPlaying = false;
    this.startTime = 0;
    this.pauseOffset = 0;
    this.duration = 0;
    this.lyrics = [];               // parsed LRC: [{ time, text }]
    this.currentLyricIdx = -1;
    this.onQueueUpdate = null;
    this.onLyricChange = null;
    this.onPlayStateChange = null;
    this.onTrackEnd = null;
  }

  async boot() {
    return this;
  }

  // Load audio file from user upload
  async loadTrack(file) {
    const arrayBuffer = await file.arrayBuffer();

    // Generate hash for the track
    let hash;
    if (crypto.subtle) {
      const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
      hash = bufToHex(hashBuf).slice(0, 16);
    } else {
      const rand = new Uint8Array(8);
      crypto.getRandomValues(rand);
      hash = bufToHex(rand);
    }

    // Try decodeAudioData first (works for pure audio files)
    let audioBuffer = null;
    try {
      audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      // decodeAudioData failed — likely a video container (mp4, mkv, webm)
      // Fall back to HTMLMediaElement-based playback
    }

    if (audioBuffer) {
      const entry = this.queue.add({
        hash,
        name: file.name.replace(/\.[^.]+$/, ''),
        duration: audioBuffer.duration,
        addedBy: 'local'
      });
      entry._audioBuffer = audioBuffer;
      if (this.onQueueUpdate) this.onQueueUpdate(this.queue.getOrdered());
      return entry;
    }

    // Fallback: use <audio> element for containers decodeAudioData can't handle
    const mediaEl = await this._loadMediaElement(file);
    const entry = this.queue.add({
      hash,
      name: file.name.replace(/\.[^.]+$/, ''),
      duration: mediaEl.duration,
      addedBy: 'local'
    });
    entry._mediaElement = mediaEl;
    if (this.onQueueUpdate) this.onQueueUpdate(this.queue.getOrdered());
    return entry;
  }

  // Create an <audio>/<video> element for formats decodeAudioData can't handle
  _loadMediaElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const el = file.type.startsWith('video/') ? document.createElement('video') : document.createElement('audio');
      el.preload = 'auto';
      el.src = url;
      el.onloadedmetadata = () => resolve(el);
      el.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load media file')); };
    });
  }

  // Parse LRC lyrics — testable copy in lib/lrc-parser.js
  parseLRC(text) {
    const lines = text.split('\n');
    this.lyrics = [];
    for (const line of lines) {
      const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
      if (match) {
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const ms = parseInt(match[3].padEnd(3, '0'));
        const time = min * 60 + sec + ms / 1000;
        const text = match[4].trim();
        if (text) this.lyrics.push({ time, text });
      }
    }
    this.lyrics.sort((a, b) => a.time - b.time);
    this.currentLyricIdx = -1;
    return this.lyrics;
  }

  // Play a track from the queue
  playTrack(queueEntry) {
    this.stop();

    this.currentTrack = queueEntry;
    this.pauseOffset = 0;

    if (queueEntry._audioBuffer) {
      // Buffer-based playback
      this._mediaElement = null;
      this._mediaSourceNode = null;
      this.audioBuffer = queueEntry._audioBuffer;
      this.duration = queueEntry._audioBuffer.duration;
      this._startPlayback(0);
    } else if (queueEntry._mediaElement) {
      // MediaElement-based playback (MP4 etc.)
      this.audioBuffer = null;
      if (this._mediaSourceNode) {
        this._mediaSourceNode.disconnect();
        this._mediaSourceNode = null;
      }
      this._mediaElement = queueEntry._mediaElement;
      this.duration = this._mediaElement.duration;
      this._startMediaPlayback(0);
    }
  }

  _startPlayback(offset) {
    if (!this.audioBuffer) return;

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.vocal.trackGain);
    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        if (this.onTrackEnd) this.onTrackEnd();
      }
    };

    this.sourceNode.start(0, offset);
    this.startTime = this.ctx.currentTime - offset;
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

class VizEngine {
  constructor(audioFabric) {
    this.fabric = audioFabric;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.canvas = null;
    this.enabled = true;

    // Orb components
    this.orbMesh = null;
    this.ringParticles = [];       // 7 particle systems, one per ring
    this.singerClusters = new Map();
    this.fieldLines = [];

    // Uniforms for orb shader
    this._time = 0;
    this._orbMaterial = null;

    // Ring colors
    this._ringColors = [
      new THREE.Color(0xff2244),
      new THREE.Color(0xff8800),
      new THREE.Color(0xffcc00),
      new THREE.Color(0x00ff88),
      new THREE.Color(0x00ccff),
      new THREE.Color(0x4466ff),
      new THREE.Color(0xaa00ff)
    ];

    this._goldColor = new THREE.Color(0xd4af37);
  }

  async boot() {
    this.canvas = document.getElementById('orb-canvas');
    if (!this.canvas || typeof THREE === 'undefined') {
      this.enabled = false;
      return this;
    }

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06060c);
    this.scene.fog = new THREE.FogExp2(0x06060c, 0.015);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 0, 50);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Build the orb
    this._buildOrb();
    this._buildRingParticles();
    this._buildFieldLines();

    // Ambient light
    const ambient = new THREE.AmbientLight(0x222244, 0.5);
    this.scene.add(ambient);

    // Point light at center
    const pointLight = new THREE.PointLight(0xd4af37, 0.5, 100);
    this.scene.add(pointLight);

    // Resize handler
    window.addEventListener('resize', () => this._onResize());

    return this;
  }

  _buildOrb() {
    // Central orb — semi-transparent sphere with custom shader
    const geometry = new THREE.SphereGeometry(6, 64, 64);

    this._orbMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
        vagalTone: { value: 0 },
        coherence: { value: 0 },
        ringValues: { value: [0, 0, 0, 0, 0, 0, 0] },
        ringColors: { value: this._ringColors.map(c => c.clone()) }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        uniform float time;
        uniform float vagalTone;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vUv = uv;

          // Subtle breathing deformation
          float breath = sin(time * 1.5 * (0.5 + vagalTone)) * 0.15 + 1.0;
          vec3 pos = position * breath;

          // Per-vertex noise displacement
          float noise = sin(position.x * 3.0 + time) * sin(position.y * 3.0 + time * 0.7) * 0.2 * vagalTone;
          pos += normal * noise;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float vagalTone;
        uniform float coherence;
        uniform float ringValues[7];
        uniform vec3 ringColors[7];

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;

        void main() {
          // Fresnel glow
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);

          // Color from ring values
          vec3 color = vec3(0.02, 0.02, 0.04);
          for (int i = 0; i < 7; i++) {
            color += ringColors[i] * ringValues[i] * 0.15;
          }

          // Golden coherence tint
          vec3 gold = vec3(0.83, 0.69, 0.22);
          color = mix(color, gold, coherence * coherence * 0.6);

          // Pulse
          float pulse = 0.6 + 0.4 * sin(time * 2.0 * (0.3 + vagalTone));

          // Internal glow pattern
          float pattern = sin(vUv.x * 20.0 + time * 2.0) * sin(vUv.y * 20.0 + time * 1.5);
          color += vec3(0.03) * pattern * vagalTone;

          float alpha = fresnel * pulse * 0.5 + 0.05;
          gl_FragColor = vec4(color * pulse * 1.5, alpha);
        }
      `
    });

    this.orbMesh = new THREE.Mesh(geometry, this._orbMaterial);
    this.scene.add(this.orbMesh);
  }

  _buildRingParticles() {
    const particlesPerRing = 1400;  // ~10,000 total across 7 rings

    for (let r = 0; r < 7; r++) {
      const radius = 8 + r * 2.5;
      const tubeRadius = 1.0 + r * 0.3;
      const geometry = new THREE.BufferGeometry();

      const positions = new Float32Array(particlesPerRing * 3);
      const colors = new Float32Array(particlesPerRing * 3);
      const sizes = new Float32Array(particlesPerRing);
      const phases = new Float32Array(particlesPerRing); // for animation

      const color = this._ringColors[r];

      for (let i = 0; i < particlesPerRing; i++) {
        const u = (i / particlesPerRing) * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;

        positions[i * 3] = (radius + tubeRadius * Math.cos(v)) * Math.cos(u);
        positions[i * 3 + 1] = (radius + tubeRadius * Math.cos(v)) * Math.sin(u);
        positions[i * 3 + 2] = tubeRadius * Math.sin(v);

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        sizes[i] = 0.15 + Math.random() * 0.2;
        phases[i] = Math.random() * Math.PI * 2;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });

      const points = new THREE.Points(geometry, material);
      this.scene.add(points);

      this.ringParticles.push({
        points,
        geometry,
        positions: positions.slice(),  // original positions
        phases,
        radius,
        tubeRadius,
        particleCount: particlesPerRing
      });
    }
  }

  _buildFieldLines() {
    // Toroidal field lines connecting rings
    for (let i = 0; i < 12; i++) {
      const curve = new THREE.CatmullRomCurve3([]);
      const points = [];
      const angle = (i / 12) * Math.PI * 2;

      for (let t = 0; t <= 1; t += 0.05) {
        const r = 8 + t * 17.5;
        const y = Math.sin(t * Math.PI) * 8;
        points.push(new THREE.Vector3(
          r * Math.cos(angle + t * 0.5),
          y,
          r * Math.sin(angle + t * 0.5)
        ));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x1a1a2e,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending
      });

      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
      this.fieldLines.push({ line, material });
    }
  }

  // Add a singer cluster
  addSingerCluster(peerId, colorHex) {
    const count = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const color = new THREE.Color(colorHex);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 12 + Math.random() * 4;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.4,
      color: color,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.singerClusters.set(peerId, { points, geometry, positions: positions.slice(), color, orbitAngle: Math.random() * Math.PI * 2 });
  }

  removeSingerCluster(peerId) {
    const cluster = this.singerClusters.get(peerId);
    if (cluster) {
      this.scene.remove(cluster.points);
      cluster.geometry.dispose();
      this.singerClusters.delete(peerId);
    }
  }

  // Main render loop
  update(dt) {
    if (!this.enabled || !this.renderer) return;

    this._time += dt;

    const rings = this.fabric.smoothRings;
    const composite = this.fabric.compositeRings;
    const coherence = this.fabric.coherence;
    const vagalTone = this.fabric.vagalTone;

    // Update orb shader uniforms
    if (this._orbMaterial) {
      this._orbMaterial.uniforms.time.value = this._time;
      this._orbMaterial.uniforms.vagalTone.value = vagalTone;
      this._orbMaterial.uniforms.coherence.value = coherence;
      for (let i = 0; i < 7; i++) {
        this._orbMaterial.uniforms.ringValues.value[i] = composite[i];
      }
    }

    // Update ring particles
    for (let r = 0; r < this.ringParticles.length; r++) {
      const rp = this.ringParticles[r];
      const activity = composite[r];
      const posAttr = rp.geometry.attributes.position;
      const origPositions = rp.positions;

      for (let i = 0; i < rp.particleCount; i++) {
        const phase = rp.phases[i];
        const speed = 0.3 + activity * 2;
        const wobble = activity * 1.5;

        // Orbital motion
        const u = (i / rp.particleCount) * Math.PI * 2 + this._time * speed * 0.1;
        const v = phase + this._time * 0.5;
        const noiseX = Math.sin(phase + this._time * 1.3) * wobble;
        const noiseY = Math.cos(phase + this._time * 0.9) * wobble;
        const noiseZ = Math.sin(phase + this._time * 1.1) * wobble;

        posAttr.array[i * 3] = origPositions[i * 3] * (1 + activity * 0.1) + noiseX;
        posAttr.array[i * 3 + 1] = origPositions[i * 3 + 1] * (1 + activity * 0.1) + noiseY;
        posAttr.array[i * 3 + 2] = origPositions[i * 3 + 2] + noiseZ;
      }
      posAttr.needsUpdate = true;

      // Opacity follows activity
      rp.points.material.opacity = 0.15 + activity * 0.7;
    }

    // Update singer clusters
    for (const [pid, cluster] of this.singerClusters) {
      cluster.orbitAngle += dt * 0.3;
      const peerRings = this.fabric.peerAnalysers.get(pid);
      const activity = peerRings ? peerRings.rings[0] : 0.1;
      const posAttr = cluster.geometry.attributes.position;

      for (let i = 0; i < posAttr.count; i++) {
        const baseR = 12 + activity * 6;
        const theta = (i / posAttr.count) * Math.PI * 2 + cluster.orbitAngle;
        const phi = cluster.positions[i * 3 + 2] / 16 * Math.PI;
        const wobble = Math.sin(this._time * 2 + i * 0.1) * activity * 2;

        posAttr.array[i * 3] = (baseR + wobble) * Math.sin(phi) * Math.cos(theta);
        posAttr.array[i * 3 + 1] = (baseR + wobble) * Math.sin(phi) * Math.sin(theta);
        posAttr.array[i * 3 + 2] = (baseR + wobble) * Math.cos(phi);
      }
      posAttr.needsUpdate = true;

      // Coherence golden flash
      if (coherence > 0.618) {
        cluster.points.material.color.lerp(this._goldColor, (coherence - 0.618) * 2.6);
      } else {
        cluster.points.material.color.lerp(cluster.color, 0.1);
      }
    }

    // Update field lines
    for (const fl of this.fieldLines) {
      fl.material.opacity = 0.05 + vagalTone * 0.15;
      if (coherence > 0.618) {
        fl.material.color.lerp(this._goldColor, 0.05);
      } else {
        fl.material.color.set(0x1a1a2e);
      }
    }

    // Camera gentle sway
    this.camera.position.x = Math.sin(this._time * 0.1) * 3;
    this.camera.position.y = Math.cos(this._time * 0.07) * 2;
    this.camera.lookAt(0, 0, 0);

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on && this.renderer) {
      this.renderer.clear();
    }
  }
}

// ─────────────────────────────────────────────────────────
// p=17  LAUNCHER — Boot sequence, UI, the stage
// ─────────────────────────────────────────────────────────

class KonomiApp {
  constructor() {
    this.identity = null;
    this.mesh = null;
    this.fabric = null;
    this.vocal = null;
    this.tracks = null;
    this.viz = null;

    this.micStream = null;
    this.micMuted = false;
    this.micSourceNode = null;

    this.settings = {
      pitch: true,
      harmony: false,
      drones: true,
      viz: true,
      aec: false
    };

    this._animFrame = null;
    this._lastTime = 0;
  }

  // ── BOOT SEQUENCE ──────────────────────────────────────
  async boot() {
    const phases = [
      { prime: 2, label: 'IDENTITY + ROOMS', fn: () => this._bootIdentity() },
      { prime: 3, label: 'P2P MESH', fn: () => this._bootMesh() },
      { prime: 5, label: 'AUDIO FABRIC', fn: () => this._bootFabric() },
      { prime: 7, label: 'VOCAL PROCESSING', fn: () => this._bootVocal() },
      { prime: 11, label: 'TRACK + LYRICS', fn: () => this._bootTracks() },
      { prime: 13, label: 'VISUALIZATION', fn: () => this._bootViz() },
      { prime: 17, label: 'LAUNCHER', fn: () => this._bootUI() },
    ];

    for (const phase of phases) {
      const el = $(`.boot-phase[data-phase="${phase.prime}"]`);
      el.classList.add('active');
      el.querySelector('.phase-status').textContent = 'booting...';

      try {
        await phase.fn();
        el.classList.remove('active');
        el.classList.add('done');
        el.querySelector('.phase-status').textContent = 'ok';
        await this._delay(200);
      } catch (err) {
        console.error(`Phase p=${phase.prime} failed:`, err);
        el.classList.remove('active');
        el.classList.add('fail');
        el.querySelector('.phase-status').textContent = err.message || 'failed';
        // Continue booting — degrade gracefully
        await this._delay(300);
      }
    }

    // Transition to lobby
    await this._delay(600);
    $('#boot-screen').style.display = 'none';
    $('#lobby-screen').style.display = 'flex';
  }

  async _bootIdentity() {
    this.identity = new KonomiIdentity();
    await this.identity.boot();
  }

  async _bootMesh() {
    this.mesh = new KonomiMesh(this.identity);
    await this.mesh.boot('');
  }

  async _bootFabric() {
    this.fabric = new AudioFabricEngine();
    await this.fabric.boot();
  }

  async _bootVocal() {
    this.vocal = new VocalProcessor(this.fabric);
    await this.vocal.boot();
  }

  async _bootTracks() {
    this.tracks = new TrackEngine(this.fabric, this.vocal);
    await this.tracks.boot();
  }

  async _bootViz() {
    this.viz = new VizEngine(this.fabric);
    await this.viz.boot();
  }

  async _bootUI() {
    this._bindLobbyEvents();
    this._bindStageEvents();
    this._bindSettingsEvents();
    this._bindTrackEvents();
    this._bindChatEvents();
    this._bindMeshCallbacks();
    this._registerServiceWorker();

    // Display identity in lobby
    $('#lobby-pubkey').textContent = this.identity.shortId;
    const savedName = this.identity.displayName;
    if (savedName && savedName !== 'Singer') {
      $('#display-name').value = savedName;
    }

    // Auto-enter public room — skip lobby, mic optional
    try {
      await this.fabric.resume();
      const code = await this.identity.createRoomCode();
      this.mesh.roomCode = code;
      this.mesh.isHost = true;
      try { await this._getMicrophone(); } catch { console.warn('Mic unavailable — entering without mic'); }
      this._enterStage(code);
    } catch (e) {
      console.warn('Auto-enter failed, showing lobby:', e.message);
    }
  }

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
      this.fabric.connectSource(this.micSourceNode);

      // Connect to vocal processor for self-monitoring
      this.vocal.connectSelf(this.micSourceNode);

      // Set as local stream for WebRTC
      this.mesh.setLocalStream(this.micStream);

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
    $('#lobby-screen').style.display = 'none';
    $('#stage-screen').style.display = 'block';
    $('#stage-room-code').textContent = roomCode;

    // Start the render/analysis loop
    this._startLoop();
  }

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

  // ── CHAT ───────────────────────────────────────────────
  _bindChatEvents() {
    const send = () => {
      const input = $('#chat-input');
      const text = input.value.trim();
      if (!text) return;

      // Broadcast via mesh
      this.mesh.broadcast({
        type: 'chat',
        from: this.identity.displayName,
        text: text
      });

      // Show locally
      this._addChatMessage(this.identity.displayName, text, peerColor(this.identity.publicKeyHex));
      input.value = '';
    };

    $('#btn-chat-send').onclick = send;
    $('#chat-input').onkeydown = (e) => { if (e.key === 'Enter') send(); };
  }

  _addChatMessage(author, text, color) {
    const container = $('#chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-author" style="color:${color}">${author}:</span>${this._escapeHtml(text)}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // Keep only last 50 messages
    while (container.children.length > 50) container.removeChild(container.firstChild);
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── MESH CALLBACKS ─────────────────────────────────────
  _bindMeshCallbacks() {
    this.mesh.onRoomJoined = (code, peers) => {
      this._updatePeersList();
    };

    this.mesh.onPeerJoined = (peerId, displayName) => {
      this._addChatMessage('SYSTEM', `${displayName || shortId(peerId)} joined`, '#d4af37');
      this.viz.addSingerCluster(peerId, peerColor(peerId));
      this._updatePeersList();
    };

    this.mesh.onPeerLeft = (peerId) => {
      this._addChatMessage('SYSTEM', `${shortId(peerId)} left`, '#ff2244');
      this.viz.removeSingerCluster(peerId);
      this.fabric.removePeerAnalyser(peerId);
      this._updatePeersList();
    };

    this.mesh.onPeerAudio = (peerId, stream) => {
      // Connect peer audio to vocal processor and fabric
      const source = this.vocal.connectPeer(stream);
      const analyser = this.fabric.createPeerAnalyser(peerId);
      source.connect(analyser);
    };

    this.mesh.onPeerData = (peerId, data) => {
      if (data.type === 'chat') {
        this._addChatMessage(data.from || shortId(peerId), data.text, peerColor(peerId));
      }
      if (data.type === 'queue') {
        this.tracks.queue.merge(data.queue);
        if (this.tracks.onQueueUpdate) {
          this.tracks.onQueueUpdate(this.tracks.queue.getOrdered());
        }
      }
    };
  }

  _updatePeersList() {
    const el = $('#peers-list');
    el.innerHTML = '';

    // Self
    const selfDiv = document.createElement('div');
    selfDiv.className = 'peer-item';
    selfDiv.innerHTML = `
      <div class="peer-dot" style="background:${peerColor(this.identity.publicKeyHex)}"></div>
      <span class="peer-name">${this.identity.displayName} (you)</span>
      <span class="peer-role">${this.mesh.isHost ? 'host' : ''}</span>
    `;
    el.appendChild(selfDiv);

    // Peers
    for (const [pid, peer] of this.mesh.peers) {
      const div = document.createElement('div');
      div.className = 'peer-item';
      div.innerHTML = `
        <div class="peer-dot" style="background:${peerColor(pid)}"></div>
        <span class="peer-name">${peer.displayName || shortId(pid)}</span>
        <span class="peer-role"></span>
      `;
      el.appendChild(div);
    }

    $('#stage-peers-count').textContent = `${this.mesh.peers.size + 1} peers`;
  }

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

  // ── SERVICE WORKER ─────────────────────────────────────
  _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

// ─────────────────────────────────────────────────────────
// IGNITION
// ─────────────────────────────────────────────────────────

const konomi = new KonomiApp();

// ── KCC MINING LAYER ── singing IS mining (uses shared template)
import('./_kcc/js/kcc-mine.js').then(kcc => {
  kcc.initMiningWidget();
  const tick = () => {
    if (konomi.fabric) kcc.tickMining(konomi.fabric);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}).catch(() => console.warn('KCC mining layer not loaded'));

konomi.boot().catch(err => {
  console.error('KONOMIOKE boot failed:', err);
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#ff2244;font-family:monospace;text-align:center;padding:2rem">
    <div>
      <h1>好みオケ</h1>
      <p>Boot failed: ${err.message}</p>
      <p style="margin-top:1rem;color:#6a6a80;font-size:0.8rem">Check console for details</p>
    </div>
  </div>`;
});
