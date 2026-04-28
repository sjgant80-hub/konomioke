// room-manager.js — KONOMI default room with 8-user cap + FIFO overflow
var ROOM_MGR = {
  MAX_PER_ROOM: 8,
  BASE_NAME: 'KONOMI',
  rooms: [],
  myRoom: null,
  repo: 'teslasolar/konomioke',
  label: 'konomi-config'
};

function _timeout(ms) { return new Promise(function(_, rej) { setTimeout(function() { rej(new Error('timeout')) }, ms) }) }

async function fetchRoomTags() {
  try {
    var ctrl = new AbortController();
    var tid = setTimeout(function() { ctrl.abort() }, 3000);
    var r = await fetch('https://api.github.com/repos/' + ROOM_MGR.repo + '/issues?labels=' + ROOM_MGR.label + '&state=open&per_page=50',
      { headers: { Accept: 'application/vnd.github+json' }, signal: ctrl.signal });
    clearTimeout(tid);
    var issues = await r.json();
    for (var iss of issues) {
      var m = iss.body?.match(/```json\s*([\s\S]*?)```/);
      if (!m) continue;
      try {
        var tag = JSON.parse(m[1]);
        if (tag.tag_id === '_rooms') { ROOM_MGR.rooms = tag.rooms || []; return; }
      } catch (e) {}
    }
  } catch (e) {}
}

function findAvailableRoom() {
  for (var i = 0; i < ROOM_MGR.rooms.length; i++) {
    if ((ROOM_MGR.rooms[i].users || []).length < ROOM_MGR.MAX_PER_ROOM) return ROOM_MGR.rooms[i];
  }
  return null;
}

function createRoomName() {
  if (ROOM_MGR.rooms.length === 0) return ROOM_MGR.BASE_NAME;
  var max = 1;
  for (var rm of ROOM_MGR.rooms) {
    var n = rm.name === 'KONOMI' ? 1 : parseInt((rm.name.match(/(\d+)$/) || [])[1] || '0');
    if (n >= max) max = n + 1;
  }
  return ROOM_MGR.BASE_NAME + '-' + max;
}

async function joinDefaultRoom(userId, displayName) {
  // Hard 3s race — never block boot longer than this
  try {
    await Promise.race([fetchRoomTags(), _timeout(3000)]);
  } catch (e) {}
  var room = findAvailableRoom();
  if (room) {
    room.users = room.users || [];
    room.users.push({ id: userId.slice(0, 16), name: displayName, joined: new Date().toISOString() });
    ROOM_MGR.myRoom = room.name;
  } else {
    var name = createRoomName();
    ROOM_MGR.rooms.push({ name: name, code: name, users: [{ id: userId.slice(0, 16), name: displayName, joined: new Date().toISOString() }], created: new Date().toISOString() });
    ROOM_MGR.myRoom = name;
  }
  ROOM_MGR.rooms = ROOM_MGR.rooms.filter(function(rm) { return (rm.users || []).length > 0 });
  saveRoomTags();
  return ROOM_MGR.myRoom;
}

async function leaveDefaultRoom(userId) {
  if (!ROOM_MGR.myRoom) return;
  for (var rm of ROOM_MGR.rooms) {
    if (rm.name === ROOM_MGR.myRoom) {
      rm.users = (rm.users || []).filter(function(u) { return u.id !== userId.slice(0, 16) });
      break;
    }
  }
  ROOM_MGR.rooms = ROOM_MGR.rooms.filter(function(rm) { return (rm.users || []).length > 0 });
  ROOM_MGR.myRoom = null;
  saveRoomTags();
}

function saveRoomTags() {
  var tag = { tag_id: '_rooms', max_per_room: ROOM_MGR.MAX_PER_ROOM, rooms: ROOM_MGR.rooms, updated: new Date().toISOString() };
  try {
    var ctrl = new AbortController();
    setTimeout(function() { ctrl.abort() }, 3000);
    fetch('https://onlybrains.onrender.com/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ key: 'konomioke-rooms', message: JSON.stringify(tag), role: 'system' })
    }).catch(function() {});
  } catch (e) {}
}
