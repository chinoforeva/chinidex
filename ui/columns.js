/* Shared density preference. Album slots deliberately keep their book layout. */
(() => {
    const clamp = value => Math.max(1, Math.min(8, Math.round(Number(value) || 8)));
    let maximum = 8;
    try { maximum = clamp(localStorage.getItem('chiniMaxColumns')); } catch {}
    window.ChiniColumns = {control: () => `<label class="card-columns-control"><span>Columnas máx.: <output>${maximum}</output></span><input type="range" min="1" max="8" step="1" value="${maximum}" aria-label="Máximo de columnas de cartas"></label>`};
    const selector = '.cards-grid, .collection-grid';
    const observed = new Set();
    function resize(grid) {
        const width = grid.clientWidth;
        if (!width) return;
        const gap = parseFloat(getComputedStyle(grid).columnGap) || 12;
        const available = Math.max(1, Math.floor((width + gap) / (150 + gap)));
        grid.style.setProperty('grid-template-columns', `repeat(${Math.min(maximum, available)}, minmax(0, 1fr))`, 'important');
    }
    const observer = new ResizeObserver(entries => entries.forEach(({target}) => resize(target)));
    const animations = new Map();
    function refresh(animate = false) {
        const before = new Map();
        if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.querySelectorAll(selector).forEach(grid => {
                if (!grid.clientWidth) return;
                for (const card of grid.children) {
                    const rect = card.getBoundingClientRect();
                    if (rect.bottom >= 0 && rect.top <= innerHeight) before.set(card, rect);
                }
            });
        }
        if (animate) {
            animations.forEach(animation => animation.cancel());
            animations.clear();
        }
        for (const grid of observed) if (!grid.isConnected) { observer.unobserve(grid); observed.delete(grid); }
        document.querySelectorAll(selector).forEach(grid => { if (!observed.has(grid)) { observed.add(grid); observer.observe(grid); } resize(grid); });
        before.forEach((old, card) => {
            const next = card.getBoundingClientRect();
            if (!next.width || !next.height || (old.width === next.width && old.height === next.height && old.left === next.left && old.top === next.top)) return;
            const animation = card.animate([
                {transformOrigin:'top left', transform:`translate(${old.left-next.left}px, ${old.top-next.top}px) scale(${old.width/next.width}, ${old.height/next.height})`},
                {transformOrigin:'top left', transform:'none'}
            ], {duration:320, easing:'cubic-bezier(.22,1,.36,1)'});
            animations.set(card, animation);
            animation.onfinish = () => { if (animations.get(card) === animation) animations.delete(card); };
        });
    }
    document.addEventListener('input', event => {
        if (!event.target.matches('.card-columns-control input')) return;
        maximum = clamp(event.target.value);
        try { localStorage.setItem('chiniMaxColumns', String(maximum)); } catch {}
        document.querySelectorAll('.card-columns-control').forEach(label => {
            label.querySelector('input').value = maximum;
            label.querySelector('output').textContent = maximum;
        });
        refresh(true);
    });
    document.addEventListener('DOMContentLoaded', () => {
        let queued = false;
        new MutationObserver(() => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; refresh(); });
        }).observe(document.body, {childList:true, subtree:true});
        refresh();
    });
})();
