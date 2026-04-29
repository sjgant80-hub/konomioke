// sidebar.js — YouTube player + scoreboard synced via MQTT
var SCORES={};
var CURRENT_VID=null;
var VID_START=0;

function ytLoad(){
  var url=document.getElementById('yt-url').value.trim();if(!url)return;
  var m=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  var vid=m?m[1]:null;
  if(!vid){document.getElementById('yt-embed').innerHTML='<div style="color:#555;font-size:8px;padding:8px">paste a youtube URL</div>';return}
  VID_START=Date.now();
  _playVid(vid,0);
  _publishYT(vid);
  trace('info','yt: streaming '+vid,'sidebar');
}

function _publishYT(vid){
  var data={peerId:typeof MQTT_SIG!=='undefined'?MQTT_SIG.myId:'?',vid:vid,startedAt:VID_START,ts:Date.now()};
  if(typeof MQTT_SIG!=='undefined'&&MQTT_SIG.client&&MQTT_SIG.connected)
    MQTT_SIG.client.publish(MQTT_SIG.topic+'youtube',JSON.stringify(data),{qos:1,retain:true});
  else if(typeof mqttPublish==='function')mqttPublish('youtube',data);
  if(typeof pollSignalSend==='function')pollSignalSend(Object.assign({type:'youtube'},data));
}

function _playVid(vid,seekTo){
  CURRENT_VID=vid;
  var s=Math.max(0,Math.floor(seekTo||0));
  var el=document.getElementById('yt-embed');
  if(el)el.innerHTML='<iframe src="https://www.youtube.com/embed/'+vid+'?autoplay=1&rel=0&start='+s+'" allow="autoplay" style="width:100%;height:100%;border:none"></iframe>';
  var now=document.getElementById('yt-now');
  if(now)now.textContent='▶ '+vid+(s>0?' @'+Math.floor(s/60)+':'+String(s%60).padStart(2,'0'):'');
}

function onRemoteYT(d){
  var vid=d.vid;if(!vid)return;
  var seekTo=0;
  if(d.startedAt){seekTo=(Date.now()-d.startedAt)/1000}
  VID_START=d.startedAt||Date.now();
  _playVid(vid,seekTo);
  var u=document.getElementById('yt-url');if(u)u.value='';
  trace('info','yt: synced '+vid+' @'+Math.floor(seekTo)+'s','sidebar');
}

function ytRefresh(){
  trace('info','yt: syncing...','sidebar');
  if(typeof mqttPublish==='function')mqttPublish('request-state',{});
  if(typeof pollSignalSend==='function')pollSignalSend({type:'request-state'});
  if(typeof MQTT_SIG!=='undefined'&&MQTT_SIG.client&&MQTT_SIG.connected){
    MQTT_SIG.client.unsubscribe(MQTT_SIG.topic+'youtube');
    setTimeout(function(){MQTT_SIG.client.subscribe(MQTT_SIG.topic+'youtube')},500);
  }
  var now=document.getElementById('yt-now');
  if(now&&!CURRENT_VID)now.textContent='syncing...';
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
}

function publishRoomState(){
  if(typeof MQTT_SIG==='undefined'||!MQTT_SIG.client||!MQTT_SIG.connected)return;
  var data={peerId:MQTT_SIG.myId,vid:CURRENT_VID,startedAt:VID_START,scores:SCORES,
    nick:typeof getNick==='function'?getNick():'?',
    score:typeof myScore!=='undefined'?myScore:0,ts:Date.now()};
  MQTT_SIG.client.publish(MQTT_SIG.topic+'state',JSON.stringify(data),{qos:0,retain:true});
}

function onRoomState(d){
  if(d.vid&&!CURRENT_VID){
    var seekTo=d.startedAt?(Date.now()-d.startedAt)/1000:0;
    VID_START=d.startedAt||Date.now();
    _playVid(d.vid,seekTo);
  }
  if(d.scores){for(var k in d.scores)if(!SCORES[k])SCORES[k]=d.scores[k];renderScores()}
}

function initSidebar(){
  fetch('ui/sidebar.html?v='+Date.now()).then(function(r){return r.text()}).then(function(h){
    var mount=document.getElementById('mount-right');
    if(mount)mount.innerHTML=h;
    setInterval(function(){
      var id=typeof CHAT!=='undefined'?CHAT.myId:'?';
      var name=typeof getNick==='function'?getNick():id.slice(0,8);
      var score=typeof myScore!=='undefined'?myScore:0;
      updateScoreboard(id,name,score);
    },3000);
    setInterval(publishRoomState,10000);
    // Re-publish YT every 5s so retained msg has fresh timestamp
    setInterval(function(){if(CURRENT_VID)_publishYT(CURRENT_VID)},5000);
    setTimeout(function(){ytRefresh()},3000);
    setTimeout(function(){ytRefresh()},8000);
  }).catch(function(){});
}
