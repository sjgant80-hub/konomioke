// yt/sync.js — MQTT sync for YouTube
var CURRENT_VID=null,VID_START=0,_ytQ=null;

function ytLoad(){
  var url=document.getElementById('yt-url')?.value?.trim();if(!url)return;
  var m=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if(!m){trace('warn','yt: bad url','yt');return}
  CURRENT_VID=m[1];VID_START=Date.now();
  trace('info','yt: LOCAL load '+CURRENT_VID,'yt');
  ytpPlay(CURRENT_VID,0);
  _ytPub();
}

function _ytPub(){
  if(!CURRENT_VID)return;
  var dur=typeof ytpGetDuration==='function'?ytpGetDuration():0;
  var d={peerId:typeof MQTT_SIG!=='undefined'?MQTT_SIG.myId:'?',vid:CURRENT_VID,startedAt:VID_START,dur:dur,ts:Date.now()};
  if(typeof MQTT_SIG!=='undefined'&&MQTT_SIG.client&&MQTT_SIG.connected){
    MQTT_SIG.client.publish(MQTT_SIG.topic+'youtube',JSON.stringify(d),{qos:1,retain:true});
    trace('debug','yt: published retained','yt');
  }
  if(typeof pollSignalSend==='function')pollSignalSend(Object.assign({type:'youtube'},d));
}

function onRemoteYT(d){
  if(!d||!d.vid)return;
  trace('info','yt: REMOTE received vid='+d.vid+' startedAt='+d.startedAt,'yt');
  _ytQ=d;
  _ytFlush();
}

function _ytFlush(){
  if(!_ytQ)return;
  if(!document.getElementById('yt-embed')){trace('debug','yt: waiting for #yt-embed','yt');return}
  var d=_ytQ;_ytQ=null;
  var seek=d.startedAt?Math.max(0,(Date.now()-d.startedAt)/1000):0;
  // Use duration from publisher to avoid seeking past end
  if(d.dur&&d.dur>0&&seek>d.dur){trace('info','yt: seek '+Math.floor(seek)+'s > dur '+Math.floor(d.dur)+'s → 0','yt');seek=0}
  if(d.dur&&typeof YTP!=='undefined')YTP.duration=d.dur;
  CURRENT_VID=d.vid;VID_START=d.startedAt||Date.now();
  trace('info','yt: FLUSH '+d.vid+' @'+Math.floor(seek)+'s'+(d.dur?' dur='+Math.floor(d.dur)+'s':''),'yt');
  ytpPlay(d.vid,seek);
}

function ytRefresh(){
  trace('info','yt: REFRESH re-subscribing','yt');
  if(typeof MQTT_SIG!=='undefined'&&MQTT_SIG.client&&MQTT_SIG.connected){
    MQTT_SIG.client.unsubscribe(MQTT_SIG.topic+'youtube');
    MQTT_SIG.client.unsubscribe(MQTT_SIG.topic+'state');
    setTimeout(function(){
      MQTT_SIG.client.subscribe(MQTT_SIG.topic+'youtube');
      MQTT_SIG.client.subscribe(MQTT_SIG.topic+'state');
      trace('debug','yt: re-subscribed','yt');
    },300);
  }
  if(typeof mqttPublish==='function')mqttPublish('request-state',{});
}

function onRoomState(d){
  trace('debug','yt: onRoomState vid='+(d?.vid||'none')+' current='+(CURRENT_VID||'none'),'yt');
  if(d&&d.vid&&!CURRENT_VID)onRemoteYT(d);
  if(d&&d.scores&&typeof SCORES!=='undefined'){
    for(var k in d.scores)if(!SCORES[k])SCORES[k]=d.scores[k];
    if(typeof renderScores==='function')renderScores()}
}

function ytFlushPending(){_ytFlush()}
