// capture.js — merges canvas video + AudioContext audio into one MediaStream
var CAPTURE = { stream: null, canvas: null, audioCtx: null, dest: null };

function initCapture(canvasEl) {
  CAPTURE.canvas = canvasEl;
  var videoStream = canvasEl.captureStream(30);
  CAPTURE.audioCtx = new AudioContext();
  CAPTURE.dest = CAPTURE.audioCtx.createMediaStreamDestination();
  var merged = new MediaStream();
  videoStream.getVideoTracks().forEach(function(t) { merged.addTrack(t) });
  CAPTURE.dest.stream.getAudioTracks().forEach(function(t) { merged.addTrack(t) });
  CAPTURE.stream = merged;
  return merged;
}

function addAudioSource(sourceNode) {
  if (!CAPTURE.dest) return;
  sourceNode.connect(CAPTURE.dest);
}

function addMicToCapture() {
  if (!CAPTURE.audioCtx || !CAPTURE.dest) return Promise.reject('no capture');
  return navigator.mediaDevices.getUserMedia({ audio: true }).then(function(s) {
    var src = CAPTURE.audioCtx.createMediaStreamSource(s);
    src.connect(CAPTURE.dest);
    return s;
  });
}

function addTabAudioToCapture() {
  if (!CAPTURE.audioCtx || !CAPTURE.dest) return Promise.reject('no capture');
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then(function(s) {
    s.getVideoTracks().forEach(function(t) { t.stop() });
    if (s.getAudioTracks().length) {
      var src = CAPTURE.audioCtx.createMediaStreamSource(s);
      src.connect(CAPTURE.dest);
    }
    return s;
  });
}
