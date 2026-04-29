// sprite.js — zoo animal sprites from client ID + nickname
var SPRITES={local:null,peers:{}};
var SPRITE_SPOTS=[{x:0,z:5},{x:-3,z:4},{x:3,z:4},{x:-5,z:3},{x:5,z:3},{x:-2,z:7},{x:2,z:7},{x:0,z:8}];
var ZOO_ANIMALS=[];

function loadZoo(){
  try{var z=CFG.zoo||{};ZOO_ANIMALS=z.animals||[]}catch(e){}
  if(!ZOO_ANIMALS.length)ZOO_ANIMALS=[
    {emoji:'🦌',name:'Alex',color:'#ff8844',bodyScale:1.1,headScale:0.9},
    {emoji:'🐝',name:'Buzz',color:'#ffdd00',bodyScale:0.7,headScale:0.8},
    {emoji:'🦆',name:'Gerald',color:'#44cc88',bodyScale:0.9,headScale:1.1},
    {emoji:'🐴',name:'Konomi',color:'#ff2d75',bodyScale:1.0,headScale:0.95},
    {emoji:'🦛',name:'Thomas',color:'#4488ff',bodyScale:1.2,headScale:1.0},
    {emoji:'🦖',name:'Teresa',color:'#44aa44',bodyScale:1.3,headScale:1.1}];
}

function pickAnimal(id){
  if(!ZOO_ANIMALS.length)loadZoo();
  var h=0;for(var i=0;i<id.length;i++)h=id.charCodeAt(i)+((h<<5)-h);
  return ZOO_ANIMALS[Math.abs(h)%ZOO_ANIMALS.length];
}

function makeEmojiTex(emoji,sz){
  var c=document.createElement('canvas');c.width=sz||128;c.height=sz||128;var x=c.getContext('2d');
  x.font=(sz||128)*.7+'px serif';x.textAlign='center';x.textBaseline='middle';
  x.fillText(emoji,(sz||128)/2,(sz||128)/2);return new THREE.CanvasTexture(c);
}

function makeLabelTex(text,color){
  var c=document.createElement('canvas');c.width=256;c.height=64;var x=c.getContext('2d');
  x.fillStyle=color||'#fff';x.font='bold 24px monospace';x.textAlign='center';x.fillText(text,128,40);
  return new THREE.CanvasTexture(c);
}

function createSprite(id,nick){
  var animal=pickAnimal(id);var color=parseInt(animal.color.replace('#',''),16);
  var bs=animal.bodyScale||1,hs=animal.headScale||1,bodyH=0.9*bs;
  var group=new THREE.Group();
  var body=new THREE.Mesh(new THREE.CylinderGeometry(.22*bs,.22*bs,bodyH,8),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:.8}));
  body.position.y=bodyH/2+.2;group.add(body);
  var emojiSp=new THREE.Sprite(new THREE.SpriteMaterial({map:makeEmojiTex(animal.emoji,128),transparent:true}));
  emojiSp.scale.set(.7*hs,.7*hs,1);emojiSp.position.y=bodyH+.2+.35*hs;group.add(emojiSp);
  [-0.3*bs,0.3*bs].forEach(function(ax){
    var arm=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.45,4),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:.7}));
    arm.position.set(ax,bodyH*.5+.2,0);arm.rotation.z=ax>0?-.3:.3;group.add(arm)});
  var ring=new THREE.Mesh(new THREE.TorusGeometry(.45*bs,.03,8,24),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.05;group.add(ring);
  var displayName=(nick||animal.name)+' '+animal.emoji;
  var label=new THREE.Sprite(new THREE.SpriteMaterial({map:makeLabelTex(displayName,animal.color),transparent:true,opacity:.85}));
  label.scale.set(1.8,.45,1);label.position.y=bodyH+.7+.35*hs;group.add(label);
  group.userData={id:id,nick:nick,animal:animal,bodyH:bodyH,arms:group.children.filter(function(c){return c.geometry?.type==='CylinderGeometry'&&c.position.x!==0})};
  return group;
}

function spawnLocalSprite(id,nick){
  if(!ZOO_ANIMALS.length)loadZoo();
  if(SPRITES.local)scene.remove(SPRITES.local);
  SPRITES.local=createSprite(id,nick);
  SPRITES.local.position.set(SPRITE_SPOTS[0].x,0,SPRITE_SPOTS[0].z);
  scene.add(SPRITES.local);aura.position.set(SPRITE_SPOTS[0].x,2.5,SPRITE_SPOTS[0].z);
  var a=pickAnimal(id);trace('info','you are '+a.emoji+' '+a.name,'engine');
}
function spawnPeerSprite(pid,nick){
  if(SPRITES.peers[pid])scene.remove(SPRITES.peers[pid]);
  var idx=Math.min(Object.keys(SPRITES.peers).length+1,SPRITE_SPOTS.length-1);
  var sp=createSprite(pid,nick);sp.position.set(SPRITE_SPOTS[idx].x,0,SPRITE_SPOTS[idx].z);
  scene.add(sp);SPRITES.peers[pid]=sp;
}
function removePeerSprite(pid){if(SPRITES.peers[pid]){scene.remove(SPRITES.peers[pid]);delete SPRITES.peers[pid]}}
function animateSprites(t){
  if(SPRITES.local){var s=SPRITES.local;s.rotation.y=Math.sin(t*.5)*.1;
    var breath=1+Math.sin(t*2)*.02+voice.energy*.15;s.scale.set(breath,1+voice.energy*.05,breath);
    var arms=s.userData.arms||[];arms.forEach(function(a,i){a.rotation.z=(i?-.3:.3)+Math.sin(t*3+i*Math.PI)*voice.energy*.8})}
  for(var pid in SPRITES.peers){var ps=SPRITES.peers[pid];ps.rotation.y=Math.sin(t*.3+pid.charCodeAt(0))*.15;ps.scale.y=1+Math.sin(t*1.5+pid.charCodeAt(1))*.02}
}
