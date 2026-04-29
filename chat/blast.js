// blast.js — charge system, projectiles, explosions, kanji sprites
var blasts=[],explosions=[],chargeParticles=[],kanjiSprites=[];
var prevSounding=false,chargeType='kiball';
var myScore=0,combo=0,lastHitTime=0,targetHP=1000,maxHP=1000;

function updateCharge(){
  if(voice.sounding){voice.chargeLevel=Math.min(1,voice.chargeLevel+voice.rms*.08);
    if(voice.pulseRate>3)chargeType='barrage';else if(voice.vowel==='ah'&&voice.pn<.4)chargeType='kamehameha';
    else if(voice.vowel==='ee'&&voice.pn>.6)chargeType='finalflash';else if(voice.vowel==='oh')chargeType='spiritbomb';
    else if(voice.vowel==='oo')chargeType='galickgun';else if(!voice.vowel)chargeType='kiball';
    if(chargeType==='barrage'&&voice.chargeLevel>.15&&Math.random()<.3)fireBlast('barrage',voice.chargeLevel*.3);
  }else{if(prevSounding&&voice.chargeLevel>.2&&chargeType!=='barrage')fireBlast(chargeType,voice.chargeLevel);
    voice.chargeLevel*=.95;if(voice.chargeLevel<.01)voice.chargeLevel=0}
  prevSounding=voice.sounding;var cl=voice.chargeLevel,bt=BLAST_TYPES[chargeType]||BLAST_TYPES.kiball;
  aura.material.color.setHex(bt.color);aura.material.opacity=cl*.25;aura.scale.setScalar(1+cl*2);auraGlow.material.opacity=cl*.12;
  // Grow the charging kanji above the aura
  var ks=aura.kanjiSprite;
  if(ks){var vk=bt.vowel||'mm';
    if(cl>.05&&kanjiTex[vk]){ks.material.map=kanjiTex[vk];ks.material.opacity=Math.min(.9,cl*1.2);ks.material.needsUpdate=true;
      var sz=1+cl*4;ks.scale.set(sz,sz,1);ks.position.y=2+cl*1.5;ks.material.rotation=(ks.material.rotation||0)+.02}
    else{ks.material.opacity=0}}
  spawnChargeVFX(cl,bt);updateParticles();updateKanjiSprites();
  var el=document.getElementById('charge-type');if(el)el.textContent=cl>.05?bt.name+' '+Math.round(cl*100)+'%':'';
}

function fireBlast(type,power){var bt=BLAST_TYPES[type],sz=bt.size*(.5+power);
  var mesh=new THREE.Mesh(new THREE.SphereGeometry(sz,12,12),new THREE.MeshBasicMaterial({color:bt.color,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));
  mesh.position.copy(aura.position);
  mesh.add(new THREE.Mesh(new THREE.SphereGeometry(sz*2.5,8,8),new THREE.MeshBasicMaterial({color:bt.color,transparent:true,opacity:.12,blending:THREE.AdditiveBlending,depthWrite:false})));
  var vk=bt.vowel||'mm';if(kanjiTex[vk]){var ks=new THREE.Sprite(new THREE.SpriteMaterial({map:kanjiTex[vk],blending:THREE.AdditiveBlending,transparent:true,opacity:.8,depthWrite:false}));ks.scale.set(sz*3,sz*3,1);mesh.add(ks)}
  scene.add(mesh);var dmg=voice.energy*100*bt.dmgMul*(1+voice.coherence*.5);
  blasts.push({mesh:mesh,vz:-bt.speed,type:type,dmg:dmg,power:power,life:1});
  voice.chargeLevel=0;
  pollSignalSend({type:'blast',blastType:type,power:power})}

function updateBlasts(){for(var i=blasts.length-1;i>=0;i--){var b=blasts[i];b.mesh.position.z+=b.vz;b.life-=.005;b.mesh.rotation.y+=.12;
  if(Math.abs(b.mesh.position.z-target.position.z)<1.5){hitTarget(b);spawnExplosion(target.position,b.type);scene.remove(b.mesh);blasts.splice(i,1);continue}
  if(b.life<=0||b.mesh.position.z<-20){scene.remove(b.mesh);blasts.splice(i,1)}}}

function hitTarget(b){var dmg=b.dmg*(.8+b.power*.5);var now=performance.now();
  if(now-lastHitTime<2000)combo++;else combo=1;lastHitTime=now;dmg*=1+Math.min(combo,20)*.1;
  targetHP=Math.max(0,targetHP-dmg);myScore+=Math.round(dmg);screenShake=Math.max(screenShake,dmg*.02);
  var el=document.getElementById('score');if(el)el.textContent=myScore.toLocaleString();
  if(targetHP<=0){targetHP=maxHP;maxHP=Math.round(maxHP*1.3)}
  var hp=targetHP/maxHP;target.hpRing.material.color.setHSL(hp*.33,1,.5);target.material.opacity=.3+hp*.5;
  showDmg(dmg,b.type);pollSignalSend({type:'score',score:myScore})}

function showDmg(amt,type){var el=document.createElement('div');el.className='dmg';
  var kj=KANJI[BLAST_TYPES[type]?.vowel||'mm'];el.textContent=(kj?kj.char+' ':'')+Math.round(amt);
  el.style.color='#'+((BLAST_TYPES[type]?.color||0xff0).toString(16).padStart(6,'0'));
  el.style.fontSize=(18+Math.min(amt/10,30))+'px';el.style.left=(W/2+(Math.random()-.5)*120)+'px';el.style.top=(H/2-60+(Math.random()-.5)*40)+'px';
  document.getElementById('dmgLayer').appendChild(el);setTimeout(function(){el.remove()},1200)}

function spawnExplosion(pos,type){var bt=BLAST_TYPES[type]||BLAST_TYPES.kiball;
  for(var i=0;i<12;i++){var e=new THREE.Mesh(new THREE.SphereGeometry(.08+Math.random()*.15,4,4),new THREE.MeshBasicMaterial({color:bt.color,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));
    e.position.copy(pos);var a=Math.random()*Math.PI*2,el2=Math.random()*Math.PI-Math.PI/2,sp2=.1+Math.random()*.25;
    e.userData={vx:Math.cos(a)*Math.cos(el2)*sp2,vy:Math.sin(el2)*sp2+.05,vz:Math.sin(a)*Math.cos(el2)*sp2,life:1};scene.add(e);explosions.push(e)}}

function updateExplosions(){for(var i=explosions.length-1;i>=0;i--){var e=explosions[i],u=e.userData;
  e.position.x+=u.vx;e.position.y+=u.vy;e.position.z+=u.vz;if(u.vy>-.1)u.vy-=.002;
  u.life-=.025;e.material.opacity=Math.max(0,u.life);e.scale.setScalar(1+((1-u.life)*2));
  if(u.life<=0){scene.remove(e);explosions.splice(i,1)}}}
