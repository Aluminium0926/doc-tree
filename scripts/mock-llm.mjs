// 本地假模型端点，用于在拿到真实 key 之前验证：SSE 流式、树结构、追问链路
import http from 'node:http'

const PORT = 4318

function tokenize(text) {
  // 每 6 个字一切，模拟流式
  const out = []
  for (let i = 0; i < text.length; i += 6) out.push(text.slice(i, i + 6))
  return out
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ data: [{ id: 'mock' }] }))
  }

  let body = ''
  for await (const c of req) body += c
  const payload = JSON.parse(body || '{}')
  const msgs = payload.messages || []
  const userMsg = msgs.find((m) => m.role === 'user')
  const text = typeof userMsg?.content === 'string' ? userMsg.content : JSON.stringify(userMsg?.content || '')

  const quoteMatch = text.match(/我选中了（第 (\d+) 页）：「([\s\S]{0,80})」/)
  const qMatch = text.match(/我的问题：([\s\S]*?)$/)
  const q = (qMatch?.[1] || '').trim().slice(0, 60)

  const answer =
    `**结论**：这是模拟回答，用于验证链路。\n\n` +
    `你这个问题的关键词是「${q || '（空）'}」。` +
    (quoteMatch ? `\n\n你选中的是第 ${quoteMatch[1]} 页的内容，开头为「${quoteMatch[2].slice(0, 24)}」。` : '') +
    `\n\n- 第一层：原文在讲什么\n- 第二层：为什么这样讲\n- 第三层：它在全文里的作用\n\n` +
    `> 接上真实模型后，这里会是基于全文摘要与相关段落的讲解。`

  if (!payload.stream) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(
      JSON.stringify({ choices: [{ message: { role: 'assistant', content: '（模拟摘要）这是一份用于测试的文档摘要。' } }] })
    )
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive'
  })

  for (const piece of tokenize(answer)) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`)
    await new Promise((r) => setTimeout(r, 35))
  }
  res.write('data: [DONE]\n\n')
  res.end()
})

server.listen(PORT, '127.0.0.1', () => console.log('mock llm on', PORT))
