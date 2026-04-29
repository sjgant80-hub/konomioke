// mqtt.js — global P2P via public MQTT broker (cross-device)
var MQTT_SIG={client:null,topic:'konomi/chat/KONOMI/',connected:false,myId:null,knownPeers:{}};

function mqttConnect(room,peerId,displayName){
  MQTT_SIG.myId=peerId;
  MQTT_SIG.topic='konomi/chat/'+(room||'KONOMI')+'/';
  if(typeof mqtt==='undefined'){trace('warn','mqtt.js lib not loaded','mqtt');return}
  try{
    MQTT_SIG.client=mqtt.connect('wss://broker.hivemq.com:8884/mqtt',{
      clientId:'konomi-'+peerId,connectTimeout:5000,keepalive:30});
    MQTT_SIG.client.on('connect',function(){
      MQTT_SIG.connected=true;
      MQTT_SIG.client.subscribe(MQTT_SIG.topic+'#');
      mqttPublish('join',{displayName:displayName});
      trace('info','mqtt connected','mqtt');
    });
    MQTT_SIG.client.on('message',function(topic,msg){
      try{var d=JSON.parse(msg.toString());_mqttHandle(topic,d)}catch(e){}
    });
    MQTT_SIG.client.on('error',function(e){trace('warn','mqtt: '+e.message,'mqtt')});
    MQTT_SIG.client.on('close',function(){MQTT_SIG.connected=false});
  }catch(e){trace('warn','mqtt fail: '+e.message,'mqtt')}
}

function mqttPublish(subTopic,data){
  if(!MQTT_SIG.client||!MQTT_SIG.connected)return;
  data.peerId=MQTT_SIG.myId;data.ts=Date.now();
  try{MQTT_SIG.client.publish(MQTT_SIG.topic+subTopic,JSON.stringify(data),{qos:0})}catch(e){}
}

function mqttDisconnect(){
  if(MQTT_SIG.client&&MQTT_SIG.connected){
    mqttPublish('leave',{});
    MQTT_SIG.client.end();MQTT_SIG.connected=false}
}

function _mqttHandle(topic,d){
  if(!d.peerId||d.peerId===MQTT_SIG.myId)return;
  var sub=topic.replace(MQTT_SIG.topic,'');
  var isNew=!MQTT_SIG.knownPeers[d.peerId];

  if(sub==='join'){
    if(isNew){
      MQTT_SIG.knownPeers[d.peerId]={name:d.displayName,ts:Date.now()};
      if(typeof window._onPollPeerJoin==='function')window._onPollPeerJoin(d.peerId,d.displayName);
      // Reply with 'present' so they see us (not 'join' to avoid loop)
      mqttPublish('present',{displayName:POLL_SIG?.displayName||'?'});
    }
  }
  if(sub==='present'&&isNew){
    MQTT_SIG.knownPeers[d.peerId]={name:d.displayName,ts:Date.now()};
    if(typeof window._onPollPeerJoin==='function')window._onPollPeerJoin(d.peerId,d.displayName);
  }
  if(sub==='leave'){
    delete MQTT_SIG.knownPeers[d.peerId];
    if(typeof window._onPollPeerLeave==='function')window._onPollPeerLeave(d.peerId)}
  if(sub==='chat'){
    if(typeof window._onPollChat==='function')window._onPollChat(d)}
  if(sub==='blast'){
    if(typeof _handleRemoteBlast==='function')_handleRemoteBlast(d)}
  if(sub==='score'){
    if(typeof updateScoreboard==='function')updateScoreboard(d.peerId,d.from||d.displayName,d.score);
  }
  if(sub==='youtube'){
    if(typeof onRemoteYT==='function'&&d.vid)onRemoteYT(d.vid);
  }
  if(sub==='state'){
    if(typeof onRoomState==='function')onRoomState(d);
  }
  if(sub==='request-state'){
    if(typeof publishRoomState==='function')publishRoomState();
  }
  if(sub==='cmd'){
    if(d.type==='reload')location.reload(true);
    if(d.type==='clear-cache'){caches.keys().then(function(k){k.forEach(function(n){caches.delete(n)})}).catch(function(){});location.reload(true)}
    if(d.type==='play'&&d.vid&&typeof onRemoteYT==='function')onRemoteYT(d);
  }
}
