// 尋寶獵人 PWA Service Worker
// 策略：cache-first（離線優先），首次安裝預先抓所有靜態資源
// 升級時 bump CACHE_VERSION 即可強制重新下載

const CACHE_VERSION = 'treasure-hunt-v8';
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './vendor/tailwind.min.js',
  './vendor/qrcode.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
  // 注意：vendor/html5-qrcode.min.js 只有 admin 用，動態快取
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
  // 不要快取後端 API 請求
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (resp.ok && new URL(event.request.url).origin === self.location.origin) {
          const respClone = resp.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, respClone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
