// Permite abrir la app aunque no haya internet (guarda una copia de la página).
const CACHE = 'cuadre-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return res })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/'))),
  )
})
