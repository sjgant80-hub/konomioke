/**
 * KCC Mining Widget — overlays on the karaoke stage
 * Shows: KCC earned, coherence level, blocks mined, wallet
 */
import { tryMine, getSessionStats, getWallet } from './kcc-mine.js';

let widgetEl = null;

export function injectWidget() {
  widgetEl = document.createElement('div');
  widgetEl.id = 'kcc-widget';
  widgetEl.innerHTML = `
    <div class="kcc-bar">
      <span class="kcc-label">KCC</span>
      <span class="kcc-earned" id="kcc-earned">0</span>
      <span class="kcc-coh" id="kcc-coh">ψ 0.000</span>
      <span class="kcc-status" id="kcc-status">idle</span>
    </div>`;
  document.body.appendChild(widgetEl);

  const style = document.createElement('style');
  style.textContent = `
    #kcc-widget{position:fixed;bottom:60px;right:12px;z-index:9999;pointer-events:none}
    .kcc-bar{background:rgba(6,6,12,0.9);border:1px solid rgba(212,175,55,0.3);border-radius:8px;
      padding:6px 12px;display:flex;gap:10px;align-items:center;font:11px 'JetBrains Mono',monospace;color:#aac}
    .kcc-label{color:#d4af37;font-weight:700;font-size:13px}
    .kcc-earned{color:#22c55e;font-weight:700;font-size:14px}
    .kcc-coh{color:#8b5cf6;font-size:10px}
    .kcc-status{font-size:9px;padding:2px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:1px}
    .kcc-status.mining{color:#d4af37;background:rgba(212,175,55,0.15)}
    .kcc-status.idle{color:#556}
    .kcc-status.mined{color:#22c55e;background:rgba(34,197,94,0.15)}
  `;
  document.head.appendChild(style);
}

export async function tick(fabric) {
  if (!widgetEl || !fabric) return;

  const psi = fabric.psiLevel || 0;
  const coh = fabric.coherence || 0;
  const statusEl = document.getElementById('kcc-status');
  const cohEl = document.getElementById('kcc-coh');

  cohEl.textContent = `ψ ${psi.toFixed(3)}`;

  if (coh >= 0.3) {
    statusEl.textContent = 'mining';
    statusEl.className = 'kcc-status mining';
  } else {
    statusEl.textContent = 'idle';
    statusEl.className = 'kcc-status idle';
  }

  const result = await tryMine(fabric);
  if (result) {
    const stats = getSessionStats();
    document.getElementById('kcc-earned').textContent = stats.kcc;
    statusEl.textContent = `+${result.reward} KCC`;
    statusEl.className = 'kcc-status mined';
    setTimeout(() => {
      statusEl.textContent = 'mining';
      statusEl.className = 'kcc-status mining';
    }, 3000);
  }
}
