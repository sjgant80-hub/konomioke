/**
 * KONOMIOKE Signaling Server
 * 好みオケ — The ONE centralized piece.
 *
 * Lightweight WebSocket relay for WebRTC handshake ONLY.
 * Sees nothing but "peer A wants to talk to peer B."
 * Anyone can run one.
 */

const { WebSocketServer } = require('ws');
const http = require('http');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT, 10) || 3000;

const server = http.createServer((req, res) => {
  // CORS + COOP/COEP headers for SharedArrayBuffer support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size, peers: wss.clients.size }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

// Room registry: roomCode -> Set<ws>
const rooms = new Map();

wss.on('connection', (ws) => {
  ws.id = crypto.randomUUID();
  ws.peerId = null;
  ws.roomCode = null;
  ws.isAlive = true;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {

      // ── JOIN ROOM ──────────────────────────────────────────
      case 'join': {
        if (!msg.room || !msg.peerId) return;

        ws.peerId = msg.peerId;
        ws.roomCode = msg.room;
        ws.displayName = msg.displayName || 'Anonymous';

        if (!rooms.has(msg.room)) {
          rooms.set(msg.room, new Set());
        }
        const room = rooms.get(msg.room);
        room.add(ws);

        // Tell joiner about existing peers
        const existingPeers = [];
        for (const peer of room) {
          if (peer !== ws && peer.readyState === 1) {
            existingPeers.push({ peerId: peer.peerId, displayName: peer.displayName });
          }
        }
        ws.send(JSON.stringify({
          type: 'room-peers',
          peers: existingPeers,
          roomCode: msg.room
        }));

        // Tell existing peers about new joiner
        for (const peer of room) {
          if (peer !== ws && peer.readyState === 1) {
            peer.send(JSON.stringify({
              type: 'peer-joined',
              peerId: ws.peerId,
              displayName: ws.displayName
            }));
          }
        }

        console.log(`[${msg.room}] ${ws.displayName} (${ws.peerId.slice(0, 8)}) joined. Room size: ${room.size}`);
        break;
      }

      // ── WEBRTC SIGNALING ───────────────────────────────────
      case 'signal': {
        if (!ws.roomCode || !msg.target) return;
        const room = rooms.get(ws.roomCode);
        if (!room) return;

        for (const peer of room) {
          if (peer.peerId === msg.target && peer.readyState === 1) {
            peer.send(JSON.stringify({
              type: 'signal',
              from: ws.peerId,
              signal: msg.signal
            }));
            break;
          }
        }
        break;
      }

      // ── ROOM STATE BROADCAST ──────────────────────────────
      case 'state': {
        if (!ws.roomCode) return;
        const room = rooms.get(ws.roomCode);
        if (!room) return;

        for (const peer of room) {
          if (peer !== ws && peer.readyState === 1) {
            peer.send(JSON.stringify({
              type: 'state',
              from: ws.peerId,
              state: msg.state
            }));
          }
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (ws.roomCode && rooms.has(ws.roomCode)) {
      const room = rooms.get(ws.roomCode);
      room.delete(ws);

      // Notify remaining peers
      for (const peer of room) {
        if (peer.readyState === 1) {
          peer.send(JSON.stringify({
            type: 'peer-left',
            peerId: ws.peerId
          }));
        }
      }

      console.log(`[${ws.roomCode}] ${ws.peerId ? ws.peerId.slice(0, 8) : '?'} left. Room size: ${room.size}`);

      // Clean up empty rooms
      if (room.size === 0) {
        rooms.delete(ws.roomCode);
        console.log(`[${ws.roomCode}] Room dissolved.`);
      }
    }
  });

  ws.on('error', (err) => {
    console.error(`[ws error] ${ws.peerId || ws.id}: ${err.message}`);
  });
});

// Heartbeat: detect dead connections
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`\n好みオケ KONOMIOKE Signaling Server`);
  console.log(`Listening on :${PORT}`);
  console.log(`Rooms: ws://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health\n`);
});
