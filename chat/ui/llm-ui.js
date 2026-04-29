// llm-ui.js — LLM panel toggle + ask logic
function toggleBot(){
  var el=document.getElementById('bot-toggle');
  if(typeof BOT==='undefined')return;
  if(BOT.enabled){BOT.enabled=false;el.textContent='OFF';el.style.color='#333';el.style.borderColor='#333';
    var s=document.getElementById('llm-status');if(s){s.textContent='off';s.style.color='#333'}}
  else _startBot();
}

function _startBot(){
  var el=document.getElementById('bot-toggle');
  var sel=document.getElementById('llm-model');
  if(sel&&typeof LLM!=='undefined')LLM.model=sel.value;
  if(typeof enableBot==='function')enableBot();
  if(el){el.textContent='ON';el.style.color='#42e898';el.style.borderColor='#42e898'}
}

function askLLM(){
  var input=document.getElementById('llm-in');var text=input?.value?.trim();if(!text)return;
  var lc=document.getElementById('llm-chat');
  if(lc)lc.innerHTML+='<div style="color:#888">you: '+text+'</div>';
  input.value='';

  // Auto-enable bot on first ask
  if(typeof BOT!=='undefined'&&!BOT.enabled)_startBot();

  if(!LLM||!LLM.ready){
    if(lc){lc.innerHTML+='<div style="color:#f0a030">loading model — will respond when ready...</div>';lc.scrollTop=lc.scrollHeight}
    // Queue the question for when model loads
    var _waitQ=setInterval(function(){
      if(LLM&&LLM.ready){clearInterval(_waitQ);_doAsk(text,lc)}
    },1000);
    setTimeout(function(){clearInterval(_waitQ)},120000);
    return;
  }
  _doAsk(text,lc);
}

function _doAsk(text,lc){
  if(lc){lc.innerHTML+='<div style="color:#333">thinking...</div>';lc.scrollTop=lc.scrollHeight}
  llmRespond(text).then(function(reply){
    if(!reply)reply='(no response)';
    if(lc){lc.innerHTML+='<div style="color:#42e898">🧠 '+reply+'</div>';lc.scrollTop=lc.scrollHeight}
    // Speak via formant synth
    if(typeof formantSpeak==='function'&&typeof FSYNTH!=='undefined'&&FSYNTH.ctx)formantSpeak(reply);
    else if(typeof speak==='function')speak(reply);
    if(typeof addMsg==='function')addMsg('🧠 LLM',reply,'#42e898');
    if(typeof mqttPublish==='function')mqttPublish('chat',{from:'🧠 LLM',text:reply,color:'#42e898'});
  });
}
