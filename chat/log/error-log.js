// error-log.js — captures console errors, writes to _errors tag via BroadcastChannel
var ERR_LOG={errors:[],maxErrors:20,bc:null};

(function(){
  ERR_LOG.bc=new BroadcastChannel('konomi-errors');
  var origError=console.error;
  console.error=function(){
    origError.apply(console,arguments);
    var msg=Array.from(arguments).map(function(a){return String(a)}).join(' ').slice(0,200);
    pushError('error',msg)};
  window.addEventListener('error',function(e){
    pushError('uncaught',e.message?.slice(0,200)+' @ '+e.filename?.split('/').pop()+':'+e.lineno)});
  window.addEventListener('unhandledrejection',function(e){
    pushError('promise',String(e.reason).slice(0,200))});
})();

function pushError(type,msg){
  var entry={type:type,msg:msg,ts:new Date().toISOString(),page:'chat'};
  ERR_LOG.errors.push(entry);
  if(ERR_LOG.errors.length>ERR_LOG.maxErrors)ERR_LOG.errors=ERR_LOG.errors.slice(-ERR_LOG.maxErrors);
  // Show in chat
  if(typeof addMsg==='function')addMsg(null,'⚠ '+type+': '+msg.slice(0,80),null,true);
  // Broadcast to other tabs
  if(ERR_LOG.bc)try{ERR_LOG.bc.postMessage({type:'error-log',errors:ERR_LOG.errors})}catch(e){}
}

function getErrorLog(){return ERR_LOG.errors}
