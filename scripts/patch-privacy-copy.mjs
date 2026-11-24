import fs from 'node:fs'
let h=fs.readFileSync('public/index.html','utf8')
h=h.replace('本地运行 · 数据不出本机','文档本地保存 · 提问内容会发送给所配置模型')
fs.writeFileSync('public/index.html',h)
console.log('footer copy updated')
