import fs from 'node:fs'
let t=fs.readFileSync('lib/llm.mjs','utf8')
if(!t.includes('export async function webResearch')){
  t += `
export async function webResearch(prompt, { signal } = {}) {
  const sources = []
  let text = ''
  await streamChatWithTools(
    [
      {
        role: 'system',
        content:
          '你是联网检索助手。必须调用 deepseek_web_search 搜索（需要读具体链接时调用 deepseek_read_url），再根据检索结果回答。只给事实摘要和关键原文，不要凭记忆编造。尽量列出可引用的 URL。'
      },
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
fs.writeFileSync('lib/llm.mjs',t)
console.log('webResearch desktop', t.includes('export async function webResearch'))
