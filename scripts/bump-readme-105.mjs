import fs from 'node:fs'

function sub(file, pairs) {
  let t = fs.readFileSync(file, 'utf8')
  for (const [a, b] of pairs) t = t.split(a).join(b)
  fs.writeFileSync(file, t)
}

const ver = [
  ['DocTree-1.0.4-win32-x64.zip', 'DocTree-1.0.5-win32-x64.zip'],
  ['releases/tag/v1.0.4', 'releases/tag/v1.0.5'],
  ['android-v1.0.3', 'android-v1.0.4'],
  ['mac-arm64-v1.0.1', 'mac-arm64-v1.0.2'],
  ['mac-x64-v1.0.1', 'mac-x64-v1.0.2'],
  ['web-v1.0.1', 'web-v1.0.2'],
  ['DocTree-web-v1.0.1.zip', 'DocTree-web-v1.0.2.zip']
]
sub('README.md', ver)
sub('docs/使用手册.md', ver)
sub('docs/安卓与鸿蒙.md', ver)

// README 最近更新：插入 v1.0.5
let r = fs.readFileSync('README.md', 'utf8')
const block = `- **v1.0.5（Windows / 安卓 / 网页 / macOS 同步）**
  - 文件列表可清理：移出列表保留提问树，同一文件再次导入自动恢复
  - 首次启动声明官方渠道 + 版本号；每次启动检查新版本，可在设置里静默
  - 独立视觉端点 / Key，文本与视觉可用不同服务商
  - 支持 Anthropic（Claude）原生接口，自动识别或手动选择
  - 右键 / 长按 PDF 页面「讲解本页」
  - 无极缩放：Ctrl+滚轮、触控板/手机双指捏合、按住按钮连续缩放
  - 内联代码样式、页面菜单阴影等细节调整
`
r = r.replace('## 最近更新\n\n', '## 最近更新\n\n' + block)
fs.writeFileSync('README.md', r)
console.log('readme updated')
