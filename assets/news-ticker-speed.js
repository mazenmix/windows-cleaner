/* Keep Breaking News scrolling at a stable visual speed on the first load and refresh. */
(() => {
  'use strict';
  const track = document.getElementById('tickerMove');
  if (!track) return;
  let previousSignature = '';
  let pending = false;
  const recalculate = () => {
    pending = false;
    const items = track.querySelectorAll('.ticker-item');
    const text = track.textContent || '';
    const loading = /loading latest|checking.*headline|connecting.*feed/i.test(text);
    const width = track.scrollWidth;
    const viewport = track.parentElement?.clientWidth || 0;
    if (!items.length || loading || width <= 0 || viewport <= 0) {
      track.style.animation = 'none';
      track.style.webkitAnimation = 'none';
      previousSignature = '';
      return;
    }
    const signature = text + '|' + width + '|' + viewport;
    if (signature === previousSignature) return;
    previousSignature = signature;
    // Existing ticker data duplicates the stories for a seamless -50% loop.
    // Size the duration to the traveled pixels, rather than a fixed 14 seconds.
    const distance = width / 2;
    const duration = Math.max(26, Math.min(240, distance / 43));
    const animation = 'scroll ' + duration.toFixed(2) + 's linear infinite';
    const prefersLessMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.style.animation = prefersLessMotion ? 'none' : animation;
    track.style.webkitAnimation = prefersLessMotion ? 'none' : animation;
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(recalculate);
  };
  // Loading placeholder never races across the screen.
  track.style.animation = 'none';
  track.style.webkitAnimation = 'none';
  new MutationObserver(schedule).observe(track, { childList: true, characterData: true, subtree: true });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(schedule).observe(track.parentElement);
  }
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  schedule();
})();
