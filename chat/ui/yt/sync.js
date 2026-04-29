// yt/sync.js — MQTT sync for YouTube
var CURRENT_VID=null,VID_START=0,_ytPending=null;

function ytLoad(){
  var url=document.getElementById('yt-url')?.value?.trim();if(!url)return;
  var m=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if(!m)return;
  CURRENT_VID=m[1];VID_START=Date.now();
  ytpPlay(CURRENT_VID,0);
  _ytPublish();
}

function _ytPublish(){
  if(!CURRENT_VID)return;
  var d={peerId:typeof MQTT_SIG!=='undefined'?MQTT_SIG.myId:'?',vid:CURRENT_VID,startedAt:VID_START,ts:Date.now()};
  if(typeof MQTT_SIG!=='undefined'&&MQTT_SIG.client&&MQTT_SIG.connected)
    MQTT_SIG.client.publish(MQTT_SIG.topic+'youtube',JSON.stringify(d),{qos:1,retain:true});
  if(typeof pollSignalSend==='function')pollSignalSend(Object.assign({type:'youtube'},d));
}

function onRemoteYT(d){
  if(!d||!d.vid)return;
  _ytPending=d;
  _ytTryPlay();
}

function _ytTryPlay(){
  if(!_ytPending)return;
  if(!document.getElementById('yt-embed'))return;
  var d=_ytPending;_ytPending=null;
  var seek=d.startedAt?Math.max(0,(Date.now()-d.startedAt)/1000):0;
  CURRENT_VID=d.vid;VID_START=d.startedAt||Date.now();
  ytpPlay(d.vid,seek);
  trace('info','yt synced '+d.vid+' @'+Math.floor(seek)+'s','yt');
}

function ytRefresh(){
  if(typeof MQTT_SIG!=='undefined'&&MQTT_SIG.client&&MQTT_SIG.connected){
    MQTT_SIG.client.unsubscribe(MQTT_SIG.topic+'youtube');
    MQTT_SIG.client.unsubscribe(MQTT_SIG.topic+'state');
    setTimeout(function(){
      MQTT_SIG.client.subscribe(MQTT_SIG.topic+'youtube');
      MQTT_SIG.client.subscribe(MQTT_SIG.topic+'state');
    },300);
  }
  if(typeof mqttPublish==='function')mqttPublish('request-state',{});
}

function onRoomState(d){
  if(d&&d.vid&&!CURRENT_VID)onRemoteYT(d);
  if(d&&d.scores&&typeof SCORES!=='undefined'){
    for(var k in d.scores)if(!SCORES[k])SCORES[k]=d.scores[k];
    if(typeof renderScores==='function')renderScores()}
}

function ytFlushPending(){_ytTryPlay()}
