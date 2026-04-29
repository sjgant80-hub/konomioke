// audio-capture.js — capture tab/system audio, feed to arena analyser
var ACAP={stream:null,source:null,active:false};

function toggleAudioCapture(){
  if(ACAP.active){stopAudioCapture();return}
  navigator.mediaDevices.getDisplayMedia({video:true,audio:true,preferCurrentTab:true,selfBrowserSurface:'include',systemAudio:'include'}).then(function(s){
    s.getVideoTracks().forEach(function(t){t.stop()});
    if(!s.getAudioTracks().length){trace('warn','no audio track','audio');return}
    ACAP.stream=s;ACAP.active=true;
    // Create AudioContext + analyser if mic hasn't done it yet
    if(typeof audioCtx==='undefined'||!audioCtx){
      audioCtx=new(window.AudioContext||window.webkitAudioContext)({sampleRate:44100});
      analyser=audioCtx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=0.8;
      timeData=new Float32Array(2048);freqData=new Float32Array(analyser.frequencyBinCount);
      voice.nf=0.005;
      trace('info','created AudioContext from tab capture','audio');
    }
    ACAP.source=audioCtx.createMediaStreamSource(s);
    ACAP.source.connect(analyser);
    // Also play through speakers so user hears the youtube
    ACAP.source.connect(audioCtx.destination);
    s.getAudioTracks()[0].onended=function(){stopAudioCapture()};
    var btn=document.getElementById('audio-cap-btn');
    if(btn){btn.textContent='🔴';btn.style.color='#ff2d75';btn.style.borderColor='#ff2d75'}
    trace('info','tab audio → analyser + speakers','audio');
  }).catch(function(e){trace('warn','capture: '+e.message,'audio')});
}

function stopAudioCapture(){
  if(ACAP.source){try{ACAP.source.disconnect()}catch(e){};ACAP.source=null}
  if(ACAP.stream){ACAP.stream.getTracks().forEach(function(t){t.stop()});ACAP.stream=null}
  ACAP.active=false;
  var btn=document.getElementById('audio-cap-btn');
  if(btn){btn.textContent='🔊';btn.style.color='#333';btn.style.borderColor='#333'}
}
