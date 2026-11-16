import fs from 'node:fs'
function sub(f, pairs) {
  let t = fs.readFileSync(f, 'utf8')
  for (const [a, b] of pairs) t = t.split(a).join(b)
  fs.writeFileSync(f, t)
}
const ver = [
  ['DocTree-1.0.6-win32-x64.zip', 'DocTree-1.0.7-win32-x64.zip'],
  ['releases/tag/v1.0.6', 'releases/tag/v1.0.7'],
  ['[v1.0.6](', '[v1.0.7]('],
  ['android-v1.0.5', 'android-v1.0.6'],
  ['mac-arm64-v1.0.3', 'mac-arm64-v1.0.4'],
  ['mac-x64-v1.0.3', 'mac-x64-v1.0.4'],
  ['web-v1.0.3', 'web-v1.0.4'],
  ['DocTree-web-v1.0.3.zip', 'DocTree-web-v1.0.4.zip']
]
sub('README.md', ver)
sub('docs/使用手册.md', ver)
sub('docs/安卓与鸿蒙.md', ver)

let r = fs.readFileSync('README.md', 'utf8')
const block = `- **v1.0.7**
  - 文档组：多份文档共享一棵提问树和上下文，可跨文档提问
  - function calling：read_page / search_docs / list_docs，模型按需读取原文
  - 无选中文字时改为自由提问，不再默认锚定第一页
  - 服务端版本过期提示移到顶部，不再挡住提问框
`
r = r.replace('## 最近更新\n\n', '## 最近更新\n\n' + block)
fs.writeFileSync('README.md', r)
console.log('readme ok')
