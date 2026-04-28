const konomi = new KonomiApp();

// ── REMOTE CONFIG ── pull engine settings from GitHub Issues (label: engine-config)
// before boot so toggles render in their configured state.
const _ghCfg = new GhConfig(konomi._ghConfigRepo, konomi._ghConfigLabel);
const _ghPromise = _ghCfg.applyTo(konomi).catch(() => 0);

// ── KCC MINING LAYER ── singing IS mining (uses shared template)
import(new URL('_kcc/js/kcc-mine.js', document.baseURI).href).then(kcc => {
  kcc.initMiningWidget();
  const tick = () => {
    if (konomi.fabric) kcc.tickMining(konomi.fabric);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}).catch(() => console.warn('KCC mining layer not loaded'));

konomi.boot = (function (orig, p) {
  return function () { return p.then(() => orig.call(this)); };
})(konomi.boot, _ghPromise);

// Clean up room state on tab close
window.addEventListener('beforeunload', function() {
  if (typeof leaveDefaultRoom === 'function' && konomi.identity) {
    leaveDefaultRoom(konomi.identity.publicKeyHex || 'anon');
  }
  if (typeof pollSignalLeave === 'function') pollSignalLeave();
});

konomi.boot().catch(err => {
  console.error('KONOMIOKE boot failed:', err);
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#ff2244;font-family:monospace;text-align:center;padding:2rem">
    <div>
      <h1>好みオケ</h1>
      <p>Boot failed: ${err.message}</p>
      <p style="margin-top:1rem;color:#6a6a80;font-size:0.8rem">Check console for details</p>
    </div>
  </div>`;
});
