/* Modern home presentation only. Catalogue actions and counts belong to the app. */
export function mountHeroCarousel(host, games) {
    if (document.documentElement.dataset.ui !== 'modern' || host.querySelector('.tcg-hero')) return;
    const sheet = document.createElement('link');
    sheet.rel = 'stylesheet'; sheet.href = './ui/hero-carousel.css?v=5'; document.head.append(sheet);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const fmt = value => Number(value || 0).toLocaleString('es-ES');
    const assets = './ui/assets/tcg-heroes/';
    const colors = {pokemon:'#695220',onepiece:'#254766',riftbound:'#403272',magic:'#773324'};
    const root = document.createElement('section'); root.className = 'tcg-hero';
    root.setAttribute('aria-label','Explora los juegos de cartas'); root.setAttribute('aria-roledescription','carrusel');
    root.innerHTML = `<div class="tcg-hero-backgrounds" aria-hidden="true">${games.map(g=>`<div class="tcg-hero-background" data-bg="${esc(g.key)}" style="--hero-color:${colors[g.key]}"></div>`).join('')}</div>
      <div class="tcg-hero-stage">${games.map(g=>`<article class="tcg-hero-card" data-hero-card="${esc(g.key)}" role="group" aria-roledescription="diapositiva" aria-label="${esc(g.label)}" style="--hero-color:${colors[g.key]}">
        <div class="tcg-hero-art"><img data-hero-image="${esc(g.key)}" alt="" draggable="false" decoding="async"></div>
        <span class="tcg-hero-featured" aria-hidden="true">DESTACADO</span>
        <button type="button" class="tcg-hero-select" data-select="${esc(g.key)}" aria-label="Seleccionar ${esc(g.label)}"></button>
        <div class="tcg-hero-copy"><h2>${esc(g.label)}</h2>
          <div class="tcg-hero-meta"><span>${fmt(g.sets)} sets</span><span>${fmt(g.cards)} cartas</span><span>${esc(g.languages.join(' · '))}</span></div>
          <button type="button" class="tcg-hero-enter" data-m-action="game-catalogue" data-m-value="${esc(g.key)}" aria-label="Entrar al catálogo de ${esc(g.label)}">Entrar al catálogo <span aria-hidden="true">→</span></button>
        </div></article>`).join('')}
        <button type="button" class="tcg-hero-arrow tcg-hero-prev" data-direction="-1" aria-label="Juego anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button>
        <button type="button" class="tcg-hero-arrow tcg-hero-next" data-direction="1" aria-label="Juego siguiente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 5 7 7-7 7"/></svg></button>
      </div>
      <p class="tcg-hero-announcement" role="status" aria-live="polite"></p>`;
    host.append(root);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const visualOrder = ['pokemon','onepiece','riftbound','magic'].filter(key=>games.some(g=>g.key===key));
    let active = visualOrder[0], timer, hovered = false, focused = false, visible = true;
    let dragging = null, suppressClick = 0;
    const loaded = new Map();
    let pools = {}, artCursor = {};
    const prepared = new Map();
    const isHome = () => document.body.dataset.modernSection === 'game';
    function schedule() {
        clearTimeout(timer);
        if(reduce.matches || hovered || focused || dragging || !visible || document.hidden || !isHome())return;
        timer=setTimeout(()=>{
            rotateArt();
            schedule();
        },5000);
    }
    function loadArt(key, priority) {
        if(loaded.has(key))return loaded.get(key);
        const img=root.querySelector(`[data-hero-image="${key}"]`),bg=root.querySelector(`[data-bg="${key}"]`);
        img.loading=priority?'eager':'lazy'; img.fetchPriority=key===active?'high':'low';
        const task=new Promise(resolve=>{
            const g=games.find(g=>g.key===key);let fallback=false;
            img.onerror=()=>{
                if(!fallback && g.fallback){fallback=true;img.src=g.fallback;}
                else {img.hidden=true;resolve(null);}
            };
            img.onload=()=>{bg.style.backgroundImage=`url("${img.src}")`;resolve(img.src);};
            img.src=assets+key+'.webp';
        });
        loaded.set(key,task);return task;
    }
    function prepareArt(game) {
        const pool=pools[game.key];if(!pool?.length)return;
        const index=((artCursor[game.key]??-1)+1)%pool.length;
        const candidate=pool[index], preload=new Image();
        preload.decoding='async';preload.fetchPriority='low';
        preload.onload=()=>prepared.set(game.key,{candidate,index,src:preload.src});
        preload.onerror=()=>{artCursor[game.key]=index;};
        preload.src=window.ChiniApi?.asset(candidate.image)||candidate.image;
    }
    function rotateArt() {
        for(const game of games) {
            const next=prepared.get(game.key);
            if(next) {
                prepared.delete(game.key);artCursor[game.key]=next.index;
                const img=root.querySelector(`[data-hero-image="${game.key}"]`);
                if(!reduce.matches && img.src!==next.src) {
                    img.parentElement.querySelector('.tcg-hero-outgoing')?.remove();
                    const previous=img.cloneNode();
                    previous.removeAttribute('data-hero-image');
                    previous.className='tcg-hero-outgoing';
                    img.after(previous);
                    const fade=previous.animate(
                        [{opacity:1,filter:'blur(0px)'},{opacity:0,filter:'blur(8px)'}],
                        {duration:700,easing:'ease-in-out',fill:'forwards'}
                    );
                    fade.finished.then(()=>previous.remove(),()=>previous.remove());
                    img.animate([{opacity:.25,filter:'blur(5px)'},{opacity:1,filter:'blur(0px)'}],
                        {duration:700,easing:'ease-in-out'});
                }
                img.onload=null;img.onerror=null;
                img.src=next.src;img.hidden=false;
                img.title=`${next.candidate.name} · ${next.candidate.rarity}`;
                root.querySelector(`[data-bg="${game.key}"]`).style.backgroundImage=`url("${next.src}")`;
            }
            prepareArt(game);
        }
    }
    fetch('./ui/assets/hero-cards.json').then(r=>r.ok?r.json():{}).then(async data=>{
        pools=data;
        for(const game of games)artCursor[game.key]=Math.floor(Math.random()*(pools[game.key]?.length||1))-1;
        await Promise.all(loaded.values());
        games.forEach(prepareArt);schedule();
    }).catch(()=>{});
    function select(key, manual=true) {
        if(!visualOrder.includes(key))return;
        active=key;root.dataset.active=key;
        const center=visualOrder.indexOf(key);
        for(const card of root.querySelectorAll('[data-hero-card]')){
            const cardKey=card.dataset.heroCard;
            let position=(visualOrder.indexOf(cardKey)-center+visualOrder.length)%visualOrder.length;
            if(position===visualOrder.length-1)position=-1;
            card.dataset.position=position;card.classList.toggle('is-active',position===0);
            card.querySelector('.tcg-hero-select').setAttribute('aria-pressed',String(position===0));
            loadArt(cardKey,Math.abs(position)<=1);
        }
        root.querySelectorAll('[data-bg]').forEach(bg=>bg.classList.toggle('is-active',bg.dataset.bg===key));

        if(manual)root.querySelector('[role="status"]').textContent=games.find(g=>g.key===key).label;
        schedule();
    }
    const step = delta => select(visualOrder[(visualOrder.indexOf(active)+delta+visualOrder.length)%visualOrder.length]);
    root.addEventListener('click',event=>{
        if(Date.now()<suppressClick){event.preventDefault();event.stopPropagation();return;}
        const button=event.target.closest('button');if(!button)return;
        if(button.dataset.select)select(button.dataset.select);
        else if(button.dataset.direction)step(Number(button.dataset.direction));
    });
    root.addEventListener('keydown',event=>{
        if(event.altKey||event.ctrlKey||event.metaKey)return;
        if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();step(event.key==='ArrowRight'?1:-1);}
        if(event.key==='Home'){event.preventDefault();select(visualOrder[0]);}
        if(event.key==='End'){event.preventDefault();select(visualOrder.at(-1));}
    });
    root.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch'){hovered=true;schedule();}});
    root.addEventListener('pointerleave',()=>{hovered=false;schedule();});
    root.addEventListener('focusin',()=>{focused=true;schedule();});
    root.addEventListener('focusout',()=>{queueMicrotask(()=>{focused=root.contains(document.activeElement);schedule();});});
    root.addEventListener('pointerdown',event=>{
        if(event.button!==0 || event.target.closest('.tcg-hero-enter,.tcg-hero-arrow'))return;
        dragging={x:event.clientX,y:event.clientY,id:event.pointerId};schedule();
    });
    root.addEventListener('pointermove',event=>{
        if(dragging && Math.abs(event.clientX-dragging.x)>12 && Math.abs(event.clientX-dragging.x)>Math.abs(event.clientY-dragging.y))root.setPointerCapture(event.pointerId);
    });
    root.addEventListener('pointerup',event=>{
        if(!dragging || event.pointerId!==dragging.id)return;
        const dx=event.clientX-dragging.x,dy=event.clientY-dragging.y;dragging=null;
        if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3){suppressClick=Date.now()+500;step(dx<0?1:-1);}
        schedule();
    });
    root.addEventListener('pointercancel',()=>{dragging=null;schedule();});
    document.addEventListener('visibilitychange',schedule);
    reduce.addEventListener('change',schedule);
    new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['data-modern-section']});
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.15}).observe(root);
    select(active,false);
}
