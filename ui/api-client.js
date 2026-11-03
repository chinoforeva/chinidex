/* One transport for the NAS frontend and the GitHub Pages frontend. */
(() => {
 'use strict';
 const nativeFetch=window.fetch.bind(window),versions=new Map();
 const stored=localStorage.getItem('chinidex-api-origin')||window.CHINI_CONFIG?.apiBase||'';
 const apiBase=stored.replace(/\/$/,'');let token=null,csrf=null;
 const dataPath=/^\/(?:TCG\/|tcg\/)?(?:(?:scrydex|es|jp|cn|onepiece(?:-jp)?|riftbound|magic|tcgx)-data\/|previews-v1\/)/;
 const isApi=url=>/^\/(?:tcg-|ip-https-status|healthz|readyz)/.test(url.pathname)||dataPath.test(url.pathname);
 function endpoint(input){const u=new URL(input,location.href);return apiBase&&u.origin===location.origin&&isApi(u)?new URL(u.pathname+u.search,apiBase).href:u.href;}
 function asset(input){if(!input)return '';if(/^(?:TCG\/)?(?:scrydex|es|jp|cn|onepiece(?:-jp)?|riftbound|magic)-data\//.test(input))input='/'+input;const u=new URL(input,location.href);if(dataPath.test(u.pathname))return endpoint(u.href);return u.origin===location.origin||apiBase&&u.origin===new URL(apiBase).origin?u.href:'';}
 function configure(value){
  const u=new URL(value);if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(u.hostname))throw Error('Introduce el origen HTTPS de tu servidor, sin rutas ni credenciales.');
  localStorage.setItem('chinidex-api-origin',u.origin);location.reload();
 }
 async function request(input,options={}){
  const original=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);
  if(!isApi(original))return nativeFetch(input,options);
  const setMatch=/^\/(?:TCG\/)?((?:scrydex|es|jp|cn|onepiece(?:-jp)?|riftbound|magic)-data)\/sets\/([^/]+)\/set\.json$/.exec(original.pathname);
  const url=setMatch?endpoint('/tcg-catalogue-set?'+new URLSearchParams({catalogue:setMatch[1],set:decodeURIComponent(setMatch[2])})):endpoint(original.href),headers=new Headers(input instanceof Request?input.headers:options.headers),method=(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  if(token)headers.set('Authorization','Bearer '+token);
  if(!['GET','HEAD'].includes(method)&&csrf)headers.set('X-CSRF-Token',csrf);
  if(original.pathname==='/tcg-collection'&&method==='POST'){
   if(!versions.has(url)){const current=await request(original.href,{cache:'no-store'});if(!current.ok)return current;}
   if(versions.has(url))headers.set('If-Match',versions.get(url));
  }
  const target=new URL(url),cross=target.origin!==location.origin;
  const response=await nativeFetch(input instanceof Request?new Request(url,input):url,{...options,method,headers,credentials:cross?'omit':'same-origin',cache:'no-store'});
  if(response.ok&&original.pathname==='/tcg-auth/login'){
   const session=await response.clone().json();token=session.token||null;csrf=session.csrf||null;
  }
  if(response.ok&&original.pathname==='/tcg-auth/session')csrf=(await response.clone().json()).csrf;
  if(response.ok&&original.pathname==='/tcg-auth/logout'){token=null;csrf=null;versions.clear();}
  if(original.pathname==='/tcg-collection'&&response.ok&&response.headers.get('ETag'))versions.set(url,response.headers.get('ETag'));
  if(response.status===401){token=null;csrf=null;versions.clear();window.dispatchEvent(new Event('chini-session-expired'));}
  return response;
 }
 window.fetch=request;
 window.ChiniApi={endpoint,asset,configure,apiBase,basePath:location.pathname.replace(/(?:index\.html)?$/,'')};
 window.logoutChini=async()=>{await request('/tcg-auth/session');const response=await request('/tcg-auth/logout',{method:'POST'});if(!response.ok)throw Error('No se pudo cerrar la sesión');window.chiniCsrf=null;window.chiniAuthenticatedUser=null;location.reload();};
 document.addEventListener('DOMContentLoaded',()=>{
  if(location.hostname.endsWith('.github.io')&&!apiBase){
   const dialog=document.createElement('dialog');dialog.className='server-setup';
   dialog.innerHTML='<form><h1>Conecta tu colección</h1><p>Introduce la dirección HTTPS del servidor donde guardas tus cartas.</p><label>Servidor<input type="url" name="server" placeholder="https://tu-servidor" required></label><p role="alert"></p><button type="submit">Conectar</button></form>';
   document.body.append(dialog);dialog.addEventListener('cancel',e=>e.preventDefault());dialog.querySelector('form').onsubmit=e=>{e.preventDefault();try{configure(new FormData(e.target).get('server'));}catch(error){dialog.querySelector('[role=alert]').textContent=error.message;}};dialog.showModal();
  }
 });
})();
