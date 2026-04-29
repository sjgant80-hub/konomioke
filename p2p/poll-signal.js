// poll-signal.js — peer signaling: BroadcastChannel (same-origin) + API (cross-device)
var POLL_SIG = {
  room: null, peerId: null, displayName: null,
  bc: null, seen: {}, state: 'disconnected',
  api: 'https://onlybrains.onrender.com/api/chat',
  pollTimer: null, pollMs: 4000, peers: {}
};

function _sigState(s) {
  POLL_SIG.state = s;
  if (typeof rlog === 'function') rlog('p2p: ' + s);
  if (typeof highlightState === 'function') highlightState(s);
}

function pollSignalJoin(room, peerId, displayName) {
  POLL_SIG.room = room; POLL_SIG.peerId = peerId; POLL_SIG.displayName = displayName;
  _sigState('joining');

  // BroadcastChannel — instant same-origin signaling
  try {
    POLL_SIG.bc = new BroadcastChannel('konomi-sig-' + room);
    POLL_SIG.bc.onmessage = function(e) { _handleMsg(e.data) };
  } catch (e) {}

  // Announce via both channels
  var joinMsg = { type: 'join', room: room, peerId: peerId, displayName: displayName, ts: Date.now() };
  _broadcast(joinMsg);
  _sigState('connected');

  // Heartbeat every 4s so peers know we're alive
  if (POLL_SIG.pollTimer) clearInterval(POLL_SIG.pollTimer);
  POLL_SIG.pollTimer = setInterval(function() {
    _broadcast({ type: 'heartbeat', room: POLL_SIG.room, peerId: POLL_SIG.peerId, displayName: POLL_SIG.displayName, ts: Date.now() });
    // Prune peers not seen in 12s
    var now = Date.now();
    for (var pid in POLL_SIG.peers) {
      if (now - POLL_SIG.peers[pid].lastSeen > 12000) {
        delete POLL_SIG.peers[pid];
        if (typeof window._onPollPeerLeave === 'function') window._onPollPeerLeave(pid);
      }
    }
  }, POLL_SIG.pollMs);
}

function pollSignalLeave() {
  if (POLL_SIG.room && POLL_SIG.peerId) {
    _broadcast({ type: 'leave', room: POLL_SIG.room, peerId: POLL_SIG.peerId, ts: Date.now() });
  }
  if (POLL_SIG.bc) { POLL_SIG.bc.close(); POLL_SIG.bc = null }
  if (POLL_SIG.pollTimer) { clearInterval(POLL_SIG.pollTimer); POLL_SIG.pollTimer = null }
  POLL_SIG.peers = {};
  _sigState('disconnected');
}

function pollSignalSend(data) {
  _broadcast(Object.assign({ room: POLL_SIG.room, peerId: POLL_SIG.peerId, from: POLL_SIG.displayName, ts: Date.now() }, data));
}

function _broadcast(data) {
  // BroadcastChannel (same-origin tabs — instant, primary)
  if (POLL_SIG.bc) try { POLL_SIG.bc.postMessage(data) } catch (e) {}
}

function _handleMsg(d) {
  if (!d || !d.peerId || d.peerId === POLL_SIG.peerId) return;
  if (d.room && d.room !== POLL_SIG.room) return;
  var key = d.peerId + ':' + d.type + ':' + d.ts;
  if (POLL_SIG.seen[key]) return;
  POLL_SIG.seen[key] = true;

  if (d.type === 'join' || d.type === 'heartbeat') {
    var isNew = !POLL_SIG.peers[d.peerId];
    POLL_SIG.peers[d.peerId] = { displayName: d.displayName, lastSeen: Date.now() };
    if (isNew && d.type === 'join') {
      if (typeof window._onPollPeerJoin === 'function') window._onPollPeerJoin(d.peerId, d.displayName);
    }
  }
  if (d.type === 'leave') {
    delete POLL_SIG.peers[d.peerId];
    if (typeof window._onPollPeerLeave === 'function') window._onPollPeerLeave(d.peerId);
  }
  if (d.type === 'chat') {
    if (typeof window._onPollChat === 'function') window._onPollChat(d);
  }
  if (d.type === 'youtube') {
    if (typeof onRemoteYT === 'function' && d.vid) onRemoteYT(d.vid);
  }
  if (d.type === 'state') {
    if (typeof onRoomState === 'function') onRoomState(d);
  }
  if (d.type === 'request-state') {
    if (typeof publishRoomState === 'function') publishRoomState();
  }
}

function getPollPeerCount() { return Object.keys(POLL_SIG.peers).length }
