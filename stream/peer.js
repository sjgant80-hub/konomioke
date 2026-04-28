// peer.js — PeerJS WebRTC broadcast: one broadcaster → N viewers
var PEER = { peer: null, id: null, viewers: [], mode: null };

function peerInit(mode) {
  PEER.mode = mode;
  return new Promise(function(ok, fail) {
    var p = new Peer(null, { debug: 1 });
    p.on('open', function(id) { PEER.peer = p; PEER.id = id; ok(id) });
    p.on('error', function(e) { fail(e) });
  });
}

function broadcastStream(stream) {
  if (!PEER.peer) return;
  PEER.peer.on('call', function(call) {
    call.answer(stream);
    PEER.viewers.push(call);
    call.on('close', function() {
      PEER.viewers = PEER.viewers.filter(function(v) { return v !== call });
      updateViewerCount();
    });
    updateViewerCount();
  });
}

function watchStream(hostId) {
  return new Promise(function(ok, fail) {
    if (!PEER.peer) return fail('peer not init');
    var call = PEER.peer.call(hostId, silentStream());
    call.on('stream', function(remote) { ok(remote) });
    call.on('error', function(e) { fail(e) });
    call.on('close', function() { ok(null) });
  });
}

function silentStream() {
  var ac = new AudioContext();
  var osc = ac.createOscillator();
  var dest = ac.createMediaStreamDestination();
  var gain = ac.createGain(); gain.gain.value = 0;
  osc.connect(gain); gain.connect(dest);
  osc.start();
  return dest.stream;
}

function getShareURL() {
  return location.origin + '/stream/watch.html?id=' + PEER.id;
}

function updateViewerCount() {
  var el = document.getElementById('viewer-count');
  if (el) el.textContent = PEER.viewers.length;
}
