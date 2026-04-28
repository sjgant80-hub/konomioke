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

