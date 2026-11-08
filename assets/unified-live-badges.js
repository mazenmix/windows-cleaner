/* Mark compact source freshness notes for the same fixed, visual-only LIVE treatment.
   The original text remains in the DOM for verification/accessibility. */
(() => {
  'use strict';
  const selector = '.fx-provider-note, #fxChecked, #costGrid .card-foot .checked';
  const isSourceStatus = text => /\b(?:last\s*verified|live\s*\d+\s*[•|·]\s*last\s*verified)\b/i.test(text);
  let queued = false;
  function mark() {
    queued = false;
    document.querySelectorAll(selector).forEach(el => {
      const text = (el.textContent || '').trim();
      if (isSourceStatus(text) && !el.classList.contains('mx-visual-live-note')) {
        el.classList.add('mx-visual-live-note');
      }
    });
  }
  function schedule() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(mark);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else schedule();
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true, characterData: true, subtree: true
  });
})();
