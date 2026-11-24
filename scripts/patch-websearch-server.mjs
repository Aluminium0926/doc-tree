import fs from 'node:fs'
let c=fs.readFileSync('lib/context.mjs','utf8')
c=c.replace("export function buildAskMessages({ doc, docs, tree, node, image }) {", "export function buildAskMessages({ doc, docs, tree, node, image, webSearch }) {")
c=c.replace(
  "  volatile.push(`【本轮要求】\\n${modeRules}${groupRule}`)",
  "  if (webSearch) volatile.push('【本轮已开启联网搜索】需要最新信息时可以直接联网搜索并阅读链接；本轮不能调用本地文档工具。回答涉及网上信息时请标注来源。')\n  volatile.push(`【本轮要求】\\n${modeRules}${groupRule}`)"
)
fs.writeFileSync('lib/context.mjs',c)

let s=fs.readFileSync('server.mjs','utf8')
s=s.replace(
  "  const hasImage = Boolean(pageImage)\n  const useModel = hasImage ? cfg.visionModel || cfg.model : cfg.model",
  `  const hasImage = Boolean(pageImage)
  const webSearch = Boolean(body.web)
  if (webSearch && !/deepseek\\.com/i.test(String(cfg.baseUrl))) {
    return json(res, 400, { error: '联网搜索仅支持 DeepSeek 官方接口' })
  }
  const useModel = hasImage ? cfg.visionModel || cfg.model : cfg.model`
)
s=s.replace(
  "    const messages = buildAskMessages({ docs, tree, node, image: pageImage })",
  "    const messages = buildAskMessages({ docs, tree, node, image: pageImage, webSearch })"
)
s=s.replace(
  `        exec: (name, args) => execWithPageImages(docs, doc.id, name, args),
        onTool: (t) => sse({ type: 'tool', name: t.name, args: t.args }),`,
  `        webSearch,
        onWebEvent: (ev) => sse({ type: 'web', status: ev?.status || ev?.type || 'searching' }),
        onSources: (list) => {
          node.sources = (Array.isArray(list) ? list : [])
            .map((a) => ({ url: a.url, title: a.title || a.url }))
            .filter((a) => a.url)
          sse({ type: 'web-sources', sources: node.sources })
        },
        exec: (name, args) => execWithPageImages(docs, doc.id, name, args),
        onTool: (t) => sse({ type: 'tool', name: t.name, args: t.args }),`
)
s=s.replace(
  `    if (usage) {
      node.usage = usage
      sse({ type: 'usage', usage })
    }
    node.status = 'done'`,
  `    if (usage) {
      node.usage = usage
      sse({ type: 'usage', usage })
    }
    if (node.sources?.length) {
      const seen = new Set()
      const uniq = node.sources.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)))
      const extra = '\\n\\n---\\n**来源**\\n' + uniq.map((x) => \`- [\${x.title || x.url}](\${x.url})\`).join('\\n')
      node.answer += extra
      sse({ type: 'delta', text: extra })
    }
    node.status = 'done'`
)
fs.writeFileSync('server.mjs',s)
console.log('server web search ok')
