import fs from 'node:fs'
let s = fs.readFileSync('server.mjs', 'utf8')
s = s.replace("import { buildAskMessages, buildSummaryMessages, treeToMarkdown, execTool } from './lib/context.mjs'", "import { buildAskMessages, buildSummaryMessages, treeToMarkdown, execTool } from './lib/context.mjs'\nimport { renderPageImage } from './lib/render.mjs'")

// handleAsk: 先渲染当前页，再决定模型
s = s.replace(
  "  const tree = await store.getTree(body.docId)\n  const id = crypto.randomBytes(6).toString('hex')\n  const useModel = body.image ? cfg.visionModel || cfg.model : cfg.model\n  const provider = body.image",
  `  const tree = await store.getTree(body.docId)
  const id = crypto.randomBytes(6).toString('hex')
  let pageImage = body.image || null
  if (!pageImage && doc.kind === 'pdf') {
    try {
      pageImage = await renderPageImage(doc, body.anchor?.page || 1)
    } catch (e) {
      console.warn('[render]', e && e.message)
    }
  }
  const hasImage = Boolean(pageImage)
  const useModel = hasImage ? cfg.visionModel || cfg.model : cfg.model
  const provider = hasImage`
)
s = s.replace(
  "  const provider = hasImage\n    ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat }",
  "  const provider = hasImage\n    ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat }"
)
s = s.replace(
  "    const messages = buildAskMessages({ docs, tree, node, image: body.image })",
  "    const messages = buildAskMessages({ docs, tree, node, image: pageImage })"
)

// resume 也带当前页图
s = s.replace(
  "  const messages = buildAskMessages({ doc, docs, tree, node })",
  `  let resumeImage = null
  if (doc.kind === 'pdf') {
    try {
      resumeImage = await renderPageImage(doc, node.anchor?.page || 1)
    } catch {}
  }
  const messages = buildAskMessages({ doc, docs, tree, node, image: resumeImage })`
)
s = s.replace(
  "        model: node.model || cfg.model,\n        exec: (name, args) => execTool(docs, doc.id, name, args),",
  "        model: resumeImage ? cfg.visionModel || node.model || cfg.model : node.model || cfg.model,\n        provider: resumeImage\n          ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat }\n          : null,\n        exec: (name, args) => execTool(docs, doc.id, name, args),"
)
fs.writeFileSync('server.mjs', s)
console.log('server page image ok')
