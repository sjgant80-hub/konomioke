// bot.js — AI bot brain: listens to chat, thinks via WebLLM, speaks via TTS
var BOT={enabled:false,thinking:false,lastReply:0,cooldownMs:5000};

function enableBot(){
  BOT.enabled=true;
  trace('info','bot brain enabled — loading LLM','bot');
  var statusEl=document.getElementById('llm-status');
  var chatEl=document.getElementById('llm-chat');
  initLLM(function(status){
    if(statusEl){statusEl.textContent=status.slice(0,30);statusEl.style.color=status.includes('ready')?'#42e898':'#888'}
    if(chatEl){chatEl.innerHTML+='<div style="color:#555;font-size:7px">'+status+'</div>';chatEl.scrollTop=chatEl.scrollHeight}
    addMsg(null,'🤖 '+status,null,true);
  });
  initTTS();
}

function onBotChat(from,text){
  if(!BOT.enabled||BOT.thinking)return;
  if(from===getNick())return;
  if(Date.now()-BOT.lastReply<BOT.cooldownMs)return;
  if(!LLM.ready){addMsg(null,'🤖 still loading model...',null,true);return}

  BOT.thinking=true;
  trace('info','bot thinking about: '+text.slice(0,40),'bot');

  llmRespond(from+' says: '+text).then(function(reply){
    BOT.thinking=false;BOT.lastReply=Date.now();
    if(!reply)return;
    // Show in chat
    addMsg('🤖 Bot',reply,'#42e898');
    // Send via MQTT so other peers see it
    if(typeof pollSignalSend==='function')pollSignalSend({type:'chat',from:'🤖 Bot',text:reply,color:'#42e898'});
    if(typeof mqttPublish==='function')mqttPublish('chat',{from:'🤖 Bot',text:reply,color:'#42e898'});
    // Speak via formant synth (custom voice) or fallback to Web Speech
    if(typeof formantSpeak==='function'&&FSYNTH.ctx)formantSpeak(reply);
    else if(typeof speak==='function')speak(reply);
  }).catch(function(e){
    BOT.thinking=false;
    trace('warn','bot error: '+e.message,'bot');
  });
}
