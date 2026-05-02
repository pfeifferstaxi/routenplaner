const CACHE_NAME = 'klinik-planer-v1';

// Lokale Dateien und wichtige externe CDN-Skripte für Offline-Fähigkeit
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    // Externe Bibliotheken aus deinem <head>
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
    // Google Fonts
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
];

// Install Event: Speichert die statischen Assets im Cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Caching App Shell & CDNs');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Zwingt den wartenden Service Worker, sofort aktiv zu werden
});

// Activate Event: Löscht alte Caches, falls sich die Version (CACHE_NAME) ändert
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Lösche alten Cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Übernimmt sofort die Kontrolle über alle offenen Clients
});

// Fetch Event: Steuert, wie Netzwerkanfragen beantwortet werden
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. TomTom API-Calls NICHT cachen (Routenberechnungen müssen live sein)
    if (url.hostname === 'api.tomtom.com') {
        return; // Standard-Netzwerkverhalten wird nicht angetastet
    }

    // 2. Nur GET-Anfragen cachen (Browser verbieten das Cachen von POST/PUT)
    if (event.request.method !== 'GET') {
        return;
    }

    // 3. Stale-While-Revalidate Strategie für den Rest
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Hole im Hintergrund trotzdem die neuste Version
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Wenn die Antwort gültig ist, aktualisiere den Cache
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic' || networkResponse.type === 'cors') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Kein Internet und Fehler beim Fetch – Fallback wird benötigt (passiert automatisch, falls im Cache)
                console.log('[ServiceWorker] Offline, versuche Cache zu nutzen für:', event.request.url);
            });

            // Liefere sofort den Cache aus, falls vorhanden. Ansonsten warte auf den Fetch.
            return cachedResponse || fetchPromise;
        })
    );
});
