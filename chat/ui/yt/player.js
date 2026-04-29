// yt/player.js — YouTube IFrame Player API
var YTP={player:null,ready:false,state:'idle',vid:null,startedAt:0,pending:null};

function ytpInit(){
  if(window.YT&&window.YT.Player){_ytpBuild();return}
  var tag=document.createElement('script');
  tag.src='https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady=_ytpBuild;
}

function _ytpBuild(){
  var el=document.getElementById('yt-embed');if(!el)return;
  el.innerHTML='<div id="yt-player-div"></div>';
  YTP.player=new YT.Player('yt-player-div',{
    height:'100%',width:'100%',
    playerVars:{autoplay:0,rel:0,modestbranding:1,playsinline:1},
    events:{
      onReady:function(){
        YTP.ready=true;trace('info','yt player ready','yt');
        // Play anything queued while loading
        if(YTP.pending){var p=YTP.pending;YTP.pending=null;ytpPlay(p.vid,p.seek)}
      },
      onStateChange:function(e){
        if(e.data===YT.PlayerState.PLAYING){YTP.state='playing';_ytpLabel('▶ '+YTP.vid)}
        else if(e.data===YT.PlayerState.PAUSED){YTP.state='paused';_ytpLabel('⏸ '+YTP.vid)}
        else if(e.data===YT.PlayerState.ENDED){YTP.state='ended';_ytpLabel('⏹ ended')}
      }
    }
  });
}

function _ytpLabel(t){var el=document.getElementById('yt-now');if(el)el.textContent=t}

function ytpPlay(vid,seekTo){
  if(!YTP.ready){YTP.pending={vid:vid,seek:seekTo||0};_ytpLabel('⏳ '+vid);return}
  YTP.vid=vid;YTP.state='loading';_ytpLabel('⏳ '+vid);
  YTP.player.loadVideoById({videoId:vid,startSeconds:Math.max(0,seekTo||0)});
  YTP.player.unMute();YTP.player.setVolume(80);
  trace('info','yt play '+vid+(seekTo>0?' @'+Math.floor(seekTo)+'s':''),'yt');
}

function ytpGetTime(){return YTP.player&&YTP.ready&&YTP.player.getCurrentTime?YTP.player.getCurrentTime():0}
