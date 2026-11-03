/* Focus lifecycle for existing overlay panels; native dialog keeps browser handling. */
(() => {
 let current=null,previous=null,scheduled=false;
 const active=()=>[...document.querySelectorAll('.user-gate-overlay.show,.scanner-overlay.show,.pokedex-variants-overlay.show,#cardModal.show')].filter(el=>el.getClientRects().length).sort((a,b)=>(parseInt(getComputedStyle(b).zIndex)||0)-(parseInt(getComputedStyle(a).zIndex)||0))[0]||null;
 const focusables=el=>[...el.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(node=>!node.disabled&&node.getClientRects().length);
 function sync(){scheduled=false;const next=active();if(next===current)return;if(next){if(!current)previous=document.activeElement;current=next;next.setAttribute('role','dialog');next.setAttribute('aria-modal','true');const first=focusables(next)[0];if(!next.contains(document.activeElement))first?.focus();}else{current=null;if(previous?.isConnected)previous.focus();previous=null;}}
 new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(sync);}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
 document.addEventListener('keydown',event=>{
  if(document.querySelector('dialog[open]'))return;
  const panel=active();if(!panel)return;
  if(event.key==='Escape'&&panel.id==='userGateOverlay'){event.preventDefault();finishCollectionUserGate(false);return;}
  if(event.key!=='Tab')return;
  const nodes=focusables(panel);if(!nodes.length){event.preventDefault();return;}
  const first=nodes[0],last=nodes[nodes.length-1];
  if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
 },true);
})();
