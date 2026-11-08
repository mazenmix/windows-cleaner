/* MX Fuel shared estimated Online Now display. Identical across homepage, News and Daily Cost.
   One deterministic clock, no tab-local random counters or independent timers. */
(() => {
  'use strict';
  const el = document.getElementById('visitorsNow');
  if (!el) return;
  const formatter = new Intl.NumberFormat('en-US');
  const stepMs = 20000;
  const calculate = () => {
    const step = Math.floor(Date.now() / stepMs);
    // Slow, gentle 20-second movement in the existing 15,000–27,000 estimated range.
    const trend = Math.sin(step / 1400);
    const noise = (Math.imul(step ^ 0x6D2B79F5, 2246822519) >>> 0) % 7 - 3;
    return Math.max(15000, Math.min(27000, Math.round(21000 + 5980 * trend + noise)));
  };
  const draw = () => {
    const text = formatter.format(calculate());
    if (el.textContent !== text) el.textContent = text;
  };
  // Also correct older visitors API updates without allowing two counter sources to diverge.
  new MutationObserver(draw).observe(el, { childList: true, characterData: true, subtree: true });
  draw();
  setInterval(draw, 1000);
  window.addEventListener('pageshow', draw);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) draw(); });
})();
