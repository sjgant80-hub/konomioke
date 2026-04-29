// sprite.js — procedural 3D sprite from client ID + nickname
var SPRITES={local:null,peers:{}};
var SPRITE_SPOTS=[{x:0,z:5},{x:-3,z:4},{x:3,z:4},{x:-5,z:3},{x:5,z:3},{x:-2,z:7},{x:2,z:7},{x:0,z:8}];

function hashColor(id){var h=0;for(var i=0;i<id.length;i++)h=id.charCodeAt(i)+((h<<5)-h);return h&0xffffff}
function hashFloat(id,seed){var h=0;for(var i=0;i<id.length;i++)h=id.charCodeAt(i)+((h<<5)-h+seed);return(h&0xffff)/0xffff}

function createSprite(id,nick){
  var color=hashColor(id);
  var bodyH=0.8+hashFloat(id,1)*0.6;
  var headR=0.25+hashFloat(id,2)*0.15;
  var limbW=0.08+hashFloat(id,3)*0.06;
  // Nickname morphs proportions
  if(nick){var nh=0;for(var i=0;i<nick.length;i++)nh+=nick.charCodeAt(i);
    bodyH+=((nh%20)-10)*0.02;headR+=((nh%10)-5)*0.01}
  var group=new THREE.Group();
  // Body
  var body=new THREE.Mesh(new THREE.CapsuleGeometry(0.2,bodyH,4,8),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.85}));
  body.position.y=bodyH/2+0.3;group.add(body);
  // Head
  var head=new THREE.Mesh(new THREE.SphereGeometry(headR,8,8),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.9}));
  head.position.y=bodyH+0.3+headR;group.add(head);
  // Eyes (2 dots based on ID)
  var eyeColor=hashColor(id+'eyes');
  [-0.08,0.08].forEach(function(ex){
    var eye=new THREE.Mesh(new THREE.SphereGeometry(0.04,6,6),new THREE.MeshBasicMaterial({color:eyeColor}));
    eye.position.set(ex,bodyH+0.3+headR+0.02,-headR*0.8);group.add(eye)});
  // Arms
  [-0.3,0.3].forEach(function(ax){
    var arm=new THREE.Mesh(new THREE.CapsuleGeometry(limbW,0.4,3,4),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.7}));
    arm.position.set(ax,bodyH*0.6+0.3,0);arm.rotation.z=ax>0?-0.3:0.3;group.add(arm)});
  // Aura glow ring
  var ring=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.03,8,24),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.3,blending:THREE.AdditiveBlending,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=0.05;group.add(ring);
  // Name label
  var cv=document.createElement('canvas');cv.width=256;cv.height=64;var cx=cv.getContext('2d');
  cx.fillStyle='#'+color.toString(16).padStart(6,'0');cx.font='bold 28px monospace';cx.textAlign='center';
  cx.fillText((nick||id.slice(0,8)),128,40);
  var label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,opacity:0.8}));
  label.scale.set(1.5,0.4,1);label.position.y=bodyH+0.6+headR*2;group.add(label);
  group.userData={id:id,nick:nick,color:color,bodyH:bodyH,arms:group.children.filter(function(c){return c.geometry?.type==='CapsuleGeometry'&&c.position.x!==0})};
  return group;
}

function spawnLocalSprite(id,nick){
  if(SPRITES.local){scene.remove(SPRITES.local)}
  SPRITES.local=createSprite(id,nick);
  SPRITES.local.position.set(SPRITE_SPOTS[0].x,0,SPRITE_SPOTS[0].z);
  scene.add(SPRITES.local);
  aura.position.set(SPRITE_SPOTS[0].x,2.5,SPRITE_SPOTS[0].z);
}

function spawnPeerSprite(pid,nick){
  if(SPRITES.peers[pid]){scene.remove(SPRITES.peers[pid])}
  var idx=Math.min(Object.keys(SPRITES.peers).length+1,SPRITE_SPOTS.length-1);
  var sp=createSprite(pid,nick);
  sp.position.set(SPRITE_SPOTS[idx].x,0,SPRITE_SPOTS[idx].z);
  scene.add(sp);SPRITES.peers[pid]=sp;
}

function removePeerSprite(pid){
  if(SPRITES.peers[pid]){scene.remove(SPRITES.peers[pid]);delete SPRITES.peers[pid]}
}

function animateSprites(t){
  // Breathing + arm swing on voice
  if(SPRITES.local){
    var s=SPRITES.local;s.rotation.y=Math.sin(t*0.5)*0.1;
    var breath=1+Math.sin(t*2)*0.02+voice.energy*0.15;
    s.scale.set(breath,1+voice.energy*0.05,breath);
    var arms=s.userData.arms||[];
    arms.forEach(function(a,i){a.rotation.z=(i?-0.3:0.3)+Math.sin(t*3+i*Math.PI)*voice.energy*0.8})}
  for(var pid in SPRITES.peers){
    var ps=SPRITES.peers[pid];ps.rotation.y=Math.sin(t*0.3+pid.charCodeAt(0))*0.15;
    ps.scale.y=1+Math.sin(t*1.5+pid.charCodeAt(1))*0.02}
}
