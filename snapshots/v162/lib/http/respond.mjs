// HTTP 响应工具：所有路由统一走这里，避免手写 writeHead 时漏掉类型/长度
export function json(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  })
  res.end(body)
}

export function text(res, code, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8')
  res.writeHead(code, { 'content-length': buf.length, ...headers })
  res.end(buf)
}

export const SSE_HEADERS = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
  connection: 'keep-alive',
  'x-accel-buffering': 'no'
}

export function openSSE(res) {
  res.writeHead(200, SSE_HEADERS)
  res.write(': ok\n\n') // 立刻把响应头刷给客户端，避免首字前的空窗
  if (typeof res.flushHeaders === 'function') res.flushHeaders()
  const send = (obj) => {
    if (res.writableEnded || res.destroyed) return
    try {
      res.write(`data: ${JSON.stringify(obj)}\n\n`)
    } catch {}
  }
  const comments = setInterval(() => {
    if (res.writableEnded || res.destroyed) return clearInterval(comments)
    try {
      res.write(': ping\n\n')
    } catch {}
  }, 15000)
  send.close = () => clearInterval(comments)
  return send
}
