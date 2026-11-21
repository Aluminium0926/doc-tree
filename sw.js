// 离线缓存：应用外壳优先缓存，接口与模型代理走网络
const CACHE = 'doctree-v3'
const SHELL = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './mobile.css',
  './icon.svg',
  './manifest.webmanifest',
  './vendor/pdf.min.mjs',
  './vendor/pdf.worker.wrapper.mjs',
  './vendor/pdf.worker.min.mjs',
  './vendor/marked.esm.js',
  './vendor/mammoth.browser.min.js'
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  if (url.pathname.startsWith('/proxy/') || url.pathname.startsWith('/api/')) return
  if (url.origin !== location.origin) return

  const shell = e.request.mode === 'navigate' || /\/(app\.js|style\.css|mobile\.css|theme\.js|index\.html)$/.test(url.pathname)
  if (shell) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, copy))
          }
          return res
        })
        .catch(() => caches.match(e.request))
    )
    return
  }

  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit
      return fetch(e.request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, copy))
        }
        return res
      })
    })
  )
})
