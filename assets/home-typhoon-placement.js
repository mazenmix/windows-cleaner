/* MX Fuel home: center the existing verified typhoon alert over Food Prices. */
(function(){
 'use strict';
 const slot=document.getElementById('mxHomepageTyphoonSlot');
 const badge=document.querySelector('.mx-global-typhoon-alert');
 if(!slot||!badge)return;
 slot.appendChild(badge);
 function update(){
   const visible=!badge.hidden;
   slot.hidden=!visible;
   slot.setAttribute('aria-hidden',visible?'false':'true');
 }
 const observer=new MutationObserver(update);
 observer.observe(badge,{attributes:true,attributeFilter:['hidden']});
 update();
})();
