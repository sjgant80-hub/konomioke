// yt/sync.js — MQTT sync for YouTube player
var CURRENT_VID=null,VID_START=0;
var _pendingYT=null,_pendingState=null;

function ytLoad(){
  var url=document.getElementById('yt-url')?.value?.trim();if(!url)return;
  var m=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if(!m)return;
  var vid=m[1];
  CURRENT_VID=vid;VID_START=Date.now();
  ytpPlay(vid,0);
  _publishYT(vid);
  trace('info','yt: streaming '+vid,'yt');
}

function _publishYT(vid){
  var data={peerId:typeof MQTT_SIG!=='undefined'?MQTT_SIG.myId:'?',vid:vid,startedAt:VID_START,ts:Date.now()};
  if(typeof MQTT_SIG!=='undefined'&&MQTT_SIG.client&&MQTT_SIG.connected)
    MQTT_SIG.client.publish(MQTT_SIG.topic+'youtube',JSON.stringify(data),{qos:1,retain:true});
  if(typeof pollSignalSend==='function')pollSignalSend(Object.assign({type:'youtube'},data));
}

function onRemoteYT(d){
  if(!d.vid)return;
  if(!document.getElementById('yt-embed')){_pendingYT=d;return}
  var seekTo=d.startedAt?(Date.now()-d.startedAt)/1000:0;
  CURRENT_VID=d.vid;VID_START=d.startedAt||Date.now();
  ytpPlay(d.vid,seekTo);
  var u=document.getElementById('yt-url');if(u)u.value='';
  trace('info','yt: synced '+d.vid+' @'+Math.floor(seekTo)+'s','yt');
}

function ytRefresh(){
  trace('info','yt: syncing...','yt');
  if(typeof mqttPublish==='function')mqttPublish('request-state',{});
  if(typeof MQTT_SIG!=='undefined'&&MQTT_SIG.client&&MQTT_SIG.connected){
    MQTT_SIG.client.unsubscribe(MQTT_SIG.topic+'youtube');
    setTimeout(function(){MQTT_SIG.client.subscribe(MQTT_SIG.topic+'youtube')},500);
  }
}

function onRoomState(d){
  if(!document.getElementById('yt-embed')){_pendingState=d;return}
  if(d.vid&&!CURRENT_VID){
    var seekTo=d.startedAt?(Date.now()-d.startedAt)/1000:0;
    CURRENT_VID=d.vid;VID_START=d.startedAt||Date.now();
    ytpPlay(d.vid,seekTo);
  }
  if(d.scores&&typeof SCORES!=='undefined'){for(var k in d.scores)if(!SCORES[k])SCORES[k]=d.scores[k];if(typeof renderScores==='function')renderScores()}
}

function flushPending(){
  if(_pendingYT){onRemoteYT(_pendingYT);_pendingYT=null}
  if(_pendingState){onRoomState(_pendingState);_pendingState=null}
}
