/* Visual-only LIVE treatment for source-freshness labels in any MX Fuel section.
   Underlying verification data, timestamps and stale warnings remain untouched. */
(() => {
  'use strict';
  const candidates = [
    '.fx-provider-note', '#fxChecked', '.card-foot .checked',
    '[class*="status"]', '[class*="Status"]', '[class*="badge"]',
    '[class*="Badge"]', '[class*="verified"]', '[class*="Verified"]',
    '[class*="source-note"]', '[class*="live-note"]'
  ].join(',');
  const freshnessLabel = /\b(?:last\s*verified|verified\s*\d+|live\s*\d+\s*[•|·-]\s*last\s*verified)\b/i;
  const skip = el => !!el.closest('.medicine-rows,.risk-grid,.alert-grid,.weather-hero,.live-list');
  let pending = false;
  function update() {
    pending = false;
    document.querySelectorAll(candidates).forEach(el => {
      if (el.classList.contains('mx-visual-live-note') || skip(el)) return;
      // Status labels only, not entire articles, source notices, or error messages.
      const raw = (el.textContent || '').replace(/\s+/g,' ').trim();
      if (raw.length && raw.length < 75 && freshnessLabel.test(raw) &&
          (el.childElementCount <= 1 || el.matches('.fx-provider-note'))) {
        el.classList.add('mx-visual-live-note');
      }
    });
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, {once:true});
  } else schedule();
  new MutationObserver(schedule).observe(document.documentElement, {
    childList:true, characterData:true, subtree:true
  });
})();
