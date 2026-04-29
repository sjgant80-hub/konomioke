// audio-capture.js — capture tab/system audio, feed to arena analyser
var ACAP={stream:null,source:null,active:false};

function toggleAudioCapture(){
  if(ACAP.active){stopAudioCapture();return}
  navigator.mediaDevices.getDisplayMedia({video:true,audio:true,preferCurrentTab:true,selfBrowserSurface:'include',systemAudio:'include'}).then(function(s){
    s.getVideoTracks().forEach(function(t){t.stop()});
    if(!s.getAudioTracks().length){trace('warn','no audio track in capture','audio');return}
    ACAP.stream=s;ACAP.active=true;
    ACAP.source=audioCtx.createMediaStreamSource(s);
    ACAP.source.connect(analyser);
    s.getAudioTracks()[0].onended=function(){stopAudioCapture()};
    var btn=document.getElementById('audio-cap-btn');
    if(btn){btn.textContent='🔴';btn.style.color='#ff2d75';btn.style.borderColor='#ff2d75'}
    trace('info','tab audio → arena visuals','audio');
  }).catch(function(e){trace('warn','capture: '+e.message,'audio')});
}

function stopAudioCapture(){
  if(ACAP.source){ACAP.source.disconnect();ACAP.source=null}
  if(ACAP.stream){ACAP.stream.getTracks().forEach(function(t){t.stop()});ACAP.stream=null}
  ACAP.active=false;
  var btn=document.getElementById('audio-cap-btn');
  if(btn){btn.textContent='🔊';btn.style.color='#333';btn.style.borderColor='#333'}
}
