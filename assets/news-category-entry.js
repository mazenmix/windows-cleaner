/* Canonical MX Fuel NEWS entry: a short URL and All News on every new visit.
   Clicking category tabs only changes in-page state, not the address bar. */
(function () {
  'use strict';
  try {
    window.localStorage.removeItem('mxNewsSelectedCategoryV2');
  } catch (_) { /* localStorage may be unavailable in private contexts */ }
  try {
    if (location.pathname === '/news' || location.pathname === '/news.html') {
      if (location.pathname !== '/news' || location.search || location.hash) {
        history.replaceState(history.state, '', '/news');
      }
    }
  } catch (_) { /* changing the address never blocks the news feed */ }
})();
