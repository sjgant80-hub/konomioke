// tabs.js — chat panel tab switching
var _chatTab='msgs';
function switchChatTab(t){
  _chatTab=t;
  var tabs=document.querySelectorAll('.chat-tab');
  var panes=document.querySelectorAll('.chat-pane');
  for(var i=0;i<tabs.length;i++)tabs[i].className='chat-tab'+(tabs[i].dataset.tab===t?' active':'');
  for(var i=0;i<panes.length;i++)panes[i].style.display=panes[i].id===t?'block':'none';
}
