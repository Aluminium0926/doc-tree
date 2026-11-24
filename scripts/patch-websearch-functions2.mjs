import fs from 'node:fs'
let s=fs.readFileSync('server.mjs','utf8')
const start=s.indexOf("      {\n        signal: ac.signal,\n        model: useModel,\n        provider,\n        webSearch,")
const end=s.indexOf("        onTool: (t) => sse({ type: 'tool'", start)
if(start<0||end<0) throw new Error('block not found')
const block=`      {
        signal: ac.signal,
        model: useModel,
        provider,
        extraTools: webSearch ? webToolSpecs() : [],
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
        },
`
s=s.slice(0,start)+block+s.slice(end)
fs.writeFileSync('server.mjs',s)
console.log('ask block replaced', s.includes('extraTools: webSearch ? webToolSpecs()'))
