// sidebar.js — YouTube player + scoreboard synced via MQTT
var SCORES={};

function ytLoad(){
  var url=document.getElementById('yt-url').value.trim();if(!url)return;
  var m=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  var vid=m?m[1]:null;
  if(!vid){document.getElementById('yt-embed').innerHTML='<div style="color:#555;font-size:8px;padding:8px">paste a youtube URL</div>';return}
  document.getElementById('yt-embed').innerHTML='<iframe src="https://www.youtube.com/embed/'+vid+'?autoplay=1&rel=0" allow="autoplay" style="width:100%;height:100%;border:none"></iframe>';
  // Broadcast to all peers
  if(typeof mqttPublish==='function')mqttPublish('youtube',{vid:vid});
  if(typeof pollSignalSend==='function')pollSignalSend({type:'youtube',vid:vid});
  trace('info','yt: playing '+vid,'sidebar');
}

function onRemoteYT(vid){
  document.getElementById('yt-embed').innerHTML='<iframe src="https://www.youtube.com/embed/'+vid+'?autoplay=1&rel=0" allow="autoplay" style="width:100%;height:100%;border:none"></iframe>';
  document.getElementById('yt-url').value='';
  trace('info','yt: peer started '+vid,'sidebar');
}

function updateScoreboard(peerId,name,score){
  SCORES[peerId]={name:name||peerId.slice(0,8),score:score||0,ts:Date.now()};
  renderScores();
}

function renderScores(){
  var sorted=Object.entries(SCORES).sort(function(a,b){return b[1].score-a[1].score});
  var el=document.getElementById('score-rows');if(!el)return;
  el.innerHTML=sorted.slice(0,8).map(function(e,i){
    var s=e[1];var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    return '<div style="display:flex;justify-content:space-between;padding:1px 0;font-size:7px;border-bottom:1px solid #111"><span style="color:#888">'+medal+s.name+'</span><span style="color:#ff0;font-weight:600">'+s.score.toLocaleString()+'</span></div>';
  }).join('');
  // Sync to MQTT periodically
  if(typeof mqttPublish==='function')mqttPublish('scores',{scores:SCORES});
}

function initSidebar(){
  fetch('ui/sidebar.html').then(function(r){return r.text()}).then(function(h){
    var mount=document.createElement('div');mount.innerHTML=h;
    document.body.appendChild(mount.firstElementChild);
    // Self score update loop
    setInterval(function(){
      var id=typeof CHAT!=='undefined'?CHAT.myId:'?';
      var name=typeof getNick==='function'?getNick():id.slice(0,8);
      var score=typeof myScore!=='undefined'?myScore:0;
      updateScoreboard(id,name,score);
    },3000);
  }).catch(function(){});
}
