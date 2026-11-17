import fs from 'node:fs'
function sub(f, pairs) {
  let t = fs.readFileSync(f, 'utf8')
  for (const [a, b] of pairs) t = t.split(a).join(b)
  fs.writeFileSync(f, t)
}
const ver = [
  ['DocTree-1.0.8-win32-x64.zip', 'DocTree-1.0.9-win32-x64.zip'],
  ['releases/tag/v1.0.8', 'releases/tag/v1.0.9'],
  ['[v1.0.8](', '[v1.0.9]('],
  ['android-v1.0.7', 'android-v1.0.8'],
  ['mac-arm64-v1.0.5', 'mac-arm64-v1.0.6'],
  ['mac-x64-v1.0.5', 'mac-x64-v1.0.6'],
  ['mac-arm64-v1.0.5', 'mac-arm64-v1.0.6'],
  ['web-v1.0.5', 'web-v1.0.6'],
  ['DocTree-web-v1.0.5.zip', 'DocTree-web-v1.0.6.zip']
]
sub('README.md', ver)
sub('docs/使用手册.md', ver)
sub('docs/安卓与鸿蒙.md', ver)
let r = fs.readFileSync('README.md', 'utf8')
const block = `- **v1.0.9**
  - 修复 DeepSeek 工具调用把 \`<|DSML|invoke>\` 标记当正文显示的问题
  - 流式过滤 DSML，工具照常执行
`
r = r.replace('## 最近更新\n\n', '## 最近更新\n\n' + block)
fs.writeFileSync('README.md', r)
console.log('readme ok')
