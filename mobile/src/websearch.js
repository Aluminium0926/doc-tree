// 移动端：DeepSeek 官方 Search / Fetch API（按次计费）
const SEARCH_PATH = '/v1/tools/search'
const FETCH_PATH = '/v1/tools/fetch'

function originOf(baseUrl) {
  try {
    return new URL(String(baseUrl || 'https://api.deepseek.com')).origin
  } catch {
    return 'https://api.deepseek.com'
  }
}

async function postJson(url, key, body) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 20000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal
    })
    const text = await res.text()
    if (!res.ok) {
      let msg = text
      try {
        msg = JSON.parse(text)?.error?.message || text
      } catch {}
      throw new Error('DeepSeek 搜索接口 ' + res.status + '：' + String(msg).slice(0, 200))
    }
    return JSON.parse(text)
  } finally {
    clearTimeout(timer)
  }
}

export function webToolSpecs() {
  return [
    {
      name: 'web_search',
      description: '联网搜索实时网页；可与 read_page/search_docs 在同一轮混用。返回标题、URL、摘要、日期。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索词，支持 site: after: 等操作符' },
          count: { type: 'integer', description: '1-10，默认 5' }
        },
        required: ['query']
      }
    },
    {
      name: 'web_fetch',
      description: '读取网页并返回 Markdown 正文。',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url']
      }
    }
  ]
}

export async function searchWeb(cfg, args) {
  const query = String(args?.query || '').trim()
  if (!query) throw new Error('web_search 缺少 query')
  const count = Math.max(1, Math.min(10, Number(args?.count) || 5))
  const data = await postJson(originOf(cfg.baseUrl) + SEARCH_PATH, cfg.apiKey, {
    query: query.slice(0, 128),
    count,
    need_content: true
  })
  const results = (Array.isArray(data?.results) ? data.results : []).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    site: r.site_name || '',
    date: r.date || '',
    snippet: r.snippet || '',
    summary: r.summary || '',
    content: String(r.content || '').slice(0, 6000)
  }))
  return { results, sources: results.map((r) => ({ url: r.url, title: r.title || r.url })).filter((x) => x.url) }
}

export async function fetchWeb(cfg, args) {
  const url = String(args?.url || '').trim()
  if (!/^https?:\/\//i.test(url)) throw new Error('web_fetch 需要 http/https 地址')
  const data = await postJson(originOf(cfg.baseUrl) + FETCH_PATH, cfg.apiKey, { url })
  return {
    title: data?.title || '',
    url,
    content: String(data?.content || '').slice(0, 12000),
    sources: [{ url, title: data?.title || url }]
  }
}
