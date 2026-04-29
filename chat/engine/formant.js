// formant.js — custom voice from oscillators, variable tone/pitch/warmth
// Based on kaleidoscope/formant-synth.js — no SpeechSynthesis dependency
var FORMANTS={
  'a':[730,1090,2440],'æ':[660,1720,2410],'e':[530,1840,2480],
  'i':[270,2290,3010],'o':[570,840,2410],'u':[300,870,2240],
  'ə':[500,1500,2500],'ʌ':[640,1190,2390]};
var NOISE_C=new Set(['s','z','f','v','h']);
var STOP_C=new Set(['t','d','p','b','k','g']);
var LETTER_MAP={'a':'æ','e':'e','i':'i','o':'o','u':'ʌ','y':'i',' ':' ','.':'.',',':',','?':'?','!':'!'};

var FSYNTH={ctx:null,master:null,speaking:false,
  f0:185,breathiness:0.15,clarity:0.7,warmth:0.6,speed:80,dest:null};

function initFormant(){
  if(!audioCtx)return;
  FSYNTH.ctx=audioCtx;
  FSYNTH.master=audioCtx.createGain();FSYNTH.master.gain.value=0.35;
  FSYNTH.dest=audioCtx.createMediaStreamDestination();
  FSYNTH.master.connect(audioCtx.destination);
  FSYNTH.master.connect(FSYNTH.dest);
  trace('info','formant synth ready f0='+FSYNTH.f0+'Hz','tts');
}

function textToPhonemes(text){
  var out=[],low=text.toLowerCase();
  for(var i=0;i<low.length;i++){var ch=low[i];
    if(LETTER_MAP[ch])out.push(LETTER_MAP[ch]);
    else if(NOISE_C.has(ch))out.push({type:'noise',ch:ch});
    else if(STOP_C.has(ch))out.push({type:'stop',ch:ch});
    else if(ch.match(/[a-z]/))out.push('ə')}
  return out}

function formantSpeak(text,cb){
  if(FSYNTH.speaking||!FSYNTH.ctx)return;
  FSYNTH.speaking=true;
  var ph=textToPhonemes(text),ctx=FSYNTH.ctx,t=ctx.currentTime+0.05,dur=FSYNTH.speed/1000;
  for(var pi=0;pi<ph.length;pi++){
    var p=ph[pi],isEnd=pi>ph.length-5,f0=FSYNTH.f0*(isEnd?.92:1);
    if(p===' '){t+=dur*.5;continue}if(p==='.'||p==='!'){t+=dur*3;continue}
    if(p==='?'){f0*=1.06;t+=dur*2;continue}if(p===','){t+=dur*1.5;continue}
    if(typeof p==='object'&&p.type==='noise'){_fNoiseAt(t,dur*.6,3000+Math.random()*4000);t+=dur*.5;continue}
    if(typeof p==='object'&&p.type==='stop'){_fClickAt(t,dur*.3);t+=dur*.4;continue}
    var fmts=FORMANTS[p]||FORMANTS['ə'];_fVowelAt(t,dur,f0,fmts);
    if(FSYNTH.breathiness>.1)_fNoiseAt(t,dur,2000,FSYNTH.breathiness*.08);
    t+=dur}
  setTimeout(function(){FSYNTH.speaking=false;if(cb)cb()},(t-ctx.currentTime)*1000+100);
}

function _fVowelAt(t,dur,f0,fmts){var ctx=FSYNTH.ctx;
  var src=ctx.createOscillator();src.type='sawtooth';src.frequency.setValueAtTime(f0,t);
  var merge=ctx.createGain();merge.gain.value=.15*FSYNTH.clarity;
  for(var fi=0;fi<3;fi++){var bp=ctx.createBiquadFilter();bp.type='bandpass';
    bp.frequency.setValueAtTime(fmts[fi],t);bp.Q.value=5+FSYNTH.clarity*10;
    var g=ctx.createGain();g.gain.value=fi===0?1:(fi===1?.7:.4);
    src.connect(bp);bp.connect(g);g.connect(merge)}
  var ls=ctx.createBiquadFilter();ls.type='lowshelf';ls.frequency.value=300;ls.gain.value=FSYNTH.warmth*8;
  merge.connect(ls);var env=ctx.createGain();env.gain.setValueAtTime(0,t);
  env.gain.linearRampToValueAtTime(.2,t+.01);env.gain.setValueAtTime(.2,t+dur-.01);
  env.gain.linearRampToValueAtTime(0,t+dur);ls.connect(env);env.connect(FSYNTH.master);
  src.start(t);src.stop(t+dur+.01)}

function _fNoiseAt(t,dur,freq,vol){var ctx=FSYNTH.ctx;vol=vol||.04;
  var buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate),d=buf.getChannelData(0);
  for(var i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  var src=ctx.createBufferSource();src.buffer=buf;
  var bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=freq;bp.Q.value=2;
  var g=ctx.createGain();g.gain.value=vol;src.connect(bp);bp.connect(g);g.connect(FSYNTH.master);src.start(t)}

function _fClickAt(t,dur){var ctx=FSYNTH.ctx;var o=ctx.createOscillator();o.type='square';
  o.frequency.value=100+Math.random()*200;var g=ctx.createGain();g.gain.setValueAtTime(.1,t);
  g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(FSYNTH.master);o.start(t);o.stop(t+dur)}
