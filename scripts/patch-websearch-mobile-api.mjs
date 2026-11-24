import fs from 'node:fs'
let a=fs.readFileSync('mobile/src/api.js','utf8')
a=a.replace(
  "  const useModel = pageImage ? cfg.visionModel || cfg.model : cfg.model",
  "  if (body.web && !/deepseek\\.com/i.test(String(cfg.baseUrl))) {\n    return json({ error: '联网搜索仅支持 DeepSeek 官方接口' }, 400)\n  }\n  const webSearch = Boolean(body.web)\n  const useModel = pageImage ? cfg.visionModel || cfg.model : cfg.model"
)
a=a.replace(
  "      const messages = buildAskMessages({ docs, tree, node, image: pageImage })",
  "      const messages = buildAskMessages({ docs, tree, node, image: pageImage, webSearch })"
)
a=a.replace(
  `          model: useModel,
          provider,
          specs: TOOL_SPECS,
          exec: (name, args) => execWithPageImages(docs, doc.id, name, args),`,
  `          model: useModel,
          provider,
          specs: TOOL_SPECS,
          webSearch,
          onWebEvent: (ev) => send({ type: 'web', status: ev?.status || ev?.type || 'searching' }),
          onSources: (list) => {
            node.sources = (Array.isArray(list) ? list : []).map((x) => ({ url: x.url, title: x.title || x.url })).filter((x) => x.url)
            send({ type: 'web-sources', sources: node.sources })
          },
          exec: (name, args) => execWithPageImages(docs, doc.id, name, args),`
)
a=a.replace(
  `        if (usage) {
          node.usage = usage
          send({ type: 'usage', usage })
        }
      } catch (e) {`,
  `        if (usage) {
          node.usage = usage
          send({ type: 'usage', usage })
        }
        if (node.sources?.length) {
          const seen = new Set()
          const uniq = node.sources.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)))
          const extra = '\\n\\n---\\n**来源**\\n' + uniq.map((x) => \`- [\${x.title || x.url}](\${x.url})\`).join('\\n')
          node.answer += extra
          send({ type: 'delta', text: extra })
        }
      } catch (e) {`
)
fs.writeFileSync('mobile/src/api.js',a)
console.log('mobile api web ok')
