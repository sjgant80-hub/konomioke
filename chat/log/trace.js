// trace.js — structured logging that pipes to error tag + chat + BroadcastChannel
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
  if(typeof addMsg==='function'&&level!=='debug'){
    var color=level==='error'?'#ff4466':level==='warn'?'#f0a030':level==='state'?'#42e898':'#3a4860';
    addMsg(null,entry.ts+' '+entry.module+' '+entry.msg,color,true)}
  if(TRACE.bc)try{TRACE.bc.postMessage(entry)}catch(e){}
  if(level==='error'&&typeof pushError==='function')pushError('trace',msg);
}

function traceState(from,to,module){
  TRACE.states.push({from:from,to:to,module:module||'chat',ts:new Date().toISOString()});
  trace('state',from+' → '+to,module);
  if(typeof highlightState==='function')highlightState(to);
}

function getTrace(){return TRACE.entries}
function getStateLog(){return TRACE.states}
