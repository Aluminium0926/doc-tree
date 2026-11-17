import fs from 'node:fs'
function sub(f, pairs) {
  let t = fs.readFileSync(f, 'utf8')
  for (const [a, b] of pairs) t = t.split(a).join(b)
  fs.writeFileSync(f, t)
}
const ver = [
  ['DocTree-1.0.7-win32-x64.zip', 'DocTree-1.0.8-win32-x64.zip'],
  ['releases/tag/v1.0.7', 'releases/tag/v1.0.8'],
  ['[v1.0.7](', '[v1.0.8]('],
  ['android-v1.0.6', 'android-v1.0.7'],
  ['mac-arm64-v1.0.4', 'mac-arm64-v1.0.5'],
  ['mac-x64-v1.0.4', 'mac-x64-v1.0.5'],
  ['web-v1.0.4', 'web-v1.0.5'],
  ['DocTree-web-v1.0.4.zip', 'DocTree-web-v1.0.5.zip']
]
sub('README.md', ver)
sub('docs/使用手册.md', ver)
sub('docs/安卓与鸿蒙.md', ver)
let r = fs.readFileSync('README.md', 'utf8')
const block = `- **v1.0.8**
  - 首次启动改为新手引导：我是新手 / 我有 API Key
  - 新手引导含 DeepSeek 注册、创建 Key、充值步骤
  - 欢迎页只在第一次启动出现（服务端持久化 + 固定本地端口）
`
r = r.replace('## 最近更新\n\n', '## 最近更新\n\n' + block)
fs.writeFileSync('README.md', r)
console.log('readme ok')
