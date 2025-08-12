const CACHE = 'translator-v1';
const ASSETS = [
  '/', '/index.html', '/manifest.json',
  // include CSS/JS and icons referenced
];

// install
self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// activate
self.addEventListener('activate', ev => {
  ev.waitUntil(clients.claim());
});

// fetch
self.addEventListener('fetch', ev => {
  // offline-first for app shell
  if(ev.request.method !== 'GET') return;
  const url = new URL(ev.request.url);
  // Bypass API calls (let them go to network)
  if(url.pathname.startsWith('/api/')) return;
  ev.respondWith(
    caches.match(ev.request).then(cached => {
      const network = fetch(ev.request).then(r => {
        // update cache for future
        if(r && r.status === 200) caches.open(CACHE).then(c => c.put(ev.request, r.clone()));
        return r;
      }).catch(()=>cached);
      return cached || network;
    })
  );
});
