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

