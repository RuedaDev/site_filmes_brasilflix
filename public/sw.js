const CACHE_NAME = 'brasilflix-v1';
const urlsToCache = [
  '/',
  '/homepage-1.html',
  '/css/extras.css',
  '/js/extras.js',
  '/js/brasilflix.js',
  // Adicione outros recursos essenciais
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});