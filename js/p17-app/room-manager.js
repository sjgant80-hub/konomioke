// room-manager.js — KONOMI default room with 8-user cap + FIFO overflow
// Tracks rooms via GitHub Issue tags (konomi-config label)
var ROOM_MGR = {
  MAX_PER_ROOM: 8,
  BASE_NAME: 'KONOMI',
  rooms: [],
  myRoom: null,
  repo: 'teslasolar/konomioke',
  label: 'konomi-config'
};

async function fetchRoomTags() {
  try {
    var r = await fetch('https://api.github.com/repos/' + ROOM_MGR.repo + '/issues?labels=' + ROOM_MGR.label + '&state=open&per_page=50',
      { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(5000) });
    var issues = await r.json();
    ROOM_MGR.rooms = [];
    for (var iss of issues) {
      var m = iss.body?.match(/```json\s*([\s\S]*?)```/);
      if (!m) continue;
      try {
        var tag = JSON.parse(m[1]);
        if (tag.tag_id === '_rooms') { ROOM_MGR.rooms = tag.rooms || []; return tag; }
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

function findAvailableRoom() {
  // Find first room with space
  for (var i = 0; i < ROOM_MGR.rooms.length; i++) {
    var rm = ROOM_MGR.rooms[i];
    if ((rm.users || []).length < ROOM_MGR.MAX_PER_ROOM) return rm;
  }
  return null;
}

function createRoomName() {
  if (ROOM_MGR.rooms.length === 0) return ROOM_MGR.BASE_NAME;
  // FIFO: next sequential name
  var max = 1;
  for (var rm of ROOM_MGR.rooms) {
    var m = rm.name.match(/^KONOMI-?(\d*)$/);
    if (m) { var n = m[1] ? parseInt(m[1]) : 1; if (n >= max) max = n + 1; }
  }
  return ROOM_MGR.BASE_NAME + '-' + max;
}

function buildRoomEntry(name, userId, displayName) {
  return { name: name, code: name, users: [{ id: userId.slice(0, 16), name: displayName, joined: new Date().toISOString() }], created: new Date().toISOString() };
}

async function joinDefaultRoom(userId, displayName) {
  await fetchRoomTags();
  var room = findAvailableRoom();
  if (room) {
    room.users = room.users || [];
    room.users.push({ id: userId.slice(0, 16), name: displayName, joined: new Date().toISOString() });
    ROOM_MGR.myRoom = room.name;
    await saveRoomTags();
    return room.name;
  }
  // All full or none exist — create new
  var name = createRoomName();
  var entry = buildRoomEntry(name, userId, displayName);
  ROOM_MGR.rooms.push(entry);
  ROOM_MGR.myRoom = name;
  // Prune empty rooms (FIFO cleanup)
  ROOM_MGR.rooms = ROOM_MGR.rooms.filter(function(rm) { return (rm.users || []).length > 0; });
  await saveRoomTags();
  return name;
}

async function leaveDefaultRoom(userId) {
  if (!ROOM_MGR.myRoom) return;
  for (var rm of ROOM_MGR.rooms) {
    if (rm.name === ROOM_MGR.myRoom) {
      rm.users = (rm.users || []).filter(function(u) { return u.id !== userId.slice(0, 16); });
      break;
    }
  }
  // Prune empty
  ROOM_MGR.rooms = ROOM_MGR.rooms.filter(function(rm) { return (rm.users || []).length > 0; });
  ROOM_MGR.myRoom = null;
  await saveRoomTags();
}

async function saveRoomTags() {
  var tag = { tag_id: '_rooms', max_per_room: ROOM_MGR.MAX_PER_ROOM, rooms: ROOM_MGR.rooms, updated: new Date().toISOString() };
  try {
    await fetch('https://onlybrains.onrender.com/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'konomioke-rooms', message: JSON.stringify(tag), role: 'system' })
    });
  } catch (e) {}
}
