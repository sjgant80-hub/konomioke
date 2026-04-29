// stt.js — speech-to-text via Web Speech Recognition API
var STT={recognition:null,active:false,lang:'en-US'};

function initSTT(){
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){trace('warn','no SpeechRecognition API','stt');return false}
  STT.recognition=new SR();
  STT.recognition.continuous=true;
  STT.recognition.interimResults=true;
  STT.recognition.lang=STT.lang;

  STT.recognition.onresult=function(e){
    var final='',interim='';
    for(var i=e.resultIndex;i<e.results.length;i++){
      if(e.results[i].isFinal)final+=e.results[i][0].transcript;
      else interim+=e.results[i][0].transcript}
    // Show interim in input
    var ci=document.getElementById('chat-in');
    if(ci&&interim)ci.value=interim;
    // Send final transcript
    if(final.trim()){
      if(ci)ci.value='';
      var text=final.trim();
      if(typeof addMsg==='function')addMsg(typeof getNick==='function'?getNick():'me',text,'#8898b4');
      if(typeof pollSignalSend==='function')pollSignalSend({type:'chat',from:typeof getNick==='function'?getNick():'me',text:text,color:'#8898b4'});
      if(typeof mqttPublish==='function')mqttPublish('chat',{from:typeof getNick==='function'?getNick():'me',text:text,color:'#8898b4'});
      if(typeof onBotChat==='function')onBotChat('me',text);
      trace('debug','stt: '+text.slice(0,40),'stt');
    }
  };
  STT.recognition.onerror=function(e){trace('warn','stt error: '+e.error,'stt')};
  STT.recognition.onend=function(){if(STT.active)STT.recognition.start()};
  trace('info','stt ready','stt');
  return true;
}

function toggleSTT(){
  if(!STT.recognition&&!initSTT())return;
  if(STT.active){
    STT.active=false;STT.recognition.stop();
    var btn=document.getElementById('stt-btn');
    if(btn){btn.textContent='🎙';btn.style.color='#333';btn.style.borderColor='#333'}
  }else{
    STT.active=true;STT.recognition.start();
    var btn=document.getElementById('stt-btn');
    if(btn){btn.textContent='🔴';btn.style.color='#ff2d75';btn.style.borderColor='#ff2d75'}
    trace('info','stt listening','stt');
  }
}
