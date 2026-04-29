// boot.js — compose UI, load config, init engine + net
(async function(){
  // Compose HTML components into mount points
  await composeUI();
  trace('info','boot start','main');
  traceState('init','config','main');
  // Load from tag.db (GitHub Issues) first, then local tags/ as fallback
  if(typeof loadTagDB==='function'){
    var tags=await loadTagDB();
    var arena=getTag('_chat_arena');
    if(arena){
      if(arena.formant)Object.assign(CFG,{voice:arena.formant||{}});
      if(arena.bot)Object.assign(CFG,{bot:arena.bot||{}});
      if(arena.blasts)CFG.blasts=arena.blasts;
      trace('info','tag.db: loaded _chat_arena from issue #'+(arena._issue||'?'),'main');
    }
    var sprites=getTag('_sprites');if(sprites)CFG.zoo=sprites;
    trace('info','tag.db: '+Object.keys(tags).length+' tags loaded','main');
  }
  await loadChatConfig();
  trace('info','config loaded: '+Object.keys(CFG).join(','),'main');

  // Build phoneme bars
  var c=document.getElementById('phonemes');
  if(c)PH_KEYS.forEach(function(k){var ph=PHONEMES[k],kj=KANJI[k];
    var d=document.createElement('div');d.className='ph';d.id='ph-'+k;
    d.innerHTML='<div class="ph-kanji" style="color:'+ph.color+'">'+kj.char+'</div><div class="ph-label" style="color:'+ph.color+'">'+ph.label+'</div><div class="ph-bar"><div class="ph-fill" style="background:'+ph.color+';height:0%"></div></div>';
    c.appendChild(d)});

  if(typeof stateWidgetInit==='function')stateWidgetInit(
    'stateDiagram-v2\n[*]-->init\ninit-->config\nconfig-->engine\nengine-->net\nnet-->live\nlive-->charging\ncharging-->fire\nfire-->live',
    'init');

  traceState('config','engine','main');
  initEngine();
  traceState('engine','net','main');
  initNet();
  if(typeof initSidebar==='function')initSidebar();

  // Hook incoming chat to bot brain
  var _origOnChat=window._onPollChat;
  window._onPollChat=function(d){
    if(_origOnChat)_origOnChat(d);
    else if(typeof addMsg==='function')addMsg(d.from||'?',d.text,d.color);
    if(typeof onBotChat==='function')onBotChat(d.from,d.text)};

  trace('info','boot complete','main');
  window.addEventListener('beforeunload',function(){
    if(typeof pollSignalLeave==='function')pollSignalLeave();
    if(typeof mqttDisconnect==='function')mqttDisconnect()});
})();
