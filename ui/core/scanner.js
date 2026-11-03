function scannerContexts() {
    return [
        { key: 'pokemon_es', game: 'pokemon', lang: 'es', label: 'Pokémon · Español', dataRoot: GAME_CONFIGS.pokemon.dataRoot.es },
        { key: 'pokemon_en', game: 'pokemon', lang: 'en', label: 'Pokémon · Inglés', dataRoot: GAME_CONFIGS.pokemon.dataRoot.en },
        { key: 'pokemon_jp', game: 'pokemon', lang: 'jp', label: 'Pokémon · Japonés', dataRoot: GAME_CONFIGS.pokemon.dataRoot.jp },
        { key: 'pokemon_cn', game: 'pokemon', lang: 'cn', label: 'Pokémon · Chino', dataRoot: GAME_CONFIGS.pokemon.dataRoot.cn },
        { key: 'onepiece_en', game: 'onepiece', lang: 'en', label: 'One Piece', dataRoot: GAME_CONFIGS.onepiece.dataRoot.en },
        { key: 'riftbound_en', game: 'riftbound', lang: 'en', label: 'Riftbound', dataRoot: GAME_CONFIGS.riftbound.dataRoot.en }
    ];
}

function activeScannerContext() {
    return scannerContexts().find(context => context.game === currentGame && context.lang === currentLang) || scannerContexts()[0];
}

function scannerIndexUrl(context = activeScannerContext()) {
    return `/${context.dataRoot}/scan-index.json`;
}

function scannerRecordToCard(record, context = activeScannerContext()) {
    const card = normalizeLocalCard({
        id: record.id,
        setId: record.setId,
        setName: record.setName,
        number: record.number,
        name: record.name,
        baseName: record.baseName,
        variant: record.variant,
        rarity: record.rarity,
        price: record.price,
        productId: record.productId,
        category: record.category,
        language: record.language,
        languageCode: record.languageCode,
        currency: record.currency,
        source: record.source,
        sourceUrl: record.sourceUrl,
        localImage: record.localImage,
        image: record.localImage || ''
    }, record.setId, context.dataRoot);
    card.setName = record.setName || allSets.find(s => s.slug === record.setId)?.name || record.setId;
    card.languageCode = record.languageCode || context.lang;
    card.englishId = record.englishId || null; card.englishSetId = record.englishSetId || null;
    card.language = record.language || (card.languageCode === 'jp' ? 'Japanese' : card.languageCode === 'en' ? 'English' : card.languageCode);
    return card;
}

async function loadScannerIndex(context = activeScannerContext()) {
    const key = context.key;
    if (scannerIndexCache.has(key)) return scannerIndexCache.get(key);
    const promise = fetch(scannerIndexUrl(context), { cache: 'no-store' }).then(async response => {
        if (!response.ok) throw new Error('El índice visual todavía no está disponible.');
        const data = await response.json();
        if (!Array.isArray(data.cards) || !data.cards.length) throw new Error('El índice visual está vacío.');
        return data.cards;
    }).catch(error => {
        scannerIndexCache.delete(key);
        throw error;
    });
    scannerIndexCache.set(key, promise);
    return promise;
}

function setScannerStatus(message, isError = false) {
    const status = document.getElementById('scannerStatus');
    status.textContent = message || '';
    status.classList.toggle('error', !!isError);
}

async function refreshScannerEngineStatus(maxAttempts = 1) {
    scannerNeuralAvailable = false;
    scannerNeuralCardCount = 0;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await fetch('/tcg-card-ai-status', { cache: 'no-store' });
            const data = await response.json().catch(() => ({}));
            scannerNeuralAvailable = response.ok && data.ok && data.model === 'tcg-ar-arcface-resnet50';
            if (scannerNeuralAvailable && data.catalogues && typeof data.catalogues === 'object') {
                scannerNeuralCardCount = Object.values(data.catalogues)
                    .reduce((total, count) => total + (Number(count) || 0), 0);
            }
        } catch (error) {
            scannerNeuralAvailable = false;
            scannerNeuralCardCount = 0;
        }
        if (scannerNeuralAvailable || attempt + 1 >= maxAttempts) break;
        const label = document.getElementById('scannerCatalogueLabel');
        label.textContent = `Arrancando IA neuronal local… intento ${attempt + 2} de ${maxAttempts}`;
        await new Promise(resolve => setTimeout(resolve, 700));
    }
    const label = document.getElementById('scannerCatalogueLabel');
    const destinationLabel = scannerDestination === 'locate' ? 'Identificar hueco del álbum, sin guardar' : scannerDestination === 'pokedex'
        ? 'Destino automático: álbum inglés o japonés'
        : 'Destino: colección normal';
    label.textContent = scannerNeuralAvailable
        ? `${destinationLabel} · juego, idioma y expansión automáticos`
        : `${destinationLabel} · IA neuronal local no disponible`;
    return scannerNeuralAvailable;
}

async function recognizeScannerWithNeuralEngine(canvas, capturedImages = null, epoch = scannerEpoch) {
    const response = await fetch('/tcg-card-recognize', {
        method: 'POST',
        signal: scannerRequestController?.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            images: capturedImages?.length ? capturedImages : [canvas.toDataURL('image/jpeg', 0.92)],
            mode: 'fast',
            contexts: scannerDestination !== 'collection'
                ? scannerContexts().filter(context => context.game === 'pokemon' && POKEDEX_ALBUM_LANGUAGES.has(context.lang)).map(context => context.key)
                : undefined,
            limit: 5,
        }),
    });
    const data = await response.json().catch(() => ({}));
    if (epoch !== scannerEpoch || scannerSaving || Date.now() < scannerHoldUntil) return false;
    scannerAccepted = !!data.accepted;
    scannerManualSelection = false;
    if (!response.ok) throw new Error(data.error || 'La IA local todavía no está disponible.');
    if (!Array.isArray(data.matches) || !data.matches.length) {
        scannerMatches = [];
        scannerSelectedMatch = 0;
        showScannerFailure(data.reason || 'No se pudo reconocer la carta. Prueba con más luz.');
        setScannerStatus(data.reason || 'No se pudo reconocer la carta. Prueba con más luz.', true);
        return false;
    }
    const contexts = scannerContexts();
    scannerMatches = data.matches.map(match => {
        const fullContext = contexts.find(context => context.key === match.context?.key) || activeScannerContext();
        return {
            record: match.record,
            context: fullContext,
            score: 1 - Number(match.similarity || 0),
            confidence: match.confidence == null ? null : Number(match.confidence),
            neural: true,
        };
    });
    scannerSelectedMatch = 0;
    return true;
}

async function openCardScanner(destination = 'collection', options = {}) {
    if(currentGame==='magic'){alert('El motor actual no reconoce Magic. Selecciona Pokémon, One Piece o Riftbound.');return;}
    if(currentGame==='onepiece'&&currentLang!=='en'){alert('El motor actual reconoce One Piece EN. El catálogo japonés no tiene un modelo de reconocimiento validado; selecciona el catálogo inglés para escanear.');return;}
    scannerDestination = ['pokedex', 'locate'].includes(destination) ? destination : 'collection';
    if (!(await ensureCollectionUser())) return;
    await loadScannerTargetCollection();
    const overlay = document.getElementById('scannerOverlay');
    if (!overlay.classList.contains('show')) scannerLocateSeen.clear();
    if (options.history !== false && !overlay.classList.contains('show')) {
        saveNavigationSnapshot();
        history.pushState({...history.state, scanner:true, scannerDestination, depth:(history.state?.depth||0)+1}, '', location.href);
    }
    document.getElementById('scannerMode').value = scannerDestination;
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.getElementById('scannerCatalogueLabel').textContent = 'Iniciando reconocimiento neuronal local…';
    resetScannerResult();
    prepareScannerCameraAccess();
    const cameraEpoch = scannerEpoch;
    await refreshScannerEngineStatus(8);
    if (cameraEpoch === scannerEpoch && document.getElementById('scannerOverlay').classList.contains('show') && !scannerNeedsSecureConnection() && navigator.mediaDevices?.getUserMedia) await startScannerCamera();
}

function closeCardScanner(options = {}) {
    const goBack = options.history !== false && history.state?.scanner === true;
    stopScannerCamera();
    const overlay = document.getElementById('scannerOverlay');
    document.querySelector('.scanner-dialog')?.classList.remove('show-result');
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (scannerObjectUrl) URL.revokeObjectURL(scannerObjectUrl);
    scannerObjectUrl = '';
    document.getElementById('scannerFileInput').value = '';
    if (goBack) history.back();
}

function closeScannerAndOpenPokedex(number, lang) {
    closeCardScanner({history:false});
    if (history.state?.scanner) {
        const {scanner, scannerDestination, ...entry} = history.state;
        history.replaceState(entry, '', location.href);
    }
    openPokedexAt(number, lang);
}

async function changeScannerMode(mode) {
    stopScannerCamera();
    scannerSaving = false;
    scannerDestination = ['pokedex', 'locate'].includes(mode) ? mode : 'collection';
    if (history.state?.scanner) history.replaceState({...history.state, scannerDestination}, '', location.href);
    const epoch = scannerEpoch;
    await loadScannerTargetCollection();
    if (epoch !== scannerEpoch || !document.getElementById('scannerOverlay').classList.contains('show')) return;
    resetScannerResult();
    prepareScannerCameraAccess();
    const cameraEpoch = scannerEpoch;
    await refreshScannerEngineStatus(8);
    if (cameraEpoch === scannerEpoch && document.getElementById('scannerOverlay').classList.contains('show') && !scannerNeedsSecureConnection() && navigator.mediaDevices?.getUserMedia) await startScannerCamera();
}

function stopScannerCamera() {
    clearTimeout(scannerRevealTimer);
    scannerHoldUntil = 0;
    document.querySelector('.scanner-dialog')?.classList.remove('continuous');
    scannerEpoch++;
    scannerCamera.stop();
    window.ChiniScannerView?.reset();
    scannerRequestController?.abort();
    scannerCaptureBusy = false;
    document.getElementById('scannerStage')?.classList.remove('revealed', 'analyzing');
    const recognized = document.getElementById('scannerRecognized');
    if (recognized) {recognized.onload = null; recognized.removeAttribute('src');}
    if (scannerStream) scannerStream.getTracks().forEach(track => track.stop());
    scannerStream = null;
    document.getElementById('scannerStage')?.classList.remove('camera-live');
    const video = document.getElementById('scannerVideo');
    video.pause();
    video.srcObject = null;
}

function scannerNeedsSecureConnection() {
    const host = location.hostname.toLowerCase();
    return location.protocol !== 'https:' && host !== 'localhost' && host !== '127.0.0.1';
}

async function openIpHttps() {
    try {
        const response=await fetch('/ip-https-status',{cache:'no-store'});
        if(!response.ok) throw new Error('Reinicia los servicios con ACTIVAR HTTPS IP desde la carpeta del NAS.');
        const data=await response.json();
        if(!data.available || !/^https:\/\//i.test(data.url)) throw new Error('HTTPS todavía no está configurado. En Docker, configura un acceso HTTPS de confianza y PUBLIC_HTTPS_URL; en Windows, consulta Red y acceso en el dashboard.');
        const target=new URL(data.url);target.pathname=location.pathname;target.search=location.search;target.hash=location.hash;location.assign(target.href);
    }catch(error){setLiveAlbumStatus(error.message,true);alert(error.message);}
}

function scannerCameraAccessHTML(message = '', secureRedirect = false, showAction = true) {
    const action = !showAction ? '' : secureRedirect
        ? '<button class="scanner-camera-access-button" type="button" onclick="openIpHttps()">Abrir cámara con HTTPS</button>'
        : '<button class="scanner-camera-access-button" type="button" onclick="startScannerCamera()">Acceder a cámara</button>';
    return `<div class="scanner-camera-access">
        <div class="scanner-camera-access-icon" aria-hidden="true"></div>
        <strong>Cámara en vivo</strong>
        ${message ? `<span class="scanner-camera-access-message">${escapeHtml(message)}</span>` : ''}
        ${action}
    </div>`;
}

function prepareScannerCameraAccess(message = '') {
    stopScannerCamera();
    const stage = document.getElementById('scannerStage');
    const video = document.getElementById('scannerVideo');
    const preview = document.getElementById('scannerPreview');
    const placeholder = document.getElementById('scannerPlaceholder');
    document.querySelector('.scanner-dialog')?.classList.remove('show-result');
    stage.classList.remove('has-capture', 'camera-live');
    stage.classList.add('awaiting-permission');
    video.classList.remove('visible');
    preview.classList.remove('visible');
    placeholder.innerHTML = scannerCameraAccessHTML(message, scannerNeedsSecureConnection());
    placeholder.style.display = 'grid';
    document.getElementById('scannerCaptureButton').disabled = true;
    setScannerStatus('');
}

async function startScannerCamera() {
    stopScannerCamera();
    const epoch = scannerEpoch;
    document.querySelector('.scanner-dialog')?.classList.remove('show-result');
    const stage = document.getElementById('scannerStage');
    const video = document.getElementById('scannerVideo');
    const preview = document.getElementById('scannerPreview');
    const placeholder = document.getElementById('scannerPlaceholder');
    stage.classList.remove('has-capture', 'camera-live');
    stage.classList.add('awaiting-permission');
    preview.classList.remove('visible');
    video.classList.remove('visible');
    placeholder.style.display = 'grid';
    document.getElementById('scannerCaptureButton').disabled = true;
    setScannerStatus('Acepta el permiso de cámara para continuar…');
    if (!navigator.mediaDevices?.getUserMedia) {
        const secureRedirect = scannerNeedsSecureConnection();
        placeholder.innerHTML = scannerCameraAccessHTML(
            secureRedirect ? '' : 'Cámara no disponible en este navegador.',
            secureRedirect,
            secureRedirect
        );
        setScannerStatus('', !secureRedirect);
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: window.ChiniScannerView?.constraints() || { facingMode: { ideal: scannerFacingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
        });
        if (epoch !== scannerEpoch) {stream.getTracks().forEach(track => track.stop()); return;}
        scannerStream = stream;

        video.srcObject = scannerStream;
        await video.play();
        const frameDeadline=Date.now()+8000;
        while(epoch===scannerEpoch && (video.readyState<2 || !video.videoWidth || !video.videoHeight)){
            if(Date.now()>frameDeadline)throw Error('La cámara no entrega vídeo. Prueba otra cámara o carga una foto.');
            await new Promise(resolve=>setTimeout(resolve,50));
        }
        if (epoch !== scannerEpoch) return;
        window.ChiniScannerView?.camera(stream);
        video.classList.add('visible');
        stage.classList.remove('awaiting-permission');
        stage.classList.add('camera-live');
        placeholder.style.display = 'none';
        document.getElementById('scannerCaptureButton').disabled = false;
        if (epoch !== scannerEpoch) return;
        document.querySelector('.scanner-dialog')?.classList.add('continuous');
        scannerCamera.start(video);
        setScannerStatus('Escaneo continuo: muestra una carta. Detectaremos su sección automáticamente.');
    } catch (error) {
        if (epoch !== scannerEpoch) return;
        stage.classList.remove('camera-live');
        stage.classList.add('awaiting-permission');
        if(scannerStream)scannerStream.getTracks().forEach(track=>track.stop());
        scannerStream=null;video.srcObject=null;
        const denied = ({NotAllowedError:'Permiso de cámara no concedido. Puedes cargar una foto.',NotFoundError:'No se encontró ninguna cámara. Puedes cargar una foto.',NotReadableError:'La cámara está ocupada o no se puede leer. Cierra otras aplicaciones o carga una foto.'})[error?.name] || error.message || 'No se pudo reproducir la cámara. Puedes cargar una foto.';
        placeholder.innerHTML = scannerCameraAccessHTML(denied, scannerNeedsSecureConnection());
        setScannerStatus('', true);
    }
}

async function switchScannerCamera() {
    window.ChiniScannerView?.clearDevice();
    scannerFacingMode = scannerFacingMode === 'environment' ? 'user' : 'environment';
    await startScannerCamera();
}

function handleScannerFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024){setScannerStatus('Usa JPEG, PNG o WebP de hasta 12 MB.',true);event.target.value='';return;}
    stopScannerCamera();
    resetScannerResult();
    const epoch = scannerEpoch;
    if (scannerObjectUrl) URL.revokeObjectURL(scannerObjectUrl);
    scannerObjectUrl = URL.createObjectURL(file);
    const stage = document.getElementById('scannerStage');
    const preview = document.getElementById('scannerPreview');
    const video = document.getElementById('scannerVideo');
    const placeholder = document.getElementById('scannerPlaceholder');
    document.querySelector('.scanner-dialog')?.classList.remove('show-result');
    stage.classList.remove('has-capture', 'camera-live', 'awaiting-permission');
    video.classList.remove('visible');
    preview.classList.remove('visible');
    preview.onload = () => {
        if (epoch !== scannerEpoch) return;
        stage.classList.add('has-capture');
        document.querySelector('.scanner-dialog')?.classList.remove('continuous');
        document.getElementById('scannerCaptureButton').hidden=false;
        preview.classList.add('visible');
        placeholder.style.display = 'none';
        document.getElementById('scannerCaptureButton').disabled = false;
        setScannerStatus('Foto lista. Pulsa Escanear para analizarla.');
    };
    preview.onerror=()=>{setScannerStatus('El archivo no contiene una imagen válida. Selecciona otra foto.',true);document.getElementById('scannerCaptureButton').disabled=true;};
    preview.src = scannerObjectUrl;
}

function scannerSourceRect(media) {
    const sw = media.tagName === 'VIDEO' ? media.videoWidth : media.naturalWidth;
    const sh = media.tagName === 'VIDEO' ? media.videoHeight : media.naturalHeight;
    return sw && sh ? {sx:0, sy:0, sw, sh} : null;
}

async function recognizeContinuousScanner(images) {
    if (scannerCaptureBusy || scannerSaving || Date.now() < scannerHoldUntil || !scannerStream || document.hidden) return;
    const epoch = scannerEpoch;
    const stage = document.getElementById('scannerStage');
    const preview = document.getElementById('scannerPreview');
    scannerCaptureBusy = true;
    const controller = new AbortController();
    scannerRequestController = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
        stage.classList.add('analyzing');
        setScannerStatus('Identificando carta, idioma y expansión…');
        if (scannerDestination === 'locate' && !scannerMatches.length) document.getElementById('scannerResult').innerHTML = '<div class="scanner-result-empty" role="status">Analizando la imagen de la carta… Si el servidor no responde en 12 segundos, reintentaremos automáticamente.</div>';
        document.querySelector('.scanner-dialog')?.classList.add('show-result');
        const previous = scannerMatches[scannerSelectedMatch];
        const previousKey = previous ? previous.context.key + ':' + previous.record.id : '';
        const found = await recognizeScannerWithNeuralEngine(document.getElementById('scannerCanvas'), images, epoch);
        if (epoch !== scannerEpoch || scannerSaving || Date.now() < scannerHoldUntil) return;
        document.querySelector('.scanner-dialog')?.classList.add('show-result');
        if (scannerDestination === 'locate') {
            if (found) renderScannerConfirmation();
            return found ? scannerAccepted : undefined;
        }
        if (!found) return;
        const match = scannerMatches[scannerSelectedMatch];
        const key = match.context.key + ':' + match.record.id;
        if (key !== previousKey || !scannerAccepted) renderScannerConfirmation();
        setScannerStatus(scannerAccepted
            ? `${match.context.label} · ${match.record.setName || match.record.setId || ''}. Puedes mostrar otra carta; el escaneo sigue activo.`
            : `Posible carta: ${match.record.name}. Puedes confirmarla o elegir otra alternativa; el escaneo continúa.`);
        return scannerAccepted;
    } catch (error) {
        if (epoch !== scannerEpoch || scannerSaving || Date.now() < scannerHoldUntil) return;
        const message = error.name === 'AbortError' ? 'El reconocimiento ha tardado demasiado. Reintentando…' : 'No se pudo identificar: ' + error.message;
        showScannerFailure(message);
        setScannerStatus(message, true);
    } finally {
        clearTimeout(timeout);
        if (epoch === scannerEpoch) {
            scannerCaptureBusy = false;
            stage.classList.remove('analyzing');
        }
    }
}

async function captureScannerFrame(automaticImages = null) {
    if (scannerCaptureBusy) return;
    scannerCaptureBusy = true;
    scannerCamera.stop();
    const epoch = scannerEpoch;
    scannerRequestController?.abort();
    const requestController = new AbortController();
    scannerRequestController = requestController;
    const timeout = setTimeout(() => requestController.abort(), 65000);
    try {
    const video = document.getElementById('scannerVideo');
    const preview = document.getElementById('scannerPreview');
    const media = video.classList.contains('visible') ? video : preview.classList.contains('visible') ? preview : null;
    if (!media) return;
    if (!scannerNeuralAvailable) {
        setScannerStatus('Esperando a que termine de arrancar la IA neuronal local…');
        const ready = await refreshScannerEngineStatus(4);
        if (!ready) {
            setScannerStatus('La IA neuronal local no está disponible. No se usará el comparador antiguo para evitar resultados incorrectos.', true);
            return;
        }
    }
    const canvas = document.getElementById('scannerCanvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const capturedImages = automaticImages?.length ? automaticImages.slice(0, 3) : [];
    const captureCount = media === video && scannerNeuralAvailable ? 3 : 1;
    if (captureCount > 1) setScannerStatus('Capturando varios fotogramas para evitar desenfoques…');
    for (let capture = 0; !automaticImages?.length && capture < captureCount; capture++) {
        const source = scannerSourceRect(media);
        if (!source) { setScannerStatus('La imagen todavía no está lista.', true); return; }
        const scale = Math.min(1, 1280 / Math.max(source.sw, source.sh));
        canvas.width = Math.round(source.sw * scale); canvas.height = Math.round(source.sh * scale);
        context.drawImage(media, source.sx, source.sy, source.sw, source.sh, 0, 0, canvas.width, canvas.height);
        capturedImages.push(canvas.toDataURL('image/jpeg', 0.92));
        if (capture + 1 < captureCount) await new Promise(resolve => setTimeout(resolve, 120));
    }
    if (epoch !== scannerEpoch) return;
    if (media === video) video.pause();
    preview.onload = null;
    preview.src = capturedImages[capturedImages.length - 1];
    preview.classList.add('visible');
    video.classList.remove('visible');
    document.getElementById('scannerStage').classList.remove('camera-live');
    document.getElementById('scannerStage').classList.add('has-capture', 'analyzing');
    document.querySelector('.scanner-dialog')?.classList.add('show-result');
    document.getElementById('scannerCaptureButton').disabled = true;
    setScannerStatus('Comparando la captura con las cartas del ordenador…');
    document.getElementById('scannerResult').innerHTML = '<div class="scanner-loader"><div class="spinner"></div><span>Analizando con la IA neuronal local…</span></div>';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
        const recognized = await recognizeScannerWithNeuralEngine(canvas, capturedImages, epoch);
        if (epoch !== scannerEpoch) return;
        if (!recognized) return;
        renderScannerConfirmation();
        if (scannerAccepted) revealScannerCard(epoch);
        setScannerStatus(scannerAccepted ? 'Carta reconocida. Confirma la edición y el acabado antes de añadirla.' : 'Resultado dudoso. Compara las alternativas o repite la captura.');
    } catch (error) {
        if (epoch !== scannerEpoch) return;
        if (error.name === 'AbortError') {showScannerFailure('El análisis ha tardado demasiado. Vuelve a intentarlo.'); return;}
        showScannerFailure(error.message || 'No se pudo analizar la carta.');
        setScannerStatus(error.message || 'No se pudo analizar la carta.', true);
        document.getElementById('scannerCaptureButton').disabled = false;
    }
    } finally {
        clearTimeout(timeout);
        if (epoch === scannerEpoch) {
            scannerCaptureBusy = false;
            document.getElementById('scannerStage').classList.remove('analyzing');
            document.getElementById('scannerCaptureButton').disabled = false;
            const liveVideo = document.getElementById('scannerVideo');
            if (scannerStream && liveVideo.classList.contains('visible') && !liveVideo.paused) scannerCamera.start(liveVideo);
        }
    }
}

function revealScannerCard(epoch = scannerEpoch) {
    const match = scannerMatches[scannerSelectedMatch];
    if (!match) return;
    const image = document.getElementById('scannerRecognized');
    document.getElementById('scannerStage').classList.remove('revealed');
    image.onload = () => {
        if (epoch === scannerEpoch && document.getElementById('scannerOverlay').classList.contains('show'))
            requestAnimationFrame(() => {if (epoch === scannerEpoch) document.getElementById('scannerStage').classList.add('revealed');});
    };
    image.src = repairCardImage(scannerRecordToCard(match.record, match.context));
}

function showScannerFailure(message) {
    if (scannerStream) {
        document.getElementById('scannerResult').innerHTML = `<div class="scanner-result-empty"><p>${escapeHtml(message)}</p><p>El escaneo continúa automáticamente. Mantén la carta visible o prueba otro ángulo.</p></div>`;
        setScannerStatus(message + ' Reintentando automáticamente…', true);
        return;
    }
    document.getElementById('scannerResult').innerHTML = `<div class="scanner-result-empty"><p>${escapeHtml(message)}</p><button class="scanner-action primary" onclick="scanAnotherCard()">Repetir captura</button></div>`;
    setScannerStatus(message, true);
}

function scannerPixels(source, width, height, cropFraction = 0, offsetX = 0, offsetY = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const inset = Math.max(0, Math.min(0.2, 0.012 + cropFraction));
    const sourceWidth = source.width * (1 - inset * 2);
    const sourceHeight = source.height * (1 - inset * 2);
    const sourceX = Math.max(0, Math.min(source.width - sourceWidth, source.width * (inset + offsetX)));
    const sourceY = Math.max(0, Math.min(source.height - sourceHeight, source.height * (inset + offsetY)));
    context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    return context.getImageData(0, 0, width, height).data;
}

function buildScannerFeature(source, cropFraction = 0, offsetX = 0, offsetY = 0) {
    const output = new Uint8Array(176);
    const lumaPixels = scannerPixels(source, 8, 12, cropFraction, offsetX, offsetY);
    const luma = new Array(96);
    let mean = 0;
    for (let i = 0; i < 96; i++) {
        const p = i * 4;
        luma[i] = 0.299 * lumaPixels[p] + 0.587 * lumaPixels[p + 1] + 0.114 * lumaPixels[p + 2];
        mean += luma[i];
    }
    mean /= 96;
    let variance = 0;
    for (const value of luma) variance += (value - mean) ** 2;
    const deviation = Math.max(12, Math.sqrt(variance / 96));
    for (let i = 0; i < 96; i++) output[i] = Math.max(0, Math.min(255, Math.round(128 + ((luma[i] - mean) / deviation) * 42)));

    const chromaPixels = scannerPixels(source, 4, 6, cropFraction, offsetX, offsetY);
    const cb = new Array(24);
    const cr = new Array(24);
    let cbMean = 0;
    let crMean = 0;
    for (let i = 0; i < 24; i++) {
        const p = i * 4;
        const r = chromaPixels[p];
        const g = chromaPixels[p + 1];
        const b = chromaPixels[p + 2];
        cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b;
        cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b;
        cbMean += cb[i];
        crMean += cr[i];
    }
    cbMean /= 24;
    crMean /= 24;
    for (let i = 0; i < 24; i++) {
        output[96 + i * 2] = Math.max(0, Math.min(255, Math.round(128 + cb[i] - cbMean)));
        output[97 + i * 2] = Math.max(0, Math.min(255, Math.round(128 + cr[i] - crMean)));
    }

    const horizontal = scannerPixels(source, 9, 16, cropFraction, offsetX, offsetY);
    const vertical = scannerPixels(source, 8, 17, cropFraction, offsetX, offsetY);
    const grayAt = (pixels, index) => {
        const p = index * 4;
        return 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
    };
    let bitIndex = 0;
    const setBit = enabled => {
        if (enabled) output[144 + (bitIndex >> 3)] |= 1 << (7 - (bitIndex & 7));
        bitIndex++;
    };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) setBit(grayAt(horizontal, y * 9 + x) < grayAt(horizontal, y * 9 + x + 1));
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) setBit(grayAt(vertical, y * 8 + x) < grayAt(vertical, (y + 1) * 8 + x));
    return output;
}

function buildScannerFeatureVariants(source) {
    // The physical card rarely fills the guide with pixel precision. These
    // variants tolerate a small border and slight horizontal/vertical drift.
    const variants = [
        [0, 0, 0], [0.02, 0, 0], [0.04, 0, 0], [0.06, 0, 0], [0.08, 0, 0],
        [0.05, -0.018, 0], [0.05, 0.018, 0], [0.05, 0, -0.018], [0.05, 0, 0.018]
    ];
    return variants.map(([crop, x, y]) => buildScannerFeature(source, crop, x, y));
}

function decodeScannerFeature(record) {
    if (record._decodedFeature) return record._decodedFeature;
    const binary = atob(record.feature);
    const decoded = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) decoded[i] = binary.charCodeAt(i);
    record._decodedFeature = decoded;
    return decoded;
}

function scannerFeatureDistance(query, reference) {
    let lumaDistance = 0;
    let chromaDistance = 0;
    let differentBits = 0;
    for (let i = 0; i < 96; i++) lumaDistance += Math.abs(query[i] - reference[i]);
    for (let i = 96; i < 144; i++) chromaDistance += Math.abs(query[i] - reference[i]);
    for (let i = 144; i < 176; i++) differentBits += scannerPopcount[query[i] ^ reference[i]];
    const lumaScore = lumaDistance / (96 * 255);
    const chromaScore = chromaDistance / (48 * 255);
    const hashScore = differentBits / 256;
    return lumaScore * 0.55 + chromaScore * 0.20 + hashScore * 0.25;
}

function findScannerMatches(features, records, limit, context = activeScannerContext()) {
    const queryFeatures = features instanceof Uint8Array ? [features] : features;
    const best = [];
    for (const record of records) {
        const reference = decodeScannerFeature(record);
        let score = Infinity;
        for (const feature of queryFeatures) score = Math.min(score, scannerFeatureDistance(feature, reference));
        if (best.length < limit || score < best[best.length - 1].score) {
            best.push({ record, score, context });
            best.sort((a, b) => a.score - b.score);
            if (best.length > limit) best.pop();
        }
    }
    return best;
}

function scannerConfidence(score, explicitPercent = null) {
    const percent = explicitPercent == null
        ? Math.max(1, Math.min(99, Math.round(100 - score * 240)))
        : Math.max(1, Math.min(99, Math.round(explicitPercent)));
    const label = percent >= 78 ? 'Coincidencia alta' : percent >= 55 ? 'Coincidencia probable' : 'Revisa con atención';
    return { percent, label };
}

function scannerVariantLabel(variant) {
    const labels = {
        normal: 'Normal',
        holofoil: 'Holo',
        reverseHolofoil: 'Holo reversa',
        firstEdition: 'Primera edición',
        firstEditionHolofoil: 'Primera edición holo',
        altArt: 'Arte alternativo',
        foil: 'Foil'
    };
    return labels[variant] || variant || '';
}

function scannerMarketPrice(card) {
    const quote=ChiniPrices.quote(card);
    if(quote.value==null)return {available:false,formatted:'Sin datos',note:'Esta impresión no tiene un precio guardado verificable.'};
    return {available:true,value:quote.value,formatted:ChiniPrices.format(quote),note:[quote.source||'Fuente no indicada',quote.updatedAt||'Sin fecha',quote.metric||'Tipo no indicado'].join(' · ')};
}

function selectScannerMatch(index) {
    scannerSelectedMatch = index;
    scannerManualSelection = true;
    scannerAccepted = true;
    scannerCamera.lastRecognized = true;
    scannerCamera.manualSelection = true;
    scannerHoldUntil = scannerDestination === 'locate' ? 0 : Date.now() + 8000;
    scannerRequestController?.abort();
    renderScannerConfirmation();
    setScannerStatus(scannerDestination === 'locate' ? 'Identificación confirmada manualmente · No se ha guardado nada.' : 'Edición seleccionada manualmente. Puedes añadirla o mostrar otra carta.');
}

function renderScannerAlbumLocation(card, context, accepted) {
    const result = document.getElementById('scannerResult');
    const state = ChiniPokedex.classifyCard(card, pokedexCollectionForLanguage(context.lang));
    if (!state.species || !state.location) {
        result.innerHTML = '<div class="scanner-result-empty">Esta carta no corresponde a un hueco de la Pokédex. Muestra otra carta.</div>';
        return;
    }
    const key = context.key + ':' + card.id;
    const seen = scannerLocateSeen.has(key);
    if (accepted) scannerLocateSeen.add(key);
    const registered = state.kind === 'duplicate';
    const status = registered ? 'YA REGISTRADA EN TU ÁLBUM' : state.kind === 'new-variant' ? 'VARIANTE SIN REGISTRAR · YA TIENES ESTE POKÉMON' : 'SIN REGISTRAR EN TU ÁLBUM';
    result.innerHTML = `<div class="scanner-locate-result ${seen ? 'already-seen' : !accepted ? 'uncertain' : 'first-seen'}" role="status" aria-live="polite">
        <div class="scanner-locate-session">${seen ? (accepted ? '↻ YA VISTA EN ESTA SESIÓN' : '↻ POSIBLE CARTA YA VISTA EN ESTA SESIÓN') : !accepted ? 'COINCIDENCIA PROVISIONAL · AJUSTA EL ÁNGULO' : '✦ PRIMERA VEZ EN ESTA SESIÓN'}</div>
        <div class="scanner-match-card"><div class="scanner-card-image-wrap"><img src="${escapeHtml(repairCardImage(card))}" alt="${escapeHtml(card.name)}" onerror="handleCardImageError(this)"></div><div class="scanner-match-content"><h3>${escapeHtml(card.name)}</h3><div>${escapeHtml(card.setName || card.setSlug)} · #${escapeHtml(card.number || '')}</div><p>${escapeHtml(scannerVariantLabel(card.variant) || 'Normal')}</p><strong class="scanner-locate-owned ${registered ? 'registered' : ''}">${status}</strong>${registered ? `<p>${state.exact?.quantity || 1} copia(s) guardada(s)</p>` : ''}</div></div>
        <div class="scanner-locate-position"><strong>#${String(state.species.number).padStart(4,'0')} ${escapeHtml(state.species.name)}</strong><p>${escapeHtml(pokedexLocationText(state.location, context.lang))}</p></div>
        <p class="scanner-locate-note">Solo identificación · No se guarda ni se modifica ninguna carta. Muestra la siguiente carta; la cámara sigue activa.</p>
    </div>`;
    setScannerStatus(!accepted ? 'Posible carta: ' + card.name + '. Ajusta el ángulo para verificarla; no se ha guardado nada.' : seen ? 'Ya vista en esta sesión · Puedes mostrar otra carta.' : 'Carta identificada · Ubicación del álbum encontrada.');
}

function renderScannerConfirmation() {
    const match = scannerMatches[scannerSelectedMatch];
    const result = document.getElementById('scannerResult');
    if (!match) {
        result.innerHTML = '<div class="scanner-result-empty">No se encontró una coincidencia. Prueba otra vez con más luz y la carta bien alineada.</div>';
        return;
    }
    const card = scannerRecordToCard(match.record, match.context);
    const image = repairCardImage(card);
    if (window.ChiniScannerView) { window.ChiniScannerView.render(card, match); return; }
    const confidence = scannerConfidence(match.score, match.confidence);
    const rarity = displayRarityLabel(card.rarity);
    const variant = scannerVariantLabel(card.variant);
    if (scannerDestination === 'locate') { renderScannerAlbumLocation(card, match.context, scannerAccepted); return; }
    const market = scannerMarketPrice(card);
    const albumGuide = scannerAlbumGuideHTML(card, match.context);
    const alternatives = scannerMatches.map((item, index) => ({ item, index })).filter(item => item.index !== scannerSelectedMatch).slice(0, 3);
    result.innerHTML = `
        <div class="scanner-result-kicker">Comprobación previa${match.neural ? ' · IA local' : ''}</div>
        <h3 class="scanner-result-title">¿Es esta tu carta?</h3>
        <div class="scanner-match-card">
            <div class="scanner-card-image-wrap">
                <img src="${escapeHtml(image)}" alt="${escapeHtml(card.name)}" onerror="handleCardImageError(this)">
                <span class="scanner-card-number">#${escapeHtml(card.number || '—')}</span>
            </div>
            <div class="scanner-match-content">
                <div class="scanner-match-name">${escapeHtml(card.name)}</div>
                <div class="scanner-match-set">${escapeHtml(card.setName || card.setSlug)}</div>
                <div class="scanner-meta-chips">
                    <span class="scanner-meta-chip">${escapeHtml(match.context.label)}</span>
                    ${rarity ? `<span class="scanner-meta-chip">${escapeHtml(rarity)}</span>` : ''}
                    ${variant ? `<span class="scanner-meta-chip">${escapeHtml(variant)}</span>` : ''}
                </div>
                <span class="scanner-confidence">${scannerAccepted ? 'Coincidencia verificada' : 'Coincidencia dudosa · confirma manualmente'}</span>
            </div>
        </div>
        ${albumGuide}
        <div class="scanner-market-panel">
            <div class="scanner-market-copy">
                <span class="scanner-market-label">Valor de mercado</span>
                <span class="scanner-market-note">${escapeHtml(market.note)}</span>
            </div>
            <strong class="scanner-market-value${market.available ? '' : ' missing'}">${escapeHtml(market.formatted)}</strong>
        </div>
        <div class="scanner-confirm-actions">
            ${scannerDestination === 'locate' ? '' : `<button class="scanner-confirm" onclick="confirmScannedCard()">${scannerDestination === 'pokedex' ? 'Sí, añadir a ¡Hazte con Todos!' : 'Sí, añadir a mi colección normal'}</button>`}
            <button class="scanner-retry" onclick="scanAnotherCard()">No, repetir escaneo</button>
        </div>
        ${alternatives.length ? `<div class="scanner-alternatives">
            <div class="scanner-alternatives-label">¿Se parece más a una de estas?</div>
            ${alternatives.map(({ item, index }) => {
                const alt = scannerRecordToCard(item.record, item.context);
                const altImage = repairCardImage(alt);
                const altMarket = scannerMarketPrice(alt);
                return `<button class="scanner-alt" onclick="selectScannerMatch(${index})">
                    <img src="${escapeHtml(altImage)}" alt="" onerror="handleCardImageError(this)">
                    <span class="scanner-alt-copy"><strong>${escapeHtml(alt.name)}</strong>${escapeHtml(alt.setName || alt.setSlug)} · #${escapeHtml(alt.number)}${alt.variant ? ' · ' + escapeHtml(scannerVariantLabel(alt.variant)) : ''}</span>
                    <span class="scanner-alt-price">${escapeHtml(altMarket.formatted)}</span>
                </button>`;
            }).join('')}
        </div>` : ''}`;
}

async function switchScannerCollectionContext(context) {
    if (!context || (context.game === currentGame && context.lang === currentLang)) return;
    currentGame = context.game;
    currentLang = context.lang;
    localStorage.setItem('chiniLang', currentLang);
    updateGameUI();
    collection = {};
    pricingCache = {};
    setCardsCache = {};
    resetTcgState();
    await loadCollectionForCurrentUser();
}

async function confirmScannedCard() {
    if (scannerDestination === 'locate') return;
    if (scannerSaving) return;
    scannerSaving = true;
    scannerRequestController?.abort();
    try {
    const match = scannerMatches[scannerSelectedMatch];
    if (!match) return;
    const card = window.ChiniScannerView?.cardFor(match.record.id, match.context.key) || scannerRecordToCard(match.record, match.context);
    if (scannerDestination === 'pokedex' && (match.context.game !== 'pokemon' || !POKEDEX_ALBUM_LANGUAGES.has(match.context.lang))) {
        setScannerStatus('¡Hazte con Todos! solo admite cartas Pokémon en inglés o japonés.', true);
        return;
    }
    await switchScannerCollectionContext(match.context);
    const targetCollection = scannerTargetCollection(match.context);
    const albumStatus = scannerDestination === 'pokedex' && match.context.game === 'pokemon'
        ? ChiniPokedex.classifyCard(card, targetCollection)
        : { kind: 'not-pokemon', species: null, location: null };
    if (scannerDestination === 'pokedex' && !albumStatus.species) {
        setScannerStatus('Esta carta no tiene un hueco de especie en ¡Hazte con Todos!.', true);
        return;
    }
    const alreadyOwned = albumStatus.kind === 'duplicate' || !!targetCollection[card.id];
    const ownedKey = albumStatus.exact?.id || card.id;
    if (alreadyOwned) {
        targetCollection[ownedKey].quantity = (targetCollection[ownedKey].quantity || 1) + 1;
    } else {
        targetCollection[card.id] = {
            id: card.id,
            name: card.name,
            baseName: card.baseName || '',
            setSlug: normalizeSetSlug(card.setSlug),
            image: card.image,
            number: card.number || '',
            quantity: 1,
            condition: window.ChiniScannerView?.conditionFor(card.id) || null,
            rarity: card.rarity || '',
            variant: card.variant || '',
            productId: card.productId || null,
            category: card.category || '',
            language: card.language || '',
            languageCode: card.languageCode || currentLang,
            currency: card.currency || null,
            source: card.source || null,
            sourceUrl: card.sourceUrl || null,
            price: card.price != null ? card.price : null,
            prices: card.prices || null,
            pokedexNumber: albumStatus.species?.number || null,
            pokedexName: albumStatus.species?.name || null,
            dateAdded: new Date().toISOString()
        };
    }
    let saveResult;
    if (scannerDestination === 'pokedex') {
        pokedexAlbumLanguage = normalizePokedexLanguage(match.context.lang);
        localStorage.setItem(POKEDEX_ALBUM_LANGUAGE_KEY, pokedexAlbumLanguage);
        saveResult = await savePokedexCollection(pokedexAlbumLanguage);
    }
    else saveResult = await saveCollection();
    if (saveResult?.ok === false) { showScannerFailure('No se guardó la carta en el NAS. Reintenta después de recuperar la conexión: ' + saveResult.error); return; }
    refreshCurrentView();
    const market = scannerMarketPrice(card);
    let successTitle = `${card.name} añadida`;
    let successCopy = alreadyOwned
        ? 'Se ha sumado una copia más a tu colección normal.'
        : `La carta ya aparece en tu colección normal de ${match.context.label}.`;
    let albumAction = '';
    if (albumStatus.species) {
        const dexLabel = `#${String(albumStatus.species.number).padStart(4, '0')} ${albumStatus.species.name}`;
        const place = pokedexLocationText(albumStatus.location, match.context.lang);
        if (albumStatus.kind === 'duplicate') {
            successTitle = 'Carta repetida';
            successCopy = `${dexLabel}: ya tenías esta impresión. Ahora tienes ${targetCollection[ownedKey].quantity} copias. Colócala en ${place}.`;
        } else if (albumStatus.kind === 'new-variant') {
            successTitle = `Nueva variante de ${albumStatus.species.name}`;
            successCopy = `${dexLabel}: es una impresión nueva para tu colección. Colócala en ${place}.`;
        } else {
            successTitle = `¡Nuevo ${albumStatus.species.name}!`;
            successCopy = `${dexLabel}: has estrenado su hueco. Colócala en ${place}.`;
        }
        albumAction = `<button class="scanner-action" onclick="closeScannerAndOpenPokedex(${albumStatus.species.number},'${normalizePokedexLanguage(match.context.lang)}')">Ver hueco en el álbum ${pokedexLanguageLabel(match.context.lang).toLowerCase()}</button>`;
    }
    document.getElementById('scannerResult').innerHTML = `<div class="scanner-success"><div><div class="scanner-success-mark">✓</div><h3>${escapeHtml(successTitle)}</h3><p>${escapeHtml(successCopy)}</p>${market.available ? `<div class="scanner-success-price">Valor de mercado · ${escapeHtml(market.formatted)}</div>` : ''}<div class="scanner-confirm-actions"><button class="scanner-action primary" onclick="scanAnotherCard()">Volver a la cámara</button>${albumAction}</div></div></div>`;
    setScannerStatus(scannerDestination === 'pokedex'
        ? `Carta guardada únicamente en el álbum ${pokedexLanguageLabel(match.context.lang).toLowerCase()} de ¡Hazte con Todos!.`
        : `Colección normal de ${match.context.label} guardada correctamente.`);
    } finally {
        scannerSaving = false;
        scannerHoldUntil = Date.now() + 4500;
    }
}

function resetScannerResult() {
    scannerMatches = [];
    scannerSelectedMatch = 0;
    document.getElementById('scannerResult').innerHTML = scannerDestination === 'locate' ? '<div class="scanner-result-empty">Muestra una carta: verás si está registrada, su álbum, página y hueco en tiempo real. Las cartas vistas en esta sesión quedarán marcadas. No se guardará nada.</div>' : '<div class="scanner-result-empty">Muestra una sola carta y mantenla quieta. La cámara la capturará automáticamente. Antes de añadirla te pediremos que confirmes el resultado.</div>';
}

async function scanAnotherCard() {
    scannerHoldUntil = 0;
    scannerCamera.stop();
    scannerRequestController?.abort();
    const epoch = ++scannerEpoch;
    scannerCaptureBusy = false;
    resetScannerResult();
    document.getElementById('scannerFileInput').value = '';
    const stage = document.getElementById('scannerStage');
    const video = document.getElementById('scannerVideo');
    const preview = document.getElementById('scannerPreview');
    document.querySelector('.scanner-dialog')?.classList.remove('show-result');
    stage.classList.remove('has-capture', 'revealed', 'analyzing');
    preview.classList.remove('visible');
    if (scannerStream) {
        window.ChiniScannerView?.camera(scannerStream);
        video.classList.add('visible');
        await video.play();

        if (epoch !== scannerEpoch) return;
        stage.classList.add('camera-live');
        document.getElementById('scannerCaptureButton').disabled = false;
        document.querySelector('.scanner-dialog')?.classList.add('continuous');
        scannerCamera.start(video);
        setScannerStatus('Buscando la siguiente carta…');
    } else {
        prepareScannerCameraAccess();
    }
}

async function showView(view, options = {}) {
const presentationArguments=Array.from(arguments);globalThis.ChiniEvents?.emit('before:showView',presentationArguments);
try{

    if (view === 'collection' && !(await ensureCollectionUser())) return;
    if (view === 'catch-em-all' && currentGame !== 'pokemon') return;
    if (options.history !== false && !options.prepared) prepareNavigation();
    closeCardModal({ history: false });
    const previousView = activeViewName();
    if (previousView === 'catch-em-all' && view !== 'catch-em-all' && (liveAlbumRunning || liveAlbumStarting)) {
        stopLiveAlbumRecognition();
    }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
    const viewMap = { 'game': 'view-game', 'sets': 'view-sets', 'set-cards': 'view-set-cards', 'search': 'view-search', 'users': 'view-users', 'collection': 'view-collection', 'catch-em-all': 'view-catch-em-all' };
    document.getElementById(viewMap[view]).classList.add('active');
    const btnMap = { 'game': 'btn-game', 'sets': 'btn-sets', 'set-cards': 'btn-sets', 'search': 'btn-search', 'users': 'btn-users', 'collection': 'btn-collection', 'catch-em-all': 'btn-catch-em-all' };
    document.getElementById(btnMap[view]).classList.add('active');
    document.getElementById(btnMap[view]).setAttribute('aria-current', 'page');
    if (view === 'collection') { renderCollection(); refreshCollectionPrices(); }
    if (view === 'catch-em-all') renderPokedexBook();
    if (view === 'users') window.loadCollectionUsers?.();
    syncShellUI(view);
    toggleContextRail(false);
    if (previousView !== view) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (options.history !== false) commitNavigation();

}finally{globalThis.ChiniEvents?.emit('showView',presentationArguments);}
}

async function openModal(cardId, options = {}) {
const presentationArguments=Array.from(arguments);
try{

    if (options.history !== false) prepareNavigation();
    const request = ++detailRequest;
    let c = options.card || currentSetCards.find(x => x.id === cardId) || searchResults.find(x => x.id === cardId) || albumSetCards.find(x => x.id === cardId);
    const colCard = collection[cardId];
    if (!c && colCard) {
        c = { id: colCard.id, name: colCard.name, image: repairCardImage(colCard), setSlug: normalizeSetSlug(colCard.setSlug), setName: '', number: colCard.number || '', rarity: colCard.rarity || '', variant: colCard.variant || '', productId: colCard.productId || null, category: colCard.category || '', language: colCard.language || '', languageCode: colCard.languageCode || currentLang, currency: colCard.currency || null, source: colCard.source || null, sourceUrl: colCard.sourceUrl || null, price: colCard.price != null ? colCard.price : null, prices: colCard.prices || null, tcgplayer: currentGame === 'pokemon' && currentLang === 'en' ? pricingCache[cardId] || null : null, pricing: currentGame === 'pokemon' && currentLang === 'jp' ? pricingCache[cardId] || null : null };
    }
    if (!c) return;
    lastDetailCard = c;
    c.setSlug = normalizeSetSlug(c.setSlug);
    repairCardImage(c);
    if (LOCAL_CATALOGUE_GAMES.has(currentGame) && !c.prices && c.setSlug) {
        try {
            const dataRoot = GAME_CONFIGS[currentGame]?.dataRoot[c.languageCode] || currentDataRoot();
            const setDetail = await apiFetch(`/${dataRoot}/sets/${encodeURIComponent(c.setSlug)}/set.json`);
            const fullCard = (setDetail.cards || []).find(x => x.id === c.id);
            if (fullCard?.prices) {
                c.prices = fullCard.prices;
                c.price = fullCard.price != null ? fullCard.price : c.price;
            }
        } catch (e) {
            console.warn('No se pudieron cargar precios locales:', e.message);
        }
    }
    if (request !== detailRequest) return;
    const modalSrc = (c.image || '').replace('/medium', '/large') || '';
    const modalFallback = c.cdnImage ? c.cdnImage.replace('/medium', '/large') : null;
    const modalImg = document.getElementById('modalImg');
    modalImg.src = modalSrc;
    modalImg.onerror = modalFallback
        ? function() { this.onerror = null; this.src = modalFallback; }
        : null;
    document.getElementById('modalName').textContent = c.name + (c.number != null ? ' #' + c.number : '');
    document.getElementById('modalMeta').textContent = [displayRarityLabel(c.rarity) || 'Sin rareza', cardFinishLabel(c)].join(' · ');
    document.getElementById('modalSummaryPrice').textContent = cardDisplayPrice(c);
    document.getElementById('modalBreadcrumb').innerHTML = `<span>${escapeHtml(GAME_CONFIGS[currentGame].label)}</span> &nbsp;/&nbsp; ${escapeHtml(c.setName || currentSet?.name || c.setSlug || 'Catálogo')} &nbsp;/&nbsp; ${escapeHtml(c.name)}`;
    document.getElementById('modalChips').innerHTML = [(c.languageCode || currentLang).toUpperCase(), displayRarityLabel(c.rarity), cardFinishLabel(c)].filter(Boolean).map(value => `<span class="modal-chip">${escapeHtml(value)}</span>`).join('');
    const quote=ChiniPrices.quote(c);
    const dateAge=quote.updatedAt&&Number.isFinite(Date.parse(quote.updatedAt))?(Date.now()-Date.parse(quote.updatedAt))/86400000:null;
    const provenance=`<p>${dateAge>30?'Dato antiguo (más de 30 días) · ':dateAge==null?'Antigüedad no verificable · ':''}Fuente: ${escapeHtml(quote.source||'No indicada en el catálogo')} · Actualización: ${escapeHtml(quote.updatedAt||'Sin fecha')} · Tipo: ${escapeHtml(quote.metric||'No indicado')} · ${escapeHtml(quote.currency||'Moneda desconocida')}</p>`;
    document.getElementById('modalPrices').innerHTML = provenance+buildModalPricesHTML(c)+`<details><summary>Atributos del catálogo y trazabilidad</summary><dl>${Object.entries(c).filter(([key,value])=>!['notes','location','store','purchasePrice','purchaseDate','quantity'].includes(key)&&value!=null&&typeof value!=='object'&&!/image|url/i.test(key)).map(([key,value])=>`<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`).join('')}</dl></details>`;
    const collectionAction = document.getElementById('modalCollectionAction');
    collectionAction.textContent = collection[c.id] ? '− Quitar de colección' : '+ Añadir a colección';
    collectionAction.onclick = () => toggleModalCollection(c.id);
    const goSetBtn = document.getElementById('modalGoSet');
    if (c.setSlug) {
        goSetBtn.style.display = 'inline-block';
        goSetBtn.onclick = async () => { if(c.languageCode && c.languageCode !== currentLang) await switchLang(c.languageCode); await navigateToCardInSet(c.setSlug, cardId); };
    } else {
        goSetBtn.style.display = 'none';
    }
    document.getElementById('cardModal').classList.add('show');
    window.renderCardLanguageOptions?.(c);
    document.body.style.overflow = 'hidden';
    syncShellUI('detail', c);
    if (options.history !== false) commitNavigation();

}finally{globalThis.ChiniEvents?.emit('openModal',presentationArguments);}
}

function toggleModalCollection(cardId) {
    toggleCard(cardId);
    const button = document.getElementById('modalCollectionAction');
    if (button) button.textContent = collection[cardId] ? '− Quitar de colección' : '+ Añadir a colección';
    renderContextRail('detail', lastDetailCard);
}

function closeCardModal(options = {}) {
    detailRequest++;
    const modal = document.getElementById('cardModal');
    const fromScanner = modal.classList.contains('scanner-detail');
    if (!fromScanner && options.history !== false && modal.classList.contains('show') && history.state?.chiniNavigation === 1 && history.state.route.card && history.state.depth > 0) {
        history.back();
        return;
    }
    modal.classList.remove('show', 'scanner-detail');
    document.body.style.overflow = document.getElementById('scannerOverlay').classList.contains('show') ? 'hidden' : '';
    syncShellUI(activeViewName());
    if (fromScanner) saveNavigationSnapshot();
}

async function navigateToCardInSet(setSlug, cardId) {
    await openSet(setSlug);
    document.getElementById('setCardSearch').value = '';
    const idx = currentSetCards.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const targetPage = Math.floor(idx / cardsPerPage) + 1;
    if (targetPage !== setCardsPage) renderSetPage(targetPage);
    setTimeout(() => {
        const el = document.querySelector(`.card-tcg[data-card-id="${CSS.escape(cardId)}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// === PACK OPENING ===
let _packCards = [];
let _packRevealStep = 0;
let _packOpening = false;

function openPack() {
    if (!currentSetCards.length) return;
    _packCards = [];
    _packRevealStep = 0;
    _packOpening = false;

    document.getElementById('packSetName').textContent = currentSet.name || 'Sobre';
    document.getElementById('packCardsArea').innerHTML = '';
    document.getElementById('packCardsArea').classList.remove('show');
    document.getElementById('packVisual').classList.remove('clicked', 'hit-tension', 'opening');
    document.getElementById('packVisual').style.display = 'flex';
    document.getElementById('packActions').classList.remove('show');

    _packCards = generatePackCards();
    document.getElementById('packOverlay').classList.add('show');
}

function closePackOverlay() {
    document.getElementById('packOverlay').classList.remove('show');
    _packCards = [];
    _packRevealStep = 0;
    _packOpening = false;
}

function generatePackCards() {
    const cards = currentSetCards;
    const psa10Price = card => localPriceNumber(card?.prices?.psa10);
    const rawPrice = card => Number(card?.price);
    const psa10Cards = cards.filter(card => Number.isFinite(psa10Price(card)) && psa10Price(card) > 0);
    // Solo cartas de céntimos para los siete slots sin hit. Si un set no tiene
    // precios menores a $1, se usa el tramo más barato disponible.
    const centCards = cards.filter(card => Number.isFinite(rawPrice(card)) && rawPrice(card) > 0 && rawPrice(card) < 1);
    const cheapPool = centCards.length ? centCards : [...cards].sort((a, b) => (rawPrice(a) || Infinity) - (rawPrice(b) || Infinity)).slice(0, Math.max(1, Math.ceil(cards.length * 0.25)));

    function pickRandom(pool, usedIds) {
        const available = pool.filter(card => card?.id && !usedIds.has(card.id));
        const source = available.length ? available : pool;
        return source[Math.floor(Math.random() * source.length)] || cards[0];
    }

    // Entre los hits, la ponderación es inversa al precio PSA 10: los menos
    // caros son más probables y el peso disminuye al subir de precio.
    function pickPsa10Hit(usedIds) {
        const available = psa10Cards.filter(card => !usedIds.has(card.id));
        const pool = available.length ? available : psa10Cards;
        if (!pool.length) return null;
        const weights = pool.map(card => 1 / Math.sqrt(psa10Price(card)));
        const total = weights.reduce((sum, weight) => sum + weight, 0);
        let roll = Math.random() * total;
        for (let i = 0; i < pool.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return pool[i];
        }
        return pool[pool.length - 1];
    }

    const usedIds = new Set();
    function pickSlot(hitChance) {
        const isHit = psa10Cards.length > 0 && Math.random() < hitChance;
        const card = isHit ? pickPsa10Hit(usedIds) : pickRandom(cheapPool, usedIds);
        if (card?.id) usedIds.add(card.id);
        return { ...card, packHit: isHit };
    }

    // Posiciones: 1 = 1% hit; 2-8 = 100% cartas de céntimos; 9 y 10 = 5% hit.
    const result = [pickSlot(0.01)];
    for (let i = 1; i <= 7; i++) result.push(pickSlot(0));
    result.push(pickSlot(0.05), pickSlot(0.05));
    return result;
}

function getRarityClass(rarity) {
    const map = {
        'Common': 'c', 'Uncommon': 'u', 'Rare': 'r',
        'Rare Holo': 'rh', 'Double Rare': 'rr', 'Art Rare': 'ar',
        'Super Rare': 'sr', 'Special Art Rare': 'sar',
        'Ultra Rare': 'ur', 'Hyper Rare': 'hr',
        'ACE SPEC Rare': 'ace', 'Promo': 'promo',
        'Character Rare': 'chr', 'Character Super Rare': 'csr',
        'Triple Rare': 'rrr', 'Secret Super Rare': 'ssr',
        'Mega Attack Rare': 'mur', 'Black & White Rare': 'bwr',
        'Shiny Rare': 'shiny', 'Legend': 'legend',
        'C': 'c', 'U': 'u', 'UC': 'u', 'R': 'r', 'RR': 'rr', 'RRR': 'rrr',
        'AR': 'ar', 'SR': 'sr', 'SAR': 'sar', 'UR': 'ur', 'HR': 'hr',
        'ACE': 'ace', 'CHR': 'chr', 'CSR': 'csr', 'SSR': 'ssr'
        , 'Mythic': 'hr', 'Special': 'sr', 'Bonus': 'ur'
    };
    return map[rarity] || 'c';
}

function getGlowRarities() {
    return ['Rare Holo', 'Double Rare', 'Art Rare', 'Super Rare', 'Special Art Rare', 'Ultra Rare', 'Hyper Rare', 'ACE SPEC Rare', 'Triple Rare', 'Character Rare', 'Character Super Rare', 'Secret Super Rare', 'Mega Attack Rare', 'Black & White Rare', 'Mythic', 'Special', 'Bonus'];
}

function revealPack() {
    if (_packOpening) return;
    _packOpening = true;
    const packEl = document.getElementById('packVisual');
    const hasHit = _packCards.some(card => card.packHit);
    const openingDelay = hasHit ? 1450 : 0;
    if (hasHit) packEl.classList.add('hit-tension');

    setTimeout(() => {
        packEl.classList.remove('hit-tension');
        packEl.classList.add('opening');
    }, openingDelay);

    setTimeout(() => {
        packEl.classList.remove('opening');
        packEl.classList.add('clicked');
    }, openingDelay + 800);

    setTimeout(() => {
        packEl.style.display = 'none';
        const area = document.getElementById('packCardsArea');
        area.innerHTML = _packCards.map((c, i) => {
            const rc = getRarityClass(c.rarity);
            const glowRarities = getGlowRarities();
            const hasGlow = glowRarities.includes(c.rarity);
            return `<div class="pack-card" id="packCard${i}" data-pack-index="${i}">
                ${hasGlow ? `<div class="pack-card-glow glow-${rc}" id="packGlow${i}"></div>` : ''}
                <div class="pack-card-face">
                    <img src="${escapeHtml(repairCardImage(c))}" alt="${escapeHtml(c.name)}" loading="lazy" onerror="${imageFallbackAttr(c)}">
                    <div class="pack-card-name">${escapeHtml(c.name)}</div>
                    <div class="pack-card-rarity ${rc}">${c.rarity || ''}</div>
                </div>
                <div class="pack-card-back"></div>
            </div>`;
        }).join('');
        area.classList.add('show');

        let delay = 0;
        _packCards.forEach((_, i) => {
            setTimeout(() => {
                const el = document.getElementById('packCard' + i);
                if (el) {
                    el.classList.add('enter');
                    el.addEventListener('animationend', function rm() {
                        el.classList.remove('enter');
                        el.classList.add('entered');
                        el.removeEventListener('animationend', rm);
                    });
                }
            }, delay);
            delay += 200 + (i < 5 ? 0 : 100);
        });

        setTimeout(() => {
            document.getElementById('packActions').classList.add('show');
        }, delay + 300);
    }, openingDelay + 1180);
}

function flipPackCard(index) {
    const el = document.getElementById('packCard' + index);
    if (!el || el.classList.contains('flipped')) return;
    if (el.classList.contains('enter')) {
        el.classList.remove('enter');
        el.classList.add('entered');
    }
    el.classList.add('flipped');
    const card = _packCards[index];
    if (card && getGlowRarities().includes(card.rarity)) {
        const glow = document.getElementById('packGlow' + index);
        if (glow) setTimeout(() => glow.classList.add('show'), 100);
    }
}

function flipAllPackCards() {
    _packCards.forEach((_, i) => {
        const el = document.getElementById('packCard' + i);
        if (el && !el.classList.contains('flipped')) {
            if (el.classList.contains('enter')) {
                el.classList.remove('enter');
                el.classList.add('entered');
            }
            el.classList.add('flipped');
            const card = _packCards[i];
            if (card && getGlowRarities().includes(card.rarity)) {
                const glow = document.getElementById('packGlow' + i);
                if (glow) glow.classList.add('show');
            }
        }
    });
}

document.getElementById('packCardsArea').addEventListener('click', function(e) {
    const cardEl = e.target.closest('.pack-card');
    if (!cardEl) return;
    const idx = parseInt(cardEl.dataset.packIndex);
    if (isNaN(idx)) return;
    flipPackCard(idx);
});

document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const searchByView = {
            sets: 'setSearch',
            'set-cards': 'setCardSearch',
            search: 'globalSearch',
            collection: 'collectionSearch',
            'catch-em-all': 'pokedexJumpInput'
        };
        const target = document.getElementById(searchByView[activeViewName()]);
        if (target) {
            e.preventDefault();
            target.focus();
        }
        return;
    }
    if (e.key === 'Escape') {
        if (document.getElementById('cardModal').classList.contains('scanner-detail')) { closeCardModal({history:false}); return; }
        if (document.getElementById('userGateOverlay').classList.contains('show')) finishCollectionUserGate(false);
        toggleContextRail(false);
        if (document.getElementById('scannerOverlay').classList.contains('show')) closeCardScanner();
        if (document.getElementById('pokedexVariantsOverlay').classList.contains('show')) closePokedexVariants();
        closeCardModal();
        closePackOverlay();
    }
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden && (liveAlbumRunning || liveAlbumStarting)) stopLiveAlbumRecognition();
    if (document.hidden && scannerStream) prepareScannerCameraAccess('Cámara pausada al salir de la página.');
});
window.addEventListener('beforeunload', () => {
    if (liveAlbumRunning || liveAlbumStarting) stopLiveAlbumRecognition({ silent: true });
});
window.addEventListener('scroll', () => document.querySelector('header').classList.toggle('scrolled', window.scrollY > 10));

// Each visible screen has a URL and its own browser-history entry.
let navigationEpoch = 0;
let navigationRestoring = false;
let navigationReady = false;
let navigationSaveTimer = null;
let detailRequest = 0;
const navigationInputIds = ['searchMode', 'setSearch', 'setCardSearch', 'setCardSort', 'globalSearch', 'searchSort', 'collectionSearch', 'collectionSort', 'pokedexJumpInput'];
