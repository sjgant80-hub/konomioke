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

// Shared mic — grab ONCE in the parent, push to both iframes.
// Engine (same-origin /engine/): injected directly via contentWindow.
// Moosic (cross-origin):  receives a postMessage nudge so its own
//   auto-prime fires immediately rather than waiting for its 5s retry.
(function(){
  if(!navigator.mediaDevices)return;
  var _stream=null,_injected=false;
  var CONSTRAINTS={audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,sampleRate:48000,channelCount:1}};

  async function grabOnce(){
    if(_stream&&_stream.active)return;
    try{
      _stream=await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
      window._sharedMicStream=_stream;
      tryInject();
    }catch(e){console.warn('[scada] mic:',e.message)}
  }

  function tryInject(){
    if(!_stream||!_stream.active)return;
    // Engine iframe — same-origin, direct contentWindow access
    var fk=document.getElementById('frame-kon');
    if(fk&&fk.contentWindow&&!_injected){
      fk.contentWindow.__sharedMicStream=_stream;
      if(typeof fk.contentWindow.__onSharedMicStream==='function')fk.contentWindow.__onSharedMicStream(_stream);
      _injected=true;
    }
    // Moosic iframe — cross-origin, postMessage nudge only
    var fm=document.getElementById('frame-mus');
    if(fm&&fm.contentWindow){
      try{fm.contentWindow.postMessage({type:'konomioke-mic-ready'},'*')}catch(e){}
    }
  }

  // Re-attempt injection every 500 ms until the engine iframe is ready
  var injectT=setInterval(function(){if(_injected)clearInterval(injectT);else tryInject()},500);

  function arm(){
    grabOnce();
    if(!_stream)setTimeout(grabOnce,5000);
  }
  window.addEventListener('pointerdown',arm,{capture:true,once:true});
  window.addEventListener('keydown',arm,{capture:true,once:true});
  if(navigator.permissions)navigator.permissions.query({name:'microphone'}).then(function(p){if(p.state==='granted')grabOnce()}).catch(function(){});
  // Background retry in case gesture fires before getUserMedia resolves
  setInterval(function(){if(!_stream)grabOnce()},5000);
})();

setInterval(function(){var c=document.getElementById('clock');if(c)c.textContent=new Date().toLocaleTimeString()},1000);
dashRefresh();setInterval(dashRefresh,60000);
