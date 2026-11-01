const CACHE = 'png-duty-shell-v15-centered-short-labels-20261101';
const SHELL = ['./', './index.html', './style.css', './app.js', './parser.js', './schedule.js', './sheets.js', './storage.js', './demo.js', './config.js', './opd.js', './names.js', './er-sync.js', './er-sync-config.js', './manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/icon-180.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('png-duty-shell-') && k !== CACHE).map(k => caches.delete(k)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith((async () => {
    try {
      const response=await fetch(event.request);
      if(response.ok) {
        const cache=await caches.open(CACHE);
        await cache.put(event.request,response.clone());
      }
      return response;
    } catch {
      return (await caches.match(event.request)) || (event.request.mode==='navigate' ? await caches.match('./index.html') : undefined) || Response.error();
    }
  })());
});
