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

// Mic permission priming for engine iframe
(function(){
  if(!navigator.mediaDevices)return;var granted=false;
  async function prime(){if(granted)return;
    try{var s=await navigator.mediaDevices.getUserMedia({audio:true});
      s.getTracks().forEach(function(t){t.stop()});granted=true}catch(e){}}
  function arm(){prime();if(!granted)setTimeout(prime,5000)}
  window.addEventListener('pointerdown',arm,{capture:true,once:true});
  window.addEventListener('keydown',arm,{capture:true,once:true});
  if(navigator.permissions)navigator.permissions.query({name:'microphone'}).then(function(p){if(p.state==='granted')prime()}).catch(function(){});
})();

setInterval(function(){var c=document.getElementById('clock');if(c)c.textContent=new Date().toLocaleTimeString()},1000);
dashRefresh();setInterval(dashRefresh,60000);
