import fs from 'node:fs'
let r=fs.readFileSync('README.md','utf8')
const block=`- **v1.0.11**
  - PDF 提问自动附带当前页截图，模型可以读图；read_page 工具也返回页图
  - 桌面端服务端渲染，手机/网页端用 PDF.js 渲染
  - 移动端补齐停止/继续、超时、重试、PWA 网络优先缓存
  - 释放远处 PDF 画布，DPR 上限降到 1.5，翻页内存不再线性增长
  - 修复 visionFormat=auto 走错协议、Anthropic 工具循环字段错误
  - 携带新依赖 @napi-rs/canvas / pdf-to-img
`
r=r.replace('## 最近更新\n\n','## 最近更新\n\n'+block)
fs.writeFileSync('README.md',r)
console.log('changelog added')
