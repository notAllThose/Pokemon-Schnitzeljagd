const CACHE = 'entdeckertour-v7';
const spriteNames = ['pikachu','glumanda','schiggy','bulbasaur','raupy','piepi','zubat'];
const sprites = spriteNames.flatMap(name => [`./assets/sprites/${name}.png`, `./assets/sprites/${name}-front.gif`, `./assets/sprites/${name}-back.gif`]);
const pokemonIds = [1, 4, 7, 10, 25, 35, 41];
const cries = pokemonIds.map(id => `./assets/cries/${id}.ogg`);
const backgrounds = ['forest', 'garden', 'cave'].map(name => `./assets/backgrounds/${name}.svg`);
const FILES = ['./manifest.webmanifest', ...sprites, ...cries, ...backgrounds];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('entdeckertour-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', event => event.respondWith((async () => {
  // Trainerprofile sind zentral und dürfen nie aus einem Offline-Cache kommen.
  if (new URL(event.request.url).pathname.startsWith('/api/')) return fetch(event.request);
  const cache = await caches.open(CACHE);
  const isSameOrigin = new URL(event.request.url).origin === self.location.origin;
  if (event.request.mode === 'navigate') {
    try {
      const response = await fetch(event.request);
      if (isSameOrigin) await cache.put(event.request, response.clone());
      return response;
    } catch {
      return (await cache.match(event.request)) ?? (await cache.match('./'));
    }
  }
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (event.request.method === 'GET' && isSameOrigin) await cache.put(event.request, response.clone());
  return response;
})()));
