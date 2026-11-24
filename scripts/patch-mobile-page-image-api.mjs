import fs from 'node:fs'
const F='mobile/src/api.js'
let t=fs.readFileSync(F,'utf8')
if(!t.includes('async function execWithPageImage')){
  t=t.replace(
    'async function handleAsk(init) {',
    `async function execWithPageImage(docs, docId, name, args) {
  const out = await execTool(docs, docId, name, args)
  if (name === 'read_page' && args && args.page) {
    try {
      const img = await globalThis.__dtPageImage?.(Number(args.page))
      if (img) return { text: out, image: img }
    } catch {}
  }
  return out
}

async function handleAsk(init) {`
  )
}
t=t.replace(
  `  const useModel = body.image ? cfg.visionModel || cfg.model : cfg.model
  const provider = body.image
    ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat }
    : null`,
  `  let pageImage = body.image || null
  if (!pageImage && doc.kind === 'pdf') {
    try {
      pageImage = await globalThis.__dtPageImage?.(body.anchor?.page || 1)
    } catch {}
  }
  const useModel = pageImage ? cfg.visionModel || cfg.model : cfg.model
  const provider = pageImage
    ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat || cfg.apiFormat }
    : null`
)
t=t.replace("const messages = buildAskMessages({ docs, tree, node, image: body.image })", "const messages = buildAskMessages({ docs, tree, node, image: pageImage })")
t=t.replace("exec: (name, args) => execTool(docs, doc.id, name, args),", "exec: (name, args) => execWithPageImage(docs, doc.id, name, args),")

// resume
t=t.replace(
  "    const messages = buildAskMessages({ docs, tree, node })\n    messages.push({ role: 'assistant'",
  `    let resumeImage = null
    if (doc.kind === 'pdf') {
      try {
        resumeImage = await globalThis.__dtPageImage?.(node.anchor?.page || 1)
      } catch {}
    }
    const messages = buildAskMessages({ docs, tree, node, image: resumeImage })
    messages.push({ role: 'assistant'`
)
t=t.replace(
  "            model: node.model || cfg.model,\n            specs: TOOL_SPECS,\n            exec: (name, args) => execTool(docs, doc.id, name, args),",
  "            model: resumeImage ? cfg.visionModel || node.model || cfg.model : node.model || cfg.model,\n            provider: resumeImage\n              ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat || cfg.apiFormat }\n              : null,\n            specs: TOOL_SPECS,\n            exec: (name, args) => execWithPageImage(docs, doc.id, name, args),"
)
fs.writeFileSync(F,t)
console.log('mobile page image ask ok')
