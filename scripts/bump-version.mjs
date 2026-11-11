// 只更新 index.html 里的资源版本号（app.js 的 UI_VERSION 单独手动改，避免脚本重写源文件）
import fs from 'node:fs'

const v = (process.argv[2] || 'v6').replace(/^v/, '')
const f = 'public/index.html'
const h = fs.readFileSync(f, 'utf8').replace(/v=\d+/g, `v=${v}`)
fs.writeFileSync(f, h, 'utf8')
console.log('html:', (h.match(/v=\d/g) || []).join(','))
