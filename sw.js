/* Service worker de Metria
   - Red primero para los archivos de la app (siempre la versión nueva si hay conexión),
     con copia local para abrir sin internet.
   - NUNCA guarda datos de salud: no cachea Firebase, ni estudios, ni nada de otro dominio. */
const CACHE = 'metria-1.1.0';
const BASE = ['./', './index.html', './css/app.css', './js/app.js', './manifest.webmanifest', './icons/logo-256.png', './icons/logo-512.png', './icons/favicon-64.png', './icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Firebase, CDN, fuentes: directo a la red
  e.respondWith(
    // 'no-cache' revalida con el servidor: cada equipo recibe la versión nueva apenas se publica
    fetch(e.request, { cache: 'no-cache' }).then((r) => {
      if (r.ok && r.type === 'basic') { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
