// vfx.js — charge particles, kanji sprites, vortex update
var chargeParticles=[],kanjiSprites=[];
function spawnChargeVFX(cl,bt){
  if(cl<.1||!voice.sounding)return;var pp=aura.position;
  for(var i=0;i<Math.floor(cl*4);i++){var a=Math.random()*Math.PI*2,r2=2+Math.random()*3;
    var p=new THREE.Mesh(new THREE.SphereGeometry(.06,4,4),new THREE.MeshBasicMaterial({color:bt.color,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));
    p.position.set(pp.x+Math.cos(a)*r2,pp.y+(Math.random()-.5)*2,pp.z+Math.sin(a)*r2);
    p.userData={tx:pp.x,ty:pp.y,tz:pp.z,life:1,speed:.06+Math.random()*.04,angle:a};scene.add(p);chargeParticles.push(p)}
  if(cl>.3&&voice.vowel&&Math.random()<.12&&kanjiGlow[voice.vowel]){
    var sm=new THREE.SpriteMaterial({map:kanjiGlow[voice.vowel],blending:THREE.AdditiveBlending,transparent:true,opacity:.6,depthWrite:false});
    var sp=new THREE.Sprite(sm);sp.scale.set(.5+cl*.5,.5+cl*.5,1);var ka=Math.random()*Math.PI*2,kr=1.5+Math.random()*2;
    sp.position.set(pp.x+Math.cos(ka)*kr,pp.y+(Math.random()-.5)*2,pp.z+Math.sin(ka)*kr);
    sp.userData={tx:pp.x,ty:pp.y,tz:pp.z,life:1.5,speed:.03,angle:ka};scene.add(sp);kanjiSprites.push(sp)}}

function updateParticles(){for(var i=chargeParticles.length-1;i>=0;i--){var p=chargeParticles[i],u=p.userData;
  var dx=u.tx-p.position.x,dy=u.ty-p.position.y,dz=u.tz-p.position.z,d=Math.sqrt(dx*dx+dy*dy+dz*dz);
  if(d>.3){u.angle+=.15;p.position.x+=dx/d*u.speed+Math.cos(u.angle)*u.speed*.5;p.position.y+=dy/d*u.speed;p.position.z+=dz/d*u.speed+Math.sin(u.angle)*u.speed*.5}
  u.life-=.02;p.material.opacity=u.life*.7;if(u.life<=0||d<.3){scene.remove(p);chargeParticles.splice(i,1)}}}

function updateKanjiSprites(){for(var i=kanjiSprites.length-1;i>=0;i--){var s=kanjiSprites[i],u=s.userData;
  var dx=u.tx-s.position.x,dy=u.ty-s.position.y,dz=u.tz-s.position.z,d=Math.sqrt(dx*dx+dy*dy+dz*dz);
  u.angle+=.08;if(d>.5){s.position.x+=dx/d*u.speed+Math.cos(u.angle)*.02;s.position.y+=dy/d*u.speed+.01;s.position.z+=dz/d*u.speed+Math.sin(u.angle)*.02}
  u.life-=.015;s.material.opacity=Math.max(0,u.life*.6);if(u.life<=0||d<.5){scene.remove(s);kanjiSprites.splice(i,1)}}}

function updateVortex(t){vortexGroup.rotation.y+=.008+voice.energy*.03;
  for(var i=0;i<VORTEX_N;i++){var ba=i*.15+t*.5,br=3+i*.025-voice.energy*1.5;if(br<.5)br=.5;
    vortexPos[i*3]=Math.cos(ba)*br;vortexPos[i*3+1]=(i/VORTEX_N-.5)*6+Math.sin(t*2+i*.05)*voice.energy*.5;vortexPos[i*3+2]=Math.sin(ba)*br;
    var rgb=hslRgb((voice.pn*360+i*.5)%360/360,.8,.4+voice.energy*.3);vortexCol[i*3]=rgb[0];vortexCol[i*3+1]=rgb[1];vortexCol[i*3+2]=rgb[2]}
  vortexGroup.children[0].geometry.attributes.position.needsUpdate=true;vortexGroup.children[0].geometry.attributes.color.needsUpdate=true;
  vortexGroup.children[0].material.opacity=.2+voice.energy*.5}
