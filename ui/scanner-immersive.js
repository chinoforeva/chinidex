/* Presentation only: camera, matching, collections and prices use the existing app. */
(() => {
 const $ = id => document.getElementById(id), esc = value => escapeHtml(String(value ?? ''));
 const dialog = document.querySelector('.scanner-dialog');
 dialog.classList.add('scanner-immersive');
 dialog.dataset.state = 'idle';
 const indicator = document.createElement('div'); indicator.className = 'scanner-device';
 indicator.innerHTML = '<span class="scanner-live-dot"></span><span id="scannerDeviceName">Cámara sin iniciar</span><span id="scannerResolution"></span>';
 dialog.append(indicator);
 const settings=document.createElement('details');settings.className='scanner-settings';
 settings.innerHTML='<summary aria-label="Configurar cámara">⚙ Cámara</summary><label>Dispositivo<select id="scannerCameraDevice"><option value="">Cámara automática</option></select></label><p>Captura automática · Sin guardar fotografías</p><p>Reconocimiento disponible: Pokémon, One Piece y Riftbound.</p>';
 dialog.append(settings);
 let selectedDevice='';
 $('scannerCameraDevice').onchange=async event=>{selectedDevice=event.target.value;settings.open=false;await startScannerCamera();};
 const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.classList.add('scanner-detection'); svg.setAttribute('aria-hidden','true');
 const outline = document.createElementNS(svg.namespaceURI,'path'); svg.append(outline);
 $('scannerStage').append(svg);
 let quad = null, recognized = false, lastCard = null, lastAccepted = null, lastContext = null, selectedCondition = '', motion = 0;
 const conditionNames={M:'Mint',MT:'Mint',NM:'Near Mint',EX:'Excellent',EXC:'Excellent',LP:'Lightly Played',MP:'Moderately Played',HP:'Heavily Played',DM:'Damaged'};
 function showConditions(card, result) {
  const raw=card.prices?.raw;
  if(!raw || typeof raw!=='object')return;
  const entries=Object.entries(raw).filter(([key,quote])=>conditionNames[key] && quote && Number(quote.market)>0);
  if(!entries.length)return;
  const host=result.querySelector('.scanner-popup-fields');if(!host)return;
  const item=document.createElement('div');item.innerHTML='<dt>Estado / precio</dt><dd><select aria-label="Condición del precio"><option value="">Precio general</option></select></dd>';
  const select=item.querySelector('select');
  for(const [key] of entries)select.append(new Option(conditionNames[key],key));
  select.onchange=()=>{
   selectedCondition=select.value;
   const quote=raw[select.value],market=scannerMarketPrice(card),price=result.querySelector('.scanner-popup-price');
   price.querySelector('span').textContent=quote?'Precio · '+conditionNames[select.value]:card.prices?.estimated?'Precio estimado':'Precio general';
   price.querySelector('strong').textContent=quote?cardDisplayPrice({...card,price:Number(quote.market),currency:quote.currency||card.currency}):market.formatted;
  };
  host.append(item);
 }
 function draw() {
  const video = $('scannerVideo'), rect = video.getBoundingClientRect();
  if (!quad || !video.videoWidth || !rect.width) { outline.setAttribute('d',''); return; }
  // Match object-fit: contain: coordinates refer to the full, undistorted video.
  const scale = Math.min(rect.width/video.videoWidth,rect.height/video.videoHeight);
  const w = video.videoWidth*scale, h = video.videoHeight*scale;
  const left = (rect.width-w)/2, top = (rect.height-h)/2;
  const points = quad.map(([x,y]) => [left+x*w,top+y*h]);
  svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
  const segments = points.map((p,i) => {
   const prev = points[(i+3)%4], next = points[(i+1)%4];
   const toward = q => {const ratio=Math.min(.22,24/Math.hypot(q[0]-p[0],q[1]-p[1]));return [p[0]+(q[0]-p[0])*ratio,p[1]+(q[1]-p[1])*ratio];};
   return `M${toward(prev).join(',')} L${p.join(',')} L${toward(next).join(',')}`;
  });
  outline.setAttribute('d',segments.join(' '));
 }
 const observer = new ResizeObserver(draw); observer.observe($('scannerStage'));
 function detection(points) {
  cancelAnimationFrame(motion);
  if(points && quad && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
   const from=quad, start=performance.now();
   const step=now=>{const t=Math.min(1,(now-start)/120);quad=points.map((p,i)=>p.map((value,j)=>from[i][j]+(value-from[i][j])*t));draw();if(t<1)motion=requestAnimationFrame(step);};
   motion=requestAnimationFrame(step);
  }else{quad=points;draw();}
  if (!points) {recognized=false;lastCard=null;if(dialog.dataset.state!=='recognizing')dialog.dataset.state='idle';}
  else if (!recognized && dialog.dataset.state!=='recognizing') dialog.dataset.state='detecting';
 }
 function status(text, error) {
  if (error) {dialog.dataset.state='error';return text;}
  if (/Identificando|Analizando/.test(text)) dialog.dataset.state='recognizing';
  else if (/identificada|guardada|vista en esta sesión/i.test(text)) dialog.dataset.state='recognized';
  if (recognized && /localizada|Buscando|quieta/.test(text)) return lastAccepted ? 'Carta reconocida · Retírala y muestra otra para continuar' : 'Coincidencia provisional · Revisa la carta o ajusta el ángulo';
  return text;
 }
 async function camera(stream) {
  const track=stream?.getVideoTracks()[0], settings=track?.getSettings() || {};
  $('scannerDeviceName').textContent=track?.label && track.label.length<60 ? track.label : 'Webcam activa';
  $('scannerResolution').textContent=settings.width && settings.height ? `${settings.width} × ${settings.height}` : '';
  dialog.dataset.state='detecting';
  try {
   const devices=await navigator.mediaDevices.enumerateDevices();
   if(scannerStream!==stream)return;
   const select=$('scannerCameraDevice');select.replaceChildren(new Option('Cámara automática',''));
   for(const device of devices.filter(d=>d.kind==='videoinput'))select.append(new Option(device.label||'Cámara',device.deviceId));
   select.value=selectedDevice;
  }catch{/* Camera may work even when enumeration is restricted. */}
  if(track) track.addEventListener('ended',()=>{if(scannerStream===stream){setScannerStatus('Cámara desconectada. Pulsa «Cambiar cámara» para reconectar.',true);prepareScannerCameraAccess('La cámara se ha desconectado.');}},{once:true});
 }
 function reset() {quad=null;recognized=false;lastCard=null;dialog.dataset.state='idle';draw();$('scannerDeviceName').textContent='Cámara sin iniciar';$('scannerResolution').textContent='';}
 function alternatives() {
  return scannerMatches.length>1?`<details class="scanner-popup-alternatives"><summary>Otras coincidencias</summary>${scannerMatches.map((item,index)=>index===scannerSelectedMatch?'':`<button onclick="selectScannerMatch(${index})">${esc(item.record.name)} · ${esc(item.record.setName||item.record.setId)} · #${esc(item.record.number)} · ${esc(scannerVariantLabel(item.record.variant))} · ${esc(item.context.lang.toUpperCase())}</button>`).join('')}</details>`:'';
 }
 function render(card, match) {
  const result=$('scannerResult'), accepted=scannerAccepted;
  if(lastCard?.id===card.id && lastContext===match.context.key && lastAccepted===accepted)return;
  lastAccepted=accepted;lastContext=match.context.key;
  recognized=true; lastCard=card;selectedCondition='';dialog.dataset.state=accepted?'recognized':'detecting';
  const percent=match.confidence!=null && Number.isFinite(Number(match.confidence)) ? Math.max(0,Math.min(100,Number(match.confidence))) : null;
  result.classList.toggle('scanner-popup-provisional',!accepted);
  if(scannerDestination==='locate') {
   renderScannerAlbumLocation(card,match.context,accepted);
   result.insertAdjacentHTML('afterbegin',`<div class="scanner-popup-heading"><span>${scannerManualSelection?'✓ Selección manual':accepted?'✓ Carta detectada':'Coincidencia por verificar'}</span>${percent!=null?`<span>${Math.round(percent)} %</span>`:''}</div>`);
   if(!accepted)result.insertAdjacentHTML('beforeend',`<button class="scanner-action" onclick="selectScannerMatch(${scannerSelectedMatch})">Confirmar identificación, sin guardar</button>`+alternatives());
   return;
  }
  const market=scannerMarketPrice(card);
  const row=(label,value)=>value?`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`:'';
  const flags={en:'🇬🇧',es:'🇪🇸',jp:'🇯🇵',ja:'🇯🇵',cn:'🇨🇳',zh:'🇨🇳'};
  const rarity=card.rarity?displayRarityLabel(card.rarity):'';
  result.innerHTML=`<div class="scanner-popup-heading"><span><i class="scanner-popup-check" aria-hidden="true">${accepted?'✓':'!'}</i>${scannerManualSelection?'Selección manual':accepted?'Carta detectada':'Revisa la coincidencia'}</span><small>Reconocimiento ${scannerManualSelection?'manual':'automático'}</small></div>
   <div class="scanner-popup-card"><img src="${esc(repairCardImage(card))}" alt="${esc(card.name)}" onerror="handleCardImageError(this)"><div class="scanner-popup-content"><h3>${esc(card.name)}</h3><p>${esc(card.setName||card.setSlug)}</p>${rarity?`<span class="scanner-meta-chip"><span aria-hidden="true">◇</span> ${esc(rarity)}</span>`:''}
   <dl class="scanner-popup-fields">${row('Nombre',card.name)}${row('Colección / Set',card.setName||card.setSlug)}${row('Número',card.number)}${rarity?`<div><dt>Rareza</dt><dd><span class="scanner-meta-chip">${esc(rarity)}</span></dd></div>`:''}${row('Idioma',`${match.context.label} ${flags[match.context.lang]||''}`)}${row('Variante',scannerVariantLabel(card.variant))}</dl>
   <div class="scanner-popup-price"><span>${card.prices?.estimated?'Precio estimado':'Precio general'}</span><strong>${esc(market.formatted)}</strong></div>
   ${percent!=null?`<div class="scanner-popup-confidence"><span>Similitud orientativa</span><strong>${Math.round(percent)} %</strong><meter min="0" max="100" value="${percent}" aria-label="Indicador de similitud, no probabilidad calibrada"></meter></div>`:''}
   </div></div>
   ${scannerDestination==='pokedex'?scannerAlbumGuideHTML(card,match.context):''}
   <div class="scanner-confirm-actions"><button class="scanner-confirm" onclick="confirmScannedCard()"><span aria-hidden="true">＋</span>${scannerDestination==='pokedex'?'Añadir a ¡Hazte con todos!':'Añadir a colección'}</button><button class="scanner-action" id="scannerOpenDetail"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 3H6v18h12V7zM14 3v5h5M9 12h6M9 16h6"/></svg>Ver ficha</button></div>
   ${!accepted?'<p class="scanner-popup-note">Coincidencia provisional. Comprueba edición y variante antes de añadir.</p>':''}
   <p class="scanner-popup-note">Revisa carta, expansión, idioma y variante. Este indicador no es una probabilidad calibrada; la cámara no verifica holografía ni conservación.</p>${alternatives()}`;
  $('scannerOpenDetail').onclick=()=>{
   // The existing detail stays above the live scanner; closing it returns here.
   $('cardModal').classList.add('scanner-detail');
   openModal(card.id,{card,history:false});
  };
  // Enrich from the existing saved set, never a live external price request.
  if(card.setSlug) {
   apiFetch(`/${match.context.dataRoot}/sets/${encodeURIComponent(card.setSlug)}/set.json`).then(set=>{
    const raw=set.cards?.find(item=>item.id===card.id);if(!raw || lastCard!==card)return;
    Object.assign(card, {price:raw.price ?? card.price,prices:raw.prices || card.prices,currency:raw.currency || card.currency});
    const saved=scannerMarketPrice(card), price=result.querySelector('.scanner-popup-price');
    if(price && saved.available){price.querySelector('strong').textContent=saved.formatted;price.querySelector('span').textContent=card.prices?.estimated?'Precio estimado':'Precio general';}
    showConditions(card,result);
   }).catch(()=>{});
  }
 }
 window.ChiniScannerView={detection,status,camera,reset,render,
  constraints:()=>selectedDevice?{deviceId:{exact:selectedDevice},width:{ideal:1920},height:{ideal:1080}}:null,
  conditionFor:id=>lastCard?.id===id?selectedCondition:null,
  cardFor:(id,context)=>lastCard?.id===id && lastContext===context?lastCard:null,
  clearDevice:()=>{selectedDevice='';}
 };
 $('scannerMode').addEventListener('change',()=>{recognized=false;lastCard=null;});
 $('scannerFlipButton').textContent='Cambiar cámara';
 $('scannerCaptureButton').hidden=true;
})();

