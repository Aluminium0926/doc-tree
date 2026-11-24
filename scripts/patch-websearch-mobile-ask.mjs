import fs from 'node:fs'
let a=fs.readFileSync('mobile/src/api.js','utf8')
const needle=`          model: useModel,
          provider,
          specs: TOOL_SPECS,`
const repl=`          model: useModel,
          provider,
          webSearch,
          onWebEvent: (ev) => send({ type: 'web', status: ev?.status || ev?.type || 'searching' }),
          onSources: (list) => {
            node.sources = (Array.isArray(list) ? list : [])
              .map((x) => {
                const c = x.url_citation || x
                return { url: c.url, title: c.title || c.url }
              })
              .filter((x) => x.url)
            send({ type: 'web-sources', sources: node.sources })
          },
          specs: TOOL_SPECS,`
if(!a.includes(needle)) throw new Error('needle')
a=a.replace(needle,repl)
a=a.replace(
`      if (usage) {
        node.usage = usage
        send({ type: 'usage', usage })
      }
    } catch (e) {`,
`      if (usage) {
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
console.log('mobile ask web opts ok', a.includes('onWebEvent'))
