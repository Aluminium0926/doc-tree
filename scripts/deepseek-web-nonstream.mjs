import fs from 'node:fs'
const cfg=JSON.parse(fs.readFileSync(process.env.APPDATA+'/文档树/config.json','utf8'))
const r=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+cfg.apiKey},body:JSON.stringify({model:'deepseek-flash',messages:[{role:'user',content:'请联网搜索：2026年11月22日前后有什么科技新闻？给出来源。'}],stream:false,tools:[{type:'deepseek_web_search'}]})})
console.log('status',r.status)
console.log((await r.text()).slice(0,2000))
