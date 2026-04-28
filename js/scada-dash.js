// SCADA dashboard — polls tag counts + iframe status for header/footer
var KON_REPO='teslasolar/konomioke',KON_LABEL='konomi-config';
var MUS_REPO='teslasolar/moosic',MUS_LABEL='grid-config';

async function countTags(repo,label){
  try{var r=await fetch('https://api.github.com/repos/'+repo+'/issues?labels='+label+'&state=open&per_page=50',
    {headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(5000)});
    var j=await r.json();return Array.isArray(j)?j.length:0}
  catch(e){return 0}
}

function setDot(id,on){var el=document.getElementById(id);if(!el)return;
  var d=el.querySelector('.dot');if(d)d.className='dot '+(on?'on':'off')}

async function dashRefresh(){
  var kon=await countTags(KON_REPO,KON_LABEL);
  var mus=await countTags(MUS_REPO,MUS_LABEL);
  document.getElementById('ftr-kon').textContent='konomioke: '+kon+' tags';
  document.getElementById('ftr-mus').textContent='moosic: '+mus+' tags';
  document.getElementById('mus-tags').textContent=mus+' tags';
  setDot('kon-status',true);setDot('mus-status',true);
}

// Audio status — one button, two sources (mic + tab), shared with both iframes.
// Mic: auto-grabbed on first gesture, kept alive, injected into engine + moosic nudged.
// Tab: opened by clicking the button (getDisplayMedia needs direct gesture).
// Button label reflects compound state:
//   ⚪ audio  — nothing active yet
//   🎤 mic    — mic only (auto-grabbed)
//   🔴 live   — mic + tab both active
//   📺 tab    — tab only (edge case)
(function(){
  if(!navigator.mediaDevices)return;
  var _ms=null,_msInjected=false;  // mic
  var _ts=null,_tac=null,_tan=null,_tfr=null,_trt=null; // tab
  var MIC_C={audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,sampleRate:48000,channelCount:1}};

  // ── button label ────────────────────────────────────────
  function updateBtn(){
    var b=document.getElementById('scada-audio-btn');if(!b)return;
    var hasMic=_ms&&_ms.active,hasTab=_ts&&_ts.active;
    if(hasMic&&hasTab){b.textContent='🔴 live';b.style.color='#ff4466';b.style.borderColor='#ff4466';}
    else if(hasMic)    {b.textContent='🎤 mic'; b.style.color='#ffaa00';b.style.borderColor='#ffaa00';}
    else if(hasTab)    {b.textContent='📺 tab'; b.style.color='#0af';   b.style.borderColor='#0af';}
    else               {b.textContent='⚪ audio';b.style.color='';       b.style.borderColor='';}
  }

  // ── mic ─────────────────────────────────────────────────
  async function grabMic(){
    if(_ms&&_ms.active)return;
    try{
      _ms=await navigator.mediaDevices.getUserMedia(MIC_C);
      window._sharedMicStream=_ms;
      injectMic();
      updateBtn();
    }catch(e){console.warn('[scada] mic:',e.message)}
  }
  function injectMic(){
    if(!_ms||!_ms.active)return;
    var fk=document.getElementById('frame-kon');
    if(fk&&fk.contentWindow&&!_msInjected){
      fk.contentWindow.__sharedMicStream=_ms;
      if(typeof fk.contentWindow.__onSharedMicStream==='function')fk.contentWindow.__onSharedMicStream(_ms);
      _msInjected=true;
    }
    var fm=document.getElementById('frame-mus');
    if(fm&&fm.contentWindow){try{fm.contentWindow.postMessage({type:'konomioke-mic-ready'},'*')}catch(e){}}
  }
  var micRetryT=setInterval(function(){if(_msInjected)clearInterval(micRetryT);else injectMic()},500);
  function armMic(){grabMic();if(!_ms)setTimeout(grabMic,5000);}
  window.addEventListener('pointerdown',armMic,{capture:true,once:true});
  window.addEventListener('keydown',armMic,{capture:true,once:true});
  if(navigator.permissions)navigator.permissions.query({name:'microphone'}).then(function(p){if(p.state==='granted')grabMic()}).catch(function(){});
  setInterval(function(){if(!_ms)grabMic()},5000);

  // ── tab ─────────────────────────────────────────────────
  async function grabTab(){
    if(_ts&&_ts.active)return;
    try{
      var s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true,preferCurrentTab:true,selfBrowserSurface:'include',systemAudio:'include'});
      s.getVideoTracks().forEach(function(t){t.stop()});
      _ts=s;
      var fk=document.getElementById('frame-kon');
      if(fk&&fk.contentWindow){
        fk.contentWindow.__sharedTabStream=s;
        if(typeof fk.contentWindow.__onSharedTabStream==='function')fk.contentWindow.__onSharedTabStream(s);
      }
      _tac=new AudioContext();
      var src=_tac.createMediaStreamSource(s);
      _tan=_tac.createAnalyser();_tan.fftSize=128;
      _tfr=new Uint8Array(_tan.frequencyBinCount);
      src.connect(_tan);
      _trt=setInterval(function(){
        if(!_tan)return;
        _tan.getByteFrequencyData(_tfr);
        var fm=document.getElementById('frame-mus');
        if(fm&&fm.contentWindow){try{fm.contentWindow.postMessage({type:'konomioke-tab-freqdata',data:Array.from(_tfr)},'*')}catch(e){}}
      },33);
      s.getAudioTracks().forEach(function(t){t.onended=function(){stopTab();};});
      updateBtn();
    }catch(e){console.warn('[scada] tab:',e.message)}
  }
  function stopTab(){
    if(_ts)_ts.getTracks().forEach(function(t){t.stop()});
    if(_tac){_tac.close().catch(function(){});}
    if(_trt)clearInterval(_trt);
    _ts=null;_tac=null;_tan=null;_tfr=null;_trt=null;
    var fk=document.getElementById('frame-kon');
    if(fk&&fk.contentWindow&&typeof fk.contentWindow.__onSharedTabStream==='function')fk.contentWindow.__onSharedTabStream(null);
    updateBtn();
  }

  // ── button: click = grab mic+tab; click again = stop tab ─
  var btn=document.getElementById('scada-audio-btn');
  if(btn)btn.onclick=function(){if(_ts&&_ts.active)stopTab();else{grabMic();grabTab();}};
})();

// ── P2P at dock level ─────────────────────────────────────
(function initDockP2P(){
  if(typeof pollSignalJoin!=='function')return;
  var myId='dock-'+Math.random().toString(36).slice(2,10);
  var room='KONOMI';
  pollSignalJoin(room,myId,'SCADA');
  document.getElementById('p2p-room').textContent=room;

  window._onPollPeerJoin=function(pid,name){
    console.log('[dock] peer joined:',name||pid);
    updateP2PStatus();
    // Forward to engine iframe
    var fk=document.getElementById('frame-kon');
    if(fk&&fk.contentWindow)try{fk.contentWindow.postMessage({type:'peer-joined',peerId:pid,displayName:name},'*')}catch(e){}
  };
  window._onPollPeerLeave=function(pid){
    console.log('[dock] peer left:',pid);
    updateP2PStatus();
    var fk=document.getElementById('frame-kon');
    if(fk&&fk.contentWindow)try{fk.contentWindow.postMessage({type:'peer-left',peerId:pid},'*')}catch(e){}
  };
  window._onPollChat=function(d){
    console.log('[dock] chat:',d.from,d.text);
    // Forward to engine iframe
    var fk=document.getElementById('frame-kon');
    if(fk&&fk.contentWindow)try{fk.contentWindow.postMessage({type:'poll-chat',from:d.from,text:d.text,color:d.color},'*')}catch(e){}
  };

  // Listen for chat sent from engine iframe
  window.addEventListener('message',function(e){
    if(e.data&&e.data.type==='send-chat'&&typeof pollSignalSend==='function'){
      pollSignalSend({type:'chat',from:e.data.from,text:e.data.text,color:e.data.color});
    }
  });

  function updateP2PStatus(){
    var n=typeof getPollPeerCount==='function'?getPollPeerCount():0;
    var el=document.getElementById('p2p-status');
    if(el)el.textContent='👥 '+(n+1);
  }
  setInterval(updateP2PStatus,2000);
  window.addEventListener('beforeunload',function(){if(typeof pollSignalLeave==='function')pollSignalLeave()});
})();

setInterval(function(){var c=document.getElementById('clock');if(c)c.textContent=new Date().toLocaleTimeString()},1000);
dashRefresh();setInterval(dashRefresh,60000);
