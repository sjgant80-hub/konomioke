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

