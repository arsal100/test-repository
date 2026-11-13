
/*
 * Service Worker — Aramex Gate House Register
 * GitHub Pages: /aramex-gatehouse-system/
 *
 * IMPORTANT:
 * Whenever you publish a new app version, change CACHE_NAME.
 * Example: aramex-gatehouse-v1 -> aramex-gatehouse-v2
 */

const APP_ROOT = '/aramex-gatehouse-system/';
const CACHE_NAME = 'aramex-gatehouse-v1';

// Main application files to cache for offline access.
const APP_SHELL = [
  APP_ROOT,
  `${APP_ROOT}index.html`,
  `${APP_ROOT}manifest.json`,
  `${APP_ROOT}icon-192.png`,
  `${APP_ROOT}icon-512.png`
];

// INSTALL: Cache the application shell.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    await Promise.all(
      APP_SHELL.map(async (path) => {
        try {
          const response = await fetch(path, {
            cache: 'reload'
          });

          if (response.ok) {
            await cache.put(path, response);
          }
        } catch (error) {
          console.warn(
            '[Aramex SW] Could not cache:',
            path,
            error
          );
        }
      })
    );

    await self.skipWaiting();
  })());
});

// ACTIVATE: Remove old application caches.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames.map((name) => {
        if (
          name.startsWith('aramex-gatehouse-') &&
          name !== CACHE_NAME
        ) {
          return caches.delete(name);
        }
      })
    );

    await self.clients.claim();
  })());
});

// Exclude Firebase, authentication, APIs and external resources.
function shouldBypass(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  return (
    url.origin !== self.location.origin ||
    /firebase|firestore|identitytoolkit|securetoken|\/api(?:\/|$)/i
      .test(host + path)
  );
}

// Identify static files.
function isStaticAsset(request, url) {
  return (
    ['style', 'script', 'image', 'font'].includes(
      request.destination
    ) ||
    /\.(css|js|mjs|png|jpg|jpeg|svg|webp|ico|woff2?|ttf|otf)$/i
      .test(url.pathname)
  );
}

// FETCH: Network-first for HTML, cache-first for static assets.
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Leave Firebase, APIs and external resources untouched.
  if (shouldBypass(url)) return;

  // HTML navigation: NETWORK FIRST.
  if (
    request.mode === 'navigate' ||
    request.destination === 'document'
  ) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);

          await cache.put(
            `${APP_ROOT}index.html`,
            response.clone()
          );
        }

        return response;

      } catch (error) {
        // Use cached application when offline.
        return (
          await caches.match(request) ||
          await caches.match(`${APP_ROOT}index.html`) ||
          await caches.match(APP_ROOT) ||
          new Response(
            'You are offline. Aramex Gate House Register is unavailable.',
            {
              status: 503,
              headers: {
                'Content-Type': 'text/plain'
              }
            }
          )
        );
      }
    })());

    return;
  }

  // Static assets: CACHE FIRST.
  if (isStaticAsset(request, url)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);

      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (
          response.ok &&
          response.type === 'basic'
        ) {
          const cache = await caches.open(CACHE_NAME);

          await cache.put(
            request,
            response.clone()
          );
        }

        return response;

      } catch (error) {
        return new Response(
          '',
          {
            status: 504,
            statusText: 'Offline asset unavailable'
          }
        );
      }
    })());
  }
});
