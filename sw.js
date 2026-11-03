const CACHE_NAME = 'chini-cartas-shell-v6';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys
                .filter(key => key.startsWith('chini-cartas-shell-') && key !== CACHE_NAME)
                .map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || request.mode !== 'navigate' || !/^\/(?:TCG|tcg)(?:\/|$)/.test(new URL(request.url).pathname)) return;

    event.respondWith(
        fetch(request, { cache: 'no-store' })
            .then(response => {
                if (response.ok && !response.headers.get('Cache-Control')?.includes('no-store') && !new URL(request.url).searchParams.has('share')) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                }
                return response;
            })
            .catch(async () => {
                const exact = await caches.match(request);
                if (exact) return exact;
                const cachedNavigations = await caches.open(CACHE_NAME);
                const keys = await cachedNavigations.keys();
                if (keys.length) return cachedNavigations.match(keys[keys.length - 1]);
                return new Response(
                    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#f3f3f1;font:14px Inter,system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box"><main><h1>ChiniDex</h1><p>Inicia el servidor de Chini y vuelve a intentarlo.</p></main></body></html>',
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
            })
    );
});
