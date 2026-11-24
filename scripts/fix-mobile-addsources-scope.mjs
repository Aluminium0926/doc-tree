import fs from 'node:fs'
let a=fs.readFileSync('mobile/src/api.js','utf8')
const block=`  const addSources = (list) => {
    const seen = new Set((node.sources || []).map((x) => x.url))
    for (const x of Array.isArray(list) ? list : []) {
      const c = x.url_citation || x
      if (!c.url || seen.has(c.url)) continue
      seen.add(c.url)
      ;(node.sources ||= []).push({ url: c.url, title: c.title || c.url })
    }
    if (node.sources?.length) send({ type: 'web-sources', sources: node.sources })
  }

`
if(!a.includes(block)) throw new Error('block missing')
a=a.replace(block,'')
a=a.replace("  return sseResponse(async (send) => {\n    send({ type: 'meta', node })\n    try {", "  return sseResponse(async (send) => {\n    send({ type: 'meta', node })\n    const addSources = (list) => {\n      const seen = new Set((node.sources || []).map((x) => x.url))\n      for (const x of Array.isArray(list) ? list : []) {\n        const c = x.url_citation || x\n        if (!c.url || seen.has(c.url)) continue\n        seen.add(c.url)\n        ;(node.sources ||= []).push({ url: c.url, title: c.title || c.url })\n      }\n      if (node.sources?.length) send({ type: 'web-sources', sources: node.sources })\n    }\n    try {")
fs.writeFileSync('mobile/src/api.js',a)
console.log('addSources scoped', a.includes("const addSources = (list) => {\n      const seen"))
