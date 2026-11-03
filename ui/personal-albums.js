(() => {
 const key=()=> 'chiniPersonalAlbums1_'+JSON.stringify(currentUser||'');
 const read=()=>window.ChiniWorkspace?.cache.user===currentUser?structuredClone(ChiniWorkspace.cache.albums):[];
 let selected='', page=0, owner='', results=[], request=0, controller;
 let editing='', pageMarkup=null, turning=false, turnTimer;
 const esc=escapeHtml;
 const catalogues=['scrydex-data','es-data','jp-data','cn-data','onepiece-data','onepiece-jp-data','riftbound-data','magic-data'];
 const labels={'es-data':'Pokémon ES','scrydex-data':'Pokémon EN','jp-data':'Pokémon JP','cn-data':'Pokémon CN','onepiece-data':'One Piece EN','onepiece-jp-data':'One Piece JP','riftbound-data':'Riftbound','magic-data':'Magic'};
 async function save(albums){await ChiniWorkspace.saveDocument('albums',albums);}
 async function mutate(fn){
  try{const albums=read();const album=albums.find(a=>a.id===selected);if(!album)return;fn(album);await save(albums);renderPersonalAlbums();}
  catch(error){alert(error.message||'No se pudo guardar el álbum en el servidor.');}
 }
 const bar=document.querySelector('.collection-album-create');
 const createChoice=document.createElement('dialog');createChoice.className='album-config-dialog';
 createChoice.setAttribute('aria-label','Crear álbum');
 createChoice.innerHTML='<h2>Crear álbum</h2><div class="album-type-options"><button type="button" data-album-type="personal">Álbum personalizado</button><button type="button" data-album-type="set">Álbum de set</button></div><div class="album-config-actions"><button type="button" data-cancel>Cancelar</button></div>';
 document.body.append(createChoice);
 createChoice.querySelector('[data-cancel]').onclick=()=>createChoice.close();
 createChoice.querySelector('[data-album-type="personal"]').onclick=()=>{createChoice.close();openPersonalAlbumEditor('');};
 createChoice.querySelector('[data-album-type="set"]').onclick=()=>{createChoice.close();configureCollectionAlbum();};
 bar.replaceChildren();
 const createButton=document.createElement('button');createButton.type='button';createButton.textContent='Crear álbum';
 createButton.onclick=()=>createChoice.showModal();bar.append(createButton);
 window.personalAlbumCount=()=>read().length;
 window.personalAlbumTiles=()=>read().map(a=>'<button class="album-set-card" data-personal-open="'+esc(a.id)+'"><div class="album-set-logo">'+(a.icon?'<img src="'+esc(a.icon)+'" alt="" loading="lazy">':'<span aria-hidden="true">▤</span>')+'</div><div class="album-set-meta"><span>'+esc(a.name)+'</span></div></button>').join('');
 const form=document.createElement('dialog');form.className='album-config-dialog';
 form.setAttribute('aria-label','Crear álbum personal');
 form.innerHTML='<form><h2>Crear álbum personal</h2><label>Nombre<input name="name" maxlength="80" required placeholder="Mis cartas favoritas"></label><input type="hidden" name="icon"><details class="personal-icon-selector"><summary>Elegir icono de expansión</summary><div class="personal-icon-grid" aria-label="Iconos de expansiones"><button type="button" data-icon="" aria-label="Sin icono">Sin icono</button></div></details><img class="personal-icon-preview" alt="" hidden><div class="album-config-dimensions"><label>Columnas por página<input name="columns" type="number" min="1" max="6" value="3" required></label><label>Filas por página<input name="rows" type="number" min="1" max="6" value="3" required></label></div><label>Páginas<input name="pages" type="number" min="1" max="100" value="2" required></label><p>Podrás mezclar cartas de cualquier juego y expansión. Se guarda en tu cuenta del servidor.</p><p class="personal-error" role="alert"></p><div class="album-config-actions"><button type="button">Cancelar</button><button type="submit">Crear álbum</button></div></form>';
 document.body.append(form);
 form.querySelector('.album-config-actions [type="button"]').onclick=()=>form.close();
 form.querySelector('form').onsubmit=async e=>{
  e.preventDefault();const fields=new FormData(e.target),name=String(fields.get('name')).trim();
  const icon=String(fields.get('icon')||'');
  const columns=Number(fields.get('columns')),rows=Number(fields.get('rows')),pages=Number(fields.get('pages'));
  if(!name||![columns,rows,pages].every(Number.isInteger)||columns<1||columns>6||rows<1||rows>6||pages<1||pages>100)return;
  const album={id:(crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('-')),name,icon,columns,rows,pages,slots:{}};
  try{
   const albums=read(), existing=editing&&albums.find(a=>a.id===editing);
   if(existing){
    const last=Math.max(-1,...Object.keys(existing.slots).map(Number));
    const required=Math.ceil((last+1)/(rows*columns));
    if(required>100){form.querySelector('.personal-error').textContent='Esta distribución necesitaría más de 100 páginas. Aumenta las filas o columnas para conservar todas las cartas.';return;}
    Object.assign(existing,{name,icon,columns,rows,pages:Math.max(pages,required)});
    selected=existing.id;
   }else{albums.push(album);selected=album.id;page=0;}
   await save(albums);form.close();collectionMode='personal';document.body.dataset.collectionMode=collectionMode;owner=key();renderPersonalAlbums();commitNavigation();
  }
  catch{form.querySelector('.personal-error').textContent='No se pudo guardar el álbum.';}
 };
 const picker=document.createElement('dialog');picker.className='personal-picker album-config-dialog';
 picker.setAttribute('aria-label','Elegir carta para el hueco');
 picker.innerHTML='<form role="search"><input name="query" type="search" required minlength="1" placeholder="Buscar carta" aria-label="Buscar carta o colección" autocomplete="off"></form><p class="personal-search-status" role="status"></p><div class="personal-results"></div>';
 document.body.append(picker);
 let slot=0,pickerOwner='',searchTimer;
 const normalizeSearch=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function pick(index){
  slot=index;pickerOwner=key();results=[];picker.querySelector('input').value='';
  picker.querySelector('.personal-results').replaceChildren();
  picker.querySelector('.personal-search-status').textContent='';
  picker.showModal();picker.querySelector('input').focus();
 }
 picker.addEventListener('click',event=>{
  if(event.target===picker||event.target===picker.querySelector('.personal-results'))picker.close();
 });
 picker.addEventListener('close',()=>{clearTimeout(searchTimer);request++;controller?.abort();});
 picker.querySelector('input').addEventListener('input',()=>{
  clearTimeout(searchTimer);request++;controller?.abort();results=[];
  picker.querySelector('.personal-results').replaceChildren();
  picker.querySelector('.personal-search-status').textContent='';
  if(picker.querySelector('input').value.trim())searchTimer=setTimeout(searchCards,280);
 });
 picker.querySelector('form').onsubmit=e=>{e.preventDefault();clearTimeout(searchTimer);searchCards();};
 async function searchCards(){
  const token=++request;controller?.abort();controller=new AbortController();
  const query=picker.querySelector('input').value.trim();
  const status=picker.querySelector('.personal-search-status'),grid=picker.querySelector('.personal-results');
  if(!query)return;status.textContent='Buscando cartas…';grid.replaceChildren();
  try{
   const responses=await Promise.allSettled(catalogues.map(async dataset=>{
    const signal=controller.signal;
    const [data,sets]=await Promise.all([
     ChiniCatalogue.search(dataset,query,signal),
     ChiniCatalogue.get('/'+dataset+'/sets.json')
    ]);
    if(signal.aborted)throw new DOMException('Cancelado','AbortError');
    const matches=sets.filter(set=>normalizeSearch(set.name).includes(normalizeSearch(query))).slice(0,4);
    const expansions=await Promise.all(matches.map(async set=>{
     const id=set.scrydexId||set.id;
     const detail=await ChiniCatalogue.get('/'+dataset+'/sets/'+encodeURIComponent(id)+'/set.json');
     return (detail.cards||[]).map(c=>({...c,setName:set.name,setId:id}));
    }));
    const unique=new Map();
    for(const c of [...expansions.flat(),...(data.cards||[])])unique.set(c.id,c);
    return {total:Math.max(data.total,unique.size),cards:[...unique.values()].map(c=>({...c,dataset}))};
   }));
   const successful=responses.filter(r=>r.status==='fulfilled').map(r=>r.value);
   if(!successful.length)throw Error('No se pudieron consultar los catálogos del NAS.');
   // Interleave catalogues so a large Pokémon result never hides the other games.
   const mixed=[];for(let i=0;i<120;i++)for(const data of successful)if(data.cards[i])mixed.push(data.cards[i]);
   const data={cards:mixed,total:successful.reduce((n,r)=>n+r.total,0)};
   const failed=responses.length-successful.length;
   if(token!==request||!picker.open)return;
   results=(data.cards||[]).filter(c=>c.localImage||c.image).slice(0,120);
   status.textContent=results.length+' cartas mostradas'+(data.total>120?' · Afina la búsqueda para ver más':'')+(failed?' · '+failed+' catálogos no disponibles':'');
   grid.innerHTML=results.map((c,i)=>'<button type="button" data-result="'+i+'" aria-label="'+esc([c.name,labels[c.dataset],c.setName||c.setId||c.setSlug,c.number,c.variant].filter(Boolean).join(' · '))+'"><img loading="lazy" src="'+esc(ChiniCatalogue.thumbnail(c.localImage||c.image))+'" alt=""></button>').join('');
  }catch(error){if(token===request&&error.name!=='AbortError')status.textContent=error.message;}
 };
 picker.querySelector('.personal-results').onclick=e=>{
  const button=e.target.closest('[data-result]');if(!button||pickerOwner!==key())return;
  const c=results[Number(button.dataset.result)];if(!c)return;
  const stored={id:c.id,name:c.name,number:c.number,rarity:c.rarity,variant:c.variant,dataset:c.dataset,setId:c.setId||c.setSlug,setName:c.setName,localImage:c.localImage||c.image};
  mutate(album=>{album.slots[slot]=stored;});picker.close();
 };
 function turnPersonalPage(delta){
  if(turning)return;
  const album=read().find(a=>a.id===selected);if(!album)return;
  const step=ChiniAlbumView.single()?1:2,target=Math.max(0,Math.min(Math.floor((album.pages-1)/step)*step,page+delta));
  if(target===page)return;
  const book=document.querySelector('.personal-book .album-book'),spread=book?.querySelector('.album-spread');
  if(!book||!spread||matchMedia('(prefers-reduced-motion:reduce)').matches){page=target;renderPersonalAlbums();commitNavigation();return;}
  if(matchMedia('(max-width:700px)').matches||!CSS.supports('transform-style','preserve-3d')){
   page=target;renderPersonalAlbums();commitNavigation();
   document.querySelector('.personal-book .album-spread')?.classList.add(delta>0?'album-enter-next':'album-enter-prev');return;
  }
  const forward=delta>0, moving=spread.querySelector(forward?'.album-page-right':'.album-page-left');
  const rect=moving.getBoundingClientRect(),base=book.getBoundingClientRect();
  const left=spread.querySelector('.album-page-left').getBoundingClientRect();
  const right=spread.querySelector('.album-page-right').getBoundingClientRect();
  const hinge=(left.right+right.left)/2;
  const rings=spread.querySelector('.personal-rings').outerHTML;
  const front=pageMarkup(forward?page+1:page,forward?'right':'left');
  const back=pageMarkup(forward?target:target+1,forward?'left':'right');
  spread.innerHTML=pageMarkup(forward?page:target,'left')+pageMarkup(forward?target+1:page+1,'right')+rings;
  const sheet=document.createElement('div');
  sheet.className='album-turn-sheet '+(forward?'turn-next':'turn-prev');
  Object.assign(sheet.style,{left:(rect.left-base.left)+'px',top:(rect.top-base.top)+'px',width:rect.width+'px',height:rect.height+'px'});
  sheet.style.transformOrigin=(hinge-rect.left)+'px '+(rect.height/2)+'px';
  const face=(html,side)=>{const template=document.createElement('template');template.innerHTML=html;const node=template.content.firstElementChild;node.classList.add('album-turn-face','album-turn-'+side);return node.outerHTML;};
  sheet.innerHTML=face(front,'front')+face(back,'back');sheet.setAttribute('aria-hidden','true');sheet.inert=true;
  book.append(sheet);turning=true;
  const stage=book.closest('.personal-book');stage.setAttribute('aria-busy','true');
  document.querySelectorAll('.personal-navigation button').forEach(b=>b.disabled=true);
  const context=key(),id=selected;
  const finish=()=>{
   if(!turning)return;turning=false;clearTimeout(turnTimer);sheet.remove();
   if(context===key()&&id===selected&&collectionMode==='personal'&&book.isConnected){page=target;renderPersonalAlbums();commitNavigation();}
  };
  sheet.addEventListener('animationend',e=>{if(e.target===sheet)finish();});
  sheet.addEventListener('animationcancel',e=>{if(e.target===sheet)finish();});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(sheet.isConnected)sheet.classList.add('is-active');}));
  turnTimer=setTimeout(finish,940);
 }
 window.ChiniPersonalAlbums={current:()=>collectionMode==='personal'?selected:'',page:()=>page,open:async(id,number=0)=>{if(!ChiniWorkspace.cache.loaded)await ChiniWorkspace.load();if(!read().some(album=>album.id===id))throw Error('Álbum no encontrado');selected=id;owner=key();page=number;collectionMode='personal';document.body.dataset.collectionMode=collectionMode;renderCollection();}};
 window.renderPersonalAlbums=()=>{
  if(turning&&document.querySelector('.personal-book .album-turn-sheet'))return;
  if(owner!==key()){owner=key();selected='';page=0;}
  const content=document.getElementById('collectionContent'),albums=read(),album=albums.find(a=>a.id===selected);
  if(!album){
   content.innerHTML='<div class="personal-heading"><h2>Álbumes</h2></div><div class="album-sets-grid">'+personalAlbumTiles()+'</div>'+(!albums.length?'<p>Crea un álbum para empezar.</p>':'');
  }else{
   page=Math.max(0,Math.min(page,album.pages-1));const step=ChiniAlbumView.single()?1:2;page-=page%step;
   const size=album.rows*album.columns;
   const renderPage=(number,side)=>{
    if(number>=album.pages)return '<section class="album-page album-page-'+side+'"><div class="album-page-title">Fin del álbum</div></section>';
    return '<section class="album-page album-page-'+side+'"><div class="album-page-title">Página '+(number+1)+'</div><div class="personal-slots" style="grid-template-columns:repeat('+album.columns+',minmax(0,1fr));grid-template-rows:repeat('+album.rows+',minmax(0,1fr))">'+Array.from({length:size},(_,i)=>{
     const index=number*size+i,c=album.slots[index];
     return '<div class="personal-slot">'+(c?'<button class="personal-card '+(ChiniWorkspace.owned(c)?'owned':'missing')+'" data-personal-view="'+index+'" aria-label="Ver '+esc(c.name)+' y gestionar bolsillo"><img src="'+esc(ChiniCatalogue.thumbnail(c.localImage))+'" alt="'+esc(c.name)+'" loading="lazy"></button>':'<button class="personal-empty" data-personal-pick="'+index+'" aria-label="Añadir carta">+</button>')+'<small class="pocket-caption">Bolsillo '+(index+1)+(c?' · Carta #'+esc(c.number||''):'')+'</small></div>';
    }).join('')+'</div></section>';
   };
   pageMarkup=renderPage;
   content.innerHTML='<div class="personal-heading"><button data-personal-back>Mis álbumes</button><h2>'+esc(album.name)+'</h2><button data-personal-edit>Editar álbum</button><button data-personal-share>Compartir solo lectura</button><button data-personal-add-page>Añadir página</button></div><div class="personal-navigation"><button data-personal-page="-'+step+'" '+(!page?'disabled':'')+'>Anterior</button><span>'+(step===1?'Página '+(page+1):'Páginas '+(page+1)+'–'+Math.min(page+2,album.pages))+' de '+album.pages+'</span><button data-personal-page="'+step+'" '+(page+step>=album.pages?'disabled':'')+'>Siguiente</button></div><div class="album-stage personal-book"><div class="album-book"><div class="album-spread">'+renderPage(page,'left')+(step===1?'':renderPage(page+1,'right'))+'<div class="personal-rings" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div></div></div>';

  }
 };
 let iconsReady;
 function updateIcon(){const value=form.querySelector('[name="icon"]').value,preview=form.querySelector('.personal-icon-preview');preview.hidden=!value;if(value)preview.src=value;form.querySelectorAll('[data-icon]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.icon===value)));}
 form.querySelector('.personal-icon-grid').onclick=event=>{
  const button=event.target.closest('[data-icon]');if(!button)return;
  form.querySelector('[name="icon"]').value=button.dataset.icon;
  updateIcon();form.querySelector('.personal-icon-selector').open=false;
 };

 function loadIcons(){
  return iconsReady ||= Promise.allSettled(catalogues.map(async dataset=>{
   const sets=await ChiniCatalogue.get('/'+dataset+'/sets.json');
   const group=document.createDocumentFragment();
   for(const set of sets){
    const logo=set.localLogo||set.logo;
    if(!logo||!logo.startsWith('/'))continue;
    const button=document.createElement('button');button.type='button';button.dataset.icon=logo;
    button.setAttribute('aria-label',labels[dataset]+' · '+set.name);button.title=set.name;
    const image=document.createElement('img');image.src=logo;image.alt='';image.loading='lazy';image.decoding='async';
    button.append(image);group.append(button);
   }
   form.querySelector('.personal-icon-grid').append(group);
  }));
 }
 async function openPersonalAlbumEditor(id){
   editing=id;
   form.querySelector('form').reset();form.querySelector('.personal-icon-selector').open=false;
   const album=read().find(a=>a.id===editing);
   if(album)for(const field of ['name','columns','rows','pages'])form.querySelector('[name="'+field+'"]').value=album[field];
   const title=album?'Editar álbum personal':'Crear álbum personal';
   form.setAttribute('aria-label',title);form.querySelector('h2').textContent=title;
   form.querySelector('[type="submit"]').textContent=album?'Guardar cambios':'Crear álbum';
   form.querySelector('.personal-error').textContent='';form.showModal();
   const expected=editing;form.querySelector('.personal-icon-grid').inert=true;form.querySelector('[name="icon"]').disabled=true;form.querySelector('[type="submit"]').disabled=true;
   await loadIcons();
   form.querySelector('.personal-icon-grid').inert=false;form.querySelector('[type="submit"]').disabled=false;form.querySelector('[name="icon"]').disabled=false;
   if(form.open&&editing===expected){form.querySelector('[name="icon"]').value=album?.icon||'';updateIcon();}

 }
 function managePocket(c,index,valid){
  const dialog=document.createElement('dialog');dialog.className='album-config-dialog';dialog.setAttribute('aria-label','Gestionar bolsillo');
  dialog.innerHTML='<h2>'+esc(c.name)+'</h2><p>'+esc([labels[c.dataset],c.setName,c.number,c.rarity,c.variant].filter(Boolean).join(' · '))+'</p><p>Bolsillo '+(index+1)+' · '+(ChiniWorkspace.owned(c)?'En tu colección':'Faltante')+'</p><label>Bolsillo de destino<input type="number" min="1" value="'+(index+1)+'"></label><div class="album-config-actions"><button data-act="move">Mover o intercambiar</button><button data-act="copy">Copiar</button><button data-act="change">Cambiar carta</button><button data-act="remove">Vaciar bolsillo</button><button data-act="close">Cerrar</button></div><p role="alert"></p>';
  document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.onclick=async event=>{const action=event.target.dataset.act;if(!action)return;if(action==='close'){dialog.close();return;}if(!valid()){dialog.close();return;}
   const album=read().find(a=>a.id===selected),dest=Number(dialog.querySelector('input').value)-1;
   if(['move','copy'].includes(action)&&(!Number.isInteger(dest)||dest<0||dest>=album.pages*album.rows*album.columns)){dialog.querySelector('[role=alert]').textContent='Destino fuera del álbum';return;}
   if(action==='change'){dialog.close();pick(index);return;}
   if(action==='remove'&&!confirm('¿Vaciar este bolsillo? La colección conserva sus cantidades.'))return;
   if(action==='copy'&&album.slots[dest]&&dest!==index&&!confirm('¿Sustituir la carta del bolsillo de destino?'))return;
   await mutate(a=>{if(action==='remove')delete a.slots[index];else if(action==='copy')a.slots[dest]=structuredClone(a.slots[index]);else if(action==='move'&&dest!==index){const other=a.slots[dest];a.slots[dest]=a.slots[index];if(other)a.slots[index]=other;else delete a.slots[index];}});dialog.close();
  };dialog.showModal();
 }
 document.getElementById('collectionContent').addEventListener('click',e=>{
  if(turning)return;
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-personal-create')||b.hasAttribute('data-personal-edit'))openPersonalAlbumEditor(b.hasAttribute('data-personal-edit')?selected:'');
  if(b.dataset.personalOpen){selected=b.dataset.personalOpen;owner=key();page=0;collectionMode='personal';renderCollection();commitNavigation();}
  if(b.hasAttribute('data-personal-share')){ChiniWorkspace.request('/tcg-workspace/shares','POST',{kind:'album',albumId:selected}).then(link=>alert('Enlace revocable de lectura: '+ChiniWorkspace.shareURL(link.token))).catch(error=>alert(error.message));}
  if(b.hasAttribute('data-personal-back')){selected='';setCollectionMode('album');}
  if(b.hasAttribute('data-personal-page'))turnPersonalPage(Number(b.dataset.personalPage));
  if(b.hasAttribute('data-personal-add-page'))mutate(a=>{if(a.pages<100){a.pages++;page=a.pages-1;}});
  if(b.hasAttribute('data-personal-pick'))pick(Number(b.dataset.personalPick));
  if(b.hasAttribute('data-personal-remove'))mutate(a=>{delete a.slots[b.dataset.personalRemove];});
  if(b.hasAttribute('data-personal-view')){
   const c=read().find(a=>a.id===selected)?.slots[b.dataset.personalView];
   if(c){
    const id=selected,context=key(),index=Number(b.dataset.personalView);
    const valid=()=>selected===id&&key()===context&&collectionMode==='personal';
    if(!ChiniWorkspace.cache.documents.ui?.data.enable3D){managePocket(c,index,valid);return;}
    openCard3D(c,b.querySelector('img'),{
     remove:()=>{if(valid()){mutate(a=>{delete a.slots[index];});document.querySelector('[data-personal-pick="'+index+'"]')?.focus({preventScroll:true});}},
     change:()=>{if(valid())pick(index);}
    });
   }
  }
 });
})();
