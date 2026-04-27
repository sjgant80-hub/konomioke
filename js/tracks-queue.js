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
