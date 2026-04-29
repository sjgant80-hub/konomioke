// config.js — loads tags/*.json into CFG object, used by all modules
var CFG={voice:{},arena:{},chat:{},kanji:{},blasts:{},zoo:{}};

async function loadChatConfig(){
  var files=['voice','arena','chat','kanji','blasts','zoo'];
  for(var f of files){
    try{var r=await fetch('tags/'+f+'.json');CFG[f]=await r.json()}catch(e){}}
  // Apply voice config
  if(CFG.voice.sampleRate)SR=CFG.voice.sampleRate;
  if(CFG.voice.fftSize)FFT=CFG.voice.fftSize;
  // Apply arena config
  if(CFG.arena.target){targetHP=CFG.arena.target.startHP||1000;maxHP=targetHP}
}
