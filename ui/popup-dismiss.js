/* Dismiss native popups through their normal close lifecycle.
   Search and card inspection keep their specialised animated closing. */
(() => {
 let pressedOutside=null;
 document.addEventListener('pointerdown',event=>{
  const dialog=event.target;
  pressedOutside=null;
  if(!(dialog instanceof HTMLDialogElement)||!dialog.open||dialog.matches('.card-inspector,.personal-picker'))return;
  const rect=dialog.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)pressedOutside=dialog;
 },true);
 document.addEventListener('click',event=>{
  const dialog=event.target;
  if(dialog===pressedOutside&&dialog instanceof HTMLDialogElement&&dialog.open){
   const rect=dialog.getBoundingClientRect();
   if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom){
    pressedOutside=null;dialog.close();return;
   }
  }
  pressedOutside=null;
  // Modern card details use a side panel, so the outside area is not its overlay.
  const detail=document.getElementById('cardModal');
  if(detail?.classList.contains('show')&&!detail.contains(event.target)&&
     !document.querySelector('dialog[open],.scanner-overlay.show,.pokedex-variants-overlay.show,.user-gate-overlay.show,.pack-overlay.show')){
   closeCardModal();
  }
 },true);
 document.getElementById('userGateOverlay')?.addEventListener('click',event=>{
  if(event.target===event.currentTarget)finishCollectionUserGate(false);
 });
})();
