// loop.js — 60Hz render loop (init moved to engine/init.js + net/init.js)
var running=false;

function animate(){if(!running)return;requestAnimationFrame(animate);
  var t=clock.elapsedTime;
  analyzeV();updateCharge();updateBlasts();updateExplosions();updateVortex(t);
  if(typeof animateSprites==='function')animateSprites(t);
  if(typeof animateZooBG==='function')animateZooBG(t);
  camAngle+=.003;camera.position.x=Math.sin(camAngle)*1.5;camera.position.y=3.5+Math.sin(camAngle*.7)*.3;camera.lookAt(0,2.5,-4);
  if(screenShake>.1){camera.position.x+=(Math.random()-.5)*screenShake*.3;camera.position.y+=(Math.random()-.5)*screenShake*.3;screenShake*=.9}
  target.rotation.y=t*.3;target.rotation.x=Math.sin(t*.5)*.2;
  var hp=targetHP/maxHP;target.scale.setScalar(1+Math.sin(t*3)*(1-hp)*.1);
  PH_KEYS.forEach(function(k){var ph=PHONEMES[k];if(voice.vowel===k&&voice.sounding)ph.power=Math.min(1,ph.power+voice.rms*.12);else ph.power*=.985;
    var el=document.getElementById('ph-'+k);if(!el)return;el.querySelector('.ph-fill').style.height=(ph.power*100)+'%';
    if(voice.vowel===k&&voice.sounding)el.classList.add('active');else el.classList.remove('active')});
  renderer.render(scene,camera)}
