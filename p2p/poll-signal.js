// poll-signal.js — signaling via OnlyBrains API polling (no WebSocket needed)
// Replaces WebSocket signaling for GitHub Pages deployments
var POLL_SIG = { interval: null, room: null, peerId: null, displayName: null, api: 'https://onlybrains.onrender.com/api/chat', pollMs: 3000, seen: {} };

function pollSignalJoin(room, peerId, displayName) {
  POLL_SIG.room = room; POLL_SIG.peerId = peerId; POLL_SIG.displayName = displayName;
  // Announce presence
  _sigPost({ type: 'join', room: room, peerId: peerId, displayName: displayName, ts: Date.now() });
  // Start polling
  if (POLL_SIG.interval) clearInterval(POLL_SIG.interval);
  POLL_SIG.interval = setInterval(_sigPoll, POLL_SIG.pollMs);
  _sigPoll();
}

function pollSignalLeave() {
  if (POLL_SIG.interval) { clearInterval(POLL_SIG.interval); POLL_SIG.interval = null; }
  if (POLL_SIG.room && POLL_SIG.peerId) {
    _sigPost({ type: 'leave', room: POLL_SIG.room, peerId: POLL_SIG.peerId, ts: Date.now() });
  }
}

function pollSignalSend(data) {
  _sigPost(Object.assign({ room: POLL_SIG.room, from: POLL_SIG.peerId, ts: Date.now() }, data));
}

function _sigPost(data) {
  try {
    var ctrl = new AbortController();
    setTimeout(function() { ctrl.abort() }, 3000);
    fetch(POLL_SIG.api, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ key: 'sig-' + POLL_SIG.room, message: JSON.stringify(data), role: 'system' })
    }).catch(function() {});
  } catch (e) {}
}

async function _sigPoll() {
  try {
    var ctrl = new AbortController();
    setTimeout(function() { ctrl.abort() }, 3000);
    var r = await fetch(POLL_SIG.api + '?key=sig-' + POLL_SIG.room + '&limit=20', { signal: ctrl.signal });
    var msgs = await r.json();
    if (!Array.isArray(msgs)) return;
    for (var m of msgs) {
      try {
        var d = typeof m.message === 'string' ? JSON.parse(m.message) : m;
        if (!d.peerId || d.peerId === POLL_SIG.peerId) continue;
        var key = d.peerId + ':' + d.ts;
        if (POLL_SIG.seen[key]) continue;
        POLL_SIG.seen[key] = true;
        if (d.type === 'join' && d.room === POLL_SIG.room) {
          if (typeof window._onPollPeerJoin === 'function') window._onPollPeerJoin(d.peerId, d.displayName);
        }
        if (d.type === 'leave' && d.room === POLL_SIG.room) {
          if (typeof window._onPollPeerLeave === 'function') window._onPollPeerLeave(d.peerId);
        }
        if (d.type === 'chat' && d.room === POLL_SIG.room) {
          if (typeof window._onPollChat === 'function') window._onPollChat(d);
        }
      } catch (e) {}
    }
  } catch (e) {}
}
