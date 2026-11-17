import fs from 'node:fs'
let r = fs.readFileSync('README.md', 'utf8')
r = r.replace(
  /\| \*\*macOS\*\* \|.*\|.*\|/,
  '| **macOS** | 下载 `mac-arm64-v1.0.5` / `mac-x64-v1.0.5` 里的 zip，解压后双击 `首次打开.command` | 未公证，首次需右键「打开」 |'
)
fs.writeFileSync('README.md', r)
console.log(r.split('\n').slice(20, 25).join('\n'))
