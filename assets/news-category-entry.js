/* MX Fuel News: navigation buttons always enter All News first.
   Remember manual category selections within News, but a new NEWS click with
   ?category=All overrides the previous Celebrity selection before app init. */
(function(){
  'use strict';
  try {
    const category = new URLSearchParams(window.location.search).get('category');
    if (category === 'All') {
      window.localStorage.setItem('mxNewsSelectedCategoryV2', 'All');
    }
  } catch (_) { /* A blocked storage API must not stop news loading. */ }
})();
