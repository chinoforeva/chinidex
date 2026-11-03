(() => {
 const key=()=> 'chiniAlbumLayouts1_'+JSON.stringify([currentUser||'',currentGame,currentLang]);
 function read(){return window.ChiniWorkspace?.cache.user===currentUser?structuredClone(ChiniWorkspace.cache.layouts[currentGame+':'+currentLang]||{}):{};}
 const valid=n=>Number.isInteger(n)&&n>=1&&n<=6;
 window.albumLayoutFor=(slug=albumSetSlug)=>{
  const item=read()[slug];
  return item&&valid(item.rows)&&valid(item.columns)?item:{rows:3,columns:4};
 };
 window.savedAlbumSlugs=()=>Object.keys(read());
 window.albumPageSize=()=>{const layout=albumLayoutFor();return layout.rows*layout.columns;};
 const dialog=document.createElement('dialog');dialog.className='album-config-dialog';
 dialog.setAttribute('aria-labelledby','albumConfigTitle');
 dialog.innerHTML='<form><h2 id="albumConfigTitle">Crear álbum</h2><label>Colección / expansión<select id="albumConfigSet" required></select></label><div class="album-config-dimensions"><label>Columnas por página<input id="albumConfigColumns" type="number" min="1" max="6" value="4" required></label><label>Filas por página<input id="albumConfigRows" type="number" min="1" max="6" value="3" required></label></div><p id="albumConfigSummary"></p><p>Se mostrarán tus cartas y los huecos que faltan. La distribución se guarda en tu cuenta del servidor.</p><p id="albumConfigError" role="alert"></p><div class="album-config-actions"><button type="button" id="albumConfigCancel">Cancelar</button><button type="submit">Guardar y abrir álbum</button></div></form>';
 document.body.append(dialog);
 const select=dialog.querySelector('select'),rows=dialog.querySelector('#albumConfigRows'),columns=dialog.querySelector('#albumConfigColumns');
 const summary=()=>{dialog.querySelector('#albumConfigSummary').textContent=Number(rows.value)*Number(columns.value)+' huecos por página';};
 const populate=()=>{const layout=albumLayoutFor(select.value);rows.value=layout.rows;columns.value=layout.columns;summary();};
 select.onchange=populate;rows.oninput=summary;columns.oninput=summary;
 dialog.querySelector('#albumConfigCancel').onclick=()=>dialog.close();
 window.configureCollectionAlbum=async(slug='')=>{
  if(!allSets.length)await loadSets();
  select.replaceChildren();
  const owned=new Set(Object.values(collection).map(c=>normalizeSetSlug(c.setSlug)));
  for(const set of [...allSets].sort((a,b)=>Number(owned.has(b.slug))-Number(owned.has(a.slug))||a.name.localeCompare(b.name))){
   const option=document.createElement('option');option.value=set.slug;option.textContent=set.name;select.append(option);
  }
  if(slug)select.value=slug;
  populate();dialog.querySelector('#albumConfigTitle').textContent=slug?'Configurar álbum':'Crear álbum';
  dialog.querySelector('#albumConfigError').textContent='';dialog.showModal();
 };
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();
  const layout={rows:Number(rows.value),columns:Number(columns.value)};
  if(!select.value||!valid(layout.rows)||!valid(layout.columns))return;
  const error=dialog.querySelector('#albumConfigError');
  try{
   const layouts=read();layouts[select.value]=layout;await ChiniWorkspace.saveDocument('layouts',{...ChiniWorkspace.cache.layouts,[currentGame+':'+currentLang]:layouts});
  }catch{error.textContent='No se pudo guardar la distribución. Recarga antes de repetir.';return;}
  const slug=select.value;dialog.close();
  setCollectionMode('album');await openCollectionAlbumSet(slug);
 };
 const action=document.createElement('div');action.className='collection-album-create';
 action.innerHTML='<button type="button">Crear álbum</button>';
 action.querySelector('button').onclick=()=>configureCollectionAlbum();
 document.getElementById('collectionContent').before(action);
 const share=document.createElement('button');share.textContent='Compartir álbum de set (solo lectura)';share.type='button';share.onclick=async()=>{if(!albumSetSlug){alert('Abre un álbum de set antes de compartirlo.');return;}try{const link=await ChiniWorkspace.request('/tcg-workspace/shares','POST',{kind:'set-album',catalogue:currentDataRoot().replace(/^TCG\//,''),set:albumSetSlug});alert('Enlace revocable de lectura: '+ChiniWorkspace.shareURL(link.token));}catch(error){alert(error.message);}};action.append(share);
})();
