/* Match active typhoon header badge size to the actual Visitors Today chip. */
(function(){
 'use strict';
 const badge=document.querySelector('.mx-global-typhoon-alert');
 const today=document.querySelector('.visitor-chip.today');
 if(!badge||!today)return;
 function sync(){
  const box=today.getBoundingClientRect();
  if(box.width>=72&&box.height>=24){
   badge.style.setProperty('--mx-visitor-width',Math.round(box.width)+'px');
   badge.style.setProperty('--mx-visitor-height',Math.round(box.height)+'px');
  }
 }
 sync();
 window.addEventListener('resize',sync,{passive:true});
 if('ResizeObserver' in window)new ResizeObserver(sync).observe(today);
 if('MutationObserver' in window)new MutationObserver(sync).observe(badge,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('pageshow',sync);
})();
