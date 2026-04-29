// loop.js — main animation loop + remote blast handling
var running=false;

function animate(){if(!running)return;requestAnimationFrame(animate);
  var t=clock.elapsedTime;
  analyzeV();updateCharge();updateBlasts();updateExplosions();updateVortex(t);
  if(typeof animateSprites==='function')animateSprites(t);
  camAngle+=.003;camera.position.x=Math.sin(camAngle)*1.5;camera.position.y=3.5+Math.sin(camAngle*.7)*.3;camera.lookAt(0,2.5,-4);
  if(screenShake>.1){camera.position.x+=(Math.random()-.5)*screenShake*.3;camera.position.y+=(Math.random()-.5)*screenShake*.3;screenShake*=.9}
  target.rotation.y=t*.3;target.rotation.x=Math.sin(t*.5)*.2;
  var hp=targetHP/maxHP;target.scale.setScalar(1+Math.sin(t*3)*(1-hp)*.1);
  // phoneme bars
  PH_KEYS.forEach(function(k){var ph=PHONEMES[k];if(voice.vowel===k&&voice.sounding)ph.power=Math.min(1,ph.power+voice.rms*.12);else ph.power*=.985;
    var el=document.getElementById('ph-'+k);if(!el)return;el.querySelector('.ph-fill').style.height=(ph.power*100)+'%';
    if(voice.vowel===k&&voice.sounding)el.classList.add('active');else el.classList.remove('active')});
  renderer.render(scene,camera)}

function startArena(){
  initKanjiTex();initScene();
  // Spawn local sprite
  if(typeof spawnLocalSprite==='function')spawnLocalSprite(CHAT.myId,getNick());
  initAudio(function(){running=true;animate()});
  // Peer events
  window._onPollChat=function(d){addMsg(d.from||'?',d.text,d.color)};
  window._onPollPeerJoin=function(pid,name){
    addMsg(null,(name||pid.slice(0,8))+' joined',null,true);updatePeers();
    if(typeof spawnPeerSprite==='function')spawnPeerSprite(pid,name)};
  window._onPollPeerLeave=function(pid){
    addMsg(null,pid.slice(0,8)+' left',null,true);updatePeers();
    if(typeof removePeerSprite==='function')removePeerSprite(pid)};
  // Remote blasts via BroadcastChannel
  if(POLL_SIG.bc){var prev=POLL_SIG.bc.onmessage;POLL_SIG.bc.onmessage=function(e){
    if(prev)prev(e);
    if(e.data&&e.data.type==='blast'&&e.data.peerId!==POLL_SIG.peerId){
      var bt=BLAST_TYPES[e.data.blastType]||BLAST_TYPES.kiball;
      var sz=bt.size*(.5+(e.data.power||.5));
      var m=new THREE.Mesh(new THREE.SphereGeometry(sz,12,12),new THREE.MeshBasicMaterial({color:bt.color,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));
      // Fire from peer's sprite position
      var psp=SPRITES.peers[e.data.peerId];
      var px=psp?psp.position.x:(Math.random()-.5)*4;
      var pz=psp?psp.position.z:8;
      m.position.set(px,2.5,pz);scene.add(m);
      blasts.push({mesh:m,vz:-bt.speed,type:e.data.blastType,dmg:0,power:e.data.power||.5,life:1})}}}
}
