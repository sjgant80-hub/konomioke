import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'node:crypto';

// We'll spawn the server logic inline since it's a single file.
// Extract the server logic into a helper to avoid port conflicts.

function createSignalServer(port) {
  const server = http.createServer((req, res) => {
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
  const rooms = new Map();

  wss.on('connection', (ws) => {
    ws.id = crypto.randomUUID();
    ws.peerId = null;
    ws.roomCode = null;
    ws.isAlive = true;

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      switch (msg.type) {
        case 'join': {
          if (!msg.room || !msg.peerId) return;
          ws.peerId = msg.peerId;
          ws.roomCode = msg.room;
          ws.displayName = msg.displayName || 'Anonymous';

          if (!rooms.has(msg.room)) rooms.set(msg.room, new Set());
          const room = rooms.get(msg.room);
          room.add(ws);

          const existingPeers = [];
          for (const peer of room) {
            if (peer !== ws && peer.readyState === WebSocket.OPEN) {
              existingPeers.push({ peerId: peer.peerId, displayName: peer.displayName });
            }
          }
          ws.send(JSON.stringify({ type: 'room-peers', peers: existingPeers, roomCode: msg.room }));

          for (const peer of room) {
            if (peer !== ws && peer.readyState === WebSocket.OPEN) {
              peer.send(JSON.stringify({ type: 'peer-joined', peerId: ws.peerId, displayName: ws.displayName }));
            }
          }
          break;
        }

        case 'signal': {
          if (!ws.roomCode || !msg.target) return;
          const room = rooms.get(ws.roomCode);
          if (!room) return;
          for (const peer of room) {
            if (peer.peerId === msg.target && peer.readyState === WebSocket.OPEN) {
              peer.send(JSON.stringify({ type: 'signal', from: ws.peerId, signal: msg.signal }));
              break;
            }
          }
          break;
        }

        case 'state': {
          if (!ws.roomCode) return;
          const room = rooms.get(ws.roomCode);
          if (!room) return;
          for (const peer of room) {
            if (peer !== ws && peer.readyState === WebSocket.OPEN) {
              peer.send(JSON.stringify({ type: 'state', from: ws.peerId, state: msg.state }));
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
        for (const peer of room) {
          if (peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify({ type: 'peer-left', peerId: ws.peerId }));
          }
        }
        if (room.size === 0) rooms.delete(ws.roomCode);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({ server, wss, rooms, port });
    });
  });
}

function connectWs(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws, filter) {
  return new Promise((resolve) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw);
      if (!filter || filter(msg)) {
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

describe('Signaling Server', () => {
  let ctx;
  const PORT = 19876;

  beforeAll(async () => {
    ctx = await createSignalServer(PORT);
  });

  afterAll(() => {
    ctx.wss.close();
    ctx.server.close();
  });

  describe('health endpoint', () => {
    it('returns status ok', async () => {
      const res = await fetch(`http://localhost:${PORT}/health`);
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(typeof data.rooms).toBe('number');
      expect(typeof data.peers).toBe('number');
    });

    it('returns 404 for unknown paths', async () => {
      const res = await fetch(`http://localhost:${PORT}/unknown`);
      expect(res.status).toBe(404);
    });
  });

  describe('room join', () => {
    it('returns room-peers on join', async () => {
      const ws = await connectWs(PORT);
      const peerMsg = waitForMessage(ws, m => m.type === 'room-peers');
      ws.send(JSON.stringify({ type: 'join', room: 'test-room-1', peerId: 'peer-a', displayName: 'Alice' }));
      const msg = await peerMsg;
      expect(msg.type).toBe('room-peers');
      expect(msg.peers).toEqual([]);
      expect(msg.roomCode).toBe('test-room-1');
      ws.close();
    });

    it('notifies existing peers when someone joins', async () => {
      const ws1 = await connectWs(PORT);
      const ws2 = await connectWs(PORT);

      // Peer 1 joins
      const joined1 = waitForMessage(ws1, m => m.type === 'room-peers');
      ws1.send(JSON.stringify({ type: 'join', room: 'test-room-2', peerId: 'peer-1', displayName: 'One' }));
      await joined1;

      // Set up listener for peer-joined on ws1 BEFORE ws2 joins
      const peerJoinedPromise = waitForMessage(ws1, m => m.type === 'peer-joined');

      // Peer 2 joins same room
      const joined2 = waitForMessage(ws2, m => m.type === 'room-peers');
      ws2.send(JSON.stringify({ type: 'join', room: 'test-room-2', peerId: 'peer-2', displayName: 'Two' }));

      const [roomPeers, peerJoined] = await Promise.all([joined2, peerJoinedPromise]);

      // Peer 2 sees peer 1 in room-peers
      expect(roomPeers.peers).toHaveLength(1);
      expect(roomPeers.peers[0].peerId).toBe('peer-1');

      // Peer 1 gets notified about peer 2
      expect(peerJoined.peerId).toBe('peer-2');
      expect(peerJoined.displayName).toBe('Two');

      ws1.close();
      ws2.close();
    });
  });

  describe('signaling relay', () => {
    it('relays signal messages between peers', async () => {
      const ws1 = await connectWs(PORT);
      const ws2 = await connectWs(PORT);

      ws1.send(JSON.stringify({ type: 'join', room: 'signal-room', peerId: 'sig-1' }));
      await waitForMessage(ws1, m => m.type === 'room-peers');

      ws2.send(JSON.stringify({ type: 'join', room: 'signal-room', peerId: 'sig-2' }));
      await waitForMessage(ws2, m => m.type === 'room-peers');

      const signalPromise = waitForMessage(ws2, m => m.type === 'signal');
      ws1.send(JSON.stringify({ type: 'signal', target: 'sig-2', signal: { sdp: 'test-offer' } }));

      const msg = await signalPromise;
      expect(msg.from).toBe('sig-1');
      expect(msg.signal.sdp).toBe('test-offer');

      ws1.close();
      ws2.close();
    });
  });

  describe('state broadcast', () => {
    it('broadcasts state to other peers in room', async () => {
      const ws1 = await connectWs(PORT);
      const ws2 = await connectWs(PORT);

      ws1.send(JSON.stringify({ type: 'join', room: 'state-room', peerId: 'st-1' }));
      await waitForMessage(ws1, m => m.type === 'room-peers');
      ws2.send(JSON.stringify({ type: 'join', room: 'state-room', peerId: 'st-2' }));
      await waitForMessage(ws2, m => m.type === 'room-peers');

      const statePromise = waitForMessage(ws2, m => m.type === 'state');
      ws1.send(JSON.stringify({ type: 'state', state: { playing: true, track: 'song.mp3' } }));

      const msg = await statePromise;
      expect(msg.from).toBe('st-1');
      expect(msg.state.playing).toBe(true);

      ws1.close();
      ws2.close();
    });
  });

  describe('peer disconnect', () => {
    it('notifies remaining peers when someone leaves', async () => {
      const ws1 = await connectWs(PORT);
      const ws2 = await connectWs(PORT);

      ws1.send(JSON.stringify({ type: 'join', room: 'leave-room', peerId: 'lv-1' }));
      await waitForMessage(ws1, m => m.type === 'room-peers');
      ws2.send(JSON.stringify({ type: 'join', room: 'leave-room', peerId: 'lv-2' }));
      await waitForMessage(ws2, m => m.type === 'room-peers');

      const leftPromise = waitForMessage(ws1, m => m.type === 'peer-left');
      ws2.close();

      const msg = await leftPromise;
      expect(msg.peerId).toBe('lv-2');

      ws1.close();
    });
  });

  describe('edge cases', () => {
    it('ignores invalid JSON', async () => {
      const ws = await connectWs(PORT);
      ws.send('not json at all {{{');
      // Should not crash — just wait a tick
      await new Promise(r => setTimeout(r, 50));
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it('ignores join without room or peerId', async () => {
      const ws = await connectWs(PORT);
      ws.send(JSON.stringify({ type: 'join' }));
      await new Promise(r => setTimeout(r, 50));
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });
  });
});
