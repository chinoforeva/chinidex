/* Presentation adapter for the existing ChiniDex application.
 * The original functions remain the only owners of requests, collection writes,
 * routing, camera lifecycle and album navigation. Classic never runs this file.
 */
(() => {
    if (document.documentElement.dataset.ui !== 'modern') return;
    const $ = id => document.getElementById(id);
    const esc = value => escapeHtml(String(value ?? ''));
    const rarityBadge = card => {
        const raw = String(card.rarity || '').trim();
        if (!raw || raw === '—' || raw === 'None') return '';
        const game = card.game || currentGame;
        const lang = card.lang || currentLang;
        const tier = ChiniRarity.classify(raw, game, lang);
        const label = game === 'pokemon' && raw === 'TR' ? 'Entrenador raro' : displayRarityLabel(raw);
        return `<span class="rarity-chip" data-rarity-tier="${tier}" title="${esc(label)} · ${esc(raw)}">${esc(label)}</span>`;
    };
    const paths = {
        home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
        book:'M12 5C8 2 3 4 3 4v16s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v16',
        search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
        user:'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
        cards:'m8 3 10 1 2 16-10 1Z M5 5l-3 2 3 14 3-1',
        layers:'m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5',
        scan:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M6 12h12',
        settings:'m10 3-1 3-3 1-3 3v4l3 3 3 1 1 3h4l1-3 3-1 3-3v-4l-3-3-3-1-1-3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
        tool:'M14 3a6 6 0 0 0-6 8L2 17l5 5 6-7a6 6 0 0 0 8-6l-4 3-4-4Z',
        android:'M5 9h14v11H5Zm2-5-2-2m12 2 2-2M5 8a7 7 0 0 1 14 0M2 10v7m20-7v7M8 20v3m8-3v3M8 6h.01M16 6h.01',
        grid:'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
        table:'M3 4h18v16H3Zm0 5h18M3 14h18M9 4v16',
        tag:'M3 3h9l9 9-9 9-9-9ZM7 7h.01',
        star:'m12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z',
        bell:'M18 8a6 6 0 0 0-12 0v6l-3 3h18l-3-3ZM10 21h4',
        arrow:'M4 12h16m-6-6 6 6-6 6',
        menu:'M3 6h18M3 12h18M3 18h18',
        filter:'M3 4h18l-7 8v8l-4-2v-6Z',
        calendar:'M4 5h16v16H4ZM8 2v6m8-6v6M4 11h16',
        trophy:'M7 3h10v8a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 16v5m-4 0h8'
    };
    const icon = name => `<svg class="m-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.cards}"/></svg>`;
    const action = (name, text, glyph, cls = 'm-secondary', value = '') => `<button type="button" class="${cls}" data-m-action="${name}" data-m-value="${esc(value)}">${glyph ? icon(glyph) : ''}${text}</button>`;
    const fmtNumber = n => Number(n || 0).toLocaleString('es-ES');
    const stat = (label,value,glyph,note='',small=false) => `<div class="m-stat"><span class="m-stat-icon">${icon(glyph)}</span><div><small>${esc(label)}</small><strong${small?' class="m-small-value"':''}>${esc(value)}</strong><p>${esc(note)}</p></div></div>`;
    const progress = percent => `<div class="m-progress"><span style="width:${Math.min(100,Math.max(0,percent || 0))}%"></span></div>`;
    const ring = (owned,total) => { const percent = total ? Math.round(owned/total*1000)/10 : 0; return `<div class="m-ring" style="--progress:${Math.min(100,percent)}"><div><strong>${percent===0&&owned>0?'&lt;0,1':percent}%</strong>Completado</div></div>`; };
    const quick = (target,title,copy,glyph) => action(target,`<span><strong>${title}</strong><small>${copy}</small></span>`,glyph,'m-quick');
    const viewToggle = () => ChiniColumns.control();
    let section = '', catalogueManifest = {}, setCovers = {}, lastSearch = [], filterResetKey = '';
    let setState = '', setYear = '', setOrder = 'recent';
    let collectionSet = '', collectionRarity = '';
    const cardFilters = {setSlug:'',rarity:'',types:'',subtypes:'',artist:''};
    const titles = {
        users:['Comunidad','Usuarios','Descubre las cartas que colecciona cada persona.'],
        game:['Inicio','Explora el universo TCG','Elige tu juego, descubre cartas, completa tu colección.'],
        sets:['Catálogo','Sets','Explora todas las expansiones y completa tu colección.'],
        search:['Catálogo','Buscar cartas','Encuentra la carta que buscas en todo el catálogo de CHINIDEX.'],
        collection:['Mi Espacio','Mi colección','Todas las cartas que forman parte de tu historia.'],
        'catch-em-all':['Mi Espacio','Álbum','Cada Pokémon tiene su lugar. Completa tu Pokédex Nacional.'],
        dashboard:['Mi Espacio','Inicio','Resumen de tu colección y progreso en CHINIDEX.'],
        album:['Mi Espacio','Álbum','Explora tu colección, pasa página y completa los huecos.'],
        mysets:['Mi Espacio','Mis álbumes','Tus álbumes por set y personalizados.'],
        tools:['Mi Espacio','Herramientas','Reconoce tus cartas y encuentra su lugar en tu colección.'],
        settings:['CHINIDEX','Ajustes','Tu usuario, tus catálogos y tu forma de coleccionar.']
    };
    Object.assign(titles,{history:['Mi Espacio','Historial','Cambios de colección, ejemplares y álbumes; deshacer con comprobación de integridad.'],inventory:['Mi Espacio','Gestión de colección','Ejemplares físicos, operaciones por lotes e importación.'],wishlist:['Mi Espacio','Lista de deseos','Impresiones, idiomas y variantes que quieres conseguir.'],trades:['Mi Espacio','Intercambios','Consentimiento y propuestas revisables.'],notifications:['Mi Espacio','Notificaciones','Eventos reales dentro de la aplicación.'],missing:['Mi Espacio','Faltantes','Completa expansiones por idioma y variante.'],shared:['Comunidad','Vista compartida','Álbum o faltantes de solo lectura.']});
    function notify(text) {
        document.querySelector('.m-notice')?.remove();
        const el = document.createElement('div'); el.className='m-notice'; el.role='status'; el.textContent=text;
        document.body.append(el); setTimeout(()=>el.remove(),5000);
    }
    function ownedForSet(set) { return Object.values(collection).filter(c=>normalizeSetSlug(c.setSlug)===set.slug&&(!c.languageCode||c.languageCode===currentLang)).length; }
    function totals() {
        const cards=Object.values(collection).filter(c=>!c.languageCode||c.languageCode===currentLang), sets=new Set(cards.map(c=>normalizeSetSlug(c.setSlug)));
        return {cards,unique:cards.length,total:cards.reduce((s,c)=>s+(c.quantity||1),0),sets:sets.size,
            catalogue:allSets.reduce((s,c)=>s+(c.cardCount||0),0)};
    }
    function recentCards(cards, count=4) { return [...cards].sort((a,b)=>String(b.dateAdded||'').localeCompare(String(a.dateAdded||''))).slice(0,count); }
    function recentHTML(cards,rows=false) {
        if(!cards.length) return '<div class="m-empty">Tu historia empieza con una carta.<br>Añade tu primera carta a la colección.</div>';
        return cards.map(c=> {
            const img=ChiniCatalogue.thumbnail(repairCardImage(c)), set=allSets.find(s=>s.slug===normalizeSetSlug(c.setSlug));
            return `<${rows?'div':'button'} ${rows?'class="m-recent-row"':`type="button" data-m-action="card" data-m-value="${esc(c.id)}"`}><img src="${esc(img)}" alt="${esc(c.name)}" loading="lazy">${cardSummaryHTML(c)}</${rows?'div':'button'}>`;
        }).join('');
    }
    function dashboardHTML() {
        const t=totals(), inProgress=allSets.filter(s=>ownedForSet(s)>0&&ownedForSet(s)<s.cardCount).sort((a,b)=>ownedForSet(b)/b.cardCount-ownedForSet(a)/a.cardCount).slice(0,4);
        return '<div class="chini-overview"><span><strong>'+fmtNumber(t.unique)+'</strong> impresiones</span><span><strong>'+fmtNumber(t.total)+'</strong> ejemplares</span><span><strong>'+fmtNumber(t.sets)+'</strong> expansiones</span><span>'+esc(ChiniPrices.summaryText(t.cards))+'</span></div><div class="chini-quick">'+action('scan','Escanear carta','scan','m-primary')+action('search','Buscar una carta','search')+action('mysets','Abrir álbumes','book')+'</div><div class="chini-dashboard"><section><h2>Últimas incorporaciones</h2><div class="m-recent">'+recentHTML(recentCards(t.cards))+'</div></section><section><h2>Expansiones en progreso</h2>'+(inProgress.length?inProgress.map(s=>'<div class="m-progress-row"><button data-m-action="open-set" data-m-value="'+esc(s.slug)+'">'+esc(s.name)+'</button><span>'+ownedForSet(s)+' / '+s.cardCount+'</span>'+progress(ownedForSet(s)/s.cardCount*100)+'</div>').join(''):'<p>Añade tu primera carta para empezar una expansión.</p>')+'</section></div>';
    }
    function mountShell() {
        const aside=document.createElement('aside'); aside.className='m-sidebar'; aside.id='modernSidebar'; aside.setAttribute('aria-label','Navegación principal');
        const primary=action('dashboard','Inicio','home','')+action('sets','Explorar','search','')+action('collection','Colección','cards','')+action('mysets','Álbumes','book','')+action('scan','Escanear','scan','');
        aside.innerHTML='<a class="m-brand" href="#/games" data-m-action="game"><span><em>CHINI</em>DEX</span></a><nav class="m-nav">'+primary+'<div class="m-subnav">'+action('inventory','Gestionar y CSV','table','')+action('wishlist','Deseos','star','')+action('missing','Faltantes','cards','')+action('trades','Intercambios','layers','')+action('history','Historial','calendar','')+action('users','Comunidad','user','')+action('settings','Ajustes','settings','')+'</div></nav><div class="m-sidebar-bottom"><a class="m-app-card" href="https://github.com/chinoforeva/chinidex#android">Aplicación Android</a></div>';
        const bottom=document.createElement('nav');bottom.className='m-bottom-nav';bottom.setAttribute('aria-label','Navegación principal móvil');bottom.innerHTML=primary;document.body.append(bottom);
        document.body.append(aside);
        const backdrop=document.createElement('button'); backdrop.className='m-drawer-backdrop'; backdrop.setAttribute('aria-label','Cerrar menú'); backdrop.onclick=()=>document.body.classList.remove('m-drawer-open'); document.body.append(backdrop);
        const top=document.querySelector('.header-content');
        top.insertAdjacentHTML('afterbegin',`${action('menu','<span class="sr-only">Menú</span>','menu','m-mobile-menu m-icon-button')}<select id="m-game-select" class="m-top-select" aria-label="Juego">${Object.entries(GAME_CONFIGS).map(([id,g])=>`<option value="${id}">${esc(g.label)}</option>`).join('')}</select><select id="m-language-select" class="m-top-select" aria-label="Idioma del catálogo"></select>`);
        const menuButton=top.querySelector('[data-m-action="menu"]');
        menuButton.setAttribute('aria-controls','modernSidebar');
        const mobileMenu=matchMedia('(max-width:850px)');
        try{document.body.classList.toggle('m-sidebar-collapsed',localStorage.getItem('chiniSidebarCollapsed')==='true');}catch{}
        const syncMenu=()=>{
            const expanded=mobileMenu.matches?document.body.classList.contains('m-drawer-open'):!document.body.classList.contains('m-sidebar-collapsed');
            menuButton.setAttribute('aria-expanded',String(expanded));
            menuButton.setAttribute('aria-label',expanded?'Plegar menú':'Desplegar menú');
            menuButton.title=expanded?'Plegar menú':'Desplegar menú';
            aside.inert=!expanded;
        };
        window.toggleModernMenu=()=>{
            if(mobileMenu.matches)document.body.classList.toggle('m-drawer-open');
            else{
                const collapsed=document.body.classList.toggle('m-sidebar-collapsed');
                try{localStorage.setItem('chiniSidebarCollapsed',String(collapsed));}catch{}
            }
            syncMenu();
        };
        new MutationObserver(syncMenu).observe(document.body,{attributes:true,attributeFilter:['class']});
        mobileMenu.addEventListener('change',()=>{document.body.classList.remove('m-drawer-open');syncMenu();});
        syncMenu();
        $('m-game-select').onchange=e=>switchGame(e.target.value);
        $('m-language-select').onchange=e=>switchLang(e.target.value);
        const nav=top.querySelector('nav');
        nav.insertAdjacentHTML('afterbegin',`${action('notifications','<span class="sr-only">Notificaciones</span>','bell','m-icon-button m-bell')}`);
        document.querySelector('.user-switch').insertAdjacentHTML('afterbegin',`<span class="m-avatar">${icon('user')}</span>`);
        $('collectionUser').setAttribute('aria-label','Usuario de la colección');
        const query=$('shellQuery'); query.setAttribute('oninput',''); query.placeholder='Buscar cartas…'; query.setAttribute('aria-label','Buscar cartas');
        let headerSearchTimer, headerSearchToken=0;
        const searchHeader=async token=>{
            const q=query.value;
            if(activeViewName()!=='search')await go('search');
            if(token!==headerSearchToken)return;
            query.value=q;$('globalSearch').value=q;globalCardSearch({immediate:true});
        };
        query.addEventListener('input',()=>{clearTimeout(headerSearchTimer);const token=++headerSearchToken;headerSearchTimer=setTimeout(()=>searchHeader(token),300);});
        query.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(headerSearchTimer);searchHeader(++headerSearchToken);}});
        document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();query.focus();}if(e.key==='Escape')document.body.classList.remove('m-drawer-open');});
        const head=document.createElement('div'); head.id='m-page-header'; $('mainContent').prepend(head);
        const extra=document.createElement('section'); extra.id='m-extra-page'; extra.hidden=true; head.after(extra);
    }
    function sync() {
        const view=activeViewName(), key=section||(view==='collection'&&['album','personal'].includes(collectionMode)?'album':view);
        document.body.dataset.modernSection=key;
        document.body.classList.toggle('m-album-mode',key==='album'||key==='mysets');
        $('m-game-select').value=currentGame;
        const langSelect=$('m-language-select');
        const langKey=currentGame+':'+currentLang;
        if(langSelect.dataset.key!==langKey){langSelect.innerHTML=GAME_CONFIGS[currentGame].languages.map(lang=>`<option value="${lang}" ${lang===currentLang?'selected':''}>${{es:'Catálogo en español',en:'Catálogo en inglés',jp:'Catálogo en japonés',cn:'Catálogo en chino'}[lang]}</option>`).join('');langSelect.dataset.key=langKey;}
        document.querySelectorAll('.m-nav [data-m-action],.m-bottom-nav [data-m-action]').forEach(el=>{const active=el.dataset.mAction===key||(key==='set-cards'&&el.dataset.mAction==='sets')||(['album','catch-em-all'].includes(key)&&el.dataset.mAction==='mysets');el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
        const title=titles[key];
        $('m-page-header').hidden=!title;
        if(title){const heading=key==='sets'?`Sets de ${GAME_CONFIGS[currentGame].label}`:title[1];const html=`<div class="m-breadcrumb"><span>${title[0]}</span><span>›</span><span>${esc(heading)}</span></div><div class="m-page-head"><div><h1>${esc(heading)}</h1><p>${title[2]}</p></div></div>`;if($('m-page-header').innerHTML!==html)$('m-page-header').innerHTML=html;}
        const extra=['dashboard','tools','settings','history','inventory','wishlist','trades','notifications','missing','shared'].includes(section);
        $('m-extra-page').hidden=!extra;
        document.querySelectorAll('.view').forEach(el=>el.style.display=extra?'none':'');
        if(extra) renderExtra();
        document.querySelectorAll('.m-view-toggle button').forEach(el=>el.classList.toggle('active',el.dataset.mAction===uiDisplayMode));
        document.querySelectorAll('[data-m-pokemon-only]').forEach(el=>el.hidden=currentGame!=='pokemon');
        if($('m-album-tabs'))$('m-album-tabs').hidden=!['album','mysets','catch-em-all'].includes(key);
        if($('m-collection-rail'))$('m-collection-rail').hidden=false;
        if($('m-collection-filters'))$('m-collection-filters').hidden=collectionMode!=='list';
        updateCollectionRail();
        updateAlbumSide();
    }
    function renderExtra() {
        if(['history','inventory','wishlist','trades','notifications','missing','shared'].includes(section)){const host=$('m-extra-page');if(host.dataset.workspace!==section)window.ChiniWorkspace?.render(section,host);return;}
        delete $('m-extra-page').dataset.workspace;
        if(section==='dashboard'){const host=$('m-extra-page'),signature=JSON.stringify([currentUser,currentGame,currentLang,Object.values(collection).map(card=>[card.id,card.name,card.quantity,card.languageCode,card.setSlug,card.dateAdded,ChiniPrices.quote(card)]),allSets.length]);if(host.dataset.dashboardSignature===signature&&host.querySelector('[data-dashboard-extras]'))return;const form=host.querySelector('[data-goal-form]'),draft=form?Object.fromEntries(new FormData(form)):null;host.dataset.dashboardSignature=signature;host.innerHTML=dashboardHTML();window.ChiniDashboard?.mount(host).then(()=>{if(draft)for(const [name,value] of Object.entries(draft)){const input=host.querySelector('[data-goal-form] [name="'+name+'"]');if(input)input.value=value;}});}
        else if(section==='tools')$('m-extra-page').innerHTML=`<div class="m-dashboard-grid"><section class="m-panel"><h3>Escanear carta</h3><p>Identifica una carta con tu cámara o una fotografía.</p>${quick('scan','Abrir escáner','Reconocimiento con el catálogo local','scan')}</section></div>`;
        else if(section==='settings')$('m-extra-page').innerHTML=`<div class="m-dashboard-grid"><section class="m-panel"><h3>Usuario de la colección</h3><p>${esc(currentUser||'Sin usuario seleccionado')}</p>${action('user','Seleccionar usuario','user')}</section><section class="m-panel"><h3>Idioma del catálogo</h3>${GAME_CONFIGS[currentGame].languages.map(lang=>action('language',{es:'Español',en:'Inglés',jp:'Japonés',cn:'Chino'}[lang],null,'m-secondary',lang)).join(' ')}</section></div>`;
        if(section==='settings'){const host=$('m-extra-page').querySelector('.m-dashboard-grid');window.ChiniAccount?.mount(host);window.ChiniWorkspace?.mountSettings(host);}
    }
    window.ChiniModernNavigation={section:()=>section,go:target=>go(target),restore:target=>{section=target;if(['album','mysets'].includes(target))setCollectionMode('album');sync();}};
    async function go(target) {
        document.body.classList.remove('m-drawer-open');
        section='';
        if(['history','inventory','wishlist','trades','notifications','missing'].includes(target)&&!await ensureCollectionUser())return;
        if(target==='game'){showGameSelector();sync();return;}
        if(target==='scan'){openCardScanner();return;}
        if(['dashboard','album','mysets','settings','tools','history','inventory','wishlist','trades','notifications','missing','shared'].includes(target)){
            if(['dashboard','album','mysets'].includes(target)){
                await showView('collection',{history:false});if(activeViewName()!=='collection')return;
                if(!allSets.length)await loadSets();
            }else await showView('sets',{history:false});
            section=target;
            if(target==='album'||target==='mysets')setCollectionMode('album');
            sync();commitNavigation();document.title=titles[target][1]+' — ChiniDex';return;
        }
        if(target==='collection')setCollectionMode('list');
        await showView(target==='pokedex'?'catch-em-all':target);
        if(target==='sets'&&!allSets.length)await loadSets();
        sync();
    }
    function mountCatalogue() {
        const view=$('view-sets'), content=$('setsContent'), controls=view.querySelector('.controls');
        const stats=document.createElement('div'); stats.id='m-catalog-stats';stats.className='m-stats';view.prepend(stats);
        const layout=document.createElement('div');layout.className='m-catalog-layout';layout.innerHTML='<aside id="m-set-filters" class="m-panel m-filter-panel" aria-label="Filtrar expansiones"></aside><div class="m-catalog-main"><div class="m-toolbar" id="m-set-toolbar"></div></div>';
        view.append(layout);$('m-set-toolbar').append(controls);$('m-set-toolbar').insertAdjacentHTML('beforeend',`${action('filter-menu','Filtros','filter','m-secondary m-filter-mobile')}<select id="m-set-order" aria-label="Ordenar expansiones"><option value="recent">Más recientes</option><option value="old">Más antiguas</option><option value="name">Nombre A–Z</option></select>`);
        $('m-set-order').onchange=e=>{setOrder=e.target.value;filterSets();};layout.querySelector('.m-catalog-main').append(content);
    }
    function decorateSets(sets) {
        const completed=allSets.filter(s=>s.cardCount>0&&ownedForSet(s)>=s.cardCount).length;
        $('m-catalog-stats').innerHTML=stat('Total de expansiones',fmtNumber(allSets.length),'layers','En el catálogo actual')+stat('Mi progreso',`${allSets.length?Math.round(completed/allSets.length*100):0}%`,'star',`${completed} sets completados`)+stat('Total de cartas',fmtNumber(allSets.reduce((sum,s)=>sum+s.cardCount,0)),'book','En todas las expansiones')+stat('Última expansión',allSets[0]?.name||'—','calendar',allSets[0]?formatReleaseDate(allSets[0].releasedAt):'',true);
        const groups=new Map();allSets.forEach(s=>{const name=setSeriesName(s);groups.set(name,(groups.get(name)||0)+1);});
        const years=[...new Set(allSets.map(s=>String(s.releasedAt).slice(0,4)).filter(y=>y&&y!=='1900'))].sort().reverse();
        $('m-set-filters').innerHTML=`<h3>${icon('filter')} Filtrar expansiones</h3>${action('clear-sets','Limpiar filtros',null,'m-text-button')}<h4>Serie principal</h4><label class="m-filter-option"><input type="checkbox" id="m-all-series" ${!selectedSetSeries.size?'checked':''}> Todas las series <small>${allSets.length}</small></label>${[...groups].sort((a,b)=>seriesSortRank(a[0])-seriesSortRank(b[0])).map(([name,count])=>`<label class="m-filter-option"><input type="checkbox" data-m-series="${esc(name)}" ${selectedSetSeries.has(name)?'checked':''}>${esc(name)}<small>${count}</small></label>`).join('')}<h4>Estado de mi colección</h4>${[['','Todos'],['complete','Completado'],['progress','En progreso'],['empty','Sin empezar']].map(([value,label])=>`<label class="m-filter-option"><input type="radio" name="m-set-state" value="${value}" ${setState===value?'checked':''}>${label}</label>`).join('')}<h4>Año de lanzamiento</h4><select id="m-set-year" aria-label="Año de lanzamiento"><option value="">Todos los años</option>${years.map(y=>`<option ${setYear===y?'selected':''}>${y}</option>`).join('')}</select>`;
        $('m-all-series').onchange=()=>{selectedSetSeries.clear();filterSets();};
        $('m-set-filters').querySelectorAll('[data-m-series]').forEach(el=>el.onchange=()=>toggleSetSeriesFilter(encodeURIComponent(el.dataset.mSeries),el.checked));
        $('m-set-filters').querySelectorAll('[name="m-set-state"]').forEach(el=>el.onchange=()=>{setState=el.value;filterSets();});
        $('m-set-year').onchange=e=>{setYear=e.target.value;filterSets();};
        document.querySelectorAll('.expansion-card').forEach(el=>{const s=allSets.find(s=>s.slug===el.dataset.setSlug);if(!s)return;const pct=s.cardCount?Math.min(100,Math.round(ownedForSet(s)/s.cardCount*1000)/10):0;el.insertAdjacentHTML('beforeend',`<div class="m-set-footer">${progress(pct)}<small>${pct===0&&ownedForSet(s)>0?'Menos del 0,1':pct}%</small><span class="m-primary">Ver set →</span></div>`);});
        decorateSetCovers();
        sync();
    }
    function mountSearch() {
        const view=$('view-search'), controls=view.querySelector('.controls');
        controls.insertAdjacentHTML('beforeend',action('submit-search','Buscar',null,'m-primary'));
        controls.insertAdjacentHTML('afterend',`<div class="m-popular"><strong>Búsquedas populares:</strong>${['Pikachu','Charizard','Mewtwo','151','Gardevoir'].map(q=>action('popular',q,null,'',q)).join('')}</div><div class="m-filter-row" id="m-search-filters"></div><div id="m-search-chips"></div><div class="m-results"><span id="m-search-count">Busca una carta para explorar el catálogo</span>${viewToggle()}</div>`);
        const sort=$('searchSort');sort.insertAdjacentHTML('beforeend','<option value="number">Número</option><option value="rarity">Rareza</option>');
        renderSearchFilters([]);
    }
    function cardValues(card,key) {
        const value=key==='rarity'?(displayRarityLabel(card.rarity)||'Sin rareza'):key==='artist'?(card.artist||card.illustrator):card[key];
        return (Array.isArray(value)?value:[value]).filter(Boolean).map(String);
    }
    function renderSearchFilters(cards) {
        if(window.ChiniSearch){ChiniSearch.mountFilters();ChiniSearch.decorate();return;}
        $('m-search-filters').innerHTML=`<label>Juego<select id="m-search-game">${Object.entries(GAME_CONFIGS).map(([id,g])=>`<option value="${id}" ${id===currentGame?'selected':''}>${esc(g.label)}</option>`).join('')}</select></label>`+Object.entries({setSlug:'Set',rarity:'Rareza',types:'Tipo',subtypes:'Subtipo',artist:'Ilustrador'}).map(([key,label])=>{
            const values=[...new Set(cards.flatMap(c=>cardValues(c,key)))].sort();
            return `<label>${label}<select data-m-card-filter="${key}" ${!values.length?'disabled':''}><option value="">${values.length?'Todos':'Sin datos en resultados'}</option>${values.map(value=>`<option value="${esc(value)}" ${cardFilters[key]===value?'selected':''}>${esc(key==='setSlug'?(allSets.find(s=>s.slug===value)?.name||value):value)}</option>`).join('')}</select></label>`;
        }).join('')+action('clear-search','Limpiar filtros',null,'m-text-button');
        $('m-search-game').onchange=async e=>{await switchGame(e.target.value);await go('search');};
        $('m-search-filters').querySelectorAll('[data-m-card-filter]').forEach(el=>el.onchange=()=>{cardFilters[el.dataset.mCardFilter]=el.value;renderSearchResults(lastSearch);});
    }
    function filterSearchCards(cards) {if(window.ChiniSearch)return cards;return cards.filter(c=>Object.entries(cardFilters).every(([key,value])=>!value||cardValues(c,key).includes(value)));}
    function searchDecorated(cards,visible) {
        if(window.ChiniSearch){ChiniSearch.decorate();return;}
        renderSearchFilters(cards);
        $('m-search-count').textContent=`${fmtNumber(visible.length)} coincidencias · hasta 60 por página${searchResultsTotal>cards.length?` de ${fmtNumber(searchResultsTotal)} totales; afina la búsqueda`:''}`;
        $('m-search-chips').innerHTML=Object.entries(cardFilters).filter(([,value])=>value).map(([key,value])=>`<span class="m-chip">${esc(key==='setSlug'?(allSets.find(s=>s.slug===value)?.name||value):value)}${action('remove-filter','×',null,'',key)}</span>`).join('');
    }
    function mountCollection() {
        const view=$('view-collection');
        const tabs=document.createElement('div');tabs.id='m-album-tabs';tabs.className='m-tabs';tabs.hidden=true;
        tabs.innerHTML=action('album','Álbumes','book','active')+`<span data-m-pokemon-only>${action('pokedex','¡Hazte con Todos!','cards','')}</span>`;view.prepend(tabs);
        $('collectionTabList').textContent='Mi colección';$('collectionTabAlbum').textContent='Álbumes';
        $('collectionTabAlbum').insertAdjacentHTML('afterend',action('user','Selección de usuario','user','collection-tab'));
        const filters=document.createElement('div');filters.id='m-collection-filters';filters.className='m-filter-row';
        view.querySelector('.collection-tabs').after(filters);
        const layout=document.createElement('div');layout.className='m-collection-layout';layout.innerHTML='<div id="m-collection-main"></div><aside id="m-collection-rail" class="m-collection-rail"></aside>';view.append(layout);
        $('m-collection-main').append($('collectionContent'));
        $('m-collection-main').insertAdjacentHTML('afterbegin','<div id="m-album-search" hidden><form class="m-toolbar" id="m-album-jump-form"><input class="m-top-select" style="max-width:none;flex:1" type="search" id="m-album-jump" placeholder="Buscar por número o nombre…" aria-label="Buscar carta en el álbum"><button class="m-primary">Ir al hueco</button></form></div>');
        $('m-album-jump-form').onsubmit=e=>{e.preventDefault();const q=$('m-album-jump').value.trim().toLowerCase();const index=albumSetCards.findIndex(c=>String(c.number).toLowerCase()===q||c.name.toLowerCase().includes(q));if(index<0){notify('No se ha encontrado esa carta en este set.');return;}albumSpreadIndex=Math.floor(index/(albumPageSize()*2));renderAlbumBook();};
        updateCollectionRail();
    }
    function updateCollectionRail() {
        if(!$('m-collection-rail'))return;
        $('m-collection-rail').innerHTML=`<section class="m-panel"><h3>Últimas añadidas</h3>${recentHTML(recentCards(Object.values(collection),5),true)}</section><section class="m-panel"><h3>${icon('scan')} Escanear para añadir</h3><p>Añade cartas a tu colección desde tu cámara.</p>${action('scan','Escanear carta',null,'m-primary')}</section>`;
    }
    function collectionGrid() {
        if(collectionMode!=='list')return;
        let cards=sortCollection(getCollectionCards(),$('collectionSort').value);
        $('m-collection-filters').hidden=true;
        if(!cards.length)return;
        $('collectionContent').innerHTML = '<div class="cards-grid">' + cards.map(c => cardHTML(c,false).replace(/<\/div>\s*$/, '<div class="m-card-quantity">' + action('quantity-minus','−',null,'qty-btn',c.id).replace('<button ',`<button aria-label="Reducir cantidad de ${esc(c.name)}" `) + '<span>' + (c.quantity||1) + '</span>' + action('quantity-plus','+',null,'qty-btn',c.id).replace('<button ',`<button aria-label="Aumentar cantidad de ${esc(c.name)}" `) + action('remove-card','Eliminar',null,'del-btn',c.id) + '</div></div>')).join('') + '</div>';
        updateCollectionRail();
    }
    function updateAlbumSide() {
        if(!$('m-album-search'))return;
        const book=collectionMode==='album'&&!!albumSetSlug;
        $('m-album-search').hidden=!book;
        if(!book){updateCollectionRail();return;}
        $('m-collection-rail').hidden=false;
        const owned=albumSetCards.filter(c=>collection[c.id]).length,total=albumSetCards.length;
        $('m-collection-rail').innerHTML=`<section class="m-panel"><h3>Progreso del set</h3><div class="m-ring-row">${ring(owned,total)}</div><div class="m-legend"><span><b>${owned}</b> En tu colección</span><span><b>${total-owned}</b> Faltan por conseguir</span><span><b>${total}</b> Total del set</span></div></section><section class="m-panel"><h3>Completa tu álbum</h3>${quick('scan','Escanear carta','Añadir a mi colección normal','scan')}${currentGame==='pokemon'?quick('pokedex','¡Hazte con Todos!','Álbum Pokédex y variantes archivadas','book'):''}</section>`;
    }
    function mountPokedex() {
        const view=$('view-catch-em-all');
        const tabs=document.createElement('div');tabs.className='m-tabs';tabs.innerHTML=action('album','Álbumes','book','')+action('pokedex','¡Hazte con Todos!','cards','active');
        view.prepend(tabs);
        const layout=document.createElement('div');layout.className='m-pokedex-layout';layout.innerHTML='<div id="m-pokedex-main"></div><aside id="m-pokedex-rail"></aside>';view.append(layout);
        const left=$('m-pokedex-main'),right=$('m-pokedex-rail');
        left.append(view.querySelector('.pokedex-language-tabs'),$('pokedexAlbumTabs'),view.querySelector('.pokedex-toolbar'),$('pokedexStage'));
        right.append(view.querySelector('.pokedex-progress-card'));
        view.querySelector('.pokedex-hero').hidden=true;
    }
    function mountSetDetails() {
        const toolbar=document.querySelector('.set-cards-toolbar');
        toolbar.insertAdjacentHTML('beforeend',viewToggle());
        toolbar.insertAdjacentHTML('beforebegin',`<div class="m-tabs" id="m-detail-tabs">${action('set-tab','Cartas de la expansión',null,'active','cards')}${action('set-tab','Información',null,'','info')}${action('unavailable','Productos',null,'','Productos')}${action('set-tab','Galería',null,'','gallery')}${action('set-tab','Series relacionadas',null,'','related')}</div><div class="m-panel m-information" id="m-set-info" hidden></div>`);
    }
    function setTab(tab) {
        const info=$('m-set-info');info.hidden=tab==='cards'||tab==='gallery';
        document.querySelector('.cards-stage').hidden=!info.hidden;
        document.querySelector('.set-cards-toolbar').hidden=!info.hidden;
        $('m-detail-tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.mValue===tab));
        if(tab==='info'&&currentSet)info.innerHTML=`<h3>${esc(currentSet.name)}</h3><dl><dt>Serie</dt><dd>${esc(setSeriesName(currentSet))}</dd><dt>Fecha de lanzamiento</dt><dd>${esc(formatReleaseDate(currentSet.releasedAt))}</dd><dt>Código</dt><dd>${esc(currentSet.slug||currentSet.id)}</dd><dt>Cartas</dt><dd>${currentSetCards.length}</dd><dt>Idioma del catálogo</dt><dd>${{es:'Español',en:'Inglés',jp:'Japonés',cn:'Chino'}[currentLang]}</dd></dl>`;
        if(tab==='related')info.innerHTML=`<h3>Series relacionadas</h3>${allSets.filter(s=>setSeriesName(s)===setSeriesName(currentSet)&&s.slug!==currentSet.slug).slice(0,12).map(s=>action('open-set',esc(s.name),'book','m-secondary',s.slug)).join(' ')||'<p>No hay otros sets en esta serie.</p>'}`;
    }
    async function loadGameCards() {
        try {
            const response=await fetch('./ui/assets/catalogues.json');if(!response.ok)return;catalogueManifest=await response.json();
            const {mountHeroCarousel}=await import('./hero-carousel.js?v=5');
            mountHeroCarousel($('view-game'),Object.entries(GAME_CONFIGS).map(([key,config])=>{
                const data=catalogueManifest[key]||{};
                return {key,label:config.label,sets:data.sets,cards:data.cards,
                    languages:config.languages.map(lang=>lang.toUpperCase()),
                    fallback:(data.images||[])[1]||(data.images||[])[0],
                    };
            }));
        } catch { notify('No se han podido cargar las portadas de los juegos.'); }
    }
    function decorateSetCovers() {
        const root=GAME_CONFIGS[currentGame].dataRoot[currentLang];
        document.querySelectorAll('.expansion-card').forEach(el=>{
            const wrap=el.querySelector('.expansion-logo-wrap');if(!wrap||wrap.querySelector('.m-set-cover'))return;
            const image=setCovers[root]?.[el.dataset.setSlug];if(!image)return;
            const img=document.createElement('img');img.className='m-set-cover';img.alt='';img.loading='lazy';img.src=ChiniCatalogue.thumbnail(image);wrap.prepend(img);
        });
    }
    async function loadSetCovers() {try{const response=await fetch('./ui/assets/set-covers.json',{cache:'no-cache'});if(response.ok){setCovers=await response.json();decorateSetCovers();}}catch{}}
    function installAdapters() {
        window.ChiniPresentation={
            sets(sets){const key=currentGame+':'+currentLang;if(filterResetKey!==key){setState='';setYear='';filterResetKey=key;}const visible=sets.filter(s=>(!setYear||String(s.releasedAt).startsWith(setYear))&&(!setState||(setState==='complete'?s.cardCount>0&&ownedForSet(s)>=s.cardCount:setState==='progress'?ownedForSet(s)>0&&ownedForSet(s)<s.cardCount:ownedForSet(s)===0)));return [...visible].sort((a,b)=>setOrder==='name'?a.name.localeCompare(b.name):setOrder==='old'?a.releasedAt.localeCompare(b.releasedAt):b.releasedAt.localeCompare(a.releasedAt));},
            search(cards){lastSearch=cards;return filterSearchCards(cards);}
        };
        ChiniEvents.on('openModal',()=>{const card=lastDetailCard;if(card)$('modalChips').textContent=(card.languageCode||currentLang).toUpperCase()+' · '+displayRarityLabel(card.rarity)+' · '+cardFinishLabel(card);});
        ChiniEvents.on('renderSets',sets=>decorateSets(ChiniPresentation.sets(sets)));
        ChiniEvents.on('renderSearchResults',cards=>searchDecorated(cards,filterSearchCards(cards)));
        ChiniEvents.on('before:showView',()=>{section='';});
        ChiniEvents.on('showView',sync);ChiniEvents.on('syncShellUI',sync);
        ChiniEvents.on('renderCollection',()=>{collectionGrid();updateAlbumSide();if(section==='dashboard')renderExtra();});
        ChiniEvents.on('renderAlbumBook',updateAlbumSide);
        ChiniEvents.on('renderAlbumSets',()=>{$('m-album-search').hidden=true;updateCollectionRail();});
        ChiniEvents.on('loadCollectionForCurrentUser',sync);ChiniEvents.on('setUiDisplayMode',sync);
        ChiniEvents.on('openSet',()=>{section='';setTab('cards');sync();});
        ChiniEvents.on('switchGame',()=>{section='';collectionSet='';collectionRarity='';Object.keys(cardFilters).forEach(k=>cardFilters[k]='');renderSearchFilters([]);sync();});
        ChiniEvents.on('switchLang',()=>{section='';Object.keys(cardFilters).forEach(k=>cardFilters[k]='');renderSearchFilters([]);sync();});
    }
    document.addEventListener('click',async event=>{
        const button=event.target.closest('[data-m-action]');if(!button)return;
        event.preventDefault();const a=button.dataset.mAction,v=button.dataset.mValue;
        if(['game','sets','search','users','collection','dashboard','album','mysets','pokedex','tools','settings','scan','history','inventory','wishlist','trades','notifications','missing','shared'].includes(a)){await go(a);return;}
        if(a==='menu')toggleModernMenu();
        else if(a==='filter-menu')document.body.classList.toggle('m-filters-open');
        else if(a==='game-catalogue'){await switchGame(v);sync();}
        else if(a==='language'){await switchLang(v);sync();}
        else if(a==='grid'||a==='table')setUiDisplayMode(a);
        else if(a==='clear-sets'){setState='';setYear='';selectedSetSeries.clear();$('setSearch').value='';filterSets();}
        else if(a==='popular'){$('globalSearch').value=v;globalCardSearch({immediate:true});}
        else if(a==='submit-search')globalCardSearch({immediate:true});
        else if(a==='clear-search'){Object.keys(cardFilters).forEach(k=>cardFilters[k]='');renderSearchResults(lastSearch);}
        else if(a==='clear-collection-filters'){collectionSet='';collectionRarity='';renderCollection();}
        else if(a==='remove-filter'){cardFilters[v]='';renderSearchResults(lastSearch);}
        else if(a==='card')openModal(v);
        else if(a==='quantity-minus')changeQty(v,-1);
        else if(a==='quantity-plus')changeQty(v,1);
        else if(a==='remove-card')removeCard(v);
        else if(a==='set-tab')setTab(v);
        else if(a==='open-set')openSet(v);
        else if(a==='user'){await ensureCollectionUser({force:true});sync();}
        else if(a==='history')await go('history');
        else if(a==='notifications')await go('notifications');
        else if(a==='unavailable')notify(`${v}: esta función todavía no está disponible en CHINIDEX.`);
    });
    mountShell();mountCatalogue();mountSearch();mountCollection();mountPokedex();mountSetDetails();installAdapters();sync();loadGameCards();loadSetCovers();
})();




