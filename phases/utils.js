// Shared utilities
export const $ = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);

export function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes.buffer;
}

export function shortId(hex) { return hex.slice(0, 8) + hex.slice(-6); }

export function peerColor(pubkeyHex) {
  let h = 0;
  for (let i = 0; i < 8; i++) h = (h * 31 + pubkeyHex.charCodeAt(i)) & 0xffffff;
  return `hsl(${h % 360}, 70%, 60%)`;
}

export function formatTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

export const RING_COLORS = ['#ff3366', '#ff8833', '#ffcc33', '#33cccc', '#3366ff', '#9933ff', '#ff33cc'];
export const RING_NAMES = ['Diaphragm', 'Larynx', 'Breath', 'Thoracic', 'Nasal', 'Oral', 'Observer'];
export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const PRIMES = [2, 3, 5, 7, 11, 13, 17];
export const PHI = 1.618033988749895;
