// DeepSeek 官方 Search / Fetch API：作为普通工具使用，可与 read_page 等本地工具同轮调用
// 计费：每 1000 次成功请求约 5 元（以官方账单为准）。
const SEARCH_PATH = '/v1/tools/search'
const FETCH_PATH = '/v1/tools/fetch'

function originOf(baseUrl) {
  try {
    return new URL(String(baseUrl || 'https://api.deepseek.com')).origin
  } catch {
    return 'https://api.deepseek.com'
  }
}

async function postJson(url, key, body, timeoutMs = 20000) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + key,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: ac.signal
    })
    const text = await res.text()
    if (!res.ok) {
      let msg = text
      try {
        msg = JSON.parse(text)?.error?.message || text
      } catch {}
      throw new Error('DeepSeek 搜索接口 ' + res.status + '：' + String(msg).slice(0, 240))
    }
    return JSON.parse(text)
  } finally {
    clearTimeout(timer)
  }
}

export function webToolSpecs() {
  return [
    {
      type: 'function',
      function: {
        name: 'web_search',
        description:
          '联网搜索实时网页。需要最新新闻、价格、天气、版本发布等外部信息时调用。可以和 read_page / search_docs 在同一轮回答里混用。返回标题、URL、摘要、日期。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索词，1-128 字，支持 site: after: 等操作符' },
            count: { type: 'integer', description: '结果数量，1-10，默认 5' }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'web_fetch',
        description:
          '读取一个网页并返回 Markdown 正文。适合在 web_search 找到链接后深入阅读。可以和本地文档工具同轮混用。',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'http/https 网页地址' }
          },
          required: ['url']
        }
      }
    }
  ]
}

export async function searchWeb(cfg, args) {
  const query = String(args?.query || '').trim()
  if (!query) throw new Error('web_search 缺少 query')
  const count = Math.max(1, Math.min(10, Number(args?.count) || 5))
  const origin = originOf(cfg.baseUrl)
  const data = await postJson(origin + SEARCH_PATH, cfg.apiKey, {
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
  return {
    results,
    sources: results.map((r) => ({ url: r.url, title: r.title || r.url })).filter((x) => x.url)
  }
}

export async function fetchWeb(cfg, args) {
  const url = String(args?.url || '').trim()
  if (!/^https?:\/\//i.test(url)) throw new Error('web_fetch 需要 http/https 地址')
  const origin = originOf(cfg.baseUrl)
  const data = await postJson(origin + FETCH_PATH, cfg.apiKey, { url })
  return {
    title: data?.title || '',
    url,
    content: String(data?.content || '').slice(0, 12000),
    sources: [{ url, title: data?.title || url }]
  }
}
