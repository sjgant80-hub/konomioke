const konomi = new KonomiApp();

// ── KCC MINING LAYER ── singing IS mining (uses shared template)
import('./_kcc/js/kcc-mine.js').then(kcc => {
  kcc.initMiningWidget();
  const tick = () => {
    if (konomi.fabric) kcc.tickMining(konomi.fabric);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}).catch(() => console.warn('KCC mining layer not loaded'));

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
</script>
