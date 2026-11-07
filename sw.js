// Service worker del Despacho: permite instalar la app y abrirla aunque la señal sea mala.
// Los datos (Supabase) NUNCA se guardan aquí: siempre van directo a la red.
// Al cambiar archivos de la app, sube este número para limpiar la copia vieja.
const VERSION = 'despacho-v4';
const APP_SHELL = [
  'reuniones-notas.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];
// Librerías y tipografías externas que la página necesita para dibujarse
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Archivos propios de la app: primero la red (para tener siempre la versión nueva),
  // y si no hay señal, la última copia guardada.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('reuniones-notas.html'))
        )
    );
    return;
  }

  // Librerías y tipografías: se usa la copia guardada y se renueva en segundo plano.
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(req).then((hit) => {
          const net = fetch(req)
            .then((res) => {
              if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || net;
        })
      )
    );
  }
  // Todo lo demás (Supabase, WhatsApp, etc.) pasa directo, sin tocarlo.
});
