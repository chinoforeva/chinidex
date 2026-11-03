/* Shared by Classic and Modern. Only public catalogues are cached here. */
(function(root){
    const memory=new Map(), pending=new Map(), warmed=new Set(), revisions=new Map();
    const DATA_CACHE='chini-catalogues-v1', MAX_SETS=48, FRESH=5*60*1000;
    let storage=null, prune=Promise.resolve(), imageActive=0;const imageQueue=[];
    function dataStore(){return storage||(storage=typeof caches==='undefined'?Promise.resolve(null):caches.open(DATA_CACHE).catch(()=>null));}
    function remember(url,data){memory.delete(url);memory.set(url,{data,time:Date.now()});while(memory.size>12)memory.delete(memory.keys().next().value);return data;}
    async function refresh(url){
        const response=await fetch(url);if(!response.ok)throw new Error(`No se pudo cargar el catálogo (HTTP ${response.status})`);
        const data=await response.json();remember(url,data);
        const store=await dataStore();
        if(store) {
            // Persist off the rendering path; quota errors never prevent opening cards.
            prune=prune.catch(()=>{}).then(async()=>{
                const text=JSON.stringify(data);if(text.length>4*1024*1024)return;
                await store.put(url,new Response(text,{headers:{'Content-Type':'application/json','X-Chini-Cached-At':String(Date.now())}}));
                const keys=await store.keys();for(const key of keys.slice(0,Math.max(0,keys.length-MAX_SETS)))await store.delete(key);
            }).catch(()=>{});
        }
        return data;
    }
    function network(url){if(pending.has(url))return pending.get(url);const task=refresh(url).finally(()=>pending.delete(url));pending.set(url,task);return task;}
    async function get(url){
        if(memory.has(url)){
            const entry=memory.get(url);
            if(Date.now()-entry.time>FRESH)network(url).catch(()=>{});
            return entry.data;
        }
        const store=await dataStore();let cached;
        try{cached=await store?.match(url);}catch{}
        if(cached)try{
            const data=remember(url,await cached.json());
            if(Date.now()-Number(cached.headers.get('X-Chini-Cached-At'))>FRESH)network(url).catch(()=>{});
            return data;
        }catch{ /* A damaged cache entry must not block the network fallback. */ }
        return network(url);
    }
    async function setRevision(dataRoot,revision){
        const prefix='/'+dataRoot+'/sets/',key='chiniCatalogueRevision_'+dataRoot;
        let previous=revisions.get(dataRoot);if(previous===undefined)try{previous=localStorage.getItem(key);}catch{}
        if(previous===revision)return;
        // Only public card metadata is invalidated; collection/user storage is untouched.
        await Promise.allSettled([...pending].filter(([url])=>url.startsWith(prefix)).map(([,task])=>task));
        for(const url of memory.keys())if(url.startsWith(prefix))memory.delete(url);
        const store=await dataStore();if(store)for(const request of await store.keys()){const pathname=new URL(request.url).pathname;if(pathname.startsWith(prefix))await store.delete(request);}
        revisions.set(dataRoot,revision);try{localStorage.setItem(key,revision);}catch{}
    }
    function thumbnail(value){
        if(!value)return '';
        if(/^https?:/i.test(String(value))){const url=new URL(value);if(!root.ChiniApi||url.origin!==new URL(root.ChiniApi.apiBase||location.origin).origin)return '';value=url.pathname;}
        const pathname=String(value).replace(/^\/(?:TCG\/)?/i,'');
        if(!/^(?:scrydex|es|jp|cn|onepiece(?:-jp)?|riftbound|magic)-data\/images\/.+\.(png|jpe?g|webp)$/i.test(pathname))return value;
        const preview='/TCG/previews-v1/'+pathname+'.webp';return root.ChiniApi?root.ChiniApi.endpoint(preview):preview;
    }
    function pump(){
        while(imageActive<3&&imageQueue.length){
            const url=imageQueue.shift();imageActive++;
            const image=new Image();image.fetchPriority='low';image.decoding='async';
            let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);imageActive--;pump();};
            const timer=setTimeout(finish,15000);image.onload=finish;image.onerror=()=>{warmed.delete(url);finish();};image.src=url;
        }
    }
    function warmImages(cards,count=12){
        if(navigator.connection?.saveData)return;
        for(const card of cards.slice(0,count)){
            const url=thumbnail(card.localImage||card.image);if(!url||warmed.has(url))continue;
            warmed.add(url);imageQueue.push(url);if(warmed.size>600)warmed.delete(warmed.values().next().value);
        }
        if(imageQueue.length>36)for(const url of imageQueue.splice(0,imageQueue.length-36))warmed.delete(url);
        pump();
    }
    async function prefetch(dataRoot,slug){
        if(!slug||navigator.connection?.saveData)return;
        try{const data=await get(`/${dataRoot}/sets/${encodeURIComponent(slug)}/set.json`);
            const cards=[...(data.cards||[])].sort((a,b)=>(parseFloat(String(a.number).replace(/[^\d.]/g,''))||0)-(parseFloat(String(b.number).replace(/[^\d.]/g,''))||0));warmImages(cards);
        }catch{}
    }
    let hoverTimer;
    function anticipate(event){const card=event.target.closest?.('[data-set-slug]');if(!card)return;clearTimeout(hoverTimer);
        hoverTimer=setTimeout(()=>{if(typeof currentDataRoot==='function')prefetch(currentDataRoot(),card.dataset.setSlug);},event.type==='pointerover'?60:0);}
    if(typeof document!=='undefined')for(const type of ['pointerover','focusin','touchstart'])document.addEventListener(type,anticipate,{passive:true});
    if(typeof document!=='undefined')document.addEventListener('error',event=>{
        const img=event.target;
        if(img.tagName!=='IMG'||img.hasAttribute('onerror'))return;
        const url=new URL(img.src,location.href);
        if(url.origin===location.origin&&url.pathname.startsWith('/TCG/previews-v1/'))
            img.src='/TCG/'+url.pathname.slice('/TCG/previews-v1/'.length).replace(/\.webp$/,'');
    },true);
    async function search(dataRoot,query,signal,options={}){
        const catalogue=String(dataRoot).replace(/^\/?TCG\//i,'').replace(/^\//,'');
        // Query only the server's direct reader of the NAS catalogue files.
        const params=new URLSearchParams({catalogue,q:query,...options});
        const response=await fetch('/tcg-catalogue-search?'+params,{signal});
        if(response.ok)return response.json();
        if(response.status===404||response.status===405)
            throw new Error('El servidor encendido todavía no ha cargado la búsqueda de tu base de datos del NAS. Detén e inicia el servidor en el equipo donde ejecutas PowerShell y después recarga esta página.');
        const error=await response.json().catch(()=>({}));
        throw new Error(error.error||`No se pudo consultar el catálogo del NAS (HTTP ${response.status})`);
    }
    root.ChiniCatalogue={get,setRevision,search,thumbnail,prefetch,warmImages,isSet:url=>/\/(?:scrydex|es|jp|cn|onepiece(?:-jp)?|riftbound|magic)-data\/sets\/[^/]+\/set\.json$/.test(url)};
})(typeof window==='undefined'?globalThis:window);

