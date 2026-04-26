/**
 * Service Worker for Portugal Vivo PWA v5
 * Features: Network-first caching, offline POI data, push notifications, background sync
 */

const CACHE_NAME = 'portugal-vivo-v6';
const API_CACHE = 'portugal-vivo-api-v6';
const OFFLINE_DATA_CACHE = 'portugal-vivo-offline-v6';
const IMAGE_CACHE = 'portugal-vivo-images-v6';
const NARRATIVE_CACHE = 'portugal-vivo-narrative-v6';
// Map tiles (CARTO basemaps + AWS terrarium DEM). Separate cache because
// tiles are immutable per (z,x,y) so we can keep them long-term and
// purge independently from the rolling app data.
const TILE_CACHE = 'portugal-vivo-tiles-v1';
// Tile cache hard cap (entries). Tiles are ~5-15 KB each so 4000 ≈ 40 MB,
// well below the typical browser quota for a single origin.
const TILE_CACHE_MAX_ENTRIES = 4000;

// Static assets to precache
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

// API endpoints to cache for offline use
const OFFLINE_API_URLS = [
  '/api/stats',
  '/api/categories',
  '/api/regions',
  '/api/heritage?limit=500',
  '/api/routes',
  '/api/calendar',
  '/api/encyclopedia/universes',
  '/api/cp/stations',
  '/api/cp/routes',
  '/api/cp/cards',
];

// Install: precache static assets + offline data
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(PRECACHE_URLS).catch(() => {});
      }),
      // Pre-fetch critical API data for offline
      caches.open(OFFLINE_DATA_CACHE).then(async (cache) => {
        for (const url of OFFLINE_API_URLS) {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (_e) {
            // Best effort - will retry on next activation
          }
        }
      }),
    ]).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches and claim clients
self.addEventListener('activate', (event) => {
  const validCaches = [CACHE_NAME, API_CACHE, OFFLINE_DATA_CACHE, IMAGE_CACHE, NARRATIVE_CACHE, TILE_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => !validCaches.includes(key)).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Heuristic tile-host check. Hostname-based so a future tile provider
// only needs adding the domain here.
function isMapTileRequest(url) {
  const h = url.hostname;
  // CARTO Voyager / Positron / Dark-Matter (no API key required)
  if (h.endsWith('.basemaps.cartocdn.com') || h === 'basemaps.cartocdn.com') return true;
  // AWS Open Data terrarium DEM (used by MapLibre hillshade)
  if (h === 'elevation-tiles-prod.s3.amazonaws.com') return true;
  if (h === 's3.amazonaws.com' && url.pathname.startsWith('/elevation-tiles-prod/')) return true;
  // Generic OSM raster fallback
  if (h === 'tile.openstreetmap.org' || h.endsWith('.tile.openstreetmap.org')) return true;
  return false;
}

// Trim the tile cache when it exceeds the LRU cap. Browsers cap origin
// storage anyway but explicit eviction keeps us well below quota.
async function trimTileCache() {
  try {
    const cache = await caches.open(TILE_CACHE);
    const keys = await cache.keys();
    if (keys.length <= TILE_CACHE_MAX_ENTRIES) return;
    const toDelete = keys.length - TILE_CACHE_MAX_ENTRIES;
    for (let i = 0; i < toDelete; i++) {
      await cache.delete(keys[i]);
    }
  } catch (_e) {
    // best-effort
  }
}

// Fetch: strategy based on request type
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // Map tiles: cache-first with network fallback. Tiles are
  // (z,x,y)-immutable so a hit is always valid; on cache miss we
  // network-fetch + store. Separate cache from images so the user can
  // clear "downloaded regions" without losing avatars/photos.
  if (isMapTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            cache.put(event.request, response.clone()).then(trimTileCache).catch(() => {});
          }
          return response;
        } catch (_e) {
          // No tile available offline. Return empty 504 so MapLibre
          // shows the placeholder instead of throwing.
          return new Response('', { status: 504, statusText: 'Tile unavailable offline' });
        }
      })
    );
    return;
  }

  // Image requests: cache-first with network fallback
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ||
      url.hostname.includes('cloudinary.com') ||
      url.hostname.includes('wikimedia.org') ||
      url.hostname.includes('customer-assets.emergentagent.com')) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => {
            return new Response('', { status: 404 });
          });
        });
      })
    );
    return;
  }

  // Narrative POST requests (/api/narrative): cache by item_id+style key
  if (url.pathname === '/api/narrative' && event.request.method === 'POST') {
    event.respondWith(
      event.request.clone().json().then(async (body) => {
        const narrativeKey = `narrative_${body.item_id}_${body.style || 'storytelling'}`;
        return fetch(event.request)
          .then(async (response) => {
            if (response.ok) {
              const clone = response.clone();
              const cache = await caches.open(NARRATIVE_CACHE);
              // Use a synthetic Request keyed by narrative params
              await cache.put(new Request(narrativeKey), clone);
            }
            return response;
          })
          .catch(async () => {
            // Offline fallback: serve cached narrative if available
            const cache = await caches.open(NARRATIVE_CACHE);
            const cached = await cache.match(new Request(narrativeKey));
            if (cached) return cached;
            return new Response(JSON.stringify({ error: 'offline', message: 'Sem conexao. Narrativa em cache indisponivel.' }), {
              status: 503, headers: { 'Content-Type': 'application/json' },
            });
          });
      }).catch(() => fetch(event.request))
    );
    return;
  }

  // API requests: network-first with offline data fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            // Individual heritage items get 24h cache in OFFLINE_DATA_CACHE
            const isHeritageSingle = /^\/api\/heritage\/[^/]+$/.test(url.pathname);
            const isOfflineEndpoint = OFFLINE_API_URLS.some(u => url.pathname + url.search === u || url.pathname === u.split('?')[0]);
            const cacheName = (isOfflineEndpoint || isHeritageSingle) ? OFFLINE_DATA_CACHE : API_CACHE;
            caches.open(cacheName).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Try offline data cache first, then API cache
          const offlineCached = await caches.open(OFFLINE_DATA_CACHE).then(c => c.match(event.request));
          if (offlineCached) return offlineCached;
          const apiCached = await caches.open(API_CACHE).then(c => c.match(event.request));
          if (apiCached) return apiCached;
          return new Response(JSON.stringify({ error: 'offline', message: 'Sem conexao. Dados em cache indisponiveis.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  // Static assets: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Fallback to index for SPA navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'Portugal Vivo', body: 'Tens uma nova descoberta!' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (_e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/assets/images/icon-192.png',
    badge: '/assets/images/favicon.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'portugal-vivo',
    renotify: true,
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Ver agora' },
      { action: 'dismiss', title: 'Fechar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  if (data.type === 'poi_do_dia' && data.poiId) {
    targetUrl = `/heritage/${data.poiId}`;
  } else if (data.type === 'event_nearby' && data.eventId) {
    targetUrl = `/evento/${data.eventId}`;
  } else if (data.type === 'badge_earned') {
    targetUrl = '/gamification';
  } else if (data.type === 'streak_reminder') {
    targetUrl = '/gamification';
  } else if (data.url) {
    targetUrl = data.url;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Background sync for offline actions (check-ins, reviews, favorites)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-checkins') {
    event.waitUntil(syncOfflineActions('checkins'));
  }
  if (event.tag === 'sync-reviews') {
    event.waitUntil(syncOfflineActions('reviews'));
  }
  if (event.tag === 'sync-favorites') {
    event.waitUntil(syncOfflineActions('favorites'));
  }
});

async function syncOfflineActions(type) {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: `SYNC_${type.toUpperCase()}` });
  });
}

// Periodic background sync for refreshing offline data
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-offline-data') {
    event.waitUntil(refreshOfflineData());
  }
});

async function refreshOfflineData() {
  const cache = await caches.open(OFFLINE_DATA_CACHE);
  for (const url of OFFLINE_API_URLS) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (_e) {
      // Will try again on next periodic sync
    }
  }
}

// Message handler for manual cache refresh from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REFRESH_OFFLINE_DATA') {
    refreshOfflineData().then(() => {
      event.ports[0]?.postMessage({ success: true });
    });
  }
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      event.ports[0]?.postMessage({ success: true });
    });
  }
  // Pre-warm image cache with a list of URLs sent from the app
  if (event.data && event.data.type === 'PREFETCH_IMAGES' && Array.isArray(event.data.urls)) {
    caches.open(IMAGE_CACHE).then(async (cache) => {
      for (const url of event.data.urls) {
        try {
          const already = await cache.match(url);
          if (!already) {
            const response = await fetch(url);
            if (response.ok) await cache.put(url, response);
          }
        } catch (_e) { /* best effort */ }
      }
      event.ports[0]?.postMessage({ success: true, count: event.data.urls.length });
    });
  }
});
