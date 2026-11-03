function saveCollection() {
    if (currentGame === 'pokemon') localStorage.setItem('chiniPricing', JSON.stringify(pricingCache));
    if (!currentUser) return Promise.resolve({ ok: false, error: 'Falta el nombre de usuario' });
    return saveCollectionToServer().catch(e => {
        console.warn('Could not save collection on server:', e.message);
        loadCollectionFromServer().then(()=>refreshCurrentView()).catch(()=>{});
        alert('No se guardó el cambio: '+e.message);
        return { ok: false, error: e.message };
    });
}

function setCollectionMode(mode) {
    collectionMode = ['album','personal'].includes(mode) ? mode : 'list';
    albumSetSlug = '';
    albumSetCards = [];
    albumSpreadIndex = 0;
    albumTurnLocked = false;
    albumLoadToken++;
    clearTimeout(albumTurnFallback);
    document.getElementById('collectionTabList')?.classList.toggle('active', collectionMode === 'list');
    document.getElementById('collectionTabAlbum')?.classList.toggle('active', collectionMode === 'album');
    renderCollection();
    renderContextRail('collection');
}

function getCollectionCards() {
    let cards = Object.values(collection);
    if (collectionMode === 'list') return cards;
    const q = (document.getElementById('collectionSearch')?.value || '').toLowerCase();
    if (q) {
        cards = cards.filter(c => {
            const slug = normalizeSetSlug(c.setSlug);
            const setObj = allSets.find(s => s.slug === slug);
            return c.name.toLowerCase().includes(q) || (setObj?.name || slug || '').toLowerCase().includes(q);
        });
    }
    return cards;
}

function renderCollection() {
const presentationArguments=Array.from(arguments);
try{

    document.body.dataset.collectionMode=collectionMode;
    if(collectionMode==='personal'){renderPersonalAlbums();return;}
    const el = document.getElementById('collectionContent');
    const sortWrap = document.getElementById('collectionSortWrap');
    document.getElementById('collectionTabList')?.classList.toggle('active', collectionMode === 'list');
    document.getElementById('collectionTabAlbum')?.classList.toggle('active', collectionMode === 'album');
    if (sortWrap) sortWrap.style.display = collectionMode === 'list' ? 'flex' : 'none';
    let cards = getCollectionCards();
    if (!cards.length && !(collectionMode === 'album' && (albumSetSlug || savedAlbumSlugs().length || window.personalAlbumCount?.()))) {
        el.innerHTML = '<div class="empty-state"><h3>Tu colección está vacía</h3><p>Escanea una carta o añádela desde Sets y Buscar</p></div>';
        updateColStats([]);
        return;
    }
    if (collectionMode === 'album') {
        updateColStats(cards);
        if (albumSetSlug) renderAlbumBook();
        else renderAlbumSets(cards);
        return;
    }
    const sort = document.getElementById('collectionSort')?.value || 'name';
    cards = sortCollection(cards, sort);
    updateColStats(cards);
    el.innerHTML = `<div class="collection-list">${cards.map(c => {
        const img = repairCardImage(c);
        const price = cardDisplayPrice(c);
        const cardMeta = [displayRarityLabel(c.rarity), c.variant, price ? 'Est. ' + price : ''].filter(Boolean).join(' · ');
        return `<div class="collection-item" data-card-id="${escapeHtml(c.id)}" tabindex="0" role="button" aria-label="Ver ficha de ${escapeHtml(c.name)}">
            <div class="collection-visual">
                <img class="collection-thumb" src="${escapeHtml(img)}" alt="${escapeHtml(c.name)}" onerror="this.style.display='none'">
                <span class="collection-num">#${c.number || ''}</span>
            </div>
            <div class="collection-info">
                ${cardSummaryHTML(c)}
            </div>
            <div class="collection-item-actions">
                <div class="collection-qty">
                    <button class="qty-btn" onclick="changeQty('${c.id}',-1)" aria-label="Restar una copia de ${escapeHtml(c.name)}">−</button>
                    <span class="qty-display">${c.quantity || 1}</span>
                    <button class="qty-btn" onclick="changeQty('${c.id}',1)" aria-label="Añadir una copia de ${escapeHtml(c.name)}">+</button>
                </div>
                <button class="del-btn" onclick="removeCard('${c.id}')">Eliminar</button>
            </div>
        </div>`;
    }).join('')}</div>`;

}finally{globalThis.ChiniEvents?.emit('renderCollection',presentationArguments);}
}

function renderAlbumSets(cards) {
const presentationArguments=Array.from(arguments);
try{

    albumSetSlug = '';
    albumTurnLocked = false;
    clearTimeout(albumTurnFallback);
    const el = document.getElementById('collectionContent');
    const grouped = new Map();
    for (const card of cards) {
        const slug = normalizeSetSlug(card.setSlug) || 'sin-set';
        if (!grouped.has(slug)) grouped.set(slug, []);
        grouped.get(slug).push(card);
    }
    for (const slug of savedAlbumSlugs()) if (!grouped.has(slug)) grouped.set(slug, []);
    const sets = Array.from(grouped.entries()).map(([slug, setCards]) => {
        const setObj = allSets.find(s => s.slug === slug) || {};
        return {
            slug,
            name: setObj.name || setCards[0]?.setName || slug,
            logo: setObj.logo || '',
            owned: setCards.length,
            total: setObj.cardCount || 0,
            releasedAt: setObj.releasedAt || ''
        };
    }).sort((a, b) => (b.releasedAt || '').localeCompare(a.releasedAt || '') || a.name.localeCompare(b.name));
    el.innerHTML = `<div class="album-sets-grid">${sets.map(s => {
        const encodedSlug = encodeURIComponent(s.slug);
        const logoSrc = imageProxyUrl(s.logo);
        const logo = logoSrc
            ? `<span>${escapeHtml(s.name)}</span><img loading="lazy" decoding="async" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(s.name)}" onload="if(this.naturalWidth<=1)this.remove();else this.previousElementSibling.style.display='none'" onerror="this.remove()">`
            : `<span>${escapeHtml(s.name)}</span>`;
        return `<button class="album-set-card" type="button" onclick="openCollectionAlbumSet(decodeURIComponent('${encodedSlug}'))" aria-label="Abrir álbum ${escapeHtml(s.name)}">
            <div class="album-set-logo">${logo}</div>
            <div class="album-set-meta">
                <span>${escapeHtml(s.name)}</span>
                <span class="album-set-count">${s.owned}${s.total ? '/' + s.total : ''}</span>
            </div>
        </button>`;
    }).join('')}${window.personalAlbumTiles?.() || ''}</div>`;

}finally{globalThis.ChiniEvents?.emit('renderAlbumSets',presentationArguments);}
}

function collectionAlbumDataRoot(setSlug) {
    const card = Object.values(collection).find(c => normalizeSetSlug(c.setSlug) === setSlug);
    const local = String(card?.localImage || card?.image || '');
    const match = /^\/(?:TCG\/)?(scrydex-data|es-data|jp-data|cn-data|onepiece(?:-jp)?-data|riftbound-data|magic-data)\//i.exec(local);
    if (match) return match[1].toLowerCase();
    if (currentGame === 'pokemon') {
        if (/_ja$/.test(setSlug)) return GAME_CONFIGS.pokemon.dataRoot.jp;
        if (card?.languageCode && GAME_CONFIGS.pokemon.dataRoot[card.languageCode]) return GAME_CONFIGS.pokemon.dataRoot[card.languageCode];
    }
    return currentDataRoot();
}

async function loadCardsForSet(setSlug) {
    const context = currentContextKey();
    const dataRoot = collectionAlbumDataRoot(setSlug);
    const cacheKey = dataRoot + ':' + setSlug;
    const cached = setCardsCache[cacheKey];
    const cacheTime = localStorage.getItem('chiniSetCardsTime_' + cacheKey);
    const now = Date.now();
    if (cached && cacheTime && (now - parseInt(cacheTime)) < 86400000) return cached;
    const setDetail = await apiFetch(`/${dataRoot}/sets/${encodeURIComponent(setSlug)}/set.json`);
    const cards = (setDetail.cards || []).map(c => normalizeLocalCard(c, setSlug, dataRoot));
    if (context !== currentContextKey()) return cards;
    setCardsCache[cacheKey] = cards;
    trimSetCardsCache();
    localStorage.setItem('chiniSetCardsTime_' + cacheKey, now.toString());
    return cards;
}

async function openCollectionAlbumSet(setSlug) {
    const loadToken = ++albumLoadToken;
    albumSetSlug = setSlug;
    albumSetCards = [];
    albumSpreadIndex = 0;
    albumTurnLocked = false;
    clearTimeout(albumTurnFallback);
    document.getElementById('collectionContent').innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>Cargando álbum...</span></div>';
    try {
        const loadedCards = await loadCardsForSet(setSlug);
        if (loadToken !== albumLoadToken || albumSetSlug !== setSlug) return;
        albumSetCards = loadedCards.sort((a, b) => normalizeCardNumber(a.number) - normalizeCardNumber(b.number) || String(a.variant || '').localeCompare(String(b.variant || '')) || a.name.localeCompare(b.name));
        renderAlbumBook();if(!navigationRestoring)commitNavigation();
    } catch (e) {
        if (loadToken !== albumLoadToken) return;
        albumSetCards = [];
        albumSetSlug = '';
        document.getElementById('collectionContent').innerHTML = `<div class="error-msg" role="alert"><strong>No se pudo abrir el álbum.</strong><span>${escapeHtml(e.message || 'Vuelve a intentarlo.')}</span></div>`;
    }
}

function getAlbumPageCount() {
    return Math.max(1, Math.ceil(albumSetCards.length / albumPageSize()));
}

function getAlbumSpreadCount() {
    return Math.max(1, Math.ceil(getAlbumPageCount() / (globalThis.ChiniAlbumView?.single()?1:2)));
}

function getAlbumSpreadPages(spreadIndex) {
    const totalPages = getAlbumPageCount();
    const single=globalThis.ChiniAlbumView?.single(),left = spreadIndex * (single?1:2);
    return [left < totalPages ? left : null, !single&&left+1<totalPages?left+1:null];
}

function albumPageStatus(spreadIndex = albumSpreadIndex) {
    const pages = getAlbumSpreadPages(spreadIndex).filter(page => page !== null);
    const label = pages.length > 1 ? `Páginas ${pages.map(page => page + 1).join('–')}` : `Página ${(pages[0] || 0) + 1}`;
    return `${label} de ${getAlbumPageCount()}`;
}

function renderAlbumBook() {
const presentationArguments=Array.from(arguments);
try{

    // Background collection/price refreshes must not replace a turning sheet.
    if (albumTurnLocked) return;
    const el = document.getElementById('collectionContent');
    const setObj = allSets.find(s => s.slug === albumSetSlug) || {};
    const ownedInSet = albumSetCards.filter(c => collection[c.id]).length;
    const spreadCount = getAlbumSpreadCount();
    albumSpreadIndex = Math.max(0, Math.min(albumSpreadIndex, spreadCount - 1));
    albumTurnLocked = false;
    clearTimeout(albumTurnFallback);
    el.innerHTML = `<div class="album-toolbar">
        <button class="album-back-btn" type="button" onclick="renderAlbumSets(getCollectionCards())">Volver a álbumes</button>
        <div class="album-title-block">
            <h3>${escapeHtml(setObj.name || albumSetCards[0]?.setName || albumSetSlug)}</h3>
            <p>${ownedInSet} de ${albumSetCards.length} cartas · ${globalThis.ChiniAlbumView?.single()?'una página vertical':'pliego de dos páginas'}</p>
        </div>
        <div class="album-nav">
            <button type="button" class="album-back-btn" onclick="configureCollectionAlbum(albumSetSlug)">Filas y columnas</button>
            <button class="album-nav-btn" type="button" aria-label="Pasar a las páginas anteriores" onclick="turnAlbumPage(-1)" ${albumSpreadIndex === 0 ? 'disabled' : ''}>‹</button>
            <span class="album-page-label" id="albumPageStatus" aria-live="polite">${albumPageStatus()}</span>
            <button class="album-nav-btn" type="button" aria-label="Pasar a las páginas siguientes" onclick="turnAlbumPage(1)" ${albumSpreadIndex >= spreadCount - 1 ? 'disabled' : ''}>›</button>
        </div>
    </div>
    <div class="album-stage" id="albumStage" tabindex="0" aria-busy="false" aria-describedby="albumPageStatus" onkeydown="if(event.key==='ArrowRight'){event.preventDefault();turnAlbumPage(1)}else if(event.key==='ArrowLeft'){event.preventDefault();turnAlbumPage(-1)}">
        <div class="album-book" id="albumBook">
            <div class="album-spread" id="albumSpread">${renderStaticAlbumSpread(albumSpreadIndex)}</div>
        </div>
    </div>`;

}finally{globalThis.ChiniEvents?.emit('renderAlbumBook',presentationArguments);}
}

function albumPageContentHTML(pageIndex) {
    if (pageIndex === null) return '<div class="album-page-empty-copy">Fin del álbum</div>';
    const start = pageIndex * albumPageSize();
    const slots = albumSetCards.slice(start, start + albumPageSize());
    while (slots.length < albumPageSize()) slots.push(null);
    return `<div class="album-page-title">Página ${pageIndex + 1}</div>
        <div class="album-slots" style="--album-rows:${albumLayoutFor().rows};grid-template-columns:repeat(${albumLayoutFor().columns},minmax(0,1fr));grid-template-rows:repeat(${albumLayoutFor().rows},minmax(0,1fr))">${slots.map((card, idx) => {
            if (!card) return '<div class="album-slot"><span class="album-empty-slot">—</span></div>';
            const owned = !!collection[card.id];
            const display = owned ? { ...card, quantity: collection[card.id]?.quantity || 1 } : card;
            const img = repairCardImage(display);
            const image = img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(display.name)}" loading="eager" decoding="async" onload="if(this.naturalWidth<=1)handleCardImageError(this,[this.dataset.cdn])" data-cdn="${escapeHtml(display.cdnImage || '')}" onerror="${imageFallbackAttr(display)}">` : `<span class="album-empty-slot">#${escapeHtml(card.number)}</span>`;
            if (owned) {
                const encodedId = encodeURIComponent(card.id);
                return `<button data-card-id="${escapeHtml(card.id)}" class="album-slot owned" type="button" onclick="openModal(decodeURIComponent('${encodedId}'))" aria-label="Abrir ${escapeHtml(display.name)}">${image}<span class="album-slot-number">Bolsillo ${start+idx+1} · Carta #${escapeHtml(card.number||'')} · ${escapeHtml(display.name)}</span></button>`;
            }
            return `<button data-card-id="${escapeHtml(card.id)}" class="album-slot album-missing" type="button" onclick="openModal(decodeURIComponent('${encodeURIComponent(card.id)}'))" aria-label="${start + idx + 1} - ${escapeHtml(display.name)}">${image}<span class="album-slot-number">Bolsillo ${start+idx+1} · Carta #${escapeHtml(card.number||'')} · ${escapeHtml(display.name)}</span></button>`;
        }).join('')}</div>`;
}

function albumPageHTML(pageIndex, side) {
    const emptyClass = pageIndex === null ? ' album-page-empty' : '';
    const label = pageIndex === null ? 'Página vacía' : `Página ${pageIndex + 1}`;
    return `<section class="album-page album-page-${side}${emptyClass}" aria-label="${label}">${albumPageContentHTML(pageIndex)}</section>`;
}

function renderStaticAlbumSpread(spreadIndex) {
    const [left, right] = getAlbumSpreadPages(spreadIndex);
    return albumPageHTML(left, 'left') + albumPageHTML(right, 'right');
}

function turnAlbumPage(delta) {
    if (albumTurnLocked) return;
    const spreadCount = getAlbumSpreadCount();
    const targetIndex = Math.max(0, Math.min(spreadCount - 1, albumSpreadIndex + delta));
    if (targetIndex === albumSpreadIndex) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        albumSpreadIndex = targetIndex;
        renderAlbumBook();if(!navigationRestoring)commitNavigation();
        return;
    }

    const book = document.getElementById('albumBook');
    const spread = document.getElementById('albumSpread');
    if (!book || !spread) {
        albumSpreadIndex = targetIndex;
        renderAlbumBook();if(!navigationRestoring)commitNavigation();
        return;
    }

    // A two-page 3D sheet cannot match the stacked mobile layout.
    if (matchMedia('(max-width: 700px)').matches || !window.CSS?.supports('transform-style', 'preserve-3d')) {
        albumSpreadIndex = targetIndex;
        renderAlbumBook();if(!navigationRestoring)commitNavigation();
        document.getElementById('albumSpread')?.classList.add(delta > 0 ? 'album-enter-next' : 'album-enter-prev');
        return;
    }
    const movingPage = spread.querySelector(delta > 0 ? '.album-page-right' : '.album-page-left');
    const pageRect = movingPage?.getBoundingClientRect();
    const bookRect = book.getBoundingClientRect();
    const currentPages = getAlbumSpreadPages(albumSpreadIndex);
    const targetPages = getAlbumSpreadPages(targetIndex);
    const movingForward = delta > 0;
    const basePages = movingForward
        ? [currentPages[0], targetPages[1]]
        : [targetPages[0], currentPages[1]];
    const frontPage = movingForward ? currentPages[1] : currentPages[0];
    const backPage = movingForward ? targetPages[0] : targetPages[1];

    albumTurnLocked = true;
    clearTimeout(albumTurnFallback);
    document.getElementById('albumStage')?.setAttribute('aria-busy', 'true');
    document.querySelectorAll('.album-nav-btn').forEach(button => { button.disabled = true; });
    spread.innerHTML = albumPageHTML(basePages[0], 'left') + albumPageHTML(basePages[1], 'right');

    const sheet = document.createElement('div');
    sheet.className = `album-turn-sheet ${movingForward ? 'turn-next' : 'turn-prev'}`;
    if (pageRect?.width > 0 && pageRect.height > 0) {
        sheet.style.left = `${pageRect.left - bookRect.left}px`;
        sheet.style.top = `${pageRect.top - bookRect.top}px`;
        sheet.style.width = `${pageRect.width}px`;
        sheet.style.height = `${pageRect.height}px`;
        const leftRect=spread.querySelector('.album-page-left').getBoundingClientRect();
        const rightRect=spread.querySelector('.album-page-right').getBoundingClientRect();
        sheet.style.transformOrigin=`${(leftRect.right+rightRect.left)/2-pageRect.left}px ${pageRect.height/2}px`;
    }
    sheet.setAttribute('aria-hidden', 'true');
    sheet.innerHTML = `<div class="album-turn-face album-turn-front${frontPage === null ? ' album-page-empty' : ''}">${albumPageContentHTML(frontPage)}</div>
        <div class="album-turn-face album-turn-back${backPage === null ? ' album-page-empty' : ''}">${albumPageContentHTML(backPage)}</div>`;
    book.appendChild(sheet);

    const finish = () => {
        if (!albumTurnLocked || !sheet.isConnected || document.getElementById('albumBook') !== book) return;
        clearTimeout(albumTurnFallback);
        albumSpreadIndex = targetIndex;
        albumTurnLocked = false;
        renderAlbumBook();if(!navigationRestoring)commitNavigation();
    };
    sheet.addEventListener('animationend', event => { if (event.target === sheet) finish(); });
    sheet.addEventListener('animationcancel', event => { if (event.target === sheet) finish(); });
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('is-active')));
    albumTurnFallback = setTimeout(finish, ALBUM_TURN_MS + 260);
}

function getPriceFromCache(id) {
    if (collection[id] && collection[id].price != null) {
        return collection[id].price;
    }
    if (pricingCache[id]) {
        const cached = pricingCache[id];
        if (cached?.prices) return getBestPrice({ tcgplayer: cached });
        if (cached?.cardmarket) return getBestPrice({ pricing: cached });
        if (cached?.marketPrice || cached?.midPrice || cached?.lowPrice) return getBestPrice({ pricing: { tcgplayer: cached } });
    }
    return null;
}

function sortCollection(cards, by) {
    return [...cards].sort((a, b) => {
        if (by === 'pokedex') {
            const aNum = normalizeCardNumber(a.number);
            const bNum = normalizeCardNumber(b.number);
            if (aNum !== bNum) return aNum - bNum;
            return (normalizeSetSlug(a.setSlug) || '').localeCompare(normalizeSetSlug(b.setSlug) || '');
        }
        if (by === 'name') return a.name.localeCompare(b.name);
        if (by === 'price' || by === 'price-asc') {
            return ChiniPrices.compare(a,b,by==='price-asc'?1:-1)||a.name.localeCompare(b.name);
        }
        if (by === 'date') return new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0);
        return 0;
    });
}

function updateColStats(cards) {
    document.getElementById('colUnique').textContent = cards.length;
    document.getElementById('colTotal').textContent = cards.reduce((s, c) => s + (c.quantity || 1), 0);
    document.getElementById('colSets').textContent = new Set(cards.map(c => normalizeSetSlug(c.setSlug)).filter(Boolean)).size;
    document.getElementById('colValue').textContent = ChiniPrices.summaryText(cards);
}

async function changeQty(id,delta) {const card=collection[id];if(!card)return;if((card.quantity||1)+delta===0&&!confirm('¿Retirar la última copia?'))return;return ChiniInventory.adjust(id,delta,true);}

async function removeCard(id) {const card=collection[id];if(!card||!confirm('¿Eliminar esta impresión de tu colección? Puedes recuperarla desde Historial.'))return;return ChiniInventory.adjust(id,-(card.quantity||1),true);}

function scannerTargetCollection(context = activeScannerContext()) {
    return scannerDestination !== 'collection'
        ? pokedexCollectionForLanguage(context?.lang || pokedexAlbumLanguage)
        : collection;
}

async function loadScannerTargetCollection() {
    if (!currentUser) return scannerTargetCollection();
    if (scannerDestination !== 'collection') {
        await Promise.all([...POKEDEX_ALBUM_LANGUAGES].map(lang => loadPokedexCollectionFromServer(lang, {readOnly: scannerDestination === 'locate'})));
    } else await loadCollectionFromServer();
    return scannerTargetCollection();
}

function pokedexOwnedIndex(sourceCollection = pokedexCollectionForLanguage()) {
    const grouped = new Map();
    for (const card of Object.values(sourceCollection || {})) {
        const species = ChiniPokedex.matchCard(card);
        if (!species) continue;
        if (!grouped.has(species.number)) grouped.set(species.number, []);
        grouped.get(species.number).push(card);
    }
    return grouped;
}

function pokedexLocationText(location, lang = null) {
    if (!location) return '';
    const edition = lang ? `Álbum ${pokedexLanguageLabel(lang).toLowerCase()} ${location.album}` : `Álbum ${location.album}`;
    return `${edition} · página ${location.page} (${location.side}) · hueco ${location.slot} · fila ${location.row}, columna ${location.column}`;
}

function scannerAlbumGuideHTML(card, context = activeScannerContext(), sourceCollection = scannerTargetCollection(context)) {
    if (scannerDestination === 'collection') {
        return `<div class="scanner-album-guide not-pokemon"><div class="scanner-album-guide-icon">COL</div><div><strong>Destino: colección normal</strong><p>Esta carta solo se guardará en tu colección normal. ¡Hazte con Todos! no se modificará.</p></div></div>`;
    }
    if (context?.game !== 'pokemon' || !POKEDEX_ALBUM_LANGUAGES.has(context?.lang)) {
        return `<div class="scanner-album-guide not-pokemon"><div class="scanner-album-guide-icon">TCG</div><div><strong>No se puede añadir al álbum</strong><p>¡Hazte con Todos! solo admite cartas Pokémon en inglés o japonés.</p></div></div>`;
    }
    const status = ChiniPokedex.classifyCard(card, sourceCollection);
    if (!status.species) {
        return `<div class="scanner-album-guide not-pokemon"><div class="scanner-album-guide-icon">—</div><div><strong>Sin hueco de Pokédex</strong><p>Es una carta de Entrenador, Energía o especial sin una especie identificable y no se añadirá al álbum.</p></div></div>`;
    }
    const dex = `#${String(status.species.number).padStart(4, '0')} ${status.species.name}`;
    const location = pokedexLocationText(status.location, context.lang);
    if (status.kind === 'duplicate') {
        const copies = status.exact?.quantity || 1;
        return `<div class="scanner-album-guide duplicate"><div class="scanner-album-guide-icon">×${copies}</div><div><strong>Carta repetida · ${escapeHtml(dex)}</strong><p>Ya tienes ${copies} ${copies === 1 ? 'copia' : 'copias'} de esta impresión. Añádela en ${escapeHtml(location)}.</p></div></div>`;
    }
    if (status.kind === 'new-variant') {
        return `<div class="scanner-album-guide new-variant"><div class="scanner-album-guide-icon">+V</div><div><strong>Nueva variante · ${escapeHtml(dex)}</strong><p>Ya tienes ${status.variants.length} ${status.variants.length === 1 ? 'variante' : 'variantes'} de esta especie. Esta va en ${escapeHtml(location)}.</p></div></div>`;
    }
    return `<div class="scanner-album-guide"><div class="scanner-album-guide-icon">NEW</div><div><strong>Nuevo Pokémon · ${escapeHtml(dex)}</strong><p>Su primer hueco es ${escapeHtml(location)}.</p></div></div>`;
}

function setLiveAlbumStatus(message, isError = false) {
    const status = document.getElementById('liveAlbumStatus');
    if (!status) return;
    status.textContent = window.ChiniScannerView?.status(message || '', isError) ?? (message || '');
    status.classList.toggle('error', !!isError);
}

function clearLiveAlbumDetection(options = {}) {
    const result = document.getElementById('liveAlbumResult');
    if (!result) return;
    if (options.resetSeen) liveAlbumSeenTracker.reset();
    else liveAlbumSeenTracker.miss();
    result.classList.remove('show', 'registered', 'new-variant', 'new-species', 'seen');
    result.setAttribute('aria-hidden', 'true');
    result.innerHTML = '';
}

function updateLiveAlbumControls(running, starting = false) {
    document.getElementById('liveAlbumStart').disabled = !!running || !!starting;
    document.getElementById('liveAlbumSwitch').disabled = !running;
    document.getElementById('liveAlbumStop').disabled = !running && !starting;
}

function stopLiveAlbumRecognition(options = {}) {
    liveAlbumRunning = false;
    liveAlbumStarting = false;
    liveAlbumSession++;
    clearTimeout(liveAlbumTimer);
    liveAlbumTimer = 0;
    if (liveAlbumAbortController) liveAlbumAbortController.abort();
    liveAlbumAbortController = null;
    if (liveAlbumStream) liveAlbumStream.getTracks().forEach(track => track.stop());
    liveAlbumStream = null;
    const video = document.getElementById('liveAlbumVideo');
    if (video) {
        video.pause();
        video.srcObject = null;
    }
    const camera = document.getElementById('liveAlbumCamera');
    camera?.classList.remove('running', 'user-facing');
    clearLiveAlbumDetection({ resetSeen: true });
    updateLiveAlbumControls(false);
    if (!options.silent) setLiveAlbumStatus('Cámara detenida.');
}

function scheduleLiveAlbumRecognition(session, delay = 550) {
    clearTimeout(liveAlbumTimer);
    if (!liveAlbumRunning || session !== liveAlbumSession) return;
    liveAlbumTimer = setTimeout(() => recognizeLiveAlbumFrame(session), delay);
}

function drawLiveAlbumFrame(video, canvas) {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return false;
    const targetAspect = canvas.width / canvas.height;
    const sourceAspect = width / height;
    let sx = 0;
    let sy = 0;
    let sw = width;
    let sh = height;
    if (sourceAspect > targetAspect) {
        sw = height * targetAspect;
        sx = (width - sw) / 2;
    } else {
        sh = width / targetAspect;
        sy = (height - sh) / 2;
    }
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return true;
}

function showLiveAlbumDetection(match) {
    const context = scannerContexts().find(item => item.key === match.context?.key);
    if (!context || !POKEDEX_ALBUM_LANGUAGES.has(context.lang)) {
        clearLiveAlbumDetection();
        return false;
    }
    const card = scannerRecordToCard(match.record, context);
    const state = ChiniPokedex.classifyCard(card, pokedexCollectionForLanguage(context.lang));
    if (!state.species || !state.location) {
        clearLiveAlbumDetection();
        return false;
    }
    const result = document.getElementById('liveAlbumResult');
    const previewState = liveAlbumSeenTracker.observe(card);
    const alreadySeen = previewState.alreadySeen;
    const language = normalizePokedexLanguage(context.lang).toUpperCase();
    const dex = `#${String(state.species.number).padStart(4, '0')} ${state.species.name}`;
    const location = pokedexLocationText(state.location, context.lang);
    const variant = scannerVariantLabel(card.variant) || card.variant || 'Normal';
    const copies = Math.max(1, Number(state.exact?.quantity || 1));
    const stateBadge = alreadySeen
        ? 'YA VISTA'
        : state.kind === 'duplicate'
        ? 'YA REGISTRADA'
        : state.kind === 'new-variant'
            ? 'VARIANTE NUEVA'
            : 'NUEVA';
    const collectionState = alreadySeen
        ? `Ya vista en esta sesión · variante ${variant}`
        : state.kind === 'duplicate'
        ? `Ya registrada · variante ${variant} · ${copies} ${copies === 1 ? 'copia' : 'copias'}`
        : state.kind === 'new-variant'
            ? `Variación ${variant} sin registrar · ya tienes ${state.variants.length} ${state.variants.length === 1 ? 'variación' : 'variaciones'} de este Pokémon`
            : `Pokémon nuevo · variante ${variant}`;
    result.innerHTML = `<div class="live-album-result-top"><span class="live-album-language">${language}</span><strong>${escapeHtml(dex)}</strong><span class="live-album-owned-state">${stateBadge}</span></div><p>${escapeHtml(location)}</p><small>${escapeHtml(collectionState)} · confianza ${Math.round(Number(match.confidence || 0))}%</small>`;
    result.classList.remove('registered', 'new-variant', 'new-species', 'seen');
    result.classList.add('show', alreadySeen ? 'seen' : state.kind === 'duplicate' ? 'registered' : state.kind);
    result.setAttribute('aria-hidden', 'false');
    setLiveAlbumStatus(alreadySeen
        ? `Esta carta ya había aparecido en la sesión. Pertenece al álbum ${pokedexLanguageLabel(context.lang).toLowerCase()}.`
        : `Detectado en el álbum ${pokedexLanguageLabel(context.lang).toLowerCase()}. Mantén la carta dentro del marco.`);
    return true;
}

async function recognizeLiveAlbumFrame(session = liveAlbumSession) {
    if (!liveAlbumRunning || session !== liveAlbumSession) return;
    const video = document.getElementById('liveAlbumVideo');
    const canvas = document.getElementById('liveAlbumCanvas');
    if (!drawLiveAlbumFrame(video, canvas)) {
        clearLiveAlbumDetection();
        scheduleLiveAlbumRecognition(session, 250);
        return;
    }
    liveAlbumAbortController = new AbortController();
    try {
        const response = await fetch('/tcg-card-recognize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: liveAlbumAbortController.signal,
            body: JSON.stringify({
                images: [canvas.toDataURL('image/jpeg', 0.84)],
                contexts: ['pokemon_en', 'pokemon_jp'],
                limit: 1,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!liveAlbumRunning || session !== liveAlbumSession) return;
        if (!response.ok) {
            clearLiveAlbumDetection();
            setLiveAlbumStatus(response.status === 503 ? 'Cámara activa. El reconocimiento todavía está iniciándose; reintentando…' : 'Cámara activa. El servidor no pudo analizar la imagen; reintentando…', true);
        } else if (!data.accepted || !Array.isArray(data.matches) || !data.matches.length) {
            clearLiveAlbumDetection();
            setLiveAlbumStatus('Buscando una carta Pokémon inglesa o japonesa…');
        } else if (!showLiveAlbumDetection(data.matches[0])) {
            setLiveAlbumStatus('La carta detectada no corresponde a un Pokémon con hueco de álbum.');
        }
    } catch (error) {
        if (error?.name !== 'AbortError' && liveAlbumRunning && session === liveAlbumSession) {
            clearLiveAlbumDetection();
            setLiveAlbumStatus('No se pudo analizar este fotograma. Reintentando…', true);
        }
    } finally {
        liveAlbumAbortController = null;
        scheduleLiveAlbumRecognition(session);
    }
}

async function startLiveAlbumRecognition() {
    if (scannerNeedsSecureConnection()) {
        setLiveAlbumStatus('Comprobando el certificado HTTPS de la IP pública…');
        await openIpHttps();
        return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
        setLiveAlbumStatus('Este navegador no ofrece acceso a la cámara.', true);
        return;
    }
    stopLiveAlbumRecognition({ silent: true });
    const session = ++liveAlbumSession;
    liveAlbumStarting = true;
    updateLiveAlbumControls(false, true);
    setLiveAlbumStatus('Solicitando acceso a la cámara…');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: liveAlbumFacingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        if (session !== liveAlbumSession) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }
        liveAlbumStream = stream;
        const video = document.getElementById('liveAlbumVideo');
        video.srcObject = stream;
        await video.play();
        const frameDeadline=Date.now()+8000;
        while(epoch===scannerEpoch && (video.readyState<2 || !video.videoWidth || !video.videoHeight)){
            if(Date.now()>frameDeadline)throw Error('La cámara no entrega vídeo. Prueba otra cámara o carga una foto.');
            await new Promise(resolve=>setTimeout(resolve,50));
        }
        liveAlbumStarting = false;
        liveAlbumRunning = true;
        const camera = document.getElementById('liveAlbumCamera');
        camera.classList.add('running');
        camera.classList.toggle('user-facing', liveAlbumFacingMode === 'user');
        updateLiveAlbumControls(true);
        setLiveAlbumStatus('Buscando una carta Pokémon inglesa o japonesa…');
        scheduleLiveAlbumRecognition(session, 100);
    } catch (error) {
        if (session !== liveAlbumSession) return;
        stopLiveAlbumRecognition({ silent: true });
        const denied = error?.name === 'NotAllowedError' ? 'Permiso de cámara no concedido.' : (error.message || 'No se pudo abrir la cámara.');
        setLiveAlbumStatus(denied, true);
    }
}

async function switchLiveAlbumCamera() {
    liveAlbumFacingMode = liveAlbumFacingMode === 'environment' ? 'user' : 'environment';
    await startLiveAlbumRecognition();
}

function getPokedexSpreadPages(spreadIndex = pokedexSpreadIndex) {
    if(globalThis.ChiniAlbumView?.single())return [spreadIndex,null];
    if (spreadIndex === 0) return [null, 0];
    const left = spreadIndex * 2 - 1;
    return [left < ChiniPokedex.PAGES_PER_ALBUM ? left : null, left + 1 < ChiniPokedex.PAGES_PER_ALBUM ? left + 1 : null];
}

function pokedexSpreadStatus() {
    const pages = getPokedexSpreadPages().filter(page => page !== null).map(page => page + 1);
    return pages.length > 1 ? `Páginas ${pages[0]}–${pages[1]} de 40` : `Página ${pages[0]} de 40`;
}

function pokedexPageHTML(pageIndex, side, ownedIndex) {
    if (pageIndex === null) {
        const copy = side === 'left' && pokedexSpreadIndex === 0
            ? `<div class="pokedex-plate">Álbum ${pokedexAlbumNumber}<br>Edición en ${pokedexLanguageLabel().toLowerCase()}</div>`
            : '<div class="pokedex-plate">Fin del álbum</div>';
        return `<section class="pokedex-page pokedex-page-${side} blank" aria-label="Portadilla">${copy}</section>`;
    }
    const albumStart = (pokedexAlbumNumber - 1) * ChiniPokedex.SLOTS_PER_ALBUM;
    const firstNumber = albumStart + pageIndex * ChiniPokedex.SLOTS_PER_PAGE + 1;
    const slots = Array.from({ length: ChiniPokedex.SLOTS_PER_PAGE }, (_, index) => firstNumber + index);
    return `<section class="pokedex-page pokedex-page-${side}" aria-label="Página ${pageIndex + 1}">
        <div class="pokedex-page-heading"><span>${pokedexLanguageLabel().toUpperCase()} · ÁLBUM ${pokedexAlbumNumber}</span><span>PÁGINA ${pageIndex + 1}</span></div>
        <div class="pokedex-slots">${slots.map(number => {
            const species = ChiniPokedex.speciesByNumber(number);
            if (!species) return `<div class="pokedex-slot reserved"><div class="pokedex-slot-empty-copy"><span class="pokedex-slot-number">#${String(number).padStart(4, '0')}</span><span class="pokedex-slot-name">Reservado</span><span class="pokedex-slot-generation">FUTURA POKÉDEX</span></div></div>`;
            const variants = ownedIndex.get(number) || [];
            if (!variants.length) return `<div class="pokedex-slot${pokedexHighlightNumber === number ? ' highlight' : ''}"><div class="pokedex-slot-empty-copy"><span class="pokedex-slot-number">#${String(number).padStart(4, '0')}</span><span class="pokedex-slot-name">${escapeHtml(species.name)}</span><span class="pokedex-slot-generation">GENERACIÓN ${species.generation}</span></div></div>`;
            const sortedVariants = [...variants].sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
            const cover = sortedVariants[0];
            const image = repairCardImage(cover);
            const copies = variants.reduce((total, variant) => total + (variant.quantity || 1), 0);
            const highlight = pokedexHighlightNumber === number ? ' highlight' : '';
            return `<button class="pokedex-slot owned${highlight}" type="button" onclick="openPokedexVariants(${number})" aria-label="${escapeHtml(species.name)}: ${variants.length} variantes, ${copies} copias">
                ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(cover.name)}" loading="eager" onerror="handleCardImageError(this)">` : ''}
                <span class="pokedex-slot-variants">${variants.length}</span>
                <span class="pokedex-slot-shade"><span class="pokedex-slot-number">#${String(number).padStart(4, '0')}</span><span class="pokedex-slot-name">${escapeHtml(species.name)}</span></span>
            </button>`;
        }).join('')}</div>
    </section>`;
}

let pokedexTurn = null;
function pokedexTurnContext() {
    return `${pokedexAlbumLanguage}:${pokedexAlbumNumber}:${pokedexSpreadIndex}:${pokedexHighlightNumber}`;
}
function renderPokedexBook() {
    if (pokedexTurn) {
        if (pokedexTurn.context === pokedexTurnContext()) return;
        clearTimeout(pokedexTurn.timer);
        pokedexTurn.sheet.remove();
        pokedexTurn = null;
    }
    document.getElementById('pokedexStage')?.setAttribute('aria-busy', 'false');
    if (!window.ChiniPokedex) return;
    const ownedIndex = pokedexOwnedIndex();
    const ownedSpecies = ownedIndex.size;
    const variants = [...ownedIndex.values()].reduce((total, cards) => total + cards.length, 0);
    const copies = [...ownedIndex.values()].flat().reduce((total, card) => total + (card.quantity || 1), 0);
    document.getElementById('pokedexEditionLabel').textContent = `Colección Pokédex Nacional · ${pokedexLanguageLabel()}`;
    for (const lang of POKEDEX_ALBUM_LANGUAGES) {
        const tab = document.getElementById(`pokedexLanguage${lang.toUpperCase()}`);
        const active = lang === pokedexAlbumLanguage;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
    }
    document.getElementById('pokedexOwnedSpecies').textContent = ownedSpecies.toLocaleString('es-ES');
    document.getElementById('pokedexSpeciesTotal').textContent = ChiniPokedex.species.length.toLocaleString('es-ES');
    document.getElementById('pokedexProgressBar').style.width = `${ownedSpecies / ChiniPokedex.species.length * 100}%`;
    document.getElementById('pokedexProgressNote').textContent = `${variants.toLocaleString('es-ES')} variantes · ${copies.toLocaleString('es-ES')} cartas físicas`;
    document.getElementById('pokedexAlbumTabs').innerHTML = Array.from({ length: ChiniPokedex.ALBUM_COUNT }, (_, index) => {
        const album = index + 1;
        const start = index * ChiniPokedex.SLOTS_PER_ALBUM + 1;
        const end = start + ChiniPokedex.SLOTS_PER_ALBUM - 1;
        const inAlbum = [...ownedIndex.keys()].filter(number => number >= start && number <= end).length;
        const available = Math.max(0, Math.min(ChiniPokedex.species.length, end) - start + 1);
        return `<button class="pokedex-album-tab ${album === pokedexAlbumNumber ? 'active' : ''}" type="button" onclick="selectPokedexAlbum(${album})"><span><strong>Álbum ${album}</strong><small>#${String(start).padStart(4, '0')}–#${String(end).padStart(4, '0')} · 40 páginas</small></span><b>${inAlbum}/${available}</b></button>`;
    }).join('');
    const start = (pokedexAlbumNumber - 1) * ChiniPokedex.SLOTS_PER_ALBUM + 1;
    const end = start + ChiniPokedex.SLOTS_PER_ALBUM - 1;
    document.getElementById('pokedexAlbumTitle').textContent = `Álbum ${pokedexAlbumNumber} · ${pokedexLanguageLabel()}`;
    document.getElementById('pokedexAlbumRange').textContent = `Edición en ${pokedexLanguageLabel().toLowerCase()} · Pokémon #${String(start).padStart(4, '0')}–#${String(end).padStart(4, '0')} · 40 páginas · 480 huecos`;
    document.getElementById('pokedexPageStatus').textContent = pokedexSpreadStatus();
    document.getElementById('pokedexPrev').disabled = pokedexSpreadIndex === 0;
    document.getElementById('pokedexNext').disabled = pokedexSpreadIndex >= (globalThis.ChiniAlbumView?.single()?39:20);
    const [left, right] = getPokedexSpreadPages();
    document.getElementById('pokedexBook').innerHTML = pokedexPageHTML(left, 'left', ownedIndex) + pokedexPageHTML(right, 'right', ownedIndex);
    if (pokedexHighlightNumber) setTimeout(() => { pokedexHighlightNumber = 0; }, 3000);
}

function selectPokedexLanguage(lang) {
    if (!POKEDEX_ALBUM_LANGUAGES.has(lang)) return;
    pokedexAlbumLanguage = lang;
    localStorage.setItem(POKEDEX_ALBUM_LANGUAGE_KEY, lang);
    pokedexAlbumNumber = 1;
    pokedexSpreadIndex = 0;
    pokedexHighlightNumber = 0;
    renderPokedexBook();
    if (activeViewName() === 'catch-em-all') renderContextRail('catch-em-all');
}

function selectPokedexAlbum(album) {
    pokedexAlbumNumber = Math.max(1, Math.min(ChiniPokedex.ALBUM_COUNT, Number(album) || 1));
    pokedexSpreadIndex = 0;
    pokedexHighlightNumber = 0;
    renderPokedexBook();
}

function turnPokedexSpread(delta) {
    if (pokedexTurn) return;
    const target = Math.max(0, Math.min(globalThis.ChiniAlbumView?.single()?39:20, pokedexSpreadIndex + Number(delta || 0)));
    if (target === pokedexSpreadIndex) return;
    const book = document.getElementById('pokedexBook');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const forward = delta > 0;
    if (!book || reduced || matchMedia('(max-width:700px)').matches || !window.CSS?.supports('transform-style','preserve-3d')) {
        pokedexSpreadIndex = target;
        pokedexHighlightNumber = 0;
        renderPokedexBook();
        if (!reduced && book) {
            book.classList.remove('album-enter-next','album-enter-prev');
            void book.offsetWidth;
            book.classList.add(forward ? 'album-enter-next' : 'album-enter-prev');
        }
        return;
    }
    book.classList.remove('album-enter-next','album-enter-prev');
    const page = book.querySelector(forward ? '.pokedex-page-right' : '.pokedex-page-left');
    const rect = page.getBoundingClientRect(), bounds = book.getBoundingClientRect();
    const current = getPokedexSpreadPages(), next = getPokedexSpreadPages(target);
    const owned = pokedexOwnedIndex();
    const sheet = document.createElement('div');
    sheet.className = `album-turn-sheet pokedex-turn-sheet ${forward ? 'turn-next' : 'turn-prev'}`;
    sheet.setAttribute('aria-hidden','true');
    sheet.inert = true;
    Object.assign(sheet.style,{left:`${rect.left-bounds.left}px`,top:`${rect.top-bounds.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
    const face = (index, side, name) => pokedexPageHTML(index, side, owned).replace('class="pokedex-page ', `class="album-turn-face album-turn-${name} pokedex-page `);
    sheet.innerHTML = face(forward ? current[1] : current[0], forward ? 'right' : 'left', 'front') + face(forward ? next[0] : next[1], forward ? 'left' : 'right', 'back');
    book.innerHTML = pokedexPageHTML(forward ? current[0] : next[0],'left',owned) + pokedexPageHTML(forward ? next[1] : current[1],'right',owned);
    book.append(sheet);
    document.getElementById('pokedexStage').setAttribute('aria-busy','true');
    document.getElementById('pokedexPrev').disabled = true;
    document.getElementById('pokedexNext').disabled = true;
    const turn = {sheet, context:pokedexTurnContext(), timer:null};
    pokedexTurn = turn;
    const finish = () => {
        if (pokedexTurn !== turn) return;
        clearTimeout(turn.timer);
        pokedexTurn = null;
        if (turn.context === pokedexTurnContext()) {
            pokedexSpreadIndex = target;
            pokedexHighlightNumber = 0;
        }
        renderPokedexBook();
    };
    sheet.addEventListener('animationend', event => { if (event.target === sheet) finish(); });
    sheet.addEventListener('animationcancel', event => { if (event.target === sheet) finish(); });
    requestAnimationFrame(() => requestAnimationFrame(() => { if (pokedexTurn === turn) sheet.classList.add('is-active'); }));
    turn.timer = setTimeout(finish, ALBUM_TURN_MS + 260);
}

async function openPokedexAt(number, lang = pokedexAlbumLanguage) {
    const location = ChiniPokedex.locationFor(number);
    if (!location || !ChiniPokedex.speciesByNumber(number)) return;
    pokedexAlbumLanguage = normalizePokedexLanguage(lang);
    localStorage.setItem(POKEDEX_ALBUM_LANGUAGE_KEY, pokedexAlbumLanguage);
    await showView('catch-em-all');
    pokedexAlbumNumber = location.album;
    pokedexSpreadIndex = globalThis.ChiniAlbumView?.single()?location.page-1:location.page === 1 ? 0 : Math.ceil((location.page - 1) / 2);
    pokedexHighlightNumber = Number(number);
    renderPokedexBook();
    (document.querySelector('.pokedex-slot.highlight') || document.getElementById('pokedexStage'))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function jumpToPokedexEntry() {
    const input = document.getElementById('pokedexJumpInput');
    const query = (input?.value || '').trim();
    if (!query) return;
    let species = /^#?\d+$/.test(query) ? ChiniPokedex.speciesByNumber(Number(query.replace('#', ''))) : null;
    if (!species) {
        const normalized = ChiniPokedex.normalizeText(query);
        species = ChiniPokedex.species.find(entry => entry.normalized === normalized)
            || ChiniPokedex.species.find(entry => entry.normalized.startsWith(normalized));
    }
    if (!species) { alert('No se encontró ese Pokémon en la Pokédex Nacional.'); return; }
    input.value = `#${String(species.number).padStart(4, '0')} ${species.name}`;
    openPokedexAt(species.number);
}

function openPokedexVariants(number) {
    const species = ChiniPokedex.speciesByNumber(number);
    if (!species) return;
    const variants = ChiniPokedex.cardsForSpecies(pokedexCollectionForLanguage(), number);
    document.getElementById('pokedexVariantsTitle').textContent = `#${String(number).padStart(4, '0')} ${species.name}`;
    document.getElementById('pokedexVariantGrid').innerHTML = variants.map((card, index) => {
        const image = repairCardImage(card);
        const setName = allSets.find(set => set.slug === normalizeSetSlug(card.setSlug))?.name || card.setSlug || 'Set desconocido';
        return `<article class="pokedex-variant-card" style="--deal-delay:${Math.min(index, 8)*65}ms;--rest-angle:${variants.length === 1 ? -3 : (index % 3 - 1)*5}deg"><button type="button" class="pokedex-card-face" aria-label="Ver ${escapeHtml(card.name)} en 3D" data-card-id="${escapeHtml(card.id)}" data-album-language="${pokedexAlbumLanguage}" data-species-number="${number}" onclick="togglePokedexCard(this)" onpointermove="tiltPokedexCard(event,this)" onpointerleave="resetPokedexCardTilt(this)">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(card.name)}" onerror="handleCardImageError(this)">` : `<span>${escapeHtml(card.name)}</span>`}</button><strong>${escapeHtml(scannerVariantLabel(card.variant) || card.variant || 'Normal')}</strong><span>${escapeHtml(setName)} · #${escapeHtml(card.number || '—')}<br>${card.quantity || 1} ${(card.quantity || 1) === 1 ? 'copia' : 'copias'}</span><div class="pokedex-variant-actions">${(card.quantity||1)>1?`<button type="button" onclick="removePokedexVariant(${number},${escapeHtml(JSON.stringify(card.id))},'${pokedexAlbumLanguage}',true)">Quitar una copia</button>`:''}<button type="button" onclick="removePokedexVariant(${number},${escapeHtml(JSON.stringify(card.id))},'${pokedexAlbumLanguage}')">Quitar carta</button></div></article>`;
    }).join('') || '<p class="empty-state">No tienes cartas de este Pokémon en este álbum.</p>';
    const overlay = document.getElementById('pokedexVariantsOverlay');
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function togglePokedexCard(button) {
    const lang = button.dataset.albumLanguage;
    const id = button.dataset.cardId;
    const number = Number(button.dataset.speciesNumber);
    const card = pokedexCollectionForLanguage(lang)[id];
    const image = button.querySelector('img');
    if (!card || !image?.naturalWidth) return;
    resetPokedexCardTilt(button);
    if(!window.ChiniWorkspace?.cache.documents.ui?.data.enable3D){openModal(id,{card,history:false});return;}
    window.openCard3D?.(card, image, {
        remove: () => removePokedexVariant(number, id, lang)
    });
}

function tiltPokedexCard(event, button) {
    if (event.pointerType === 'touch' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = button.getBoundingClientRect();
    button.style.setProperty('--tilt-x', ((.5 - (event.clientY - rect.top) / rect.height) * 14) + 'deg');
    button.style.setProperty('--tilt-y', (((event.clientX - rect.left) / rect.width - .5) * 14) + 'deg');
}

function resetPokedexCardTilt(button) {
    button.style.setProperty('--tilt-x', '0deg');
    button.style.setProperty('--tilt-y', '0deg');
}

async function removePokedexVariant(number, id, lang, oneCopy = false) {
    const target = pokedexCollectionForLanguage(lang), card = target[id];
    if(!card || ChiniPokedex.matchCard(card)?.number !== number)return;
    if(oneCopy && (card.quantity||1)>1)card.quantity--;
    else delete target[id];
    await savePokedexCollection(lang);
    renderPokedexBook();
    if(pokedexAlbumLanguage===lang)openPokedexVariants(number);
}

function closePokedexVariants() {
    const overlay = document.getElementById('pokedexVariantsOverlay');
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}
