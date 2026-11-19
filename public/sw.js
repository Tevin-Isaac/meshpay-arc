// WayaMesh service worker: keeps the app usable with no connection.
// Strategy: network first, fall back to the last cached copy.
const CACHE = 'wayamesh-shell-v2'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icon.svg']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return
  const sameOrigin = url.origin === self.location.origin
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!sameOrigin && !isFont) return
  // Never cache API calls or anything that is not a plain page asset.
  if (sameOrigin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/'))) return

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && (res.type === 'basic' || isFont)) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(req, copy))
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(req)
        if (cached) return cached
        if (req.mode === 'navigate') {
          const shell = await caches.match('/')
          if (shell) return shell
        }
        return Response.error()
      }),
  )
})
