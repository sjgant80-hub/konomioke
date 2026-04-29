// engine/init.js — wraps scene + sprite init with tracing
function initEngine(){
  trace('info','loading kanji textures','engine');
  initKanjiTex();
  trace('info','building scene','engine');
  initScene();
  trace('info','scene: '+scene.children.length+' objects','engine');
  traceState('config','scene','engine');
  if(typeof spawnLocalSprite==='function'){
    spawnLocalSprite(CHAT.myId,getNick());
    trace('info','sprite spawned: '+CHAT.myId.slice(0,8),'engine');
    traceState('scene','spawn','engine');
  }
  trace('info','starting render loop','engine');
  running=true;animate();
  traceState('spawn','loop','engine');
  initAudio(function(){
    trace('info','mic acquired — voice analysis active','engine');
    traceState('loop','live','engine');
  });
}
