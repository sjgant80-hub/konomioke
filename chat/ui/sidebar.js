// sidebar.js — scoreboard + sidebar init (YouTube moved to ui/yt/)
var SCORES={};

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
}

function publishRoomState(){
  if(typeof MQTT_SIG==='undefined'||!MQTT_SIG.client||!MQTT_SIG.connected)return;
  var data={peerId:MQTT_SIG.myId,vid:CURRENT_VID,startedAt:VID_START,scores:SCORES,
    nick:typeof getNick==='function'?getNick():'?',
    score:typeof myScore!=='undefined'?myScore:0,ts:Date.now()};
  MQTT_SIG.client.publish(MQTT_SIG.topic+'state',JSON.stringify(data),{qos:0,retain:true});
}

function initSidebar(){
  fetch('ui/sidebar.html?v='+Date.now()).then(function(r){return r.text()}).then(function(h){
    var mount=document.getElementById('mount-right');
    if(mount)mount.innerHTML=h;
    // Init YT IFrame Player API
    if(typeof ytpInit==='function')ytpInit();
    // Score loop
    setInterval(function(){
      var id=typeof CHAT!=='undefined'?CHAT.myId:'?';
      var name=typeof getNick==='function'?getNick():id.slice(0,8);
      var score=typeof myScore!=='undefined'?myScore:0;
      updateScoreboard(id,name,score);
    },3000);
    setInterval(publishRoomState,10000);
    setInterval(function(){if(CURRENT_VID)_publishYT(CURRENT_VID)},5000);
    // Flush pending + auto-sync
    if(typeof flushPending==='function')flushPending();
    var _sa=0;var _st=setInterval(function(){_sa++;if(CURRENT_VID||_sa>12){clearInterval(_st);return}
      if(typeof ytRefresh==='function')ytRefresh()},5000);
  }).catch(function(){});
}
