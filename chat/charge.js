// charge.js — voice → charge level → blast type selection + aura update
var prevSounding=false,chargeType='kiball';
var myScore=0,combo=0,lastHitTime=0,targetHP=1000,maxHP=1000;

function updateCharge(){
  if(voice.sounding){voice.chargeLevel=Math.min(1,voice.chargeLevel+voice.rms*CFG.voice.chargeRate);
    if(voice.pulseRate>CFG.voice.barragePulseRate)chargeType='barrage';
    else if(voice.vowel==='ah'&&voice.pn<.4)chargeType='kamehameha';
    else if(voice.vowel==='ee'&&voice.pn>.6)chargeType='finalflash';
    else if(voice.vowel==='oh')chargeType='spiritbomb';
    else if(voice.vowel==='oo')chargeType='galickgun';
    else if(!voice.vowel)chargeType='kiball';
    if(chargeType==='barrage'&&voice.chargeLevel>CFG.voice.barrageThreshold&&Math.random()<.3)fireBlast('barrage',voice.chargeLevel*.3);
  }else{
    if(prevSounding&&voice.chargeLevel>CFG.voice.fireThreshold&&chargeType!=='barrage')fireBlast(chargeType,voice.chargeLevel);
    voice.chargeLevel*=CFG.voice.chargeDecay;
    if(voice.chargeLevel<CFG.voice.chargeMin)voice.chargeLevel=0}
  prevSounding=voice.sounding;
  var cl=voice.chargeLevel,bt=BLAST_TYPES[chargeType]||BLAST_TYPES.kiball;
  aura.material.color.setHex(bt.color);aura.material.opacity=cl*.25;aura.scale.setScalar(1+cl*2);auraGlow.material.opacity=cl*.12;
  // Grow charging kanji
  var ks=aura.kanjiSprite;
  if(ks){var vk=bt.vowel||'mm';
    if(cl>.05&&kanjiTex[vk]){ks.material.map=kanjiTex[vk];ks.material.opacity=Math.min(.9,cl*1.2);ks.material.needsUpdate=true;
      var sz=1+cl*4;ks.scale.set(sz,sz,1);ks.position.y=2+cl*1.5}
    else{ks.material.opacity=0}}
  spawnChargeVFX(cl,bt);updateParticles();updateKanjiSprites();
  var el=document.getElementById('charge-type');if(el)el.textContent=cl>.05?bt.name+' '+Math.round(cl*100)+'%':'';
}
