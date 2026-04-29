// error-log.js — captures errors → errors pane + badge count
var ERR_LOG={errors:[],maxErrors:20,bc:null};

(function(){
  ERR_LOG.bc=new BroadcastChannel('konomi-errors');
  var origError=console.error;
  console.error=function(){origError.apply(console,arguments);
    var msg=Array.from(arguments).map(function(a){return String(a)}).join(' ').slice(0,200);
    pushError('error',msg)};
  window.addEventListener('error',function(e){
    pushError('uncaught',e.message?.slice(0,200)+' @ '+e.filename?.split('/').pop()+':'+e.lineno)});
  window.addEventListener('unhandledrejection',function(e){
    pushError('promise',String(e.reason).slice(0,200))});
})();

function pushError(type,msg){
  var entry={type:type,msg:msg,ts:new Date().toISOString().slice(11,23),page:'chat'};
  ERR_LOG.errors.push(entry);
  if(ERR_LOG.errors.length>ERR_LOG.maxErrors)ERR_LOG.errors=ERR_LOG.errors.slice(-ERR_LOG.maxErrors);
  var errPane=document.getElementById('errors');
  if(errPane){
    var div=document.createElement('div');div.className='err-entry';
    div.textContent=entry.ts+' ['+entry.type+'] '+entry.msg;
    errPane.appendChild(div);errPane.scrollTop=errPane.scrollHeight;
    while(errPane.children.length>50)errPane.removeChild(errPane.firstChild)}
  var badge=document.getElementById('err-count');
  if(badge)badge.textContent=ERR_LOG.errors.length;
  if(ERR_LOG.bc)try{ERR_LOG.bc.postMessage({type:'error-log',errors:ERR_LOG.errors})}catch(e){}
}

function getErrorLog(){return ERR_LOG.errors}
