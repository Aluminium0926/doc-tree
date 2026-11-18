import fs from 'node:fs'
function sub(f, pairs) { let t=fs.readFileSync(f,'utf8'); for (const [a,b] of pairs) t=t.split(a).join(b); fs.writeFileSync(f,t) }
const ver = [
  ['DocTree-1.0.9-win32-x64.zip','DocTree-1.0.10-win32-x64.zip'],
  ['releases/tag/v1.0.9','releases/tag/v1.0.10'],
  ['[v1.0.9](','[v1.0.10]('],
  ['android-v1.0.8','android-v1.0.9'],
  ['mac-arm64-v1.0.6','mac-arm64-v1.0.7'],
  ['mac-x64-v1.0.6','mac-x64-v1.0.7'],
  ['web-v1.0.6','web-v1.0.7'],
  ['DocTree-web-v1.0.6.zip','DocTree-web-v1.0.7.zip']
]
sub('README.md', ver); sub('docs/使用手册.md', ver); sub('docs/安卓与鸿蒙.md', ver)
let r = fs.readFileSync('README.md','utf8')
const block = `- **v1.0.10**
  - 文档组编辑：重命名、移入/移出、成员不足自动解散；「已移除」可折叠
  - 指令模式：发送指令修改回答方式，不计入提问树；点「指令 N」可查看/删除
  - 停止生成 + 继续生成
  - 用量面板：缓存命中率、按天/按文档统计；节点显示本次 tokens
  - 请求重试（429/5xx）与 120 秒超时
  - 工具状态提示、read_pages 跨页读取、句子级分块、命中页前后扩展
  - 提示词缓存优化：静态 system、稳定段前置、Anthropic cache_control
  - 截图预览限宽、Ctrl +/- 缩放、停止图标与提示样式调整
  - 修复 DSML 标记漏出、追问页码、空白页、输入焦点等问题
`
r = r.replace('## 最近更新\n\n', '## 最近更新\n\n' + block)
fs.writeFileSync('README.md', r)
console.log('readme ok')
