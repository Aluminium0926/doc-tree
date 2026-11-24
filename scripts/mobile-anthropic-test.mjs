import http from 'node:http'
import puppeteer from 'puppeteer-core'

const seen = []
const srv = http.createServer((req, res) => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'POST,OPTIONS'
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    return res.end()
  }
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    let j = {}
    try {
      j = JSON.parse(body)
    } catch {}
    seen.push({ url: req.url, key: req.headers['x-api-key'], ver: req.headers['anthropic-version'], model: j.model, stream: j.stream, system: Boolean(j.system), hasImage: JSON.stringify(j.messages || '').includes('"type":"image"') })
    res.writeHead(200, { ...cors, 'content-type': 'text/event-stream' })
    res.write('event: x\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"你好"}}\n\n')
    res.end('event: x\ndata: {"type":"message_stop"}\n\n')
  })
})
await new Promise((r) => srv.listen(4401, '127.0.0.1', r))

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))

await page.goto('http://127.0.0.1:4501/', { waitUntil: 'networkidle2' })
await page.evaluate(() => {
  localStorage.setItem('dt:config', JSON.stringify({
    baseUrl: 'http://127.0.0.1:4401/v1',
    apiKey: 'ak-m',
    model: 'claude-m',
    apiFormat: 'anthropic',
    visionModel: 'claude-v',
    visionBaseUrl: 'http://127.0.0.1:4401/v1',
    visionFormat: 'anthropic',
    effort: 'low',
    temperature: 0.3
  }))
  localStorage.setItem('dt:seenWelcome', '1')
})
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 600))

const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/code-test.md')
await page.waitForSelector('.sheet', { timeout: 20000 })
await new Promise((r) => setTimeout(r, 800))

const ask = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const docId = st.docs[0].id
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docId, anchor: { kind: 'doc', page: 1, quote: 'x' }, question: '解释' })
  })
  const text = await res.text()
  return { text: text.slice(0, 400), ok: res.ok }
})
const vision = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      docId: st.docs[0].id,
      anchor: { kind: 'doc', page: 1, quote: 'x' },
      question: '看图',
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    })
  })
  return res.status
})
console.log(JSON.stringify({ askOk: ask.ok, hasDelta: ask.text.includes('你好'), seen, visionStatus: vision, errs: errs.slice(0, 2) }))
await browser.close()
srv.close()
