// tts.js — single TTS entry point, consistent voice selection
var TTS={voice:null,ready:false,queue:[],speaking:false,rate:1.0,pitch:1.0,lang:'en-US'};

function initTTS(){
  if(!window.speechSynthesis)return;
  function pick(){
    var v=speechSynthesis.getVoices();
    TTS.voice=v.find(function(x){return x.name.includes('Google')&&x.lang.startsWith('en')})||
      v.find(function(x){return x.lang.startsWith('en')})||v[0]||null;
    if(TTS.voice){TTS.ready=true;trace('info','tts voice: '+TTS.voice.name,'tts');_flushQueue()}
  }
  if(speechSynthesis.getVoices().length)pick();
  speechSynthesis.onvoiceschanged=pick;
}

function sayTTS(text,cb){
  if(!window.speechSynthesis)return;
  if(!TTS.ready){TTS.queue.push({text:text,cb:cb});return}
  if(TTS.speaking){TTS.queue.push({text:text,cb:cb});return}
  _speak(text,cb);
}

function _speak(text,cb){
  TTS.speaking=true;
  var utt=new SpeechSynthesisUtterance(text);
  if(TTS.voice)utt.voice=TTS.voice;
  utt.lang=TTS.lang;utt.rate=TTS.rate;utt.pitch=TTS.pitch;
  utt.onend=function(){TTS.speaking=false;if(cb)cb();_flushQueue()};
  utt.onerror=function(){TTS.speaking=false;_flushQueue()};
  speechSynthesis.speak(utt);
}

function _flushQueue(){
  if(TTS.queue.length&&!TTS.speaking){var next=TTS.queue.shift();_speak(next.text,next.cb)}
}
