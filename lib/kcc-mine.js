/**
 * KCC Mining via Singing — Proof of Voice Work
 *
 * Singing IS mining. When group coherence exceeds φ (0.618),
 * the session mines KCC tokens. Higher coherence = more reward.
 *
 * Hooks into AudioFabricEngine's analysis loop.
 * Reports to OnlyBrains API for chain anchoring.
 */
const API = 'https://onlybrains.onrender.com';
const PHI = 0.6180339887498949;
const MINE_INTERVAL_MS = 10000;
const MIN_COHERENCE = 0.3;

let _key = localStorage.getItem('kono-key');
if (!_key) {
  _key = 'singer-' + Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem('kono-key', _key);
}

let lastMineTime = 0;
let sessionKcc = 0;
let sessionBlocks = 0;

export function getSessionStats() {
  return { kcc: sessionKcc, blocks: sessionBlocks, key: _key };
}

export async function tryMine(fabric) {
  const now = Date.now();
  if (now - lastMineTime < MINE_INTERVAL_MS) return null;
  if (!fabric || fabric.coherence < MIN_COHERENCE) return null;

  lastMineTime = now;

  const reward = calcReward(fabric);
  if (reward <= 0) return null;

  const problem = buildProof(fabric);

  try {
    const r = await fetch(API + '/api/sing?key=' + _key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof: problem, key: _key }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await r.json();
    sessionKcc += reward;
    sessionBlocks++;
    return { reward, block: data.block, kono: data.$KONO, coherence: fabric.coherence };
  } catch { return null; }
}

function calcReward(fabric) {
  const c = fabric.coherence;
  const v = fabric.vagalTone;
  const psi = fabric.psiLevel;

  if (psi >= PHI) return 4;
  if (c >= PHI) return 3;
  if (c >= 0.5) return 2;
  if (c >= MIN_COHERENCE) return 1;
  return 0;
}

function buildProof(fabric) {
  return `PoVW|coherence=${fabric.coherence.toFixed(4)}`
    + `|vagal=${fabric.vagalTone.toFixed(4)}`
    + `|psi=${fabric.psiLevel.toFixed(4)}`
    + `|mode=${fabric.mode}`
    + `|exhale=${fabric.exhaleRatio.toFixed(3)}`
    + `|rings=${Array.from(fabric.compositeRings).map(r => r.toFixed(2)).join(',')}`;
}

export async function getWallet() {
  try {
    const r = await fetch(API + '/api/wallet?key=' + _key, { signal: AbortSignal.timeout(3000) });
    return r.json();
  } catch { return { balance: 0, mined: 0 }; }
}

export async function getChain() {
  try {
    const r = await fetch(API + '/api/chain', { signal: AbortSignal.timeout(3000) });
    return r.json();
  } catch { return { height: 0 }; }
}
