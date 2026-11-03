/* Language counterparts are resolved exclusively from the NAS catalogues. */
(() => {
 let manifestPromise=null,loadedAt=0,version=0;
 function manifest(){
  if(!manifestPromise||Date.now()-loadedAt>60000){loadedAt=Date.now();manifestPromise=fetch('/es-data/translations.json').then(r=>{if(!r.ok)throw Error('Traducciones no disponibles');return r.json();}).catch(e=>{manifestPromise=null;throw e;});}
  return manifestPromise;
 }
 let japanesePromise=null,japaneseLoadedAt=0;
 function japanese(){
  if(!japanesePromise||Date.now()-japaneseLoadedAt>60000){japaneseLoadedAt=Date.now();japanesePromise=fetch('/jp-data/translations.json').then(r=>{if(!r.ok)throw Error('Enlaces japoneses no disponibles');return r.json();}).catch(()=>{japanesePromise=null;return {en:{},jp:{}};});}
  return japanesePromise;
 }
 const language=card=>{const value=card.languageCode||(/jp-data/.test(card.localImage||card.image||'')?'jp':String(card.id).startsWith('es-')?'es':/scrydex-data/.test(card.localImage||card.image||'')?'en':currentLang);return value==='ja'?'jp':value;};
 const labels={es:'Español',en:'English',jp:'日本語'};
 async function versions(card){
  const lang=language(card);if(!['es','en','jp'].includes(lang))return {};
  const [map,jp]=await Promise.all([manifest().catch(()=>({en:{},es:{},sets:{}})),japanese()]);
  const enId=lang==='en'?card.id:lang==='es'?map.es[card.id]:jp.jp[card.id]?.id;
  const result={[lang]:{id:card.id,setId:card.setSlug||card.setId}};
  if(enId){
   result.en={id:enId,setId:map.sets?.[enId]||card.englishSetId||jp.jp[card.id]?.setId||(lang==='en'?(card.setSlug||card.setId):null)};
   const esId=map.en[enId];if(esId)result.es={id:esId,setId:map.sets?.[esId]};
   if(jp.en[enId])result.jp=jp.en[enId];
  }
  // Preserve the exact source edition when returning from a language switch.
  return {...result,...card._languageVersions,[lang]:{id:card.id,setId:card.setSlug||card.setId}};
 }
 window.ChiniCardLanguages={
  language,labels,
  decorateButton(button, lang){
   button.title=labels[lang]||lang;
   button.setAttribute('aria-label',labels[lang]||lang);
   button.classList.add('card-language-flag');
   const image=document.createElement('img');image.src='/TCG/ui/assets/flags/'+lang+'.svg';image.alt='';image.width=30;image.height=20;
   button.replaceChildren(image);
  },
  async options(card){const result=await versions(card);return ['es','en','jp'].filter(l=>result[l]);},
  async available(card){return (await this.options(card)).length>1;},
  async translate(card,target){
   const lang=language(card);if(lang===target)return card;
   const links=await versions(card),link=links[target];if(!link?.setId)throw Error('Versión no disponible');
   const otherId=link.id,root={es:'es-data',en:'scrydex-data',jp:'jp-data'}[target];
   const setId=link.setId;
   const set=await apiFetch(`/${root}/sets/${encodeURIComponent(setId)}/set.json`);
   const raw=(set.cards||[]).find(c=>c.id===otherId);if(!raw)throw Error('La versión aún no está descargada');
   return {...normalizeLocalCard({...raw,languageCode:target},setId,root),_languageVersions:links};
  }
 };
 const host=document.createElement('div');host.className='card-language-options';host.setAttribute('aria-label','Idioma de la carta');
 document.getElementById('modalChips').after(host);
 window.renderCardLanguageOptions=async card=>{
  const request=++version;host.replaceChildren();
  const lang=language(card);
  if(currentGame!=='pokemon'||!['es','en','jp'].includes(lang))return;
  try{
   const options=await window.ChiniCardLanguages.options(card);if(request!==version||lastDetailCard?.id!==card.id||options.length<2)return;
   for(const target of options){
    const button=document.createElement('button');button.type='button';button.className='modal-chip';window.ChiniCardLanguages.decorateButton(button,target);button.disabled=target===lang;button.setAttribute('aria-pressed',String(target===lang));
    button.onclick=async()=>{
     button.disabled=true;
     try{
      const translated=await window.ChiniCardLanguages.translate(card,target);
      if(request!==version||!document.getElementById('cardModal').classList.contains('show'))return;
      await openModal(translated.id,{card:translated,history:false});
     }catch(e){button.disabled=false;button.title=e.message;button.setAttribute('aria-label',(labels[target]||target)+': No disponible');}
    };
    host.append(button);
   }
  }catch{/* Untranslated cards keep their normal detail view. */}
 };
})();
