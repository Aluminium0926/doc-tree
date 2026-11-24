import fs from 'node:fs'
let a=fs.readFileSync('mobile/src/api.js','utf8')
a=a.replace("import { chat, streamChat, streamChatWithTools, ocrImage } from './llm.js'", "import { chat, streamChat, streamChatWithTools, ocrImage } from './llm.js'\nimport { webToolSpecs, searchWeb, fetchWeb } from './websearch.js'")
const start=a.indexOf("        {\n          signal: ac.signal,\n          model: useModel,\n          provider,\n          webSearch,")
const end=a.indexOf("          onTool: (t) => send({ type: 'tool'", start)
if(start<0||end<0) throw new Error('mobile block')
const block=`        {
          signal: ac.signal,
          model: useModel,
          provider,
          specs: webSearch ? [...TOOL_SPECS, ...webToolSpecs()] : TOOL_SPECS,
          exec: async (name, args) => {
            if (name === 'web_search' && webSearch) {
              send({ type: 'web', status: 'searching' })
              const r = await searchWeb(cfg, args)
              addSources(r.sources)
              return JSON.stringify({ results: r.results })
            }
            if (name === 'web_fetch' && webSearch) {
              send({ type: 'web', status: 'reading' })
              const r = await fetchWeb(cfg, args)
              addSources(r.sources)
              return JSON.stringify({ title: r.title, url: r.url, content: r.content })
            }
            return execWithPageImage(docs, doc.id, name, args)
          },
`
a=a.slice(0,start)+block+a.slice(end)
// addSources helper before try in sseResponse
a=a.replace("  return sseResponse(async (send) => {\n    send({ type: 'meta', node })\n    try {", `  const addSources = (list) => {
    const seen = new Set((node.sources || []).map((x) => x.url))
    for (const x of Array.isArray(list) ? list : []) {
      const c = x.url_citation || x
      if (!c.url || seen.has(c.url)) continue
      seen.add(c.url)
      ;(node.sources ||= []).push({ url: c.url, title: c.title || c.url })
    }
    if (node.sources?.length) send({ type: 'web-sources', sources: node.sources })
  }

  return sseResponse(async (send) => {
    send({ type: 'meta', node })
    try {`)
fs.writeFileSync('mobile/src/api.js',a)
console.log('mobile web functions', a.includes('webToolSpecs()'), a.includes('addSources'))
