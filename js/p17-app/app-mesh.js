  // ── CHAT ───────────────────────────────────────────────
  _bindChatEvents() {
    const send = () => {
      const input = $('#chat-input');
      const text = input.value.trim();
      if (!text) return;

      // Broadcast via WebRTC data channel
      this.mesh.broadcast({
        type: 'chat',
        from: this.identity.displayName,
        text: text
      });

      // Show locally + persist to tag + relay via poll-signal
      const color = peerColor(this.identity.publicKeyHex);
      this._addChatMessage(this.identity.displayName, text, color);
      if (typeof chatPush === 'function') chatPush(this.identity.displayName, text, color, this.mesh.roomCode);
      // Relay to dock for BroadcastChannel distribution
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'send-chat', from: this.identity.displayName, text: text, color: color }, '*');
      } else if (typeof pollSignalSend === 'function') {
        pollSignalSend({ type: 'chat', from: this.identity.displayName, text: text, color: color });
      }
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
    while (container.children.length > 50) container.removeChild(container.firstChild);
  }

  async _loadChatHistory() {
    if (typeof loadChatHistory !== 'function') return;
    const msgs = await loadChatHistory(this.mesh.roomCode);
    for (const m of msgs) {
      this._addChatMessage(m.from, m.text, m.color || '#8898b4');
    }
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
      this._loadChatHistory();
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
        const color = peerColor(peerId);
        this._addChatMessage(data.from || shortId(peerId), data.text, color);
        if (typeof chatPush === 'function') chatPush(data.from || shortId(peerId), data.text, color, this.mesh.roomCode);
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

