// yt/player.js — YouTube IFrame Player API wrapper
var YTP={player:null,ready:false,state:'idle',vid:null,startedAt:0};
// States: idle → loading → playing → paused → ended

function ytpInit(){
  if(window.YT&&window.YT.Player){_ytpCreate();return}
  var tag=document.createElement('script');
  tag.src='https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady=_ytpCreate;
}

function _ytpCreate(){
  var el=document.getElementById('yt-embed');if(!el)return;
  el.innerHTML='<div id="yt-player-div"></div>';
  YTP.player=new YT.Player('yt-player-div',{
    height:'100%',width:'100%',
    playerVars:{autoplay:0,rel:0,modestbranding:1,playsinline:1},
    events:{
      onReady:function(){YTP.ready=true;trace('info','yt: player ready','yt');_ytpSetState('idle')},
      onStateChange:function(e){
        if(e.data===YT.PlayerState.PLAYING)_ytpSetState('playing');
        else if(e.data===YT.PlayerState.PAUSED)_ytpSetState('paused');
        else if(e.data===YT.PlayerState.ENDED)_ytpSetState('ended');
      }
    }
  });
}

function _ytpSetState(s){
  YTP.state=s;
  trace('debug','yt state: '+s,'yt');
  var now=document.getElementById('yt-now');
  if(now){
    if(s==='playing')now.textContent='▶ '+YTP.vid;
    else if(s==='paused')now.textContent='⏸ '+YTP.vid;
    else if(s==='ended')now.textContent='⏹ ended';
    else if(s==='loading')now.textContent='⏳ loading...';
    else now.textContent='';
  }
}

function ytpPlay(vid,seekTo){
  if(!YTP.ready){
    // Queue until ready
    var _w=setInterval(function(){if(YTP.ready){clearInterval(_w);ytpPlay(vid,seekTo)}},500);
    setTimeout(function(){clearInterval(_w)},30000);
    _ytpSetState('loading');
    return;
  }
  YTP.vid=vid;
  _ytpSetState('loading');
  YTP.player.loadVideoById({videoId:vid,startSeconds:Math.max(0,seekTo||0)});
  YTP.player.unMute();
  YTP.player.setVolume(80);
  trace('info','yt: playing '+vid+(seekTo>0?' @'+Math.floor(seekTo)+'s':''),'yt');
}

function ytpSeek(seconds){
  if(YTP.player&&YTP.ready)YTP.player.seekTo(seconds,true);
}

function ytpGetTime(){
  if(YTP.player&&YTP.ready&&typeof YTP.player.getCurrentTime==='function')return YTP.player.getCurrentTime();
  return 0;
}
