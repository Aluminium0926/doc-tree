import fs from 'node:fs'

// 1) 移动端 handleAsk：超时 + 中止
let a=fs.readFileSync('mobile/src/api.js','utf8')
a=a.replace(
  `  return sseResponse(async (send) => {
    send({ type: 'meta', node })
    try {
      const messages = buildAskMessages({ docs, tree, node, image: pageImage })`,
  `  const ac = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    try { ac.abort() } catch {}
  }, 120000)
  const onAbort = () => ac.abort()
  if (init?.signal) {
    if (init.signal.aborted) ac.abort()
    else init.signal.addEventListener('abort', onAbort, { once: true })
  }

  return sseResponse(async (send) => {
    send({ type: 'meta', node })
    try {
      const messages = buildAskMessages({ docs, tree, node, image: pageImage })`
)
a=a.replace(
  `        {
          model: useModel,
          provider,
          specs: TOOL_SPECS,`,
  `        {
          signal: ac.signal,
          model: useModel,
          provider,
          specs: TOOL_SPECS,`
)
a=a.replace(
  `    } catch (e) {
      node.error = String(e.message || e)
      send({ type: 'error', message: node.error })
    }
    if (node.reasoning) node.reasoning = node.reasoning.slice(0, 6000)`,
  `    } catch (e) {
      if (timedOut) {
        node.error = '请求超时（120 秒），已中止'
        send({ type: 'error', message: node.error })
      } else if (ac.signal.aborted) {
        node.stopped = true
        send({ type: 'stopped' })
      } else {
        node.error = String(e.message || e)
        send({ type: 'error', message: node.error })
      }
    }
    clearTimeout(timeout)
    if (init?.signal) init.signal.removeEventListener('abort', onAbort)
    if (node.reasoning) node.reasoning = node.reasoning.slice(0, 6000)`
)
fs.writeFileSync('mobile/src/api.js',a)

// 2) 移动端直连重试
let l=fs.readFileSync('mobile/src/llm.js','utf8')
if(!l.includes('async function fetchRetry')){
  l=l.replace(
    'async function requestModel(cfg, payload, signal, provider) {',
    `const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchRetry(url, opts, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, opts)
      const retryable = res.status === 429 || [500, 502, 503, 504].includes(res.status)
      if (res.ok || !retryable || attempt >= retries) return res
      const retryAfter = Number(res.headers.get('retry-after')) * 1000
      await sleep(retryAfter > 0 ? retryAfter : 600 * 2 ** attempt)
    } catch (e) {
      if (opts?.signal?.aborted || attempt >= retries || navigator.onLine === false) throw e
      await sleep(600 * 2 ** attempt)
    }
  }
}

async function requestModel(cfg, payload, signal, provider) {`
  )
  l=l.replace(
    "  return fetch(endpointFor(cfg, provider), {",
    "  return fetchRetry(endpointFor(cfg, provider), {"
  )
  fs.writeFileSync('mobile/src/llm.js',l)
}

// 3) Service Worker：外壳网络优先
let s=fs.readFileSync('mobile/sw.js','utf8')
s=s.replace("const CACHE = 'doctree-v2'", "const CACHE = 'doctree-v3'")
s=s.replace(
  `  e.respondWith(
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
  )`,
  `  const shell = e.request.mode === 'navigate' || /\\/(app\\.js|style\\.css|mobile\\.css|theme\\.js|index\\.html)$/.test(url.pathname)
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
  )`
)
fs.writeFileSync('mobile/sw.js',s)
console.log('mobile parity fixes ok')
