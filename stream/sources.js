// sources.js — video source selection (canvas test, engine iframe, screen capture)
var _sourceMode = null;

function sourceCanvas() {
  _sourceMode = 'canvas';
  var cv = document.getElementById('broadcast-cv');
  cv.style.display = 'block';
  var el = document.querySelector('.preview iframe');
  if (el) el.remove();
  var x = cv.getContext('2d'), w = cv.width, h = cv.height, t = 0;
  (function draw() {
    t += 0.02;
    x.fillStyle = '#050810'; x.fillRect(0, 0, w, h);
    for (var i = 0; i < 7; i++) {
      var r = 80 + i * 40 + Math.sin(t + i) * 20;
      x.strokeStyle = ['#ff4444','#ff8800','#ffcc00','#44cc44','#4488ff','#8844ff','#ff44ff'][i];
      x.lineWidth = 2; x.globalAlpha = 0.4 + 0.3 * Math.sin(t * 2 + i);
      x.beginPath(); x.arc(w / 2, h / 2, r, 0, Math.PI * 2); x.stroke();
    }
    x.globalAlpha = 1; x.fillStyle = '#d4a94a'; x.font = '14px monospace';
    x.textAlign = 'center'; x.fillText('好みオケ STREAM', w / 2, h / 2 - 10);
    x.fillStyle = '#8898b4'; x.font = '10px monospace';
    x.fillText(new Date().toLocaleTimeString(), w / 2, h / 2 + 10);
    requestAnimationFrame(draw);
  })();
  initCapture(cv);
  setStatus('canvas source ready');
}

function sourceEngine() {
  _sourceMode = 'engine';
  document.getElementById('broadcast-cv').style.display = 'none';
  var prev = document.querySelector('.preview');
  var old = prev.querySelector('iframe');
  if (old) old.remove();
  var iframe = document.createElement('iframe');
  iframe.src = '../engine/';
  iframe.allow = 'autoplay *; microphone *; camera *; display-capture *';
  iframe.allowFullscreen = true;
  prev.appendChild(iframe);
  setStatus('engine loaded — use "Add tab audio" to capture');
}

function sourceScreen() {
  _sourceMode = 'screen';
  navigator.mediaDevices.getDisplayMedia({ video: { width: 1280, height: 720 }, audio: true }).then(function(s) {
    var cv = document.getElementById('broadcast-cv');
    var x = cv.getContext('2d');
    var vid = document.createElement('video');
    vid.srcObject = s; vid.muted = true; vid.play();
    (function draw() {
      if (vid.readyState >= 2) x.drawImage(vid, 0, 0, cv.width, cv.height);
      requestAnimationFrame(draw);
    })();
    initCapture(cv);
    if (s.getAudioTracks().length) {
      var src = CAPTURE.audioCtx.createMediaStreamSource(s);
      src.connect(CAPTURE.dest);
    }
    setStatus('screen capture active');
  }).catch(function(e) { setStatus('screen capture failed: ' + e.message) });
}
