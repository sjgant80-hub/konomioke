// chat.js — standalone chat page using BroadcastChannel via poll-signal
var CHAT = { myId: 'chat-' + Math.random().toString(36).slice(2, 10), room: 'KONOMI' };

function getNick() { return document.getElementById('nick').value.trim() || CHAT.myId.slice(0, 8) }
function ts() { return new Date().toLocaleTimeString() }

function addMsg(author, text, color, system) {
  var el = document.getElementById('msgs');
  var div = document.createElement('div');
  div.className = 'msg' + (system ? ' sys' : '');
  if (system) {
    div.innerHTML = '<span class="ts">' + ts() + '</span>' + text;
  } else {
    div.innerHTML = '<span class="ts">' + ts() + '</span><span class="author" style="color:' + (color || '#8898b4') + '">' + esc(author) + ':</span>' + esc(text);
  }
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  while (el.children.length > 200) el.removeChild(el.firstChild);
}

function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML }

function sendChat() {
  var input = document.getElementById('chat-in');
  var text = input.value.trim();
  if (!text) return;
  var nick = getNick();
  var color = '#' + CHAT.myId.slice(-6).replace(/[^0-9a-f]/g, 'a');
  addMsg(nick, text, color);
  pollSignalSend({ type: 'chat', from: nick, text: text, color: color });
  input.value = '';
  input.focus();
}

// Wire up poll-signal callbacks
window._onPollPeerJoin = function(pid, name) {
  addMsg(null, (name || pid.slice(0, 8)) + ' joined', null, true);
  updatePeers();
};
window._onPollPeerLeave = function(pid) {
  addMsg(null, pid.slice(0, 8) + ' left', null, true);
  updatePeers();
};
window._onPollChat = function(d) {
  addMsg(d.from || '?', d.text, d.color);
};

function updatePeers() {
  var n = typeof getPollPeerCount === 'function' ? getPollPeerCount() : 0;
  var el = document.getElementById('peers');
  if (el) el.textContent = '👥 ' + (n + 1);
}
setInterval(updatePeers, 2000);
