/* Authenticated preferences use the existing account and collection storage. */
window.ChiniAccount={
 async request(url,options={}){
  const session=await fetch('/tcg-auth/session',{cache:'no-store'}).then(r=>r.json());
  if(!session.user)throw Error('Inicia sesión para gestionar tu cuenta.');
  const response=await fetch(url,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf,...options.headers},cache:'no-store'});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'No se pudo completar la operación.');}
  return response.json();
 },
 async mount(host){
  if(!host||host.querySelector('[data-account-panel]'))return;
  const panel=document.createElement('section');panel.className='m-panel';panel.dataset.accountPanel='';host.append(panel);
  panel.innerHTML='<h3>Privacidad y datos</h3><p role="status">Cargando cuenta…</p>';
  try{
   const prefs=await this.request('/tcg-preferences');if(!panel.isConnected)return;
   panel.innerHTML=`<h3>Privacidad y datos</h3><p>Los perfiles antiguos requieren que el titular elija su visibilidad. Hasta entonces, el acceso anónimo está bloqueado.</p><label for="accountVisibility">Visibilidad</label><select id="accountVisibility"><option value="pending" disabled>Pendiente de elección</option><option value="private">Privada</option><option value="public">Pública</option><option value="shared">Por enlace de lectura</option></select><label for="accountCurrency">Moneda preferida</label><select id="accountCurrency"><option>EUR</option><option>USD</option><option>JPY</option><option>GBP</option></select><p>En público o por enlace se muestran tu nombre de perfil, cartas, expansiones, variantes, idiomas, cantidades e imágenes. Se excluyen precios de compra, ubicaciones, notas y datos de acceso. No se convierten monedas sin un tipo de cambio verificable.</p><button type="button" id="accountSave">Guardar preferencias</button><button type="button" id="accountShare">Crear o renovar enlace</button><button type="button" id="accountRevoke">Revocar enlace</button><button type="button" id="accountExport">Exportar mis datos</button><button type="button" id="accountHistory">Ver historial</button><button type="button" onclick="logoutChini()">Cerrar sesión</button><p role="status" id="accountStatus"></p><div id="accountHistoryRows"></div>`;
   const find=id=>panel.querySelector('#'+id),status=text=>{find('accountStatus').textContent=text;};
   find('accountVisibility').value=prefs.visibility;find('accountCurrency').value=prefs.currency;
   const run=fn=>async()=>{try{await fn();}catch(error){status(error.message);}};
   find('accountSave').onclick=run(async()=>{await this.request('/tcg-preferences',{method:'POST',body:JSON.stringify({visibility:find('accountVisibility').value,currency:find('accountCurrency').value})});status('Preferencias guardadas.');});
   find('accountShare').onclick=run(async()=>{const data=await this.request('/tcg-preferences/share',{method:'POST'});const url=new URL(window.ChiniApi?.basePath||'/TCG/',location.origin);url.searchParams.set('sharedUser',data.user);url.searchParams.set('share',data.token);url.hash='/pokemon/en/users';status('Enlace de solo lectura: '+url.href);});
   find('accountRevoke').onclick=run(async()=>{await this.request('/tcg-preferences/share',{method:'DELETE'});status('Enlace revocado.');});
   find('accountExport').onclick=run(async()=>{const data=await this.request('/tcg-export'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='chinidex-datos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Exportación preparada.');});
   find('accountHistory').onclick=run(async()=>{const data=await this.request('/tcg-history'),rows=find('accountHistoryRows');rows.replaceChildren();if(!data.changes.length)status('Sin cambios registrados desde esta actualización.');const events=await this.request('/tcg-workspace/history');for(const entry of events.events){const row=document.createElement('p');row.textContent=entry.created_at+' · '+entry.kind+' · '+entry.target;if(entry.reversible){const undo=document.createElement('button');undo.textContent='Deshacer';undo.onclick=run(async()=>{if(!confirm('¿Deshacer este cambio?'))return;await this.request('/tcg-workspace/history/'+entry.id+'/undo',{method:'POST',body:'{}'});await ChiniWorkspace.load();status('Cambio deshecho.');find('accountHistory').click();});row.append(undo);}rows.append(row);}for(const change of data.changes){const row=document.createElement('p'),button=document.createElement('button');row.textContent=change.created_at+' · '+change.username+' ';button.textContent='Deshacer';button.onclick=run(async()=>{if(!confirm('¿Restaurar la colección anterior a este cambio?'))return;await this.request('/tcg-undo',{method:'POST',body:JSON.stringify({id:change.id})});await loadCollectionForCurrentUser();refreshCurrentView();status('Cambio deshecho.');});row.append(button);rows.append(row);}});
   window.ChiniAccess?.mount(panel);
   if(window.chiniOpenHistory){window.chiniOpenHistory=false;find('accountHistory').click();}
  }catch(error){panel.querySelector('[role=status]').textContent=error.message;}
 }
};

