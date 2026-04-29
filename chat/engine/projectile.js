// projectile.js — fire blasts, update flight, hit target, explosions, damage
var blasts=[],explosions=[];

function fireBlast(type,power){var bt=BLAST_TYPES[type],sz=bt.size*(.5+power);
  var mesh=new THREE.Mesh(new THREE.SphereGeometry(sz,12,12),new THREE.MeshBasicMaterial({color:bt.color,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));
  mesh.position.copy(aura.position);
  mesh.add(new THREE.Mesh(new THREE.SphereGeometry(sz*2.5,8,8),new THREE.MeshBasicMaterial({color:bt.color,transparent:true,opacity:.12,blending:THREE.AdditiveBlending,depthWrite:false})));
  var vk=bt.vowel||'mm';if(kanjiTex[vk]){var ks=new THREE.Sprite(new THREE.SpriteMaterial({map:kanjiTex[vk],blending:THREE.AdditiveBlending,transparent:true,opacity:.8,depthWrite:false}));ks.scale.set(sz*3,sz*3,1);mesh.add(ks)}
  scene.add(mesh);var dmg=voice.energy*100*bt.dmgMul*(1+voice.coherence*CFG.arena.damage.coherenceBonus);
  blasts.push({mesh:mesh,vz:-bt.speed,type:type,dmg:dmg,power:power,life:1});
  voice.chargeLevel=0;
  pollSignalSend({type:'blast',blastType:type,power:power});
  if(typeof mqttPublish==='function')mqttPublish('blast',{blastType:type,power:power})}

function updateBlasts(){for(var i=blasts.length-1;i>=0;i--){var b=blasts[i];b.mesh.position.z+=b.vz;b.life-=.005;b.mesh.rotation.y+=.12;
  if(Math.abs(b.mesh.position.z-target.position.z)<1.5){hitTarget(b);spawnExplosion(target.position,b.type);scene.remove(b.mesh);blasts.splice(i,1);continue}
  if(b.life<=0||b.mesh.position.z<-20){scene.remove(b.mesh);blasts.splice(i,1)}}}

function hitTarget(b){var dmg=b.dmg*(.8+b.power*.5);var now=performance.now();
  if(now-lastHitTime<CFG.arena.damage.comboWindow)combo++;else combo=1;lastHitTime=now;
  dmg*=1+Math.min(combo,CFG.arena.damage.comboMaxMul)*CFG.arena.damage.comboMulStep;
  targetHP=Math.max(0,targetHP-dmg);myScore+=Math.round(dmg);
  screenShake=Math.max(screenShake,dmg*CFG.arena.screenShake.dmgMul);
  var el=document.getElementById('score');if(el)el.textContent=myScore.toLocaleString();
  if(targetHP<=0){targetHP=maxHP;maxHP=Math.round(maxHP*CFG.arena.target.hpScaleFactor)}
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
