// tts.js — text-to-speech via Web Speech API, pipes audio to WebRTC
var TTS={speaking:false,voice:null,rate:1.0,pitch:1.0};

function initTTS(){
  var synth=window.speechSynthesis;
  if(!synth){trace('warn','no speechSynthesis','tts');return}
  // Pick a voice after they load
  function pickVoice(){
    var voices=synth.getVoices();
    TTS.voice=voices.find(function(v){return v.lang.startsWith('en')&&v.name.includes('Google')})||
      voices.find(function(v){return v.lang.startsWith('en')})||voices[0];
    if(TTS.voice)trace('info','tts voice: '+TTS.voice.name,'tts');
  }
  if(synth.getVoices().length)pickVoice();
  else synth.onvoiceschanged=pickVoice;
}

function speak(text,cb){
  if(!window.speechSynthesis||TTS.speaking)return;
  var utt=new SpeechSynthesisUtterance(text);
  if(TTS.voice)utt.voice=TTS.voice;
  utt.rate=TTS.rate;utt.pitch=TTS.pitch;
  TTS.speaking=true;
  utt.onend=function(){TTS.speaking=false;if(cb)cb()};
  utt.onerror=function(){TTS.speaking=false};
  window.speechSynthesis.speak(utt);
  trace('debug','speaking: '+text.slice(0,40),'tts');
}

function speakToStream(text){
  speak(text);
  // SpeechSynthesis audio goes to default output — peers hear it
  // via getDisplayMedia tab capture or system audio loopback.
  // For direct WebRTC: capture destination and route.
  if(typeof audioCtx!=='undefined'&&audioCtx){
    try{
      var dest=audioCtx.createMediaStreamDestination();
      // Connect TTS to the voice analyser so blasts react to bot speech
      var src=audioCtx.createMediaStreamSource(dest.stream);
      src.connect(analyser);
    }catch(e){}
  }
}
