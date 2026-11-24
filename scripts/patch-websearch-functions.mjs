import fs from 'node:fs'
let s=fs.readFileSync('server.mjs','utf8')
s=s.replace("import { pptToPdf } from './lib/office.mjs'", "import { pptToPdf } from './lib/office.mjs'\nimport { webToolSpecs, searchWeb, fetchWeb } from './lib/websearch.mjs'")
const old=`        webSearch,
        onWebEvent: (ev) => sse({ type: 'web', status: ev?.status || ev?.type || 'searching' }),
        onSources: (list) => {
          node.sources = (Array.isArray(list) ? list : [])
            .map((a) => {
              const c = a.url_citation || a
              return { url: c.url, title: c.title || c.url }
            })
            .filter((a) => a.url)
          sse({ type: 'web-sources', sources: node.sources })
        },
        exec: (name, args) => execWithPageImages(docs, doc.id, name, args),`
const repl=`        extraTools: webSearch ? webToolSpecs() : [],
        exec: async (name, args) => {
          if (name === 'web_search' && webSearch) {
            sse({ type: 'web', status: 'searching' })
            const r = await searchWeb(cfg, args)
            addSources(r.sources)
            return JSON.stringify({ results: r.results })
          }
          if (name === 'web_fetch' && webSearch) {
            sse({ type: 'web', status: 'reading' })
            const r = await fetchWeb(cfg, args)
            addSources(r.sources)
            return JSON.stringify({ title: r.title, url: r.url, content: r.content })
          }
          return execWithPageImages(docs, doc.id, name, args)
        },`
if(!s.includes(old)) throw new Error('ask options old block missing')
s=s.replace(old,repl)
// define addSources before options / inside try
s=s.replace("  try {\n    const messages = buildAskMessages({ docs, tree, node, image: pageImage, webSearch })", `  const addSources = (list) => {
    const seen = new Set((node.sources || []).map((x) => x.url))
    for (const a of Array.isArray(list) ? list : []) {
      const c = a.url_citation || a
      if (!c.url || seen.has(c.url)) continue
      seen.add(c.url)
      ;(node.sources ||= []).push({ url: c.url, title: c.title || c.url })
    }
    if (node.sources?.length) sse({ type: 'web-sources', sources: node.sources })
  }

  try {
    const messages = buildAskMessages({ docs, tree, node, image: pageImage, webSearch })`)
fs.writeFileSync('server.mjs',s)
console.log('server web functions', s.includes('extraTools: webSearch'), s.includes('addSources'))
