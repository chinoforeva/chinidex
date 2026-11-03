(()=>{
 const labels={pokemon:'Pokémon TCG',onepiece:'One Piece TCG',riftbound:'Riftbound',magic:'Magic: The Gathering'};
 const sharedParams=new URLSearchParams(location.search);
 let selected=sharedParams.get('sharedUser')||'',page=1,epoch=0,controller,timer;
 const root=()=>document.getElementById('view-users');
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function request(params){
  controller?.abort();controller=new AbortController();
  if(selected && sharedParams.get('share'))params.share=sharedParams.get('share');
  const response=await fetch('/tcg-users?'+new URLSearchParams(params),{cache:'no-store',signal:controller.signal});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'No se pudieron cargar las colecciones. Vuelve a intentarlo.');}
  return response.json();
 }
 function shell(){
  root().innerHTML=`<h2>Usuarios</h2><div class="users-toolbar"><button type="button" id="usersBack" hidden>← Usuarios</button><input id="usersQuery" type="search" placeholder="Buscar usuario" aria-label="Buscar usuario"><select id="usersGame" aria-label="Filtrar por juego" hidden><option value="">Todos los juegos</option>${Object.entries(labels).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select><button type="button" id="usersRefresh">Actualizar</button></div><h3 id="usersTitle"></h3><p id="usersStatus" role="status"></p><div id="usersResults"></div><div id="usersPages"></div>`;
  document.getElementById('usersBack').onclick=()=>{selected='';document.getElementById('usersQuery').value='';document.getElementById('usersGame').value='';page=1;load();};
  document.getElementById('usersRefresh').onclick=()=>load();
  document.getElementById('usersQuery').oninput=()=>{epoch++;controller?.abort();clearTimeout(timer);timer=setTimeout(()=>{page=1;load();},250);};
  document.getElementById('usersGame').onchange=()=>{page=1;load();};
 }
 async function load(){
  clearTimeout(timer);const token=++epoch;
  const query=document.getElementById('usersQuery'),game=document.getElementById('usersGame'),status=document.getElementById('usersStatus'),results=document.getElementById('usersResults'),pages=document.getElementById('usersPages');
  document.getElementById('usersBack').hidden=!selected;game.hidden=!selected;
  query.placeholder=selected?'Buscar carta o colección':'Buscar usuario';query.setAttribute('aria-label',query.placeholder);
  document.getElementById('usersTitle').textContent=selected?`Colección de ${selected}`:'';
  status.textContent='Cargando…';results.replaceChildren();pages.replaceChildren();
  try{
   const data=await request(selected?{user:selected,q:query.value,game:game.value,page}:{});
   if(token!==epoch)return;
   if(!selected){
    const users=data.users.filter(u=>u.name.toLocaleLowerCase().includes(query.value.toLocaleLowerCase()));
    status.textContent=users.length?`${users.length} usuarios`:'No hay usuarios con colecciones guardadas que coincidan.';
    results.className='users-list';results.innerHTML=users.map((u,i)=>`<button type="button" data-user-index="${i}" class="users-person"><span class="users-avatar">${esc(u.name.slice(0,1).toUpperCase())}</span><strong>${esc(u.name)}</strong><span>${u.count} cartas · ${u.quantity} ejemplares</span><small>${u.games.map(g=>esc(labels[g])).join(' · ')}</small></button>`).join('');
    results.querySelectorAll('button').forEach(button=>button.onclick=()=>{selected=users[button.dataset.userIndex].name;query.value='';page=1;load();});
   }else{
    status.textContent=data.total?`${data.total} cartas · Solo lectura`:'No hay cartas que mostrar.';
    results.className='users-cards';
    results.innerHTML=data.cards.map((c,i)=>{
     const original=c.localImage||c.image||'';
     // Only use local NAS assets, never another user's remote URL.
     const image=/^\/(?:TCG\/)?(?:scrydex|tcgx|es|jp|cn|magic|onepiece|riftbound)-data\//i.test(original)?original:'';
     c.image=image;c.localImage=image;
     return `<button type="button" class="users-card" data-card-index="${i}" aria-label="Ver ${esc(c.name)} en 3D">${image?`<img src="${esc(window.ChiniCatalogue?.thumbnail(image)||image)}" alt="${esc(c.name)}" loading="lazy">`:'<span class="users-no-image">Sin imagen</span>'}${cardSummaryHTML(c)}<small>×${c.quantity}${c.inPokedex||c.section==='pokedex'?' · Pokédex':''}</small></button>`;
    }).join('');
    results.querySelectorAll('button').forEach(button=>button.onclick=()=>{const c=data.cards[button.dataset.cardIndex],img=button.querySelector('img');if(img)window.openCard3D?.(c,img);});
    if(data.pages>1){pages.innerHTML=`<button type="button" id="usersPrev" ${page===1?'disabled':''}>Anterior</button><span>${page} / ${data.pages}</span><button type="button" id="usersNext" ${page>=data.pages?'disabled':''}>Siguiente</button>`;document.getElementById('usersPrev').onclick=()=>{page--;load();};document.getElementById('usersNext').onclick=()=>{page++;load();};}
   }
  }catch(error){if(token===epoch&&error.name!=='AbortError')status.textContent=error.message;}
 }
 window.loadCollectionUsers=()=>{if(!document.getElementById('usersQuery'))shell();load();};
})();


