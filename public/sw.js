const CACHE_NAME = 'ace-field-shell-v2'
const APP_SHELL = [
  '/field',
  '/field/jobs',
  '/field/activity',
  '/field/settings',
  '/manifest.webmanifest',
  '/ace-logo-global.png',
]

const STATIC_PATH_PREFIXES = ['/_next/static/', '/icons/']
const STATIC_EXTENSIONS = [
  '.css',
  '.js',
  '.mjs',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.webmanifest',
]

function isApiOrAuthPath(pathname) {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/logout')
  )
}

function isStaticCacheablePath(pathname) {
  if (APP_SHELL.includes(pathname)) return true
  if (STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))
}

function isDataRequest(request, url) {
  return (
    url.pathname.startsWith('/_next/data/') ||
    url.searchParams.has('__nextDataReq') ||
    request.headers.has('rsc') ||
    request.headers.has('next-router-state-tree') ||
    request.headers.has('next-router-prefetch')
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined)
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isApiOrAuthPath(url.pathname)) return
  if (isDataRequest(request, url)) return

  if (request.mode === 'navigate') {
    if (!url.pathname.startsWith('/field')) return

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined)
          }
          return response
        })
        .catch(async () => {
          const cachedRoute = (await caches.match(request)) ?? (await caches.match(url.pathname))
          if (cachedRoute) return cachedRoute
          return caches.match('/field/jobs')
        })
    )
    return
  }

  if (!isStaticCacheablePath(url.pathname)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined)
          }
          return response
        })
        .catch(() => Response.error())
    })
  )
})
