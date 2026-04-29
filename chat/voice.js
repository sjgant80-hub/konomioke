// voice.js — mic capture + F0 detection + vowel classification
var audioCtx,analyser,timeData,freqData,SR=44100,FFT=2048;
var voice={rms:0,f0:0,pn:0,f1:0,f2:0,vowel:'',sounding:false,nf:0.01,energy:0,coherence:0,sustain:0,
  prevF0:0,pDelta:0,prevRms:0,lastAmp:0,onsets:[],pulseRate:0,chargeLevel:0};

function initAudio(cb){
  navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}).then(function(s){
    audioCtx=new(window.AudioContext||window.webkitAudioContext)({sampleRate:SR});
    analyser=audioCtx.createAnalyser();analyser.fftSize=FFT;analyser.smoothingTimeConstant=CFG.voice.smoothing||.8;
    timeData=new Float32Array(FFT);freqData=new Float32Array(analyser.frequencyBinCount);
    audioCtx.createMediaStreamSource(s).connect(analyser);
    setTimeout(function(){analyser.getFloatTimeDomainData(timeData);var r=0;
      for(var i=0;i<timeData.length;i++)r+=timeData[i]*timeData[i];
      voice.nf=Math.sqrt(r/timeData.length)*(CFG.voice.noiseFloorMul||1.5)+(CFG.voice.noiseFloorBase||.005)},300);
    if(cb)cb()}).catch(function(e){console.warn('mic:',e.message)})}

function analyzeV(){if(!analyser)return;analyser.getFloatTimeDomainData(timeData);analyser.getFloatFrequencyData(freqData);
  var r=0;for(var i=0;i<timeData.length;i++)r+=timeData[i]*timeData[i];r=Math.sqrt(r/timeData.length);
  voice.prevRms=voice.rms;voice.rms=r;voice.sounding=r>voice.nf*2;voice.energy+=(r-voice.energy)*.1;
  voice.prevF0=voice.f0;voice.f0=detectF0(timeData,SR);voice.pn=Math.max(0,Math.min(1,(voice.f0-80)/720));
  if(voice.f0>0&&voice.prevF0>0)voice.pDelta=voice.f0-voice.prevF0;
  if(voice.sounding){voice.sustain+=.016;if(voice.sustain>(CFG.voice.sustainThreshold||.3))voice.coherence=Math.min(1,voice.coherence+(CFG.voice.coherenceGrowth||.01))}
  else{voice.sustain=0;voice.coherence*=(CFG.voice.coherenceDecay||.97)}
  classifyVowel();
  var now=performance.now();if(r>voice.lastAmp*1.8&&r>voice.nf*2)voice.onsets.push(now);
  voice.lastAmp=r;while(voice.onsets.length&&now-voice.onsets[0]>2000)voice.onsets.shift();voice.pulseRate=voice.onsets.length/2}

function detectF0(b,sr){var sz=b.length,bc=0,bl=0,r=0;for(var i=0;i<sz;i++)r+=b[i]*b[i];r=Math.sqrt(r/sz);if(r<voice.nf)return 0;
  var mn=Math.floor(sr/1000),mx=Math.floor(sr/50);for(var lag=mn;lag<mx&&lag<sz;lag++){var c=0;for(var j=0;j<sz-lag;j++)c+=b[j]*b[j+lag];if(c>bc){bc=c;bl=lag}}return bl===0?0:sr/bl}

function classifyVowel(){var bw=SR/(freqData.length*2),sm=new Float32Array(freqData.length);
  for(var i=2;i<freqData.length-2;i++)sm[i]=(freqData[i-2]+freqData[i-1]+freqData[i]+freqData[i+1]+freqData[i+2])/5;
  var peaks=[],lo=Math.floor(200/bw),hi=Math.min(Math.floor(3000/bw),sm.length-1);
  for(var i=lo+1;i<hi-1;i++)if(sm[i]>sm[i-1]&&sm[i]>sm[i+1]&&sm[i]>-60)peaks.push({f:i*bw,m:sm[i]});
  peaks.sort(function(a,b){return b.m-a.m});var f1=peaks.length>=1?peaks[0].f:0,f2=0;
  if(peaks.length>=2)for(var i=1;i<peaks.length;i++)if(Math.abs(peaks[i].f-f1)>200){f2=peaks[i].f;break}
  if(f1>f2&&f2>0){var t=f1;f1=f2;f2=t}voice.f1=f1;voice.f2=f2;voice.vowel='';
  if(f1>0&&f2>0){if(f1<400&&f2>2000)voice.vowel='ee';else if(f1>400&&f1<650&&f2>1600)voice.vowel='eh';
    else if(f1>600&&f2>900&&f2<1500)voice.vowel='ah';else if(f1>350&&f1<600&&f2<1100)voice.vowel='oh';
    else if(f1<400&&f2<1000)voice.vowel='oo';else if(f1<350&&f2<1200)voice.vowel='mm'}}
