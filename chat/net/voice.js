// voice.js — WebRTC voice chat using MQTT for signaling
var VOICE={peers:{},localStream:null,muted:false};
var ICE=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];

function initVoiceChat(){
  navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}).then(function(s){
    VOICE.localStream=s;
    trace('info','voice: mic ready for WebRTC','voice');
    // Offer to all known MQTT peers
    for(var pid in MQTT_SIG.knownPeers)voiceOffer(pid);
  }).catch(function(e){trace('warn','voice mic: '+e.message,'voice')});

  // Listen for WebRTC signaling via MQTT
  var origHandle=_mqttHandle;
  _mqttHandle=function(topic,d){
    origHandle(topic,d);
    var sub=topic.replace(MQTT_SIG.topic,'');
    if(sub==='rtc-offer'&&d.to===MQTT_SIG.myId)handleOffer(d);
    if(sub==='rtc-answer'&&d.to===MQTT_SIG.myId)handleAnswer(d);
    if(sub==='rtc-ice'&&d.to===MQTT_SIG.myId)handleIce(d);
  };
}

function voiceOffer(peerId){
  if(VOICE.peers[peerId]||!VOICE.localStream)return;
  var pc=new RTCPeerConnection({iceServers:ICE});
  VOICE.peers[peerId]={pc:pc};
  VOICE.localStream.getTracks().forEach(function(t){pc.addTrack(t,VOICE.localStream)});
  pc.onicecandidate=function(e){if(e.candidate)mqttPublish('rtc-ice',{to:peerId,candidate:e.candidate})};
  pc.ontrack=function(e){onRemoteAudio(peerId,e.streams[0])};
  pc.createOffer().then(function(o){return pc.setLocalDescription(o)}).then(function(){
    mqttPublish('rtc-offer',{to:peerId,sdp:pc.localDescription});
    trace('info','voice: offer → '+peerId.slice(0,8),'voice');
  }).catch(function(e){trace('warn','offer fail: '+e.message,'voice')});
}

function handleOffer(d){
  if(VOICE.peers[d.peerId])return;
  var pc=new RTCPeerConnection({iceServers:ICE});
  VOICE.peers[d.peerId]={pc:pc};
  if(VOICE.localStream)VOICE.localStream.getTracks().forEach(function(t){pc.addTrack(t,VOICE.localStream)});
  pc.onicecandidate=function(e){if(e.candidate)mqttPublish('rtc-ice',{to:d.peerId,candidate:e.candidate})};
  pc.ontrack=function(e){onRemoteAudio(d.peerId,e.streams[0])};
  pc.setRemoteDescription(d.sdp).then(function(){return pc.createAnswer()}).then(function(a){return pc.setLocalDescription(a)}).then(function(){
    mqttPublish('rtc-answer',{to:d.peerId,sdp:pc.localDescription});
    trace('info','voice: answer → '+d.peerId.slice(0,8),'voice');
  }).catch(function(e){trace('warn','answer fail: '+e.message,'voice')});
}

function handleAnswer(d){
  var p=VOICE.peers[d.peerId];
  if(p&&p.pc)p.pc.setRemoteDescription(d.sdp).catch(function(e){trace('warn','setRemote: '+e.message,'voice')});
}

function handleIce(d){
  var p=VOICE.peers[d.peerId];
  if(p&&p.pc)p.pc.addIceCandidate(d.candidate).catch(function(){});
}

function onRemoteAudio(peerId,stream){
  trace('info','voice: audio from '+peerId.slice(0,8),'voice');
  var audio=document.createElement('audio');
  audio.srcObject=stream;audio.autoplay=true;audio.id='audio-'+peerId;
  document.body.appendChild(audio);
}
