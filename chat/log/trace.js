// trace.js — structured logging to log pane + state pane + BroadcastChannel
var TRACE={entries:[],max:50,bc:null,states:[]};

(function(){
  TRACE.bc=new BroadcastChannel('konomi-trace');
  var origWarn=console.warn;
  console.warn=function(){origWarn.apply(console,arguments);
    trace('warn',Array.from(arguments).map(String).join(' ').slice(0,200))};
})();

function trace(level,msg,module){
  var entry={level:level||'info',msg:msg,module:module||'chat',ts:new Date().toISOString().slice(11,23)};
  TRACE.entries.push(entry);
  if(TRACE.entries.length>TRACE.max)TRACE.entries=TRACE.entries.slice(-TRACE.max);
  console.log('['+entry.module+'] '+entry.level+': '+entry.msg);
  // Write to log pane
  var logPane=document.getElementById('logs');
  if(logPane){
    var div=document.createElement('div');
    div.className='log-entry'+(level==='warn'?' warn':level==='error'?' error':level==='state'?' state':'');
    div.textContent=entry.ts+' ['+entry.module+'] '+entry.msg;
    logPane.appendChild(div);logPane.scrollTop=logPane.scrollHeight;
    while(logPane.children.length>100)logPane.removeChild(logPane.firstChild)}
  if(TRACE.bc)try{TRACE.bc.postMessage(entry)}catch(e){}
  if(level==='error'&&typeof pushError==='function')pushError('trace',msg);
}

function traceState(from,to,module){
  TRACE.states.push({from:from,to:to,module:module||'chat',ts:new Date().toISOString()});
  trace('state',from+' → '+to,module);
  if(typeof highlightState==='function')highlightState(to);
  // Write to state pane
  var statePane=document.getElementById('state');
  if(statePane){
    var div=document.createElement('div');div.className='state-entry';
    div.innerHTML='<span class="mod">'+module+'</span><span class="from">'+from+'</span><span class="arrow">→</span><span class="to">'+to+'</span>';
    statePane.appendChild(div);statePane.scrollTop=statePane.scrollHeight}
}

function getTrace(){return TRACE.entries}
function getStateLog(){return TRACE.states}
