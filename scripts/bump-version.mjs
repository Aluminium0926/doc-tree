// 版本号单一入口：一条命令改完所有出现位置，避免 4 处手改漏掉
// 用法：node scripts/bump-version.mjs 1.0.43 v153
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const version = process.argv[2]
const ui = process.argv[3]
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('用法: node scripts/bump-version.mjs <x.y.z> <uiTag>')
  process.exit(1)
}
if (!ui || !/^v\d+$/.test(ui)) {
  console.error('uiTag 形如 v153')
  process.exit(1)
}
const bust = version.replace(/\./g, '')

function patch(file, fn) {
  const p = path.join(ROOT, file)
  const before = fs.readFileSync(p, 'utf8')
  const after = fn(before)
  if (after === before) console.warn('  [skip] 没有变化:', file)
  else fs.writeFileSync(p, after, 'utf8')
  return before !== after
}

let changed = 0
if (patch('package.json', (s) => s.replace(/"version":\s*"[^"]+"/, `"version": "${version}"`))) changed++
if (
  patch('public/app.js', (s) =>
    s
      .replace(/const UI_VERSION = '[^']+'/, `const UI_VERSION = '${ui}'`)
      .replace(/const APP_VERSION = '[^']+'/, `const APP_VERSION = '${version}'`)
      .replace(/chem\.js\?v=[\d.]+/g, `chem.js?v=${version}`)
  )
)
  changed++
if (
  patch('public/index.html', (s) =>
    s.replace(/(style\.css\?v=)\d+/g, `$1${bust}`).replace(/(app\.js\?v=)\d+/g, `$1${bust}`)
  )
)
  changed++

console.log(`版本已更新: UI ${ui} / APP ${version}，缓存号 ?v=${bust}（${changed} 个文件）`)
console.log('记得：node mobile/build.mjs 重新生成移动端（或明确不改移动端）')
