/* Shared card inspection view; all artwork comes from the current local detail image. */
(() => {
 let source=document.getElementById('modalImg');
 const detailSource=source;
 if(!source)return;
 source.tabIndex=0;source.setAttribute('role','button');
 source.setAttribute('aria-label','Abrir vista 3D de la carta');
 source.title='Abrir vista 3D';
 const dialog=document.createElement('dialog');
 dialog.className='card-inspector';
 dialog.setAttribute('aria-label','Vista 3D de la carta');
 dialog.innerHTML='<div class="card-inspector-stage"><div class="card-inspector-card"><img alt="" draggable="false"><div class="card-inspector-shine"></div><div class="card-inspector-glare"></div></div></div><div class="card-inspector-actions" hidden></div>';
 document.body.append(dialog);
 const card=dialog.querySelector('.card-inspector-card'), image=card.querySelector('img');
 const actions=dialog.querySelector('.card-inspector-actions');
 let pendingAction=null;
 const stage=dialog.querySelector('.card-inspector-stage');
 let flight=null, closing=false, flightVersion=0, sourceVisibility='';
 let languageVersion=0;
 function destinationTransform(){
  const from=source.getBoundingClientRect(), to=card.getBoundingClientRect();
  if(!from.width||!from.height||!to.width||!to.height)return 'none';
  return `translate(${from.left+from.width/2-to.left-to.width/2}px, ${from.top+from.height/2-to.top-to.height/2}px) scale(${from.width/to.width}, ${from.height/to.height})`;
 }
 async function travel(reverse=false){
  const version=++flightVersion;
  const current=flight?getComputedStyle(stage).transform:'none';
  flight?.cancel();flight=null;reset();
  dialog.dataset.travel='true';
  const target=destinationTransform();
  if(!reduce.matches){
   flight=stage.animate(
    reverse?[{transform:current},{transform:target}]:[{transform:target},{transform:'none'}],
    {duration:reverse?360:460,easing:'cubic-bezier(.22,.7,.2,1)',fill:'both'}
   );
   try{await flight.finished;}catch{}
  }
  if(version!==flightVersion)return;
  flight?.cancel();flight=null;delete dialog.dataset.travel;
  if(reverse){
   source.style.visibility=sourceVisibility;
   dialog.close();(source.closest('button,[tabindex]')||source).focus({preventScroll:true});
  }
 }
 function close(){
  if(!dialog.open||closing)return;
  closing=true;dialog.classList.add('is-closing');travel(true);
 }
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 function foil(data){
  const variant=String(data?.variant||'').toLowerCase();
  if(/non[ -]?foil|non[ -]?holo|normal|regular/.test(variant))return false;
  return /holo|foil/.test(variant)||/holo|foil/i.test(String(data?.rarity||''));
 }
 function reset(){card.style.setProperty('--light','.12');card.style.setProperty('--angle','115deg');card.style.setProperty('--rx','0deg');card.style.setProperty('--ry','0deg');card.style.setProperty('--x','50%');card.style.setProperty('--y','50%');}
 function open(dataOverride, sourceOverride, controls){
  if(dialog.open)return;
  source=sourceOverride||detailSource;
  if(!source.naturalWidth||dialog.open)return;
  const data=dataOverride||(typeof lastDetailCard==='undefined'?{}:lastDetailCard);
  image.src=source.currentSrc||source.src;
  const original=data?.localImage||data?.image;
  if(original&&!/^(?:[a-z]+:|\/\/)/i.test(original)){const full=new Image();full.onload=()=>{if(dialog.open&&image.alt===(data?.name||'Carta'))image.src=full.src;};full.src=original;}
  image.alt=data?.name||'Carta';
  card.style.aspectRatio=source.naturalWidth+'/'+source.naturalHeight;
  card.style.width='min(76vw, 430px, '+(70*source.naturalWidth/source.naturalHeight)+'dvh)';
  card.classList.toggle('is-foil',foil(data));
  actions.replaceChildren();pendingAction=null;
  for(const [label,callback] of [['Quitar',controls?.remove],['Cambiar',controls?.change]]){
   if(typeof callback!=='function')continue;
   const button=document.createElement('button');button.type='button';button.textContent=label;
   button.onclick=()=>{if(closing)return;pendingAction=callback;close();};
   actions.append(button);
  }
  actions.hidden=!actions.childElementCount;
  const languageRequest=++languageVersion;
  window.ChiniCardLanguages?.options(data).then(options=>{
   if(options.length<2||languageRequest!==languageVersion||!dialog.open)return;
   const group=document.createElement('span');group.className='card-language-options';
   for(const lang of options){
    const button=document.createElement('button');button.type='button';window.ChiniCardLanguages.decorateButton(button,lang);button.disabled=window.ChiniCardLanguages.language(data)===lang;button.setAttribute('aria-pressed',String(button.disabled));
    button.onclick=async()=>{
     if(closing)return;button.disabled=true;
     try{
      const translated=await window.ChiniCardLanguages.translate(data,lang);const next=new Image();next.src=translated.image;await next.decode();
      if(languageRequest!==languageVersion||!dialog.open||closing)return;
      image.src=next.src;image.alt=translated.name;card.classList.toggle('is-foil',foil(translated));
      card.style.aspectRatio=next.naturalWidth+'/'+next.naturalHeight;
      for(const b of group.children){b.disabled=b===button;b.setAttribute('aria-pressed',String(b===button));}
     }catch(error){button.disabled=false;button.title=error.message;}
    };group.append(button);
   }
   actions.append(group);actions.hidden=false;
  }).catch(()=>{});
  closing=false;dialog.classList.remove('is-closing');
  reset();dialog.showModal();
  sourceVisibility=source.style.visibility;source.style.visibility='hidden';
  travel();
  dialog.tabIndex=-1;dialog.focus();
 }
 window.openCard3D=(data,img,controls)=>open(data,img,controls);
 detailSource.addEventListener('click',()=>open());
 detailSource.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
 dialog.addEventListener('click',event=>{if(!event.target.closest('.card-inspector-card,.card-inspector-actions'))close();});
 dialog.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();}});
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',()=>{
  languageVersion++;
  if(dialog.open)return;
  flightVersion++;flight?.cancel();flight=null;closing=false;
  delete dialog.dataset.travel;dialog.classList.remove('is-closing');
  source.style.visibility=sourceVisibility;reset();
  const action=pendingAction;pendingAction=null;
  if(action){action();return;}
  setTimeout(()=>{if(!dialog.open && (document.activeElement===document.body || dialog.contains(document.activeElement)))(source.closest('button,[tabindex]')||source).focus({preventScroll:true});},100);
 });
 stage.addEventListener('pointermove',event=>{
  if(reduce.matches||dialog.dataset.travel||closing)return;
  const rect=stage.getBoundingClientRect();
  const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
  const y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));
  card.style.setProperty('--rx',((.5-y)*24)+'deg');card.style.setProperty('--ry',((x-.5)*30)+'deg');
  card.style.setProperty('--light',String(.12+Math.hypot(x-.5,y-.5)*.34));
  card.style.setProperty('--angle',(100+x*35-y*15)+'deg');
  card.style.setProperty('--x',(x*100)+'%');card.style.setProperty('--y',(y*100)+'%');
 });
 stage.addEventListener('pointerdown',event=>{stage.setPointerCapture(event.pointerId);});
 stage.addEventListener('pointerleave',reset);stage.addEventListener('pointerup',reset);
 stage.addEventListener('pointercancel',reset);
 function collectionInspect(event){
  if(!window.ChiniWorkspace?.cache.documents.ui?.data.enable3D)return;
  if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
  const container=event.target.closest('#collectionContent .card-tcg, #collectionContent .collection-item, #collectionContent .album-slot');
  if(!container||event.target.closest('.qty-btn,.del-btn,.m-card-quantity, .personal-slot-actions'))return;
  const img=container.querySelector('img');if(!img?.naturalWidth)return;
  const id=container.dataset.cardId;
  const data=collection[id]||albumSetCards.find(c=>c.id===id);
  if(!data)return;
  event.preventDefault();event.stopImmediatePropagation();open(data,img);
 }
 document.addEventListener('click',collectionInspect,true);
 document.addEventListener('keydown',collectionInspect,true);
 reduce.addEventListener('change',()=>{reset();if(reduce.matches)flight?.finish();});
})();
