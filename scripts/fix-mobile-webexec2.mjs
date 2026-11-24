import fs from 'node:fs'
let a=fs.readFileSync('mobile/src/api.js','utf8')
a=a.replace(/const r = await searchWeb\(cfg, args\)[\s\S]*?return JSON\.stringify\(\{ results: r\.results \}\)/, "const q = String(args?.query || '').trim()\n            if (!q) throw new Error('web_search 缺少 query')\n            const r = await webResearch('请联网搜索并给出与这个问题相关的事实、数据和时间：' + q, { signal: ac.signal })\n            addSources(r.sources)\n            return JSON.stringify({ brief: r.text, sources: r.sources })")
a=a.replace(/const r = await fetchWeb\(cfg, args\)[\s\S]*?return JSON\.stringify\(\{ title: r\.title, url: r\.url, content: r\.content \}\)/, "const url = String(args?.url || '').trim()\n            if (!/^https?:\\/\\//i.test(url)) throw new Error('web_fetch 需要 http/https 地址')\n            const r = await webResearch('请用 deepseek_read_url 打开并阅读这个网页，提取与用户问题相关的要点：' + url, { signal: ac.signal })\n            addSources([{ url, title: url }, ...(r.sources || [])])\n            return JSON.stringify({ url, content: r.text, sources: r.sources })")
fs.writeFileSync('mobile/src/api.js',a)
console.log('replaced regex', !a.includes('await searchWeb(cfg'), a.includes('await webResearch('))
