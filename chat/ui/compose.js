// compose.js — loads HTML components into mount points
async function loadComponent(url,mountId){
  try{
    var r=await fetch(url+'?v='+Date.now());if(!r.ok)return;
    var el=document.getElementById(mountId);
    if(el)el.innerHTML=await r.text();
  }catch(e){}
}

async function composeUI(){
  await Promise.all([
    loadComponent('ui/hud.html','mount-hud'),
    loadComponent('ui/chat-panel.html','mount-left-bot'),
    loadComponent('ui/sidebar.html','mount-right')
  ]);
  // Wire events after DOM is ready
  var ci=document.getElementById('chat-in');
  if(ci)ci.onkeydown=function(e){if(e.key==='Enter'){sendChat();e.stopPropagation()}};
  var li=document.getElementById('llm-in');
  if(li)li.onkeydown=function(e){if(e.key==='Enter'){askLLM();e.stopPropagation()}};
  var ni=document.getElementById('nick');
  if(ni)ni.onchange=function(){
    if(typeof POLL_SIG!=='undefined')POLL_SIG.displayName=getNick();
    if(typeof SPRITES!=='undefined'&&SPRITES.local){scene.remove(SPRITES.local);spawnLocalSprite(CHAT.myId,getNick())}};
}
