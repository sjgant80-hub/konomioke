// net/init.js — wraps BroadcastChannel (local) + MQTT (global) with tracing
function initNet(){
  trace('info','joining room KONOMI','net');
  traceState('init','joining','net');

  // Local: BroadcastChannel (same-browser tabs)
  pollSignalJoin('KONOMI',CHAT.myId,getNick());
  trace('info','BroadcastChannel: local peers','net');

  // Global: MQTT (cross-device via public broker)
  if(typeof mqttConnect==='function'){
    mqttConnect('KONOMI',CHAT.myId,getNick());
    trace('info','MQTT: connecting to hivemq','net');
  }
  // Voice: WebRTC audio via MQTT signaling
  if(typeof initVoiceChat==='function'){
    setTimeout(function(){initVoiceChat()},3000);
    trace('info','voice: will init in 3s','net');
  }
  traceState('joining','connected','net');

  // Peer events (fired by both BC and MQTT)
  window._onPollPeerJoin=function(pid,name){
    trace('info','peer joined: '+(name||pid.slice(0,8)),'net');
    addMsg(null,(name||pid.slice(0,8))+' joined',null,true);updatePeers();
    if(typeof spawnPeerSprite==='function')spawnPeerSprite(pid,name)};

  window._onPollPeerLeave=function(pid){
    trace('info','peer left: '+pid.slice(0,8),'net');
    addMsg(null,pid.slice(0,8)+' left',null,true);updatePeers();
    if(typeof removePeerSprite==='function')removePeerSprite(pid)};

  window._onPollChat=function(d){
    addMsg(d.from||'?',d.text,d.color)};

  // Remote blasts (from BC)
  if(POLL_SIG.bc){var prev=POLL_SIG.bc.onmessage;POLL_SIG.bc.onmessage=function(e){
    if(prev)prev(e);
    if(e.data&&e.data.type==='blast'&&e.data.peerId!==POLL_SIG.peerId)_handleRemoteBlast(e.data)}}

  addMsg(null,'joined KONOMI arena',null,true);
  trace('info','net ready','net');
}

// Shared remote blast handler (BC + MQTT both call this)
function _handleRemoteBlast(d){
  if(!d.blastType||typeof BLAST_TYPES==='undefined')return;
  var bt=BLAST_TYPES[d.blastType]||BLAST_TYPES.kiball;
  var sz=bt.size*(.5+(d.power||.5));
  var m=new THREE.Mesh(new THREE.SphereGeometry(sz,12,12),new THREE.MeshBasicMaterial({color:bt.color,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));
  var psp=typeof SPRITES!=='undefined'?SPRITES.peers[d.peerId]:null;
  m.position.set(psp?psp.position.x:(Math.random()-.5)*4,2.5,psp?psp.position.z:8);
  scene.add(m);blasts.push({mesh:m,vz:-bt.speed,type:d.blastType,dmg:0,power:d.power||.5,life:1});
}

// Override sendChat to publish to both BC + MQTT
var _origSendChat=typeof sendChat==='function'?sendChat:null;
function sendChat(){
  var input=document.getElementById('chat-in');
  var text=input?.value?.trim();if(!text)return;
  var nick=getNick();var color='#'+CHAT.myId.slice(-6).replace(/[^0-9a-f]/g,'a');
  addMsg(nick,text,color);
  // Local: BroadcastChannel
  if(typeof pollSignalSend==='function')pollSignalSend({type:'chat',from:nick,text:text,color:color});
  // Global: MQTT
  if(typeof mqttPublish==='function')mqttPublish('chat',{from:nick,text:text,color:color});
  input.value='';input.focus();
}
