import fs from 'node:fs'
let t=fs.readFileSync('mobile/src/llm.js','utf8')
if(!t.includes('export async function webResearch')){
  t += `
export async function webResearch(prompt, { signal } = {}) {
  const sources = []
  let text = ''
  await streamChatWithTools(
    [
      { role: 'system', content: '你是联网检索助手。必须调用 deepseek_web_search 搜索（需要读具体链接时调用 deepseek_read_url），再根据结果回答。只给事实摘要和关键原文，不要凭记忆编造，尽量列出 URL。' },
      { role: 'user', content: prompt }
    ],
    (d) => {
      text += d
    },
    {
      signal,
      webSearch: true,
      onSources: (list) => {
        for (const x of list || []) {
          const c = x.url_citation || x
          if (c.url) sources.push({ url: c.url, title: c.title || c.url })
        }
      }
    }
  )
  return { text: text.trim(), sources }
}
`
}
fs.writeFileSync('mobile/src/llm.js',t)
let a=fs.readFileSync('mobile/src/api.js','utf8')
a=a.replace("import { chat, streamChat, streamChatWithTools, ocrImage } from './llm.js'", "import { chat, streamChat, streamChatWithTools, ocrImage, webResearch } from './llm.js'")
a=a.replace("            const r = await searchWeb(cfg, args)\n            addSources(r.sources)\n            return JSON.stringify({ results: r.results })", "            const q = String(args?.query || '').trim()\n            if (!q) throw new Error('web_search 缺少 query')\n            const r = await webResearch('请联网搜索并给出与这个问题相关的事实、数据和时间：' + q, { signal: ac.signal })\n            addSources(r.sources)\n            return JSON.stringify({ brief: r.text, sources: r.sources })")
a=a.replace("            const r = await fetchWeb(cfg, args)\n            addSources(r.sources)\n            return JSON.stringify({ title: r.title, url: r.url, content: r.content })", "            const url = String(args?.url || '').trim()\n            if (!/^https?:\\/\\//i.test(url)) throw new Error('web_fetch 需要 http/https 地址')\n            const r = await webResearch('请用 deepseek_read_url 打开并阅读这个网页，提取与用户问题相关的要点：' + url, { signal: ac.signal })\n            addSources([{ url, title: url }, ...(r.sources || [])])\n            return JSON.stringify({ url, content: r.text, sources: r.sources })")
fs.writeFileSync('mobile/src/api.js',a)
console.log('mobile free webResearch', t.includes('export async function webResearch'), a.includes('webResearch('))
