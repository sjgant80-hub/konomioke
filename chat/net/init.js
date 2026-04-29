// net/init.js — wraps peer signaling + chat with tracing
function initNet(){
  trace('info','joining room KONOMI','net');
  traceState('init','joining','net');
  pollSignalJoin('KONOMI',CHAT.myId,getNick());
  traceState('joining','connected','net');
  trace('info','BroadcastChannel: konomi-sig-KONOMI','net');

  window._onPollPeerJoin=function(pid,name){
    trace('info','peer joined: '+(name||pid.slice(0,8)),'net');
    addMsg(null,(name||pid.slice(0,8))+' joined',null,true);updatePeers();
    if(typeof spawnPeerSprite==='function')spawnPeerSprite(pid,name)};

  window._onPollPeerLeave=function(pid){
    trace('info','peer left: '+pid.slice(0,8),'net');
    addMsg(null,pid.slice(0,8)+' left',null,true);updatePeers();
    if(typeof removePeerSprite==='function')removePeerSprite(pid)};

  window._onPollChat=function(d){
    trace('debug','chat from '+(d.from||'?'),'net');
    addMsg(d.from||'?',d.text,d.color)};

  // Remote blasts
  if(POLL_SIG.bc){var prev=POLL_SIG.bc.onmessage;POLL_SIG.bc.onmessage=function(e){
    if(prev)prev(e);
    if(e.data&&e.data.type==='blast'&&e.data.peerId!==POLL_SIG.peerId){
      trace('info','remote blast: '+e.data.blastType,'net');
      var bt=BLAST_TYPES[e.data.blastType]||BLAST_TYPES.kiball;
      var sz=bt.size*(.5+(e.data.power||.5));
      var m=new THREE.Mesh(new THREE.SphereGeometry(sz,12,12),new THREE.MeshBasicMaterial({color:bt.color,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));
      var psp=SPRITES.peers[e.data.peerId];
      m.position.set(psp?psp.position.x:(Math.random()-.5)*4,2.5,psp?psp.position.z:8);
      scene.add(m);blasts.push({mesh:m,vz:-bt.speed,type:e.data.blastType,dmg:0,power:e.data.power||.5,life:1})}}}

  addMsg(null,'joined KONOMI arena',null,true);
  trace('info','net ready — peers: '+(typeof getPollPeerCount==='function'?getPollPeerCount()+1:1),'net');
}
