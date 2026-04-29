// yt/player.js — YouTube IFrame Player API
var YTP={player:null,ready:false,state:'idle',vid:null,pending:null};

function ytpInit(){
  trace('info','yt: init IFrame API','yt');
  if(window.YT&&window.YT.Player){_ytpBuild();return}
  var s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';
  document.head.appendChild(s);
  window.onYouTubeIframeAPIReady=function(){trace('info','yt: API script loaded','yt');_ytpBuild()};
}

function _ytpBuild(){
  var el=document.getElementById('yt-embed');
  if(!el){trace('warn','yt: #yt-embed missing','yt');return}
  el.innerHTML='<div id="yt-player-div"></div>';
  YTP.player=new YT.Player('yt-player-div',{
    height:'100%',width:'100%',
    playerVars:{autoplay:1,rel:0,modestbranding:1,playsinline:1},
    events:{
      onReady:function(){
        YTP.ready=true;trace('info','yt: PLAYER READY','yt');
        if(YTP.pending){var p=YTP.pending;YTP.pending=null;trace('info','yt: flushing pending '+p.vid,'yt');ytpPlay(p.vid,p.seek)}
      },
      onStateChange:function(e){
        var s=e.data===1?'playing':e.data===2?'paused':e.data===0?'ended':'buf';
        YTP.state=s;trace('debug','yt: state→'+s,'yt');
        var n=document.getElementById('yt-now');
        if(n)n.textContent=(s==='playing'?'▶ ':s==='paused'?'⏸ ':s==='ended'?'⏹ ':'⏳ ')+(YTP.vid||'')
      }
    }
  });
  trace('info','yt: player created','yt');
}

function ytpPlay(vid,seek){
  // Cap seek to 5 min max — if older than that, play from start
  var s=Math.max(0,seek||0);
  if(s>300){trace('info','yt: seek '+Math.floor(s)+'s > 5min, playing from start','yt');s=0}
  trace('info','yt: PLAY '+vid+' @'+Math.floor(s)+'s ready='+YTP.ready,'yt');
  if(!YTP.ready){YTP.pending={vid:vid,seek:s};trace('info','yt: queued (not ready)','yt');return}
  YTP.vid=vid;
  YTP.player.loadVideoById({videoId:vid,startSeconds:s});
  try{YTP.player.unMute();YTP.player.setVolume(80)}catch(e){}
}

function ytpGetTime(){return YTP.player&&YTP.ready&&YTP.player.getCurrentTime?YTP.player.getCurrentTime():0}
