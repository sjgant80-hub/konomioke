// mqtt.js — global P2P via public MQTT broker (cross-device)
var MQTT_SIG={client:null,topic:'konomi/chat/KONOMI/',connected:false,myId:null};

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
      mqttPublish('join',{peerId:peerId,displayName:displayName});
      trace('info','mqtt connected to hivemq','mqtt');
    });
    MQTT_SIG.client.on('message',function(topic,msg){
      try{var d=JSON.parse(msg.toString());_mqttHandle(topic,d)}catch(e){}
    });
    MQTT_SIG.client.on('error',function(e){trace('warn','mqtt error: '+e.message,'mqtt')});
    MQTT_SIG.client.on('close',function(){MQTT_SIG.connected=false});
  }catch(e){trace('warn','mqtt connect fail: '+e.message,'mqtt')}
}

function mqttPublish(subTopic,data){
  if(!MQTT_SIG.client||!MQTT_SIG.connected)return;
  data.peerId=MQTT_SIG.myId;data.ts=Date.now();
  try{MQTT_SIG.client.publish(MQTT_SIG.topic+subTopic,JSON.stringify(data),{qos:0})}catch(e){}
}

function mqttDisconnect(){
  if(MQTT_SIG.client&&MQTT_SIG.connected){
    mqttPublish('leave',{peerId:MQTT_SIG.myId});
    MQTT_SIG.client.end();MQTT_SIG.connected=false}
}

function _mqttHandle(topic,d){
  if(!d.peerId||d.peerId===MQTT_SIG.myId)return;
  var sub=topic.replace(MQTT_SIG.topic,'');
  if(sub==='join'){
    if(typeof window._onPollPeerJoin==='function')window._onPollPeerJoin(d.peerId,d.displayName);
    // Reply so they see us
    mqttPublish('join',{peerId:MQTT_SIG.myId,displayName:POLL_SIG?.displayName||'?'})}
  if(sub==='leave'){
    if(typeof window._onPollPeerLeave==='function')window._onPollPeerLeave(d.peerId)}
  if(sub==='chat'){
    if(typeof window._onPollChat==='function')window._onPollChat(d)}
  if(sub==='blast'){
    if(typeof _handleRemoteBlast==='function')_handleRemoteBlast(d)}
  if(sub==='score'){
    trace('debug',d.peerId?.slice(0,8)+' score:'+d.score,'mqtt')}
}
