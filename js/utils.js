/* ═══════════════════════════════════════════════════════════
   KONOMIOKE — 好みオケ — JavaScript Engine
   fold(konomioke) = 2 × 3 × 5 × 7 × 11 × 13 × 17 = 510,510
   ═══════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes.buffer;
}

function shortId(hex) {
  return hex.slice(0, 8) + hex.slice(-6);
}

function peerColor(pubkeyHex) {
  let h = 0;
  for (let i = 0; i < 8; i++) h = (h * 31 + pubkeyHex.charCodeAt(i)) & 0xffffff;
  return `hsl(${h % 360}, 70%, 60%)`;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────
// p=2  IDENTITY + ROOMS — Ed25519 keypair, IndexedDB
// ─────────────────────────────────────────────────────────
