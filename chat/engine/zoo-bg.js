// zoo-bg.js — all zoo animals roaming in the background
var ZOO_BG={animals:[],inited:false};

function initZooBG(){
  if(ZOO_BG.inited||!ZOO_ANIMALS.length)return;
  ZOO_BG.inited=true;
  for(var i=0;i<ZOO_ANIMALS.length;i++){
    var a=ZOO_ANIMALS[i];
    var color=parseInt(a.color.replace('#',''),16);
    var bs=(a.bodyScale||1)*.6,hs=(a.headScale||1)*.6;
    var bodyH=.5*bs;
    var g=new THREE.Group();
    // body
    var body=new THREE.Mesh(new THREE.CylinderGeometry(.12*bs,.12*bs,bodyH,6),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:.5}));
    body.position.y=bodyH/2+.1;g.add(body);
    // emoji head
    var eSp=new THREE.Sprite(new THREE.SpriteMaterial({map:makeEmojiTex(a.emoji,64),transparent:true,opacity:.7}));
    eSp.scale.set(.4*hs,.4*hs,1);eSp.position.y=bodyH+.1+.2*hs;g.add(eSp);
    // random start position around the arena edge
    var angle=Math.random()*Math.PI*2;
    var radius=8+Math.random()*10;
    g.position.set(Math.cos(angle)*radius,0,Math.sin(angle)*radius);
    g.userData={
      angle:angle,radius:radius,speed:.1+Math.random()*.15,
      wobble:Math.random()*Math.PI*2,bob:Math.random()*Math.PI*2,
      dir:Math.random()>.5?1:-1,animal:a
    };
    scene.add(g);ZOO_BG.animals.push(g);
  }
  trace('info','zoo bg: '+ZOO_BG.animals.length+' animals roaming','engine');
}

function animateZooBG(t){
  for(var i=0;i<ZOO_BG.animals.length;i++){
    var g=ZOO_BG.animals[i],u=g.userData;
    // Orbit around the arena
    u.angle+=u.speed*.005*u.dir;
    var r=u.radius+Math.sin(t*.3+u.wobble)*2;
    g.position.x=Math.cos(u.angle)*r;
    g.position.z=Math.sin(u.angle)*r;
    // Bob up and down
    g.position.y=Math.abs(Math.sin(t*u.speed*2+u.bob))*.3;
    // Face center
    g.rotation.y=u.angle+Math.PI;
    // React to music/voice
    var energy=typeof voice!=='undefined'?voice.energy:0;
    var scale=1+energy*.3+Math.sin(t*2+i)*.05;
    g.scale.set(scale,scale,scale);
  }
}
