import fs from 'node:fs'
function sub(f, pairs) {
  let t = fs.readFileSync(f, 'utf8')
  for (const [a,b] of pairs) t = t.split(a).join(b)
  fs.writeFileSync(f, t)
}
const ver = [
  ['DocTree-1.0.5-win32-x64.zip','DocTree-1.0.6-win32-x64.zip'],
  ['releases/tag/v1.0.5','releases/tag/v1.0.6'],
  ['android-v1.0.4','android-v1.0.5'],
  ['mac-arm64-v1.0.2','mac-arm64-v1.0.3'],
  ['mac-x64-v1.0.2','mac-x64-v1.0.3'],
  ['web-v1.0.2','web-v1.0.3'],
  ['DocTree-web-v1.0.2.zip','DocTree-web-v1.0.3.zip']
]
sub('README.md', ver)
sub('docs/使用手册.md', ver)
sub('docs/安卓与鸿蒙.md', ver)

let r = fs.readFileSync('README.md', 'utf8')
const block = `- **v1.0.6**
  - 修复 Markdown 渲染的 XSS（可执行脚本会读取浏览器里的 API Key）
  - Android 本地代理补齐 Anthropic 认证头（x-api-key / anthropic-version）
  - 设置里增加 Anthropic 地区提示；首次启动与设置页增加免责声明
`
r = r.replace('## 最近更新\n\n', '## 最近更新\n\n' + block)
if (!r.includes('## 免责声明')) {
  r = r.replace('## 许可\n', `## 免责声明

本项目仅为本地文档阅读与提问工具，不提供任何模型服务，也不代表任何模型厂商。

- 模型服务（DeepSeek、Anthropic、本地模型、第三方中转等）由使用者自行配置并承担费用
- 各模型服务的地区限制、服务条款、账号风控由该服务商决定，与本项目无关
- 因使用第三方模型服务导致的限流、停用、费用或数据问题，由使用者自行承担

## 许可
`)
}
fs.writeFileSync('README.md', r)
console.log('readme ok')
