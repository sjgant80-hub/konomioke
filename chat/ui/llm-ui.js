// llm-ui.js — LLM ask logic, auto-starts on first question
function askLLM(){
  var input=document.getElementById('llm-in');var text=input?.value?.trim();if(!text)return;
  var lc=document.getElementById('llm-chat');
  if(lc)lc.innerHTML+='<div style="color:#888">you: '+text+'</div>';
  input.value='';

  // Auto-enable bot on first ask
  if(typeof BOT!=='undefined'&&!BOT.enabled){
    var sel=document.getElementById('llm-model');
    if(sel&&typeof LLM!=='undefined')LLM.model=sel.value;
    if(typeof enableBot==='function')enableBot();
  }

  if(!LLM||!LLM.ready){
    if(lc){lc.innerHTML+='<div style="color:#f0a030">loading model...</div>';lc.scrollTop=lc.scrollHeight}
    var _q=setInterval(function(){if(LLM&&LLM.ready){clearInterval(_q);_doAsk(text,lc)}},1000);
    setTimeout(function(){clearInterval(_q)},120000);
    return;
  }
  _doAsk(text,lc);
}

function _doAsk(text,lc){
  if(lc){lc.innerHTML+='<div style="color:#333">thinking...</div>';lc.scrollTop=lc.scrollHeight}
  llmRespond(text).then(function(reply){
    if(!reply)reply='(no response)';
    if(lc){lc.innerHTML+='<div style="color:#42e898">🧠 '+reply+'</div>';lc.scrollTop=lc.scrollHeight}
    if(typeof sayTTS==='function')sayTTS(reply);
    else if(typeof formantSpeak==='function'&&typeof FSYNTH!=='undefined'&&FSYNTH.ctx)formantSpeak(reply);
    if(typeof addMsg==='function')addMsg('🧠 LLM',reply,'#42e898');
    if(typeof mqttPublish==='function')mqttPublish('chat',{from:'🧠 LLM',text:reply,color:'#42e898'});
  });
}
