function navigationHash(route) {
    if (route.view === 'game') return '#/games';
    const section = {history:'history',inventory:'inventory',wishlist:'wishlist',trades:'trades',notifications:'notifications',missing:'missing',shared:'shared',dashboard:'dashboard',tools:'tools',settings:'settings',album:'album',mysets:'mysets', sets: 'sets', 'set-cards': 'sets', users: 'users', search: 'search', collection: 'collection', 'catch-em-all': 'pokedex' }[route.view] || 'sets';
    let hash = `#/${encodeURIComponent(route.game)}/${encodeURIComponent(route.lang)}/${section}`;
    if (route.view === 'set-cards') hash += '/' + encodeURIComponent(route.set);
    const query = new URLSearchParams();
    if(route.searchFilters)for(const [name,value] of Object.entries(route.searchFilters))if(value)query.set(name==='set'?'expansion':name,value);
    if(route.albumId)query.set('albumId',route.albumId);if(route.albumPage)query.set('albumPage',route.albumPage);if(route.albumSet)query.set('albumSet',route.albumSet);
    if(route.workspaceFilters)for(const [name,value] of Object.entries(route.workspaceFilters))if(value)query.set(name,value);
    if (route.q) query.set('q', route.q);
    if(route.searchMode)query.set('scope',route.searchMode);
    if(route.sort)query.set('sort',route.sort);
    if (route.card) {
        query.set('card', route.card);
        if (route.view !== 'set-cards' && route.set) query.set('set', route.set);
    }
    return hash + (query.size ? '?' + query.toString() : '');
}

function parseNavigationHash(hash) {
    const fallback = { view: 'game', game: 'pokemon', lang: 'en' };
    try {
        const [path, queryText = ''] = hash.replace(/^#\/?/, '').split('?');
        const [game, lang, section, set] = path.split('/').map(decodeURIComponent);
        if (game === 'games' || !GAME_CONFIGS[game] || !GAME_CONFIGS[game].languages.includes(lang)) return fallback;
        const view = {history:'history',inventory:'inventory',wishlist:'wishlist',trades:'trades',notifications:'notifications',missing:'missing',shared:'shared',dashboard:'dashboard',tools:'tools',settings:'settings',album:'album',mysets:'mysets', sets: set ? 'set-cards' : 'sets', users: 'users', search: 'search', collection: 'collection', pokedex: game === 'pokemon' ? 'catch-em-all' : 'sets' }[section];
        if (!view) return fallback;
        const query = new URLSearchParams(queryText);
        return { view, game, lang,...(query.has('albumId')?{albumId:query.get('albumId'),albumPage:Number(query.get('albumPage'))||0}:{}),...(query.has('albumSet')?{albumSet:query.get('albumSet'),albumPage:Number(query.get('albumPage'))||0}:{}), set: set || query.get('set') || '', card: query.get('card') || '', q: query.get('q') || '',...(query.has('scope')?{searchMode:query.get('scope')==='name'?'name':'all'}:{}),...(query.has('sort')?{sort:query.get('sort')||'relevance'}:{}),...(['inventory','missing','shared'].includes(view)?{workspaceFilters:Object.fromEntries(query)}:{}),...(view==='search'&&[...query.keys()].some(key=>['expansion','rarity','variant','artist','ownership','currency','min','max','page'].includes(key))?{searchFilters:Object.fromEntries([...query].filter(([key])=>['expansion','rarity','variant','artist','ownership','currency','min','max','page'].includes(key)).map(([key,value])=>[key==='expansion'?'set':key,value]))}:{}) };
    } catch { return fallback; }
}

function currentNavigationRoute() {
    const view = window.ChiniModernNavigation?.section() || window.ChiniWorkspace?.routeSection() || activeViewName();
    const card = document.getElementById('cardModal').classList.contains('show') ? lastDetailCard : null;
    return { view, game: currentGame, lang: currentLang,...(['album','mysets','collection'].includes(view)&&collectionMode==='personal'?{albumId:window.ChiniPersonalAlbums?.current(),albumPage:window.ChiniPersonalAlbums?.page()}:{}),...(['album','mysets','collection'].includes(view)&&collectionMode==='album'&&albumSetSlug?{albumSet:albumSetSlug,albumPage:albumSpreadIndex}:{}),
        set: card?.setSlug || (view === 'set-cards' ? currentSet?.slug || '' : ''),
        card: card?.id || '',searchFilters:view==='search'?globalThis.ChiniSearch?.filters():undefined,workspaceFilters:['inventory','missing','shared'].includes(view)?Object.fromEntries(new URLSearchParams(location.hash.split('?')[1]||'')):undefined,searchMode:view==='search'?document.getElementById('searchMode').value:'',sort:view==='search'?document.getElementById('searchSort').value:'', q: view === 'search' ? document.getElementById('globalSearch').value.trim() : '' };
}

function navigationSnapshot() {
    return {
        inputs: Object.fromEntries(navigationInputIds.map(id => [id, document.getElementById(id)?.value || ''])),
        series: [...selectedSetSeries], rarities: [...selectedCardRarities], page: setCardsPage,
        collectionMode, albumSet: albumSetSlug, albumSpread: albumSpreadIndex,
        dexLanguage: pokedexAlbumLanguage, dexAlbum: pokedexAlbumNumber, dexSpread: pokedexSpreadIndex,
        scrollY: window.scrollY
    };
}

function saveNavigationSnapshot() {
    if (!navigationReady || navigationRestoring || history.state?.chiniNavigation !== 1) return;
    const route = currentNavigationRoute();
    // Typing changes a search URL in place, rather than adding an entry per keystroke.
    if (route.view !== history.state.route.view || route.game !== history.state.route.game || route.lang !== history.state.route.lang) return;
    history.replaceState({ ...history.state, route, snapshot: navigationSnapshot() }, '', navigationHash(route));
}

function prepareNavigation() {
    saveNavigationSnapshot();
    clearTimeout(navigationSaveTimer);
    navigationEpoch++;
    setRequest++;
    detailRequest++;
    navigationRestoring = false;
}

function commitNavigation() {
    if (!navigationReady) return;
    const route = currentNavigationRoute();
    const previous = history.state;
    const same = previous?.chiniNavigation === 1 && navigationHash(previous.route) === navigationHash(route);
    const state = { chiniNavigation: 1, route, snapshot: navigationSnapshot(), depth: (previous?.depth || 0) + (same ? 0 : 1) };
    history[same ? 'replaceState' : 'pushState'](state, '', navigationHash(route));
    document.title = `${route.card ? lastDetailCard.name : (route.albumId?window.ChiniWorkspace?.cache.albums.find(album=>album.id===route.albumId)?.name:null)||shellViewLabel(route.view)} · ${GAME_CONFIGS[route.game].label} — ChiniDex`;
}

async function restoreNavigation(entry) {
    searchController?.abort();
    const epoch = ++navigationEpoch;
    navigationRestoring = true;
    clearTimeout(navigationSaveTimer);
    clearTimeout(searchTimeout);
    searchRequest++;
    setRequest++;
    setsRequest++;
    closeCardModal({ history: false });
    closePackOverlay();
    if (document.getElementById('scannerOverlay').classList.contains('show')) closeCardScanner({ history:false });
    closePokedexVariants();
    if (liveAlbumRunning || liveAlbumStarting) stopLiveAlbumRecognition();
    const route = entry.route;
    const snapshot = entry.snapshot || {};
    const isCurrent = () => epoch === navigationEpoch;
    try {
        const changedContext = currentGame !== route.game || currentLang !== route.lang;
        if (changedContext) {
            currentGame = route.game;
            currentLang = route.lang;
            localStorage.setItem('chiniLang', currentLang);
            resetTcgState();
            collection = {};
            pricingCache = {};
            setCardsCache = {};
            updateGameUI();
        }
        if (route.view === 'game') {
            await showView('game', { history: false });
        } else {
            // Show the destination immediately, while its data loads.
            const presentation=['dashboard','tools','settings','album','mysets','history','inventory','wishlist','trades','notifications','missing','shared'].includes(route.view);
            await showView(presentation?(['dashboard','album','mysets'].includes(route.view)?'collection':'sets'):(route.view==='set-cards'?'sets':route.view),{history:false});
            if(presentation){if(window.ChiniModernNavigation)window.ChiniModernNavigation.restore(route.view);else if(['history','inventory','wishlist','trades','notifications','missing','shared'].includes(route.view))await ChiniWorkspace.restore(route.view);}
            if (!isCurrent()) return;
            if (!allSets.length) await loadSets();
            if (!isCurrent()) return;
            if (route.view === 'set-cards') await openSet(route.set, { history: false });
            if (!isCurrent()) return;
            for (const [id, value] of Object.entries(snapshot.inputs || {})) {
                if (navigationInputIds.includes(id)) document.getElementById(id).value = value;
            }
            selectedSetSeries = new Set(snapshot.series || []);
            selectedCardRarities = new Set(snapshot.rarities || []);
            if (route.view === 'sets') filterSets();
            if (route.view === 'set-cards') {
                setCardsPage = snapshot.page || 1;
                filterSetCards();
            }
            if (route.view === 'search') {
                document.getElementById('globalSearch').value = route.q || '';
                document.getElementById('searchMode').value=route.searchMode||'all';
                document.getElementById('searchSort').value=route.sort||'relevance';
                globalThis.ChiniSearch?.restore(route.searchFilters||{});
                await globalCardSearch({ immediate: true,page:Number(route.searchFilters?.page)||1 });
            }
            if (!isCurrent()) return;
            if (route.view === 'collection' && activeViewName() === 'collection') {
                collectionMode = snapshot.collectionMode || 'list';
                renderCollection();
                if (collectionMode === 'album' && snapshot.albumSet) {
                    await openCollectionAlbumSet(snapshot.albumSet);
                    if (!isCurrent()) return;
                    albumSpreadIndex = snapshot.albumSpread || 0;
                    renderAlbumBook();
                }
            }
            if(route.albumId)await window.ChiniPersonalAlbums?.open(route.albumId,route.albumPage||0);
            else if(route.albumSet){await openCollectionAlbumSet(route.albumSet);albumSpreadIndex=route.albumPage||0;renderAlbumBook();}
            if (route.view === 'catch-em-all') {
                pokedexAlbumLanguage = normalizePokedexLanguage(snapshot.dexLanguage || pokedexAlbumLanguage);
                pokedexAlbumNumber = snapshot.dexAlbum || 1;
                pokedexSpreadIndex = snapshot.dexSpread || 0;
                renderPokedexBook();
            }
            if (route.card) {
                if (![...currentSetCards, ...searchResults, ...albumSetCards].some(c => c.id === route.card) && !collection[route.card] && route.set) {
                    const root = currentDataRoot();
                    const detail = await apiFetch(`/${root}/sets/${encodeURIComponent(route.set)}/set.json`);
                    if (!isCurrent()) return;
                    const raw = (detail.cards || []).find(c => c.id === route.card);
                    if (raw) searchResults.push(normalizeLocalCard(raw, route.set, root));
                }
                await openModal(route.card, { history: false });
            }
            if (!isCurrent()) return;
            syncShellUI(document.getElementById('cardModal').classList.contains('show') ? 'detail' : activeViewName(), lastDetailCard);
        }
        if (!isCurrent()) return;
        if(entry.scanner) await openCardScanner(entry.scannerDestination || 'collection',{history:false});
        window.scrollTo({ top: snapshot.scrollY || 0, behavior: 'instant' });
        document.title = `${route.card && lastDetailCard ? lastDetailCard.name : shellViewLabel(route.view)} · ${GAME_CONFIGS[currentGame].label} — ChiniDex`;
    } catch (error) {
        console.warn('No se pudo restaurar la página:', error.message);
    } finally {
        if (isCurrent()) navigationRestoring = false;
    }
}

function initializeNavigation() {
    history.scrollRestoration = 'manual';
    const route = parseNavigationHash(location.hash);
    const saved = history.state;
    if (saved?.chiniNavigation === 1 && navigationHash(saved.route) === navigationHash(route)) {
        navigationReady = true;
        restoreNavigation(saved);
        return;
    }
    // A shared set/card link also gets sensible parent pages for Back.
    const parents = [{ view: 'game', game: route.game, lang: route.lang }];
    if (route.view !== 'game') parents.push({ ...route, view: route.view === 'set-cards' ? 'sets' : route.view, set: '', card: '' });
    if (route.view === 'set-cards') parents.push({ ...route, card: '' });
    if (route.card) parents.push(route);
    let previousHash = '';
    let depth = -1;
    for (const parent of parents) {
        const hash = navigationHash(parent);
        if (hash === previousHash) continue;
        depth++;
        history[depth === 0 ? 'replaceState' : 'pushState']({ chiniNavigation: 1, route: parent, depth, snapshot: {} }, '', hash);
        previousHash = hash;
    }
    navigationReady = true;
    restoreNavigation(history.state);
}

window.addEventListener('popstate', event => {
    restoreNavigation(event.state?.chiniNavigation === 1 ? event.state : { route: parseNavigationHash(location.hash), snapshot: {} });
});
for (const event of ['scroll', 'input', 'change', 'click']) {
    window.addEventListener(event, () => {
        clearTimeout(navigationSaveTimer);
        navigationSaveTimer = setTimeout(saveNavigationSnapshot, 120);
    }, { passive: true });
}
window.addEventListener('pagehide', saveNavigationSnapshot);

document.addEventListener('DOMContentLoaded', async () => {
    document.body.classList.toggle('ui-table', uiDisplayMode === 'table');
    document.querySelectorAll('.inline-view-toggle button').forEach(button => button.classList.toggle('active', button.dataset.display === uiDisplayMode));
    updateGameUI();
    document.getElementById('langEN').classList.toggle('active', currentLang === 'en');
    document.getElementById('langJP').classList.toggle('active', currentLang === 'jp');
    document.getElementById('langCN').classList.toggle('active', currentLang === 'cn');
    initializeNavigation();
    await detectImageProxy();
    await loadCollectionForCurrentUser();
});

if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(error => {
            console.warn('No se pudo activar el modo aplicación:', error);
        });
    });
}
