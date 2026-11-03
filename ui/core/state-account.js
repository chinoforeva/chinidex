const cardsPerPage = 100;

const CACHE_V = 'v32';

// Clean up old cache versions (keep only current + non-versioned keys)
(function cleanOldCache() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('chini') && k.includes('_v') && !k.includes('_' + CACHE_V)) {
            keys.push(k);
        }
    }
    keys.forEach(k => localStorage.removeItem(k));
})();
const COLLECTION_USER_KEY = 'chiniCollectionUser';
const POKEDEX_COLLECTION_SERVER_PREFIX = '__pokedex__:';
const POKEDEX_ALBUM_LANGUAGE_KEY = 'chiniPokedexAlbumLanguage';
const POKEDEX_ALBUM_LANGUAGES = new Set(['en', 'jp']);
const GAME_CONFIGS = {
    pokemon: { label: 'Pokémon TCG', dataRoot: { en: 'scrydex-data', es: 'es-data', jp: 'jp-data', cn: 'cn-data' }, languages: ['en', 'es', 'jp', 'cn'] },
    onepiece: { label: 'One Piece TCG', dataRoot: { en: 'onepiece-data', jp: 'onepiece-jp-data' }, languages: ['en','jp'] },
    riftbound: { label: 'Riftbound', dataRoot: { en: 'riftbound-data' }, languages: ['en'] },
    magic: { label: 'Magic: The Gathering', dataRoot: { en: 'magic-data' }, languages: ['en'] }
};
const LOCAL_CATALOGUE_GAMES = new Set(Object.keys(GAME_CONFIGS));
const MERGED_SET_ALIASES = {
    swsh12pt5gg: 'swsh12pt5',
    swsh12tg: 'swsh12',
    swsh11tg: 'swsh11',
    swsh10tg: 'swsh10',
    swsh9tg: 'swsh9',
    cel25c: 'cel25',
    swsh45sv: 'swsh45',
    sma: 'sm115'
};
let currentGame = 'pokemon';
let currentLang = localStorage.getItem('chiniLang') || 'en';
if (currentLang === 'test') currentLang = 'en';
if (!GAME_CONFIGS.pokemon.languages.includes(currentLang)) currentLang = 'en';
let currentUser = localStorage.getItem(COLLECTION_USER_KEY) || '';
if (currentUser === 'default') currentUser = '';
let collectionUserGatePromise = null;
let collectionUserGateResolver = null;

let allSets = [];
let currentSet = null;
let currentSetCards = [];
let setCardsPage = 1;
let collectionMode = 'list';
let albumSetSlug = '';
let albumSetCards = [];
let albumSpreadIndex = 0;
let albumTurnLocked = false;
let albumTurnFallback = 0;
let albumLoadToken = 0;

const ALBUM_TURN_MS = 680;
let pokedexAlbumNumber = 1;
let pokedexSpreadIndex = 0;
let pokedexHighlightNumber = 0;
let pokedexAlbumLanguage = POKEDEX_ALBUM_LANGUAGES.has(localStorage.getItem(POKEDEX_ALBUM_LANGUAGE_KEY))
    ? localStorage.getItem(POKEDEX_ALBUM_LANGUAGE_KEY)
    : 'en';
let scannerDestination = 'collection';
let searchResults = [];
let searchResultsTotal = 0;
let collection = {};
let pokedexCollections = {
    en: {},
    jp: {}
};
let pricingCache = {};
let setCardsCache = {};
let searchTimeout = null;
let searchRequest = 0;
let searchController = null;
let setRequest = 0;
let setsRequest = 0;
let localCardsIndex = null;
let imageProxyAvailable = false;
let scannerStream = null;
let scannerEpoch = 0, scannerCaptureBusy = false, scannerRequestController = null;
let scannerAccepted = false;
let scannerSaving = false, scannerHoldUntil = 0, scannerRevealTimer = 0;
const scannerCamera = new CameraScanner({onStatus: text => setScannerStatus(text), onCapture: images => recognizeContinuousScanner(images), onDetection: quad => window.ChiniScannerView?.detection(quad)});
let scannerFacingMode = 'environment';
const scannerLocateSeen = new Set();
let scannerManualSelection = false;
let scannerMatches = [];
let scannerSelectedMatch = 0;
let scannerObjectUrl = '';
let scannerNeuralAvailable = false;
let scannerNeuralCardCount = 0;
let liveAlbumStream = null;
let liveAlbumRunning = false;
let liveAlbumStarting = false;
let liveAlbumFacingMode = 'environment';
let liveAlbumTimer = 0;
let liveAlbumAbortController = null;
let liveAlbumSession = 0;
let selectedSetSeries = new Set();
let selectedCardRarities = new Set();
let uiDisplayMode = 'grid';
let lastDetailCard = null;
const scannerIndexCache = new Map();
const liveAlbumSeenTracker = ChiniPokedex.createPreviewTracker({ releaseAfterMs: 1100 });
const scannerPopcount = new Uint8Array(256);
for (let i = 1; i < 256; i++) scannerPopcount[i] = scannerPopcount[i >> 1] + (i & 1);
const LOCAL_IMAGE_OVERRIDES = {
    'm2a_ja-75-holofoil': '/jp-data/images/m2a_ja/75_holofoil.png',
    'm2a_ja-146-normal': '/jp-data/images/m2a_ja/146_normal.png',
    'm2a_ja-189-normal': '/jp-data/images/m2a_ja/189_normal.png',
    'm2a_ja-235-holofoil': '/jp-data/images/m2a_ja/235_holofoil.png',
    'sv7a_ja-62-normal': '/jp-data/images/sv7a_ja/62_normal.png'
};
const MISSING_LOCAL_IMAGES = new Set();

function collectionStorageKey(lang = currentLang, user = currentUser) {
    const suffix = currentGame === 'pokemon' ? user : `${currentGame}_${user}`;
    return 'chiniCollection_' + CACHE_V + '_' + suffix;
}

function normalizePokedexLanguage(lang = pokedexAlbumLanguage) {
    return lang === 'jp' ? 'jp' : 'en';
}

function pokedexLanguageLabel(lang = pokedexAlbumLanguage) {
    return normalizePokedexLanguage(lang) === 'jp' ? 'Japonés' : 'Inglés';
}

function pokedexCollectionStorageKey(lang = pokedexAlbumLanguage, user = currentUser) {
    return 'chiniPokedexCollection_' + CACHE_V + '_' + normalizePokedexLanguage(lang) + '_' + user;
}

function legacyCollectionStorageKey(lang = currentLang) {
    return 'chiniCollection_' + CACHE_V + '_' + lang;
}

function pricingStorageKey(user = currentUser) {
    const suffix = currentGame === 'pokemon' ? user : `${currentGame}_${user}`;
    return 'chiniPricing_' + suffix;
}

function currentContextKey() {
    return `${currentGame}_${currentLang}`;
}

function currentDataRoot() {
    return GAME_CONFIGS[currentGame]?.dataRoot?.[currentLang] || GAME_CONFIGS.pokemon.dataRoot.en;
}

function normalizeSetSlug(slug) {
    return MERGED_SET_ALIASES[slug] || slug;
}

function safeImageToken(value) {
    return String(value || '').replace(/[^A-Za-z0-9_-]/g, ch => '_' + ch.charCodeAt(0).toString(16));
}

function imageProxyUrl(url) {
    return window.ChiniApi?ChiniApi.asset(url):url && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/image-proxy)/i.test(url) ? url : '';
}

async function detectImageProxy() {
    imageProxyAvailable = false;
}

function readJsonStorage(key, fallback = {}) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (e) { return fallback; }
}

function readLocalCollection(lang = currentLang, user = currentUser) {
    return readJsonStorage(collectionStorageKey(lang, user), readJsonStorage(legacyCollectionStorageKey(lang), {}));
}

function readLocalPokedexCollection(lang = pokedexAlbumLanguage, user = currentUser) {
    return readJsonStorage(pokedexCollectionStorageKey(lang, user), {});
}

function migrateLegacyLocalPokedexCollection(user = currentUser) {
    if (!user) return;
    const markerKey = 'chiniPokedexLanguageMigration_' + CACHE_V + '_' + user;
    if (localStorage.getItem(markerKey)) return;
    const legacy = readJsonStorage('chiniPokedexCollection_' + CACHE_V + '_' + user, {});
    const next = {
        en: readLocalPokedexCollection('en', user),
        jp: readLocalPokedexCollection('jp', user)
    };
    for (const [id, card] of Object.entries(legacy)) {
        const language = String(card?.languageCode || card?.language || '').toLowerCase();
        if (/^(cn|zh)/.test(language) || /chinese|chino|china/.test(language)) continue;
        const albumLanguage = /^(jp|ja)$/.test(language) || /japan|japon|日本/.test(language) ? 'jp' : 'en';
        if (!next[albumLanguage][id]) next[albumLanguage][id] = card;
    }
    localStorage.setItem(pokedexCollectionStorageKey('en', user), JSON.stringify(next.en));
    localStorage.setItem(pokedexCollectionStorageKey('jp', user), JSON.stringify(next.jp));
    localStorage.setItem(markerKey, '1');
}

function readLocalPricing(user = currentUser) {
    return readJsonStorage(pricingStorageKey(user), currentGame === 'pokemon' ? readJsonStorage('chiniPricing', {}) : {});
}

function collectionApiUrl() {
    const serverUser = currentGame === 'pokemon' ? currentUser : `${currentGame}_${currentUser}`;
    return `/tcg-collection?user=${encodeURIComponent(serverUser)}`;
}

function pokedexCollectionApiUrl(lang = pokedexAlbumLanguage) {
    const albumUser = `${POKEDEX_COLLECTION_SERVER_PREFIX}${normalizePokedexLanguage(lang)}:${currentUser}`;
    return `/tcg-collection?user=${encodeURIComponent(albumUser)}`;
}

function pokedexCollectionForLanguage(lang = pokedexAlbumLanguage) {
    return pokedexCollections[normalizePokedexLanguage(lang)] || {};
}

function hasCards(obj) {
    return obj && typeof obj === 'object' && Object.keys(obj).length > 0;
}

async function loadCollectionFromServer() {
    const requestedContext = currentContextKey();
    const requestedUser = currentUser;
    const resp = await fetch(collectionApiUrl(), { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (requestedContext !== currentContextKey() || requestedUser !== currentUser) return;
    collection = data.collection || {};
    pricingCache = data.pricingCache || {};
    return data;
}

async function saveCollectionToServer() {
    const resp = await fetch(collectionApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, pricingCache }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
}

async function loadPokedexCollectionFromServer(lang = pokedexAlbumLanguage, options = {}) {
    const requestedUser = currentUser;
    const albumLanguage = normalizePokedexLanguage(lang);
    pokedexCollections[albumLanguage] = {};
    const resp = await fetch(pokedexCollectionApiUrl(albumLanguage), { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (requestedUser !== currentUser) return;
    pokedexCollections[albumLanguage] = data.collection || {};
    return data;
}

async function savePokedexCollectionToServer(lang = pokedexAlbumLanguage) {
    const albumLanguage = normalizePokedexLanguage(lang);
    const resp = await fetch(pokedexCollectionApiUrl(albumLanguage), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: pokedexCollectionForLanguage(albumLanguage), pricingCache: {} }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
}

function savePokedexCollection(lang = pokedexAlbumLanguage) {
    const albumLanguage = normalizePokedexLanguage(lang);
    if (!currentUser) return Promise.resolve({ ok: false, error: 'Falta el nombre de usuario' });
    return savePokedexCollectionToServer(albumLanguage).catch(error => {
        console.warn('Could not save Pokédex collection on server:', error.message);
        return { ok: false, error: error.message };
    });
}

async function loadCollectionForCurrentUser() {
const presentationArguments=Array.from(arguments);
try{

    currentUser = (currentUser || '').trim();
    if (!currentUser) return;
    const session=await fetch('/tcg-auth/session',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}));
    if(session.user!==currentUser){collection={};pokedexCollections={en:{},jp:{}};pricingCache={};return;}
    window.chiniCsrf=session.csrf;window.chiniAuthenticatedUser=session.user;
    localStorage.setItem(COLLECTION_USER_KEY, currentUser);
    const userInput = document.getElementById('collectionUser');
    if (userInput) userInput.value = currentUser;

    collection = {};

    pokedexCollections = {
        en: {},
        jp: {}
    };
    pricingCache = {};

    try {
        await loadCollectionFromServer();
    } catch (e) {
        console.warn('Using browser collection backup:', e.message);
    }
    for (const albumLanguage of POKEDEX_ALBUM_LANGUAGES) {
        try {
            await loadPokedexCollectionFromServer(albumLanguage);
        } catch (e) {
            console.warn(`Using browser ${pokedexLanguageLabel(albumLanguage)} Pokédex backup:`, e.message);
        }
    }

}finally{globalThis.ChiniEvents?.emit('loadCollectionForCurrentUser',presentationArguments);}
}

async function changeCollectionUser() {
    const value = (document.getElementById('collectionUser')?.value || '').trim();
    if (!value) { alert('Escribe un nombre para cargar su colección.'); return; }
    if(!await ensureCollectionUser({force:true}))return;
    if(currentUser!==value)return;
    await loadCollectionForCurrentUser();
    refreshCurrentView();
}

async function ensureCollectionUser({force=false}={}) {
    const session=await fetch('/tcg-auth/session',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}));
    if(!force && currentUser && session.user===currentUser){window.chiniCsrf=session.csrf;window.chiniAuthenticatedUser=session.user;return true;}
    if (collectionUserGatePromise) return collectionUserGatePromise;
    const overlay = document.getElementById('userGateOverlay');
    const input = document.getElementById('userGateInput');
    document.getElementById('userGateError').textContent = '';
    input.value = document.getElementById('collectionUser')?.value?.trim() || '';
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    collectionUserGatePromise = new Promise(resolve => { collectionUserGateResolver = resolve; });
    requestAnimationFrame(() => input.focus());
    return collectionUserGatePromise;
}

function finishCollectionUserGate(accepted) {
    const overlay = document.getElementById('userGateOverlay');
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    const resolve = collectionUserGateResolver;
    collectionUserGateResolver = null;
    collectionUserGatePromise = null;
    if (resolve) resolve(!!accepted);
}

async function confirmCollectionUserGate() {
    const input = document.getElementById('userGateInput');
    const name = (input.value || '').trim();
    if (!name) {
        document.getElementById('userGateError').textContent = 'Escribe un nombre para continuar.';
        input.focus();
        return;
    }
    try {
        const response = await fetch('/tcg-auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:name,password:document.getElementById('userGatePassword').value})});
        const auth = await response.json();
        if(!response.ok)throw Error(auth.error || 'No se pudo iniciar sesión');
        window.chiniCsrf = auth.csrf;window.chiniAuthenticatedUser=auth.user;
        document.getElementById('userGatePassword').value='';
    } catch(error) {document.getElementById('userGateError').textContent=error.message;return;}
    currentUser = name;
    await loadCollectionForCurrentUser();
    finishCollectionUserGate(true);
}

function resetTcgState() {
    searchController?.abort();
    clearTimeout(searchTimeout);
    searchRequest++;
    setRequest++;
    setsRequest++;
    allSets = [];
    currentSet = null;
    currentSetCards = [];
    albumSetSlug = '';
    albumSetCards = [];
    albumSpreadIndex = 0;
    albumTurnLocked = false;
    albumLoadToken++;
    clearTimeout(albumTurnFallback);
    selectedSetSeries.clear();
    selectedCardRarities.clear();
    searchResults = [];
    searchResultsTotal = 0;
    localCardsIndex = null;
    setCardsPage = 1;
    document.getElementById('setSearch').value = '';
    document.getElementById('globalSearch').value = '';
    document.getElementById('setCardSearch').value = '';
    document.getElementById('setsContent').innerHTML = '';
    document.getElementById('searchContent').innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Escribe el nombre de una carta para buscar</p>';
}

function updateGameUI() {
    const isPokemon = currentGame === 'pokemon';
    document.querySelector('.lang-switch').style.display = GAME_CONFIGS[currentGame].languages.length > 1 ? '' : 'none';
    document.getElementById('langCN').hidden = !GAME_CONFIGS[currentGame].languages.includes('cn');
    document.getElementById('sidebarScannerLink').hidden = currentGame === 'magic';
    document.getElementById('sidebarToolsLabel').hidden = currentGame === 'magic';
    const scannerButton = document.getElementById('scanCollectionButton');
    if (scannerButton) scannerButton.style.display = currentGame === 'magic' ? 'none' : '';
    document.getElementById('setsTitle').textContent = `Todos los sets de ${GAME_CONFIGS[currentGame].label}`;
    const catalogueKicker = document.getElementById('catalogueKicker');
    if (catalogueKicker) catalogueKicker.textContent = GAME_CONFIGS[currentGame].label.toUpperCase();
    const intro = document.getElementById('catalogueIntroText');
    if (intro) intro.textContent = `Explora cada expansión de ${GAME_CONFIGS[currentGame].label}, consulta sus cartas y archiva las que forman parte de tu colección.`;
    const gameChip = document.getElementById('shellGameChip');
    if (gameChip) gameChip.textContent = GAME_CONFIGS[currentGame].label.replace(' TCG', '');
    const source = document.getElementById('catalogueSource');
    const isChinesePokemon = currentGame === 'pokemon' && currentLang === 'cn';
    source.hidden = currentGame !== 'magic' && !isChinesePokemon;
    source.innerHTML = currentGame === 'magic'
        ? 'Catálogo, precios e imágenes descargados de <a href="https://scrydex.com/magicthegathering/expansions" target="_blank" rel="noopener">Scrydex</a>.'
        : isChinesePokemon
            ? 'Catálogo chino, rarezas, acabados, precios e imágenes descargados de <a href="https://app.getcollectr.com/sets/category/3?language=chinese" target="_blank" rel="noopener">Collectr</a>.'
            : '';
    document.getElementById('langEN').classList.toggle('active', currentLang === 'en');
    document.getElementById('langJP').classList.toggle('active', currentLang === 'jp');
    document.getElementById('langCN').classList.toggle('active', currentLang === 'cn');
    renderShellSidebar();
}

async function switchGame(game) {
const presentationArguments=Array.from(arguments);
try{

    if (!GAME_CONFIGS[game]) return;
    prepareNavigation();
    if (liveAlbumRunning || liveAlbumStarting) stopLiveAlbumRecognition();
    currentGame = game;
    if (!GAME_CONFIGS[game].languages.includes(currentLang)) currentLang = 'en';
    localStorage.setItem('chiniLang', currentLang);
    updateGameUI();
    collection = {};
    pricingCache = {};
    setCardsCache = {};
    resetTcgState();
    showView('sets', { prepared: true });
    loadSets();
    const context = currentContextKey();
    await loadCollectionForCurrentUser();
    if (context === currentContextKey()) refreshCurrentView();

}finally{globalThis.ChiniEvents?.emit('switchGame',presentationArguments);}
}

function showGameSelector() {
    return showView('game');
}

async function switchLang(lang) {
const presentationArguments=Array.from(arguments);
try{

    if (!GAME_CONFIGS[currentGame]?.languages.includes(lang)) return;
    if (lang === currentLang) return;
    prepareNavigation();
    currentLang = lang;
    localStorage.setItem('chiniLang', lang);
    updateGameUI();
    setCardsCache = {};
    resetTcgState();
    showView('sets', { prepared: true });
    loadSets();
    const context = currentContextKey();
    await loadCollectionForCurrentUser();
    if (context === currentContextKey()) refreshCurrentView();

}finally{globalThis.ChiniEvents?.emit('switchLang',presentationArguments);}
}

function trimSetCardsCache() {
    // Only expendable catalogue data, never the user's collection.
    const keys = Object.keys(setCardsCache);
    while (keys.length > 8) delete setCardsCache[keys.shift()];
    while (keys.length > 1 && keys.reduce((total, key) => total + setCardsCache[key].length, 0) > 6000) delete setCardsCache[keys.shift()];
    localStorage.removeItem('chiniSetCardsCache_' + CACHE_V + '_' + currentContextKey());
}

async function apiFetch(url, options = {}) {
    if (!/^\/(?:TCG\/)?(?:scrydex|es|jp|cn|onepiece(?:-jp)?|riftbound|magic|tcgx)-data\/(?:sets\.json|sets\/[^/]+\/set\.json)$/i.test(url))
        throw new Error('Los catálogos solo se consultan desde los archivos del NAS.');
    if (window.ChiniCatalogue?.isSet(url)) return ChiniCatalogue.get(url);
    const r = await fetch(url, options);
    if (r.status === 429) throw new Error('Limite de peticiones superado. Intentalo de nuevo mas tarde.');
    if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        const msg = err.error || err.message || `HTTP ${r.status}`;
        throw new Error(`${msg} (${url})`);
    }
    return r.json();
}

function normalizeLocalCard(c, setId, dataRoot = 'jp-data') {
    const cdnImage = '';
    let localImage = LOCAL_IMAGE_OVERRIDES[c.id] || c.localImage || '';
    const hasMissingLocalImage = MISSING_LOCAL_IMAGES.has(c.id) || c.imageUnavailable === true;
    if (hasMissingLocalImage) localImage = '';
    if (localImage && dataRoot === 'TCG/scrydex-data') {
        localImage = localImage.replace(/^\/scrydex-data\//, '/TCG/scrydex-data/');
    }
    if (localImage && dataRoot === 'TCG/onepiece-data') {
        localImage = localImage.replace(/^\/onepiece-data\//, '/TCG/onepiece-data/');
    }
    if (localImage && dataRoot === 'TCG/riftbound-data') {
        localImage = localImage.replace(/^\/riftbound-data\//, '/TCG/riftbound-data/');
    }
    if (localImage && dataRoot === 'TCG/magic-data') {
        localImage = localImage.replace(/^\/magic-data\//, '/TCG/magic-data/');
    }
    if (localImage && dataRoot === 'TCG/cn-data') {
        localImage = localImage.replace(/^\/cn-data\//, '/TCG/cn-data/');
    }
    const variant = c.variant || 'normal';
    const imageSet = setId || c.setId || '';
    const generatedImage = imageSet && c.number && !/(?:cn|es)-data$/.test(dataRoot) && !hasMissingLocalImage
        ? `/${dataRoot}/images/${encodeURIComponent(imageSet)}/${safeImageToken(c.number)}_${safeImageToken(variant)}.png` : '';
    if (!localImage && !hasMissingLocalImage) localImage = generatedImage || cdnImage;
    return {
        id: c.id || (setId && c.number ? `${setId}-${c.number}-${c.variant || 'normal'}` : ''),
        englishId: c.englishId || null, englishSetId: c.englishSetId || null, nameEnglish: c.nameEnglish || '', nameJapanese: c.nameJapanese || '', pokedexNumber: c.pokedexNumber || null, pokemonNameEnglish: c.pokemonNameEnglish || '', translationKey: c.translationKey || null,
        name: c.name || 'Unknown', baseName: c.baseName || '', number: c.number || '',
        rarityId:c.rarityId||ChiniFields.rarity(c.rarity,currentGame).id,rarityOriginal:c.rarityOriginal??c.rarity,variantId:c.variantId||ChiniFields.variant(c.variant).id,variantOriginal:c.variantOriginal??c.variant,
        searchMatch:c.searchMatch||null, artist:c.artist||c.illustrator||'',
        rarity: c.rarity || '', variant: c.variant || '',
        sourcePrintingId: c.sourcePrintingId || null,
        priceAuthority:c.priceAuthority,originalPrice:c.originalPrice,originalCurrency:c.originalCurrency,priceSource:c.priceSource,priceUpdatedAt:c.priceUpdatedAt,
        price: c.price != null ? c.price : null,
        prices: c.prices || null,
        pageUrl: c.pageUrl || null,
        productId: c.productId || null,
        category: c.category || GAME_CONFIGS[currentGame]?.label || '',
        language: c.language || '',
        languageCode: c.languageCode || currentLang,
        currency: c.currency || null,
        source: c.source || null,
        sourceUrl: c.sourceUrl || null,
        image: localImage || cdnImage,
        cdnImage: cdnImage,
        generatedImage,
        setSlug: setId || c.setId || '',
        setName: c.setName || '',
        tcgplayer: null,
        pricing: null,
        variants: null
    };
}

function fmt(n) {
    if (n == null || isNaN(n)) return null;
    return '$' + parseFloat(n).toFixed(2);
}

function getBestPrice(card) {
    if (card?.tcgplayer?.prices) {
        const p = card.tcgplayer.prices;
        return p.holofoil?.market ?? p.normal?.market ?? p.reverseHolofoil?.market ?? null;
    }
    if (card?.pricing?.cardmarket) {
        const p = card.pricing.cardmarket;
        return p.avg ?? p.trend ?? p.low ?? null;
    }
    if (card?.pricing?.tcgplayer) {
        const p = card.pricing.tcgplayer;
        return p.marketPrice ?? p.midPrice ?? p.lowPrice ?? null;
    }
    return null;
}

function fmtEUR(n) {
    if (n == null || !Number.isFinite(Number(n))) return null;
    return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(n));
}
function localPriceValue(price) {
    if (!price) return 'N/A';
    let value = price.market ?? price.mid ?? price.low ?? price.high;
    if (value == null || isNaN(value)) return 'N/A';
    return ChiniPrices.format({value:Number(value),currency:price.currency||null});
}

function localPriceNumber(price) {
    if (!price) return null;
    let value = price.market ?? price.mid ?? price.low ?? price.high;
    if (value == null || isNaN(value)) return null;
    return Number(value);
}
function buildLocalPricesHTML(card) {
 const quote=ChiniPrices.quote(card),rows=[];
 rows.push('<div class="price-row"><span class="price-label">Precio guardado'+(card.prices?.estimated?' · Estimado':'')+'</span><span class="price-value">'+escapeHtml(ChiniPrices.format(quote))+'</span></div>');
 for(const [field,label] of [['psa9','PSA 9'],['psa10','PSA 10']]){const p=card.prices?.[field];if(p&&p.market!=null)rows.push('<div class="price-row"><span>'+label+'</span><span>'+escapeHtml(ChiniPrices.format({value:p.market,currency:p.currency}))+'</span></div>');}
 rows.push('<p class="price-provenance">'+escapeHtml(quote.source||'Fuente no disponible')+' · '+escapeHtml(quote.updatedAt||'Fecha no disponible')+'</p>');
 return '<div class="card-modal-prices">'+rows.join('')+'</div>';
}
function displayRarityLabel(rarity) {
    if(globalThis.ChiniFields)return ChiniFields.rarity(rarity,currentGame).label;
    if (!rarity || ['none','—','null'].includes(String(rarity).toLowerCase())) return '';
    if(String(rarity).toLowerCase()==='promo')return 'Promocional';
    if(rarity==='★H')return 'Rara holo';
    const map = {
        'Common': 'Común',
        'Uncommon': 'Poco común',
        'Rare': 'Rara',
        'Rare Holo': 'Rara holo',
        'Rare Holo EX': 'Rara holo EX',
        'Rare Holo GX': 'Rara holo GX',
        'Rare Holo LV.X': 'Rara holo LV.X',
        'Rare Holo Star': 'Rara holo estrella',
        'Rare Prime': 'Rara Prime',
        'Rare Prism Star': 'Rara Prisma Estrella',
        'Rare Rainbow': 'Rara arcoiris',
        'Rare Secret': 'Rara secreta',
        'Rare Shining': 'Rara shiny',
        'Rare Shiny': 'Rara shiny',
        'Rare Shiny GX': 'Rara shiny GX',
        'Radiant Rare': 'Rara radiante',
        'Amazing Rare': 'Rara asombrosa',
        'Classic Collection': 'Colección clásica',
        'Double Rare': 'Doble rara',
        'Ultra Rare': 'Ultra rara',
        'Illustration Rare': 'Rara de ilustración',
        'Special Illustration Rare': 'Rara de ilustración especial',
        'Hyper Rare': 'Hiper rara',
        'Secret Rare': 'Rara secreta',
        'Promo': 'Promo',
        'C': 'Común',
        'U': 'Poco común',
        'UC': 'Poco común',
        'R': 'Rara',
        'RR': 'Doble rara',
        'RRR': 'Triple rara',
        'AR': 'Rara de arte',
        'SR': 'Super rara',
        'SAR': 'Rara de arte especial',
        'UR': 'Ultra rara',
        'HR': 'Hiper rara',
        'ACE': 'ACE SPEC',
        'CHR': 'Rara de personaje',
        'CSR': 'Super rara de personaje',
        'SSR': 'Super rara shiny',
        'SEC': 'Secreta',
        'L': 'Líder',
        'SP': 'Especial',
        'TR': 'Treasure rare',
        'P': 'Promo'
        , 'Mythic': 'Mítica'
        , 'Special': 'Especial'
        , 'Bonus': 'Bonus'
        , 'Art Rare': 'Rara de arte'
        , 'Secret Art Rare': 'Rara de arte secreta'
        , 'Special Art Rare': 'Rara de arte especial'
        , 'Shiny Rare': 'Rara shiny'
        , 'Shiny Secret Rare': 'Rara shiny secreta'
    };
    return map[rarity] || rarity
        .replace(/Special Illustration Rare/g, 'Rara de ilustración especial')
        .replace(/Illustration Rare/g, 'Rara de ilustración')
        .replace(/Hyper Rare/g, 'Hiper rara')
        .replace(/Ultra Rare/g, 'Ultra rara')
        .replace(/Double Rare/g, 'Doble rara')
        .replace(/Secret Rare/g, 'Rara secreta')
        .replace(/Rare/g, 'Rara')
        .replace(/Uncommon/g, 'Poco común')
        .replace(/Common/g, 'Común');
}

function buildModalPricesHTML(card) {return buildLocalPricesHTML(card);}

function normalizeCardNumber(n) {
    if (!n) return 0;
    const match = String(n).match(/(\d+)(?!.*\d)/);
    return match ? parseInt(match[1], 10) : 0;
}

function formatReleaseDate(value) {
    const match = String(value || '').match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (!match) return String(value || '');
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}
