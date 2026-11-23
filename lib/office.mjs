import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

function run(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      try {
        p.kill()
      } catch {}
      reject(new Error('转换超时'))
    }, timeoutMs)
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    p.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error((err || out || '转换失败').trim().slice(0, 500)))
    })
  })
}

// 用本机 PowerPoint 把 .ppt/.pptx 转成 PDF，保留版式、图片和图表
export async function pptToPdf(buf, ext) {
  if (process.platform !== 'win32') throw new Error('仅 Windows 支持 PowerPoint 转换')
  const id = crypto.randomBytes(5).toString('hex')
  const input = path.join(os.tmpdir(), `doctree-${id}${ext}`)
  const output = path.join(os.tmpdir(), `doctree-${id}.pdf`)
  await fs.writeFile(input, buf)
  const quote = (s) => s.replace(/'/g, "''")
  const script = `$ErrorActionPreference='Stop'
$app = New-Object -ComObject PowerPoint.Application
try {
  $pres = $app.Presentations.Open('${quote(input)}', $true, $false, $false)
  $pres.SaveAs('${quote(output)}', 32)
  $pres.Close()
} finally {
  try { $app.Quit() } catch {}
}`
  try {
    await run(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', script],
      120000
    )
    const pdf = await fs.readFile(output)
    if (pdf.length < 1000) throw new Error('PowerPoint 没有生成有效 PDF')
    return pdf
  } catch (e) {
    try {
      await fs.writeFile(path.join(os.tmpdir(), 'doctree-ppt-error.txt'), String(e.stack || e))
    } catch {}
    throw e
  } finally {
    await fs.rm(input, { force: true }).catch(() => {})
    await fs.rm(output, { force: true }).catch(() => {})
  }
}
