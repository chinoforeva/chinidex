/* Confirmed atomic adjustments shared with Android. Pending identities stay in memory. */
(() => {
 const pending=new Map(),busy=new Set();
 function message(text){let node=document.getElementById('inventory-feedback');if(!node){node=document.createElement('p');node.id='inventory-feedback';node.setAttribute('role','status');node.className='m-notice';document.body.append(node);}node.textContent=text;setTimeout(()=>node.remove(),7000);}
 async function adjust(id,delta,confirmRemoval=false){
  if(!await ensureCollectionUser())return;
  const card=collection[id]||currentSetCards.find(c=>c.id===id)||searchResults.find(c=>c.id===id)||albumSetCards.find(c=>c.id===id)||lastDetailCard;
  if(!card)throw Error('Selecciona la impresión antes de añadirla');
  const catalogue=card.catalogue||currentDataRoot().replace(/^\/?TCG\//,''),cardId=card.sourceCardId||card.id||id,context=currentContextKey(),user=currentUser,key=[user,catalogue,cardId,delta].join(':');
  if(busy.has(key))return;busy.add(key);
  const operationId=pending.get(key)||(crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''));pending.set(key,operationId);
  try{
   const before=await fetch(collectionApiUrl(),{cache:'no-store'});if(!before.ok)throw Error('No se pudo leer la colección. Inicia sesión y reintenta.');const snapshot=await before.json();
   let answer;try{const response=await ChiniAccount.request('/tcg-workspace/inventory/adjust',{method:'POST',headers:{'If-Match':snapshot.revision},body:JSON.stringify({catalogue,cardId,delta,operationId,confirmRemoval})});answer=response;}
   catch(error){const recovery=await fetch('/tcg-workspace/operations/'+encodeURIComponent(operationId),{cache:'no-store'});if(recovery.ok)answer=await recovery.json();else {pending.delete(key);throw error;}}
   if(!answer.ok)throw Error('El servidor no ha confirmado el cambio');pending.delete(key);
   if(context===currentContextKey()&&user===currentUser){await loadCollectionFromServer();refreshCurrentView();if(document.getElementById('cardModal')?.classList.contains('show'))openModal(id);}
   message('Cantidad guardada en tu colección');
  }catch(error){message(error.message+' No se ha aplicado ningún reintento automático.');}
  finally{busy.delete(key);}
 }
 window.ChiniInventory=Object.freeze({adjust});
})();
