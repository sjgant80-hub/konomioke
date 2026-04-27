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

