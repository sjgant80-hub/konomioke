// kanji.js — phoneme → kanji mapping + texture generation
var KANJI={ah:{char:'火',name:'Fire',reading:'HI',color:'#ff4444',hex:0xff4444,blast:'kamehameha'},
  ee:{char:'雷',name:'Lightning',reading:'RAI',color:'#ffdd00',hex:0xffdd00,blast:'finalflash'},
  oh:{char:'気',name:'Spirit',reading:'KI',color:'#ffffff',hex:0xffffff,blast:'spiritbomb'},
  oo:{char:'水',name:'Water',reading:'SUI',color:'#aa44ff',hex:0xaa44ff,blast:'galickgun'},
  eh:{char:'風',name:'Wind',reading:'FŪ',color:'#ff8844',hex:0xff8844,blast:'barrage'},
  mm:{char:'土',name:'Earth',reading:'DO',color:'#44ffaa',hex:0x44ffaa,blast:'kiball'}};
var kanjiTex={},kanjiGlow={};
var PHONEMES={ah:{label:'AH',color:'#ff4444',power:0},ee:{label:'EE',color:'#ffdd00',power:0},
  oh:{label:'OH',color:'#ffffff',power:0},oo:{label:'OO',color:'#aa44ff',power:0},
  eh:{label:'EH',color:'#ff8844',power:0},mm:{label:'MM',color:'#44ffaa',power:0}};
var PH_KEYS=Object.keys(PHONEMES);
var BLAST_TYPES={kiball:{color:0x44ffaa,name:'土 Earth',dmgMul:1,speed:0.8,size:0.25,vowel:'mm'},
  kamehameha:{color:0xff4444,name:'火 KAME',dmgMul:3,speed:0.5,size:0.4,vowel:'ah'},
  finalflash:{color:0xffdd00,name:'雷 FLASH',dmgMul:2.5,speed:0.6,size:0.35,vowel:'ee'},
  spiritbomb:{color:0xffffff,name:'気 SPIRIT',dmgMul:5,speed:0.2,size:0.8,vowel:'oh'},
  galickgun:{color:0xaa44ff,name:'水 GALICK',dmgMul:2,speed:0.55,size:0.35,vowel:'oo'},
  barrage:{color:0xff8844,name:'風 BARRAGE',dmgMul:0.4,speed:1.2,size:0.15,vowel:'eh'}};
function initKanjiTex(){Object.keys(KANJI).forEach(function(k){var kj=KANJI[k];
  var c=document.createElement('canvas');c.width=256;c.height=256;var x=c.getContext('2d');
  x.shadowColor=kj.color;x.shadowBlur=40;x.fillStyle=kj.color;x.font='bold 150px serif';x.textAlign='center';x.textBaseline='middle';
  x.fillText(kj.char,128,128);x.shadowBlur=0;x.fillStyle='#fff';x.fillText(kj.char,128,128);kanjiTex[k]=new THREE.CanvasTexture(c);
  var g=document.createElement('canvas');g.width=128;g.height=128;var gx=g.getContext('2d');
  gx.shadowColor=kj.color;gx.shadowBlur=30;gx.fillStyle=kj.color;gx.font='bold 80px serif';gx.textAlign='center';gx.textBaseline='middle';
  gx.fillText(kj.char,64,64);kanjiGlow[k]=new THREE.CanvasTexture(g)});}
