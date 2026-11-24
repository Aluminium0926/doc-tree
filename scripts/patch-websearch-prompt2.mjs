import fs from 'node:fs'
let c=fs.readFileSync('lib/context.mjs','utf8')
c=c.replace(
"if (webSearch) volatile.push('【本轮已开启联网搜索】用户明确要求联网。请先调用 deepseek_web_search 检索并阅读链接，再结合结果回答；即使问题看起来和文档有关，也要用搜索核实外部事实。本轮不能调用本地文档工具。回答涉及网上信息时请标注来源。')",
"if (webSearch) volatile.push('【本轮已开启联网搜索】你可以用 web_search 搜索实时网页、用 web_fetch 读取具体链接；也可以照常调用 read_page / search_docs / list_docs 读本地文档。需要外部或最新信息时调用 web_search，网上信息请标注来源。')"
)
fs.writeFileSync('lib/context.mjs',c)
console.log('prompt updated', c.includes('web_search'))
