// SSE 分帧：服务端每帧是 `data: {json}\n\n`
export async function readSSE(res, onEvent, { signal } = {}) {
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let closed = false
  signal?.addEventListener('abort', () => {
    closed = true
    try {
      reader.cancel().catch(() => {})
    } catch {}
  })
  while (!closed) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i)
      buf = buf.slice(i + 2)
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data) continue
        try {
          onEvent(JSON.parse(data))
        } catch {}
      }
    }
  }
}
