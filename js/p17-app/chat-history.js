// chat-history.js — rolling 10-message buffer, persisted as _chat tag
var CHAT_BUF = { messages: [], room: null, maxMessages: 10 };

function chatPush(author, text, color, room) {
  CHAT_BUF.room = room || CHAT_BUF.room || 'KONOMI';
  CHAT_BUF.messages.push({
    from: author, text: text, color: color || '#8898b4',
    ts: new Date().toISOString()
  });
  if (CHAT_BUF.messages.length > CHAT_BUF.maxMessages) {
    CHAT_BUF.messages = CHAT_BUF.messages.slice(-CHAT_BUF.maxMessages);
  }
  saveChatTag();
}

function saveChatTag() {
  var tag = {
    tag_id: '_chat',
    room: CHAT_BUF.room,
    messages: CHAT_BUF.messages,
    updated: new Date().toISOString()
  };
  try {
    var ctrl = new AbortController();
    setTimeout(function() { ctrl.abort() }, 3000);
    fetch('https://onlybrains.onrender.com/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ key: 'konomioke-chat-' + CHAT_BUF.room, message: JSON.stringify(tag), role: 'system' })
    }).catch(function() {});
  } catch (e) {}
}

async function loadChatHistory(room) {
  CHAT_BUF.room = room || 'KONOMI';
  try {
    var ctrl = new AbortController();
    setTimeout(function() { ctrl.abort() }, 3000);
    var r = await fetch('https://api.github.com/repos/teslasolar/konomioke/issues?labels=konomi-config&state=open&per_page=50',
      { headers: { Accept: 'application/vnd.github+json' }, signal: ctrl.signal });
    var data = await r.json();
    var issues = Array.isArray(data) ? data : [];
    for (var iss of issues) {
      var m = iss.body?.match(/```json\s*([\s\S]*?)```/);
      if (!m) continue;
      try {
        var tag = JSON.parse(m[1]);
        if (tag.tag_id === '_chat' && tag.room === CHAT_BUF.room) {
          if (tag.maxMessages) CHAT_BUF.maxMessages = tag.maxMessages;
          CHAT_BUF.messages = (tag.messages || []).slice(-CHAT_BUF.maxMessages);
          return CHAT_BUF.messages;
        }
      } catch (e) {}
    }
  } catch (e) {}
  return [];
}
