// 本地 API 客户端：所有请求统一带上客户端标识（服务端用它挡住跨站 CSRF）
export const CLIENT_ID = 'doc-tree-web'

export const fileUrl = (id) => `/api/file/${id}`
export const exportUrl = (id) => `/api/export/${id}`

export async function apiFetch(url, opts = {}) {
  const headers = { 'x-doctree-client': CLIENT_ID, ...(opts.headers || {}) }
  return fetch(url, { ...opts, headers })
}

export async function apiJson(url, { method = 'GET', body, headers, timeout = 30000 } = {}) {
  const opts = { method, headers: { ...headers } }
  if (body !== undefined) {
    opts.body = JSON.stringify(body)
    opts.headers['content-type'] = 'application/json'
  }
  if (timeout) opts.signal = AbortSignal.timeout(timeout)
  const res = await apiFetch(url, opts)
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {}
  if (!res.ok) throw new Error(data?.error || `请求失败 ${res.status}`)
  return data
}

// 流式接口：返回原始 Response，由 modules/sse.js 读事件
export async function apiStream(url, body, { signal } = {}) {
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
  if (!res.ok) {
    let msg = `请求失败 ${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(msg)
  }
  return res
}

export async function uploadFile(file) {
  return apiFetch('/api/import', {
    method: 'POST',
    headers: { 'x-filename': encodeURIComponent(file.name) },
    body: await file.arrayBuffer()
  })
}
