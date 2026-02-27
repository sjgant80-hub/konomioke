# 好みオケ KONOMIOKE

**Peer-to-Peer Therapeutic Karaoke**

`fold(konomioke) = 2 × 3 × 5 × 7 × 11 × 13 × 17 = 510,510`

The mesh is the room. The voice is the controller. The singing is the healing.

---

## What Is It

Konomioke is a peer-to-peer karaoke platform where singing is simultaneously social performance and vagal nerve therapy. No server hosts the room. No algorithm picks the queue. No company owns the stage.

You open a room. Friends join via WebRTC. Someone picks a track. Everyone sings. While you sing, the Audio Fabric vagal phoneme engine analyzes every voice in real-time — mapping phonemes to vagal branches, generating a live visualization of collective nervous system state, and producing prime-tuned harmonic accompaniment that follows the room's vocal energy.

## The Bloom

| Prime | Phase | Purpose |
|-------|-------|---------|
| p=2 | IDENTITY + ROOMS | Ed25519 keypair, room creation/joining, stage management |
| p=3 | P2P MESH | WebRTC direct connections, audio streams, no server |
| p=5 | AUDIO FABRIC | Vagal phoneme detection, 7-ring analysis, therapeutic feedback |
| p=7 | VOCAL PROCESSING | Pitch display, harmony, mixing, vocal isolation |
| p=11 | TRACK + LYRICS | Track loading, LRC lyrics sync, queue system |
| p=13 | VISUALIZATION | 127D vagal orb, per-singer particles, coherence visuals |
| p=17 | LAUNCHER | Boot sequence, room UI, controls, deployment |

## Quick Start

### 1. Start the signaling server

```bash
npm install
npm start
```

The signaling server runs on port 3000. This is the ONE centralized piece — it only relays WebRTC handshake messages.

### 2. Open the app

Open `index.html` in a browser. For full functionality (SharedArrayBuffer for WASM):

```bash
# Serve with required headers
npx serve -l 8080 --cors -c '{"headers":[{"source":"**","headers":[{"key":"Cross-Origin-Opener-Policy","value":"same-origin"},{"key":"Cross-Origin-Embedder-Policy","value":"require-corp"}]}]}'
```

Or simply open `index.html` directly — core features work without special headers.

### 3. Create a room

- Set your display name
- Click **CREATE ROOM**
- Share the room code with friends

### 4. Sing

- Upload a track (MP3, WAV, OGG)
- Import LRC lyrics if available
- Hit play
- Sing

## Tech Stack

- **Single `index.html`** — the complete client
- **`signaling/server.js`** — lightweight WebSocket relay
- **Three.js r128** — 127D vagal orb visualization
- **Web Audio API** — mic input, FFT analysis, mixing, prime drones
- **WebRTC** — peer-to-peer audio streaming
- **Web Crypto API** — Ed25519 identity
- **IndexedDB** — local persistence

## Signal Flow

```
YOUR MIC → AnalyserNode (FFT at 60Hz)
         → Audio Fabric (7 ring vectors per singer)
         → Room composite (weighted average)
         → Prime drones (7 oscillators at p×55Hz)
         → 127D orb visualization
         → WebRTC → other peers (direct audio)
         → Local mix (each listener controls their own)
```

## The Seven Drones

Seven oscillators at prime × 55Hz: 110, 165, 275, 385, 605, 715, 935 Hz. Amplitude follows composite ring activity. The room's collective voice drives the harmonic bed. Felt more than heard.

## Coherence

When room coherence exceeds 0.618 (the golden ratio), the orb pulses gold. Collective singing in tune = collective vagal entrainment. The group heals together.

---

*Open a room. Invite friends. Pick a track. Sing. See the orb respond. Feel the drones. That's konomioke.*
