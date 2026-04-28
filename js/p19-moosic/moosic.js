// p19-moosic/moosic.js — toggle the moosic iframe panel
(function () {
  function $(id) { return document.getElementById(id); }

  function open()  { var p = $('moosic-panel'); if (p) p.hidden = false; }
  function close() { var p = $('moosic-panel'); if (p) p.hidden = true;  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[data-moosic-open]'))  { e.preventDefault(); open();  return; }
    if (t.closest('[data-moosic-close]')) { e.preventDefault(); close(); return; }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  window.Moosic = { open: open, close: close };
  if (typeof rlog === 'function') rlog('moosic ready');
})();
