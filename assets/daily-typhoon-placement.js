/* Place Daily Cost's verified cyclone badge centered, not near logo. */
(function(){
 'use strict';
 const badge=document.querySelector('.mx-global-typhoon-alert');
 const slot=document.getElementById('mxDailyTyphoonSlot');
 if(!badge||!slot)return;
 slot.appendChild(badge);
 const sync=()=>{const visible=!badge.hidden;slot.hidden=!visible;slot.setAttribute('aria-hidden',visible?'false':'true')};
 new MutationObserver(sync).observe(badge,{attributes:true,attributeFilter:['hidden']});
 sync();
})();