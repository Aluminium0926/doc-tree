import fs from 'node:fs'
let s=fs.readFileSync('server.mjs','utf8')
const needle=`      {
        signal: ac.signal,
        model: useModel,
        provider,
        exec: (name, args) => execWithPageImages(docs, doc.id, name, args),`
const repl=`      {
        signal: ac.signal,
        model: useModel,
        provider,
        webSearch,
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
if(!s.includes(needle)) throw new Error('needle missing')
s=s.replace(needle,repl)
fs.writeFileSync('server.mjs',s)
console.log('ask web options added')
