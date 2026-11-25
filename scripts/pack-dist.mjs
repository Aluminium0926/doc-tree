// 只做 Electron 打包：build/stage 里已经准备好应用文件 + 生产 node_modules
// 由 scripts/dist.ps1 调用；也可单独运行（前提是 stage 就绪）
import path from 'node:path'
import fs from 'node:fs/promises'
import packager from 'electron-packager'

const ROOT = process.cwd()
const STAGE = path.join(ROOT, 'build', 'stage')
const OUT = path.join(ROOT, 'release')

async function dirSize(dir) {
  let total = 0
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) total += await dirSize(p)
    else total += (await fs.stat(p)).size
  }
  return total
}

async function main() {
  const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'))
  for (const need of ['server.mjs', 'desktop', 'public', 'lib', 'node_modules']) {
    try {
      await fs.access(path.join(STAGE, need))
    } catch {
      throw new Error(`build/stage 缺少 ${need}；请先运行 scripts/dist.ps1`)
    }
  }
  const electronVersion = String(pkg.devDependencies?.electron || '').replace(/^[^\d]*/, '')
  console.log(`[pack] DocTree ${pkg.version} / Electron ${electronVersion} → win32-x64`)
  const t0 = Date.now()
  const res = await packager({
    dir: STAGE,
    name: 'DocTree',
    platform: 'win32',
    arch: 'x64',
    out: OUT,
    overwrite: true,
    asar: false,
    prune: false,
    electronVersion,
    quiet: false
  })
  const outDir = res[0]
  console.log(`[pack] 完成 ${outDir}`)
  console.log(`[pack] 体积 ${((await dirSize(outDir)) / 1024 / 1024).toFixed(1)} MB，用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

main().catch((e) => {
  console.error('[pack] 失败：', e && e.message ? e.message : e)
  process.exit(1)
})
