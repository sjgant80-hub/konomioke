// controls.js — mic/tab toggle, go live, stats, clipboard
var _started = null, _micStream = null, _tabStream = null;

function toggleMic() {
  if (_micStream) { _micStream.getTracks().forEach(function(t){t.stop()}); _micStream = null; document.getElementById('btn-mic').textContent = '🎤 Add mic'; return }
  addMicToCapture().then(function(s) { _micStream = s; document.getElementById('btn-mic').textContent = '🔴 Mic ON'; updateTracks(); if(typeof highlightState==='function')highlightState('audio') }).catch(function(e) { setStatus('mic: ' + e) });
}

function toggleTab() {
  if (_tabStream) { _tabStream.getTracks().forEach(function(t){t.stop()}); _tabStream = null; document.getElementById('btn-tab').textContent = '🔊 Add tab audio'; return }
  addTabAudioToCapture().then(function(s) { _tabStream = s; document.getElementById('btn-tab').textContent = '🔴 Tab ON'; updateTracks() }).catch(function(e) { setStatus('tab: ' + e) });
}

async function goLive() {
  if (!CAPTURE.stream) { setStatus('pick a source first'); return }
  document.getElementById('btn-live').textContent = '⏳ connecting...';
  try {
    var id = await peerInit('broadcast');
    broadcastStream(CAPTURE.stream);
    _started = Date.now();
    document.getElementById('btn-live').textContent = '🔴 LIVE';
    document.getElementById('btn-live').className = 'btn live';
    if(typeof highlightState==='function')highlightState('live');
    document.getElementById('share-section').style.display = '';
    document.getElementById('share-url').textContent = getShareURL();
    document.getElementById('s-peer').textContent = id.slice(0, 12) + '…';
    setStatus('🔴 LIVE'); updateTracks();
  } catch(e) { setStatus('peer error: ' + e.message); document.getElementById('btn-live').textContent = '▶ GO LIVE' }
}

function copyLink() { navigator.clipboard.writeText(getShareURL()); setStatus('link copied!') }
function setStatus(msg) { document.getElementById('status').textContent = msg }
function updateTracks() {
  if (!CAPTURE.stream) return;
  document.getElementById('s-tracks').textContent = CAPTURE.stream.getTracks().map(function(t){return t.kind[0]}).join('+');
}

setInterval(function() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString();
  document.getElementById('s-viewers').textContent = PEER.viewers.length;
  if (_started) {
    var s = Math.floor((Date.now() - _started) / 1000);
    document.getElementById('s-uptime').textContent = Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
  }
}, 1000);
