// 尋寶獵人 PWA Service Worker
// 策略：cache-first（離線優先），首次安裝預先抓所有靜態資源
// 升級時 bump CACHE_VERSION 即可強制重新下載

const CACHE_VERSION = 'treasure-hunt-v24';
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './vendor/tailwind.min.js',
  './vendor/qrcode.min.js',
  './vendor/html5-qrcode.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  if (event.request.url.includes('script.google.com')) return;

  const url = new URL(event.request.url);
  // HTML / 根目錄 → 「網路優先」，永遠抓最新版（避免手機卡舊版）
  const isHTML = url.pathname.endsWith('.html') || url.pathname.endsWith('/') ||
                 url.pathname === '' || event.request.mode === 'navigate';

  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          if (resp.ok && url.origin === self.location.origin) {
            const cloned = resp.clone();
            caches.open(CACHE_VERSION).then(c => c.put(event.request, cloned));
          }
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // 其他靜態資源 → 快取優先，速度第一
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp.ok && url.origin === self.location.origin) {
            const cloned = resp.clone();
            caches.open(CACHE_VERSION).then(c => c.put(event.request, cloned));
          }
          return resp;
        }).catch(() => cached);
      })
    );
  }
});
