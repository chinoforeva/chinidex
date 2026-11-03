async function loadSets() {
    const request = ++setsRequest;
    const el = document.getElementById('setsContent');
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>Cargando sets...</span></div>';
    try {
        const cached = localStorage.getItem('chiniSets_' + CACHE_V + '_' + currentContextKey());
        const cachedTime = localStorage.getItem('chiniSetsTime_' + CACHE_V + '_' + currentContextKey());
        const now = Date.now();
        if (!LOCAL_CATALOGUE_GAMES.has(currentGame) && currentLang !== 'es' && cached && cachedTime && (now - parseInt(cachedTime)) < 3600000) {
            allSets = JSON.parse(cached);
        } else {
            if (LOCAL_CATALOGUE_GAMES.has(currentGame)) {
                const dataRoot = currentDataRoot();
                const raw = await apiFetch(`/${dataRoot}/sets.json`, { cache: 'no-store' });
                if(window.ChiniCatalogue?.setRevision)await ChiniCatalogue.setRevision(dataRoot,raw.map(s=>s.officialCatalogueRevision||'').sort().pop()||'');
                if (request !== setsRequest) return;
                allSets = raw.map(s => ({
                    id: s.scrydexId || s.id, slug: s.scrydexId || s.id, name: s.name,
                    series: s.series || '',
                    cardCount: s.cardCount || 0,
                    productCount: s.productCount || s.cardCount || 0,
                    releasedAt: s.releaseDate || '',
                    logo: dataRoot === 'TCG/cn-data' ? String(s.localLogo || s.logo || '').replace(/^\/cn-data\//, '/TCG/cn-data/') : s.localLogo || s.logo || null,
                    category: s.category || '',
                    language: s.language || '',
                    languageCode: s.languageCode || currentLang,
                    source: s.source || null,
                    sourceUrl: s.sourceUrl || null,
                    symbol: null
                }));
                allSets.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
            }
            localStorage.setItem('chiniSets_' + CACHE_V + '_' + currentContextKey(), JSON.stringify(allSets));
            localStorage.setItem('chiniSetsTime_' + CACHE_V + '_' + currentContextKey(), now.toString());
        }
        // Also repair old cached metadata: catalogue logos are served only from the NAS.
        const logoRoot = currentDataRoot();
        allSets = allSets.map(set => ({
            ...set,
            logo: /^https?:/i.test(set.logo || '')
                ? '/' + logoRoot + '/logos/' + encodeURIComponent(set.id || set.slug) + '.webp'
                : set.logo
        }));
        renderSets(allSets);
        const warmRoot = currentDataRoot(), warmSets = allSets.slice(0, 2);
        setTimeout(() => {if (currentDataRoot() === warmRoot) warmSets.forEach(set => ChiniCatalogue.prefetch(warmRoot, set.slug));}, 150);
        renderShellSidebar();
        renderContextRail('sets');
    } catch (e) {
        if (request !== setsRequest) return;
        el.innerHTML = `<div class="error-msg" role="alert"><strong>No se pudieron cargar las expansiones.</strong><span>${escapeHtml(e.message || 'Vuelve a intentarlo.')}</span></div>`;
    }
}

function filterSets() {
    const q = document.getElementById('setSearch').value.toLowerCase();
    const filtered = allSets.filter(s => {
        const matchesText = s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
        const matchesSeries = !selectedSetSeries.size || selectedSetSeries.has(setSeriesName(s));
        return matchesText && matchesSeries;
    });
    renderSets(filtered);
}

function renderSets(sets) {
const presentationArguments=Array.from(arguments);sets=globalThis.ChiniPresentation?.sets(sets)??sets;
try{

    const el = document.getElementById('setsContent');
    const overview = seriesOverviewHTML();
    if (!sets.length) { el.innerHTML = overview + '<div class="empty-state"><h3>No se encontraron sets</h3><p>Prueba con otra búsqueda o selecciona una serie distinta.</p></div>'; return; }
    const groups = new Map();
    sets.forEach(set => {
        const series = setSeriesName(set);
        if (!groups.has(series)) groups.set(series, []);
        groups.get(series).push(set);
    });
    el.innerHTML = overview + [...groups.entries()].sort((a, b) => seriesSortRank(a[0]) - seriesSortRank(b[0])).map(([series, groupSets]) => `<section class="set-series-group" data-series="${escapeHtml(series)}">
        <h3 class="set-series-title">${escapeHtml(series)}</h3>
        <div class="expansions-grid">${groupSets.map(s => {
            const owned = Object.values(collection).filter(c => normalizeSetSlug(c.setSlug) === s.slug).length;
            const logoSrc = imageProxyUrl(s.logo);
            const logoHTML = logoSrc
                ? `<span class="set-label">${escapeHtml(s.name)}</span><img loading="lazy" decoding="async" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(s.name)}" onload="if(this.naturalWidth<=1)this.remove();else this.previousElementSibling.style.display='none'" onerror="this.remove()" style="max-height:88px;max-width:94%;object-fit:contain;">`
                : `<span class="set-label">${escapeHtml(s.name)}</span>`;
            const release = String(s.releasedAt || '').replaceAll('-', '/');
            return `<button type="button" class="expansion-card" aria-label="Abrir set ${escapeHtml(s.name)}" data-set-slug="${escapeHtml(s.slug)}" onclick="openSet('${escapeHtml(s.slug)}')">
                <div class="expansion-logo-wrap">${logoHTML}</div>
                <div class="expansion-info">
                    <div class="expansion-name">${escapeHtml(s.name)}</div>
                    <div class="expansion-date">${escapeHtml(release)}</div>
                    <div class="expansion-meta"><span>${s.cardCount} cartas</span>${owned > 0 ? `<span class="expansion-badge">${owned} tuyas</span>` : ''}</div>
                </div>
            </button>`;
        }).join('')}</div>
    </section>`).join('');

}finally{globalThis.ChiniEvents?.emit('renderSets',presentationArguments);}
}

function seriesOverviewHTML() {
    if (!allSets.length) return '';
    const groups = new Map();
    allSets.forEach(set => {
        const series = setSeriesName(set);
        if (!groups.has(series)) groups.set(series, []);
        groups.get(series).push(set);
    });
    const cards = [...groups.entries()]
        .sort((a, b) => seriesSortRank(a[0]) - seriesSortRank(b[0]))
        .slice(0, currentGame === 'pokemon' ? 12 : 8)
        .map(([series, groupSets]) => {
            const latest = [...groupSets].sort((a, b) => String(b.releasedAt || '').localeCompare(String(a.releasedAt || '')))[0];
            const logo = imageProxyUrl(latest?.logo);
            const active = selectedSetSeries.has(series);
            const token = encodeURIComponent(series);
            const seriesMark = series.split(/\s+/).filter(word => /^[A-Za-z0-9À-ÿ]/.test(word)).map(word => word[0]).join('').slice(0, 4).toUpperCase() || 'TCG';
            return `<button class="series-overview-card ${active ? 'active' : ''}" onclick="toggleSeriesOverview('${token}')" aria-pressed="${active}">
                <span class="series-overview-art"><span>${escapeHtml(seriesMark)}</span>${logo ? `<img src="${escapeHtml(logo)}" alt="" onload="if(this.naturalWidth<=1){this.remove()}else{this.previousElementSibling.style.display='none'}" onerror="this.remove()">` : ''}</span>
                <strong>${escapeHtml(series)}</strong>
                <small>${groupSets.length} ${groupSets.length === 1 ? 'expansión' : 'expansiones'} · ${escapeHtml(String(latest?.releasedAt || '').slice(0, 4))}</small>
            </button>`;
        }).join('');
    return `<section class="series-overview"><div class="series-overview-heading"><div><span class="section-eyebrow">EXPLORAR CATÁLOGO</span><h3>Series y eras</h3></div><span>${groups.size} colecciones</span></div><div class="series-overview-grid">${cards}</div></section>`;
}

function toggleSeriesOverview(token) {
    const series = decodeURIComponent(token);
    if (selectedSetSeries.size === 1 && selectedSetSeries.has(series)) selectedSetSeries.clear();
    else selectedSetSeries = new Set([series]);
    filterSets();
    renderContextRail('sets');
    document.getElementById('setsTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function refreshSetBadges() {
    document.querySelectorAll('.expansion-card[data-set-slug]').forEach(card => {
        const slug = card.dataset.setSlug;
        const owned = Object.values(collection).filter(c => normalizeSetSlug(c.setSlug) === slug).length;
        const meta = card.querySelector('.expansion-meta');
        if (!meta) return;
        let badge = meta.querySelector('.expansion-badge');
        if (owned > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'expansion-badge';
                meta.appendChild(badge);
            }
            badge.textContent = `${owned} en colección`;
        } else if (badge) {
            badge.remove();
        }
    });
}

async function openSet(setSlug, options = {}) {
const presentationArguments=Array.from(arguments);
try{

    if (options.history !== false) prepareNavigation();
    const request = ++setRequest;
    const setObj = allSets.find(s => s.slug === setSlug);
    currentSet = { ...(setObj || {}), slug: setSlug, name: setObj?.name || setSlug, series: setSeriesName(setObj) };
    selectedCardRarities.clear();
    document.getElementById('setCardsTitle').textContent = currentSet.name;
    document.getElementById('setHeroMeta').textContent = [currentSet.series, currentSet.releasedAt ? formatReleaseDate(currentSet.releasedAt) : '', currentSet.cardCount ? `${currentSet.cardCount} cartas` : ''].filter(Boolean).join(' · ');
    const heroLogo = document.getElementById('setHeroLogo');
    if (heroLogo) {
        const logo = imageProxyUrl(setObj?.logo);
        const monogram = currentSet.name.split(/\s+/).filter(Boolean).map(word => word[0]).join('').slice(0, 3).toUpperCase();
        heroLogo.innerHTML = `<span class="set-label" aria-hidden="true">${escapeHtml(monogram || 'TCG')}</span>${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(currentSet.name)}" onload="if(this.naturalWidth<=1){this.remove()}else{this.previousElementSibling.style.display='none'}" onerror="this.remove()">` : ''}`;
    }
    document.getElementById('setCardsSubtitle').textContent = 'Cargando la galería del set…';
    document.getElementById('setResultCount').textContent = 'Preparando cartas…';
    document.getElementById('setCardsContent').innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>Cargando cartas...</span></div>';
    showView('set-cards', { ...options, prepared: true });
    try {
        let cards;
        const cached = setCardsCache[setSlug];
        const cacheTime = localStorage.getItem('chiniSetCardsTime_' + setSlug);
        const now = Date.now();
        if (cached && cacheTime && (now - parseInt(cacheTime)) < 86400000) {
            cards = cached;
        } else {
            if (LOCAL_CATALOGUE_GAMES.has(currentGame)) {
                const dataRoot = currentDataRoot();
                const setDetail = await apiFetch(`/${dataRoot}/sets/${encodeURIComponent(setSlug)}/set.json`);
                if (request !== setRequest) return;
                const setCards = setDetail.cards || [];
                cards = setCards.map(c => normalizeLocalCard(c, setSlug, dataRoot));
                const setObj = allSets.find(s => s.slug === setSlug);
                if (setObj) cards.forEach(c => c.setName = setObj.name);
            }
            setCardsCache[setSlug] = cards;
            trimSetCardsCache();
            localStorage.setItem('chiniSetCardsTime_' + setSlug, now.toString());
        }
        currentSetCards = cards.sort((a, b) => normalizeCardNumber(a.number) - normalizeCardNumber(b.number));
        if (LOCAL_CATALOGUE_GAMES.has(currentGame)) {
            currentSet.productCount = currentSetCards.length;
            const idx = allSets.findIndex(s => s.slug === setSlug);
            if (idx >= 0) {
                allSets[idx].productCount = currentSetCards.length;
                if (!allSets[idx].cardCount) allSets[idx].cardCount = currentSetCards.length;
            }
            localStorage.setItem('chiniSets_' + CACHE_V + '_' + currentContextKey(), JSON.stringify(allSets));
        }
        document.getElementById('setCardsTitle').textContent = currentSet.name;
        const officialCount = setObj?.cardCount || currentSetCards.length;
        document.getElementById('setHeroMeta').textContent = [currentSet.series, currentSet.releasedAt ? formatReleaseDate(currentSet.releasedAt) : '', `${officialCount} cartas`].filter(Boolean).join(' · ');
        document.getElementById('setCardsSubtitle').textContent = currentLang === 'cn' && currentSetCards.length > officialCount
            ? `${officialCount} cartas numeradas · ${currentSetCards.length} acabados para explorar y añadir a tu colección.`
            : `${currentSetCards.length} cartas para explorar, consultar y añadir a tu colección.`;
        const cover = ChiniCatalogue.thumbnail(currentSetCards.find(card => card.image)?.image || '');
        document.querySelector('.set-cards-hero')?.style.setProperty('--set-cover', cover ? `url("${cover.replaceAll('"', '%22')}")` : 'none');
        populateSetFilters();
        renderSetPage(1);
        renderShellSidebar();
        renderContextRail('set-cards');
    } catch (e) {
        if (request !== setRequest) return;
        document.getElementById('setCardsContent').innerHTML = `<div class="error-msg" role="alert"><strong>No se pudieron cargar las cartas.</strong><span>${escapeHtml(e.message || 'Vuelve a intentarlo.')}</span></div>`;
        document.getElementById('setResultCount').textContent = 'No se pudo cargar el set';
    }

}finally{globalThis.ChiniEvents?.emit('openSet',presentationArguments);}
}

function activeViewName() {
    const id = document.querySelector('.view.active')?.id || 'view-game';
    return id.replace('view-', '');
}

function setSeriesName(set) {
    if(currentGame==='pokemon' && currentLang==='es' && set?.series)return set.series;
    const id = String(set?.id || set?.slug || '').toLowerCase().replace(/^es-/, '').replace(/_ja$/, '');
    if (currentGame !== 'pokemon') {
        const year = String(set?.releasedAt || '').slice(0, 4);
        return year && year !== '1900' ? `${GAME_CONFIGS[currentGame].label} · ${year}` : GAME_CONFIGS[currentGame].label;
    }
    if (/^me/.test(id)) return 'Mega Evolution';
    if (/^(r?z?sv|svp)/.test(id)) return 'Scarlet & Violet';
    if (/^swsh/.test(id)) return 'Sword & Shield';
    if (/^(sm|det|cel)/.test(id)) return 'Sun & Moon';
    if (/^xy/.test(id)) return 'XY';
    if (/^bw/.test(id)) return 'Black & White';
    if (/^(dp|pl|hgss)/.test(id)) return 'Diamond & Pearl';
    if (/^(ex|ecard)/.test(id)) return 'EX / E-Card';
    if (/^(neo|gym|base|np|pop)/.test(id)) return 'Classic';
    return 'Other';
}

function seriesSortRank(name) {
    const spanish=['Megaevolución','Escarlata y Púrpura','Espada y Escudo','Sol y Luna','Serie XY','Serie Negro y Blanco','Serie HeartGold & SoulSilver','Serie Platino','Serie Diamante & Perla','EX'];
    if(currentLang==='es'&&spanish.includes(name))return spanish.indexOf(name);
    const order = ['Mega Evolution', 'Scarlet & Violet', 'Sword & Shield', 'Sun & Moon', 'XY', 'Black & White', 'Diamond & Pearl', 'EX / E-Card', 'Classic', 'Other'];
    const rank = order.indexOf(name);
    return rank === -1 ? 50 : rank;
}

function shellViewLabel(view = activeViewName()) {
    return ({
        dashboard:'Dashboard',tools:'Herramientas',settings:'Ajustes',album:'Álbum',mysets:'Mis álbumes',game: 'Catálogos', sets: 'Expansiones', 'set-cards': currentSet?.name || 'Cartas',
        users: 'Usuarios', search: 'Buscar', collection: 'Colección', 'catch-em-all': '¡Hazte con Todos!', detail: lastDetailCard?.name || 'Detalle'
    })[view] || 'Catálogo';
}

function renderShellSidebar() {
    const showPokedex = currentGame === 'pokemon' && activeViewName() !== 'game';
    for (const id of ['btn-catch-em-all', 'sidebarCatchAllLink']) {
        document.getElementById(id).hidden = !showPokedex;
    }

    const label = document.getElementById('sidebarGameLabel');
    if (label) label.textContent = GAME_CONFIGS[currentGame].label;
    const sidebarLanguages = document.querySelector('.sidebar-language-switch');
    if (sidebarLanguages) sidebarLanguages.style.display = GAME_CONFIGS[currentGame].languages.length > 1 ? '' : 'none';
    if (document.getElementById('sidebarLangCN')) document.getElementById('sidebarLangCN').hidden = !GAME_CONFIGS[currentGame].languages.includes('cn');
    document.getElementById('sidebarLangEN')?.classList.toggle('active', currentLang === 'en');
    document.getElementById('sidebarLangJP')?.classList.toggle('active', currentLang === 'jp');
    document.getElementById('sidebarLangCN')?.classList.toggle('active', currentLang === 'cn');
    const list = document.getElementById('sidebarSetList');
    if (list) {
        list.innerHTML = allSets.slice(0, 7).map(set => `<li><button class="${currentSet?.slug === set.slug ? 'active' : ''}" onclick="openSet('${escapeHtml(set.slug)}')" title="${escapeHtml(set.name)}">${escapeHtml(set.name)}</button></li>`).join('') || '<li><button onclick="showView(\'sets\')">Cargar catálogo…</button></li>';
    }
    const games = document.getElementById('sidebarGames');
    if (games) {
        games.innerHTML = Object.entries(GAME_CONFIGS).map(([key, config]) => `<button class="sidebar-game-option ${key === currentGame ? 'active' : ''}" onclick="switchGame('${key}')">${escapeHtml(config.label)}</button>`).join('');
    }
    const view = activeViewName();
    document.getElementById('sidebarSetsLink')?.classList.toggle('active', view === 'sets' || view === 'set-cards');
    document.getElementById('sidebarSearchLink')?.classList.toggle('active', view === 'search');
    document.getElementById('sidebarUsersLink')?.classList.toggle('active', view === 'users');
    document.getElementById('sidebarCollectionLink')?.classList.toggle('active', view === 'collection');
    document.getElementById('sidebarCatchAllLink')?.classList.toggle('active', view === 'catch-em-all');
}

function railViewToggleHTML() {
    return typeof ChiniColumns !== 'undefined' ? ChiniColumns.control() : '';
}

function renderContextRail(view = activeViewName(), detailCard = null) {
    const heading = document.getElementById('railHeading');
    const content = document.getElementById('railContent');
    if (!content) return;
    if (heading) heading.textContent = view === 'detail' ? 'Ficha' : view === 'collection' ? 'Colección' : view === 'catch-em-all' ? 'Pokédex' : 'Filtros';
    let html = '';
    if (view === 'game') {
        html = `<div class="rail-section"><div class="rail-label">Catálogos disponibles</div><div class="rail-options">${Object.entries(GAME_CONFIGS).map(([key, config]) => `<label class="rail-option"><input type="radio" name="railGame" ${key === currentGame ? 'checked' : ''} onchange="switchGame('${key}')"><span>${escapeHtml(config.label)}</span></label>`).join('')}</div></div><div class="rail-section"><p class="rail-note"><strong>Todo en un solo archivo.</strong><br>Sets, búsqueda, precios, escáner, sobres y colección personal.</p></div>`;
    } else if (view === 'sets') {
        const groups = new Map();
        allSets.forEach(set => { const name = setSeriesName(set); groups.set(name, (groups.get(name) || 0) + 1); });
        html = railViewToggleHTML() + `<div class="rail-section"><div class="rail-search"><input value="${escapeHtml(document.getElementById('setSearch')?.value || '')}" placeholder="Filtrar expansiones…" oninput="shellFilterSets(this.value)"></div></div>`;
        if (GAME_CONFIGS[currentGame].languages.length > 1) html += `<div class="rail-section"><div class="rail-label">Idioma</div><div class="rail-view-toggle"><button class="${currentLang === 'en' ? 'active' : ''}" onclick="switchLang('en')">EN</button><button class="${currentLang === 'jp' ? 'active' : ''}" onclick="switchLang('jp')">JP</button></div>${currentGame === 'pokemon' ? `<button class="rail-action ${currentLang === 'cn' ? 'primary' : ''}" style="margin-top:7px" onclick="switchLang('cn')">CATÁLOGO CN</button>` : ''}</div>`;
        html += `<div class="rail-section"><div class="rail-label">Series</div><div class="rail-options">${[...groups.entries()].map(([name, count]) => { const token = encodeURIComponent(name); return `<label class="rail-option"><input type="checkbox" ${selectedSetSeries.has(name) ? 'checked' : ''} onchange="toggleSetSeriesFilter('${token}',this.checked)"><span>${escapeHtml(name)}</span><small class="rail-count">${count}</small></label>`; }).join('')}</div></div>`;
    } else if (view === 'set-cards') {
        const counts = new Map();
        currentSetCards.forEach(card => { const name = displayRarityLabel(card.rarity) || 'Sin rareza'; counts.set(name, (counts.get(name) || 0) + 1); });
        html = railViewToggleHTML() + `<div class="rail-section"><div class="rail-search"><input value="${escapeHtml(document.getElementById('setCardSearch')?.value || '')}" placeholder="Filtrar cartas…" oninput="shellFilterCards(this.value)"></div></div><div class="rail-section"><button class="rail-action primary" onclick="openPack()">✦ ABRIR SOBRE</button></div><div class="rail-section"><div class="rail-label">Rareza</div><div class="rail-options">${[...counts.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([name,count]) => { const token = encodeURIComponent(name); return `<label class="rail-option"><input type="checkbox" ${selectedCardRarities.has(name) ? 'checked' : ''} onchange="toggleCardRarityFilter('${token}',this.checked)"><span>${escapeHtml(name)}</span><small class="rail-count">${count}</small></label>`; }).join('')}</div></div>`;
    } else if (view === 'search') {
        html = railViewToggleHTML() + `<div class="rail-section"><div class="rail-label">Búsqueda global</div><div class="rail-search"><input value="${escapeHtml(document.getElementById('globalSearch')?.value || '')}" placeholder="Nombre de la carta…" oninput="shellGlobalSearch(this.value)"></div></div><div class="rail-section"><div class="rail-label">Orden</div><select class="rail-select" onchange="shellSearchSort(this.value)"><option value="alpha" ${document.getElementById('searchSort')?.value === 'alpha' ? 'selected' : ''}>Alfabético</option><option value="price" ${document.getElementById('searchSort')?.value === 'price' ? 'selected' : ''}>Precio mayor</option></select></div>`;
    } else if (view === 'collection') {
        html = `<div class="rail-section"><div class="rail-label">Vista</div><div class="rail-view-toggle"><button class="${collectionMode === 'list' ? 'active' : ''}" onclick="setCollectionMode('list')">▤ Lista</button><button class="${collectionMode === 'album' ? 'active' : ''}" onclick="setCollectionMode('album')">▦ Álbum</button></div></div><div class="rail-section"><div class="rail-search"><input value="${escapeHtml(document.getElementById('collectionSearch')?.value || '')}" placeholder="Filtrar colección…" oninput="shellCollectionSearch(this.value)"></div></div><div class="rail-section"><button class="rail-action primary" onclick="openCardScanner()">⌗ ESCANEAR CARTA</button></div><div class="rail-section"><div class="rail-label">Orden</div><select class="rail-select" onchange="shellCollectionSort(this.value)">${[['pokedex','Orden Pokédex'],['name','Nombre A–Z'],['price','Precio: mayor a menor'],['price-asc','Precio: menor a mayor'],['date','Fecha añadida']].map(([value,label]) => `<option value="${value}" ${document.getElementById('collectionSort')?.value === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>`;
    } else if (view === 'catch-em-all') {
        html = `<div class="rail-section"><div class="rail-label">Idioma del álbum</div><div class="rail-view-toggle"><button class="${pokedexAlbumLanguage === 'en' ? 'active' : ''}" onclick="selectPokedexLanguage('en')">INGLÉS</button><button class="${pokedexAlbumLanguage === 'jp' ? 'active' : ''}" onclick="selectPokedexLanguage('jp')">JAPONÉS</button></div></div><div class="rail-section"><div class="rail-label">Volumen</div><div class="rail-options">${[1,2,3].map(album => `<label class="rail-option"><input type="radio" name="railPokedexAlbum" ${album === pokedexAlbumNumber ? 'checked' : ''} onchange="selectPokedexAlbum(${album})"><span>Álbum ${album}</span><small class="rail-count">${(album - 1) * 480 + 1}–${album * 480}</small></label>`).join('')}</div></div><div class="rail-section"><button class="rail-action primary" onclick="openCardScanner('pokedex')">⌗ ESCANEAR EN/JP</button></div><div class="rail-section"><p class="rail-note"><strong>Destino automático.</strong><br>La carta irá al álbum inglés o japonés según su catálogo.</p></div>`;
    } else if (view === 'detail') {
        const card = detailCard || lastDetailCard;
        const owned = card && !!collection[card.id];
        html = `<div class="rail-section"><div class="rail-label">Estado</div><p class="rail-note">${owned ? '<strong>En tu colección</strong><br>Esta carta ya forma parte de tu archivo.' : '<strong>Sin archivar</strong><br>Añádela para conservarla en tu colección.'}</p></div>${card ? `<div class="rail-section"><button class="rail-action primary" onclick="toggleModalCollection('${escapeHtml(card.id)}')">${owned ? '− QUITAR DE COLECCIÓN' : '+ AÑADIR A COLECCIÓN'}</button></div>` : ''}<div class="rail-section"><p class="rail-note">Pulsa <strong>Esc</strong> para volver a la galería.</p></div>`;
    }
    content.innerHTML = html;
}

function syncShellUI(view = activeViewName(), detailCard = null) {
const presentationArguments=Array.from(arguments);
try{

    document.body.dataset.view = view;
    renderShellSidebar();
    renderContextRail(view, detailCard);
    const query = document.getElementById('shellQuery');
    if (query) {
        query.placeholder = 'Buscar cartas…';
        query.setAttribute('aria-label', 'Buscar cartas');
        if (document.activeElement !== query) query.value = document.getElementById('globalSearch')?.value || '';
    }

}finally{globalThis.ChiniEvents?.emit('syncShellUI',presentationArguments);}
}

function setUiDisplayMode(mode) {
const presentationArguments=Array.from(arguments);
try{

    uiDisplayMode = 'grid';
    localStorage.setItem('chiniDisplayMode', uiDisplayMode);
    document.body.classList.toggle('ui-table', uiDisplayMode === 'table');
    document.querySelectorAll('.inline-view-toggle button').forEach(button => button.classList.toggle('active', button.dataset.display === uiDisplayMode));
    renderContextRail(activeViewName());

}finally{globalThis.ChiniEvents?.emit('setUiDisplayMode',presentationArguments);}
}

function shellFilterSets(value) {
    document.getElementById('setSearch').value = value;
    const query = document.getElementById('shellQuery'); if (query && document.activeElement !== query) query.value = value;
    filterSets();
}

function toggleSetSeriesFilter(token, checked) {
    const name = decodeURIComponent(token);
    if (checked) selectedSetSeries.add(name); else selectedSetSeries.delete(name);
    filterSets();
}

function shellFilterCards(value) {
    document.getElementById('setCardSearch').value = value;
    const query = document.getElementById('shellQuery'); if (query && document.activeElement !== query) query.value = value;
    filterSetCards();
}

function toggleCardRarityFilter(token, checked) {
    const name = decodeURIComponent(token);
    if (checked) selectedCardRarities.add(name); else selectedCardRarities.delete(name);
    filterSetCards();
}

function shellGlobalSearch(value) {
    document.getElementById('globalSearch').value = value;
    const query = document.getElementById('shellQuery'); if (query && document.activeElement !== query) query.value = value;
    globalCardSearch();
}

function shellSearchSort(value) {
    document.getElementById('searchSort').value = value;
    applySearchSortAndRender();
}

function shellCollectionSearch(value) {
    document.getElementById('collectionSearch').value = value;
    const query = document.getElementById('shellQuery'); if (query && document.activeElement !== query) query.value = value;
    renderCollection();
}

function shellCollectionSort(value) {
    document.getElementById('collectionSort').value = value;
    renderCollection();
}

function shellQueryInput(value) {
    const view = activeViewName();
    if (view === 'sets') shellFilterSets(value);
    else if (view === 'set-cards') shellFilterCards(value);
    else if (view === 'search') shellGlobalSearch(value);
    else if (view === 'collection') shellCollectionSearch(value);
    else if (view === 'catch-em-all') document.getElementById('pokedexJumpInput').value = value;
}

function toggleContextRail(force) {
    const open = typeof force === 'boolean' ? force : !document.body.classList.contains('rail-open');
    document.body.classList.toggle('rail-open', open);
    document.querySelectorAll('.rail-toggle, .inline-filter-btn').forEach(button => button.setAttribute('aria-expanded', String(open)));
    const rail = document.querySelector('.context-rail');
    if (rail) {
        rail.toggleAttribute('inert', !open);
        rail.setAttribute('aria-hidden', String(!open));
    }
    const backdrop = document.querySelector('.rail-backdrop');
    if (backdrop) {
        backdrop.tabIndex = open ? 0 : -1;
        backdrop.setAttribute('aria-hidden', String(!open));
    }
}

function sortSetCards(cards) {
    const mode = document.getElementById('setCardSort')?.value || 'number';
    const sorted = [...cards];
    if (mode === 'name') return sorted.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
    if (mode === 'rarity') return sorted.sort((a, b) => String(displayRarityLabel(a.rarity) || '').localeCompare(String(displayRarityLabel(b.rarity) || ''), undefined, { sensitivity: 'base' }) || normalizeCardNumber(a.number) - normalizeCardNumber(b.number));
    if (mode === 'price' || mode === 'price-asc') return sorted.sort((a, b) => {
        return ChiniPrices.compare(a,b,mode==='price-asc'?1:-1);
    });
    return sorted.sort((a, b) => normalizeCardNumber(a.number) - normalizeCardNumber(b.number));
}

function renderSetPage(page) {
    setCardsPage = page || 1;
    const sortedCards = sortSetCards(currentSetCards);
    const totalPages = Math.ceil(sortedCards.length / cardsPerPage) || 1;
    if (setCardsPage > totalPages) setCardsPage = totalPages;
    const start = (setCardsPage - 1) * cardsPerPage;
    const end = start + cardsPerPage;
    const pageCards = sortedCards.slice(start, end);
    renderSetCards(pageCards);
    ChiniCatalogue.warmImages(sortedCards.slice(end, end + 12));
    updateSetStats(currentSetCards);
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const el = document.getElementById('setPagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = `<button class="pagination-btn" onclick="goToPage(${setCardsPage - 1})" ${setCardsPage === 1 ? 'disabled' : ''}>‹</button>`;
    const range = 2;
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= setCardsPage - range && i <= setCardsPage + range)) {
            pages.push(i);
        } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
        }
    }
    for (const p of pages) {
        if (p === '...') {
            html += '<span class="pagination-ellipsis">…</span>';
        } else {
            html += `<button class="pagination-btn ${p === setCardsPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
        }
    }
    html += `<button class="pagination-btn" onclick="goToPage(${setCardsPage + 1})" ${setCardsPage === totalPages ? 'disabled' : ''}>›</button>`;
    html += `<span class="pagination-info">${currentSetCards.length} cartas · ${totalPages} paginas</span>`;
    el.innerHTML = html;
}

function goToPage(p) {
    const totalPages = Math.ceil(currentSetCards.length / cardsPerPage) || 1;
    if (p < 1 || p > totalPages) return;
    renderSetPage(p);
    document.getElementById('setCardsContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function populateSetFilters() {
    renderContextRail('set-cards');
}

function filterSetCards() {
    const q = document.getElementById('setCardSearch').value.toLowerCase();
    const filtered = sortSetCards(currentSetCards.filter(c => {
        return (!q || String(c.name || '').toLowerCase().includes(q) || String(c.number || '').toLowerCase().includes(q))
            && (!selectedCardRarities.size || selectedCardRarities.has(displayRarityLabel(c.rarity) || 'Sin rareza'));
    }));
    if (q || selectedCardRarities.size) {
        renderSetCards(filtered);
        updateSetStats(currentSetCards);
        document.getElementById('setPagination').innerHTML = `<span class="pagination-info">${filtered.length} de ${currentSetCards.length} cartas (filtradas)</span>`;
    } else {
        renderSetPage(setCardsPage || 1);
    }
}

function clearSetFilters() {
    document.getElementById('setCardSearch').value = '';
    document.getElementById('setCardSort').value = 'number';
    selectedCardRarities.clear();
    renderSetPage(1);
    renderContextRail('set-cards');
}

function renderSetCards(cards) {
    const el = document.getElementById('setCardsContent');
    const resultCount = document.getElementById('setResultCount');
    if (resultCount) resultCount.textContent = `${cards.length} ${cards.length === 1 ? 'carta visible' : 'cartas visibles'}`;
    if (!cards.length) {
        el.innerHTML = '<div class="empty-state"><div><h3>No se encontraron cartas</h3><p>Prueba con otro nombre, número o rareza.</p></div></div>';
        return;
    }
    el.innerHTML = `<div class="cards-grid">${cards.map((c, index) => cardHTML(c, true, index < 12)).join('')}</div>`;
}

function updateSetStats(cards) {
    const list = cards || currentSetCards;
    const total = list.length;
    const owned = list.filter(c => collection[c.id]).length;
    const progress = total ? Math.round(owned / total * 1000)/10 : 0;
    document.getElementById('setTotalCards').textContent = total;
    document.getElementById('setOwnedCards').textContent = owned;
    document.getElementById('setProgress').textContent = progress + '%';
    document.getElementById('setProgressBar').style.width = progress + '%';
}

function handleCardImageError(img, fallbacks = []) {
    if (!img._cardFallbacks) img._cardFallbacks = [...new Set(fallbacks)].filter(url => url && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/image-proxy)/i.test(url) && url !== img.getAttribute('src'));
    const next = img._cardFallbacks.shift();
    if (next) { img.src = next; return; }
    img.onerror = null;
    const placeholder = document.createElement('span');
    placeholder.className = 'no-img';
    placeholder.textContent = 'Imagen no disponible';
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', img.alt || 'Carta sin imagen');
    img.replaceWith(placeholder);
}

function imageFallbackAttr(c) {
    return escapeHtml(`handleCardImageError(this, ${JSON.stringify([c.image, c.generatedImage, c.cdnImage].filter(Boolean))})`);
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function repairCardImage(card) {
    if (!card) return '';
    const fixedLocal = LOCAL_IMAGE_OVERRIDES[card.id];
    if (fixedLocal) {
        if (card.image !== fixedLocal) card.image = fixedLocal;
        return fixedLocal;
    }
    if (MISSING_LOCAL_IMAGES.has(card.id)) return '';
    return imageProxyUrl(card.localImage || card.image || card.generatedImage || '');
}

function cardFinishLabel(card) {
    if(card.source==='bandai-official-jp'&&card.sourcePrintingId){const m=/_([pr])(\d+)$/.exec(card.sourcePrintingId);if(m)return (m[1]==='p'?'Ilustración alternativa ':'Reimpresión ')+m[2];}
    if(globalThis.ChiniFields)return card.variantLabel||ChiniFields.variant(card.variant||card.finish).label;
    const finish = String(card.variant || card.finish || '').trim();
    const key = finish.toLowerCase().replace(/[\s_-]/g, '');
    if (/^(normal|nonfoil|nonholo|regular)$/.test(key)) return 'Normal';
    if(key==='altart')return 'Ilustración alternativa';
    if (/reverse/.test(key)) return 'Reverse Holo';
    if (/holo/.test(key)) return 'Holo';
    if (/foil/.test(key)) return 'Foil';
    if (!key && /holo|foil/i.test(card.rarity || '')) return /holo/i.test(card.rarity) ? 'Holo' : 'Foil';
    return finish || 'Sin especificar';
}

function cardDisplayPrice(card) {return ChiniPrices.format(ChiniPrices.quote(card));}

function cardSummaryHTML(card) {
    const number = card.number ?? card.albumNumber;
    const rarity = displayRarityLabel(card.rarity) || 'Sin rareza';
    const image = String(card.localImage || card.image || '');
    const game = card.game || (/onepiece(?:-jp)?-data/.test(image) ? 'onepiece' : /riftbound-data/.test(image) ? 'riftbound' : /magic-data/.test(image) ? 'magic' : 'pokemon');
    const tier = window.ChiniRarity?.classify(card.rarity || '', game, card.languageCode || currentLang) || '';
    return `<div class="card-summary"><div class="card-summary-title"><span class="card-name" title="${escapeHtml(card.name)}">${escapeHtml(card.name)}</span><span class="card-number">${number != null && number !== '' ? '#' + escapeHtml(number) : '—'}</span></div><div class="card-summary-meta"><span class="rarity-chip" data-rarity-tier="${escapeHtml(tier)}">${escapeHtml(rarity)}</span><span class="variant-chip">${escapeHtml(cardFinishLabel(card))}</span></div><div class="card-summary-price card-price">${escapeHtml(cardDisplayPrice(card))}</div>${card.searchMatch&&card.searchMatch.field!=='name'?`<small class="search-match-note">Coincide en ${escapeHtml(({setName:'expansión',setId:'código de expansión',setSlug:'código de expansión',number:'número',id:'código',artist:'ilustrador',illustrator:'ilustrador'})[card.searchMatch.field]||card.searchMatch.field)}</small>`:card.searchMatch?.kind==='similar'?'<small>Nombre parecido: revisa la coincidencia</small>':''}</div>`;
}

function cardHTML(c, showActions = true, eager = false) {
    const owned = !!collection[c.id];
    const img = ChiniCatalogue.thumbnail(repairCardImage(c));
    const rarityLabel = displayRarityLabel(c.rarity);
    const marketPrice = fmt(c.price ?? getBestPrice(c));
    const errFallback = imageFallbackAttr(c);
    return `<div class="card-tcg ${owned ? 'owned' : ''}" data-card-id="${c.id}">
        <div class="owned-badge">✓</div>
        <div class="card-img-wrap" role="button" tabindex="0" aria-label="Abrir detalle de ${escapeHtml(c.name)}" onclick="openModal('${c.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openModal('${c.id}')}" style="cursor:pointer;">
            ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(c.name)}" loading="${typeof eager !== 'undefined' && eager ? 'eager' : 'lazy'}" decoding="async" onerror="${errFallback}">` : '<span class="no-img">Sin imagen</span>'}
        </div>
        <div class="card-details">${cardSummaryHTML(c)}</div>
        ${showActions ? `<div class="card-actions">${owned
            ? `<button class="remove-btn" onclick="toggleCard('${c.id}')">Quitar</button>`
            : `<button class="add-btn" onclick="toggleCard('${c.id}')">+ Añadir</button>`
        }</div>` : ''}
    </div>`;
}

function searchHTML(c, eager = false) {
    const owned = !!collection[c.id];
    const img = ChiniCatalogue.thumbnail(repairCardImage(c));
    const rarityLabel = displayRarityLabel(c.rarity);
    const marketPrice = fmt(c.price ?? getBestPrice(c));
    const meta = `${c.setName || ''} ${c.number ? '#' + c.number + ' ' : ''}${rarityLabel}${c.variant ? ' · ' + c.variant : ''}`;
    const errFallback = imageFallbackAttr(c);
    return `<div class="card-tcg ${owned ? 'owned' : ''}">
        <div class="owned-badge">✓</div>
        <div class="card-img-wrap" role="button" tabindex="0" aria-label="Abrir detalle de ${escapeHtml(c.name)}" onclick="openModal('${c.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openModal('${c.id}')}" style="cursor:pointer;">
            ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(c.name)}" loading="${typeof eager !== 'undefined' && eager ? 'eager' : 'lazy'}" decoding="async" onerror="${errFallback}">` : '<span class="no-img">Sin imagen</span>'}
        </div>
        <div class="card-details">${cardSummaryHTML(c)}</div>
        <div class="card-actions">
            ${owned
                ? `<button class="remove-btn" onclick="toggleCard('${c.id}')">Quitar</button>`
                : `<button class="add-btn" onclick="toggleCard('${c.id}')">+ Añadir</button>`
            }
        </div>
    </div>`;
}

function globalCardSearch(options = {}) {
    const request = ++searchRequest;
    searchController?.abort();
    clearTimeout(searchTimeout);
    const q = document.getElementById('globalSearch').value.trim();
    if (!q) {
        globalThis.ChiniSearch?.clear();
        document.getElementById('searchContent').innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Escribe el nombre de una carta para buscar</p>';
        searchResults = [];
        searchResultsTotal = 0;
        return;
    }
    document.getElementById('searchContent').innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>Buscando...</span></div>';
    const runSearch = async () => {
        const controller = new AbortController();
        searchController = controller;
        try {
            let cards;
            if (LOCAL_CATALOGUE_GAMES.has(currentGame)) {
                const dataRoot = currentDataRoot();
                const result = await ChiniCatalogue.search(dataRoot,q,controller.signal,globalThis.ChiniSearch?.options(options)||{});
                if (request !== searchRequest) return;
                globalThis.ChiniSearch?.receive(result);
                searchResultsTotal = result.total;
                cards = result.cards.map(c => {
                    const card = normalizeLocalCard(c, c.setId, dataRoot);
                    card.id = c.id;
                    card.name = c.name || '';
                    card.number = c.number || '';
                    const setObj = allSets.find(s => s.slug === c.setId);
                    if (setObj) card.setName = setObj.name;
                    return card;
                });
            }
            searchResults = sortSearchResults(cards || []);
            renderSearchResults(searchResults);
        } catch (e) {
            if (request !== searchRequest || e.name === 'AbortError') return;
            document.getElementById('searchContent').innerHTML = `<div class="error-msg" role="alert"><strong>No se pudo completar la búsqueda.</strong><span>${escapeHtml(e.message || 'Vuelve a intentarlo.')}</span></div>`;
        }
    };
    if (options.immediate) return runSearch();
    searchTimeout = setTimeout(runSearch, 180);
}

function sortSearchResults(cards) {
    if(globalThis.ChiniSearch?.paged())return [...(cards||[])];
    const mode=document.getElementById('searchSort')?.value||'relevance',list=[...(cards||[])];
    if(mode==='price')return list.sort((a,b)=>ChiniPrices.compare(a,b,-1)||a.name.localeCompare(b.name));
    if(mode==='relevance'){
        const rank=c=>{const m=c.searchMatch;if(!m)return 99;if(m.kind==='exact')return 0;if(m.field==='name')return m.kind==='prefix'?1:m.kind==='similar'?8:2;return ({number:3,id:4,setId:5,setSlug:5,setName:6,artist:7,illustrator:7})[m.field]||9;};
        return list.sort((a,b)=>rank(a)-rank(b));
    }
    return list.sort((a,b)=>a.name.localeCompare(b.name)||normalizeCardNumber(a.number)-normalizeCardNumber(b.number));
}
function applySearchSortAndRender() {
    if(globalThis.ChiniSearch)return globalCardSearch({immediate:true,page:1});
    searchResults = sortSearchResults(searchResults);
    renderSearchResults(searchResults);
}

function renderSearchResults(cards, requestedPage = 1) {
const presentationArguments=Array.from(arguments);cards=globalThis.ChiniPresentation?.search(cards)??cards;
try{

    if(globalThis.ChiniSearch?.paged())return ChiniSearch.render(cards);
    const el = document.getElementById('searchContent');
    if (!cards.length) { el.innerHTML = '<div class="empty-state"><h3>No se encontraron cartas</h3></div>'; return; }
    const notice = searchResultsTotal > cards.length
        ? `<p class="search-limit-note">Mostrando ${cards.length} de ${searchResultsTotal} coincidencias. Afina la búsqueda para ver la carta concreta.</p>`
        : '';
    const pages = Math.ceil(cards.length / 60), page = Math.max(1, Math.min(pages, requestedPage));
    const visible = cards.slice((page - 1) * 60, page * 60);
    const controls = pages > 1 ? `<div class="pagination"><button class="pagination-btn" type="button" ${page === 1 ? 'disabled' : ''} onclick="renderSearchResults(searchResults,${page - 1})">Anterior</button><span aria-live="polite">Página ${page} de ${pages}</span><button class="pagination-btn" type="button" ${page === pages ? 'disabled' : ''} onclick="renderSearchResults(searchResults,${page + 1})">Siguiente</button></div>` : '';
    el.innerHTML = `${notice}${controls}<div class="cards-grid">${visible.map((c,index) => searchHTML(c,index < 12)).join('')}</div>${controls}`;

}finally{globalThis.ChiniEvents?.emit('renderSearchResults',presentationArguments);}
}

async function toggleCard(cardId) {const existing=collection[cardId];if(existing&&!confirm('¿Quitar esta impresión de la colección? Puedes revisarlo en Historial.'))return;return ChiniInventory.adjust(cardId,existing?-(existing.quantity||1):1,!!existing);}

function refreshCurrentView() {
    const activeView = document.querySelector('.view.active');
    if (!activeView) return;
    refreshSetBadges();
    if (activeView.id === 'view-set-cards') { filterSetCards(); }
    else if (activeView.id === 'view-search') { renderSearchResults(searchResults); }
    else if (activeView.id === 'view-collection') { renderCollection(); }
    else if (activeView.id === 'view-catch-em-all') { renderPokedexBook(); }
    else if (activeView.id === 'view-sets') { renderSets(allSets); }
}

async function refreshCollectionPrices() {
    const context = currentContextKey(), user = currentUser;
    const sets = [...new Set(Object.values(collection).map(c => c.setSlug).filter(Boolean))];
    let changed = false;
    for (const set of sets) {
        if (context !== currentContextKey() || user !== currentUser) return;
        try {
            const detail = await apiFetch(`/${collectionAlbumDataRoot(normalizeSetSlug(set))}/sets/${encodeURIComponent(set)}/set.json`);
            if (context !== currentContextKey() || user !== currentUser) return;
            for (const card of detail.cards || []) {
                const owned = collection[card.id];
                if (owned && card.price != null && (owned.price !== card.price || JSON.stringify(owned.prices) !== JSON.stringify(card.prices))) {
                    owned.price = card.price; owned.prices = card.prices || null;
                    delete pricingCache[card.id]; changed = true;
                }
            }
        } catch (error) { console.warn('No se pudieron leer los precios guardados en el NAS:', error.message); }
    }
    // Quotes update presentation only; market data is not a collection edit.
    const activeView = document.querySelector('.view.active');
    if (activeView?.id === 'view-collection') renderCollection();
}
