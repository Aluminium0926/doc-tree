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
      else reject(new Error((err || out || '转换失败').trim().slice(0, 600)))
    })
  })
}

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function quoteApple(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function tryLibreOffice(input, output, timeoutMs) {
  const candidates =
    process.platform === 'darwin'
      ? ['/Applications/LibreOffice.app/Contents/MacOS/soffice', '/opt/homebrew/bin/soffice', '/usr/local/bin/soffice']
      : ['soffice', 'libreoffice']
  for (const bin of candidates) {
    if (bin.startsWith('/') && !(await exists(bin))) continue
    try {
      await run(bin, ['--headless', '--convert-to', 'pdf', '--outdir', path.dirname(output), input], timeoutMs)
      if (await exists(output)) return true
    } catch {}
  }
  return false
}

async function tryPowerPointMac(input, output) {
  const candidates = ['/Applications/Microsoft PowerPoint.app', path.join(os.homedir(), 'Applications', 'Microsoft PowerPoint.app')]
  let installed = false
  for (const c of candidates) {
    if (await exists(c)) {
      installed = true
      break
    }
  }
  if (!installed) throw new Error('未安装 Microsoft PowerPoint 或 LibreOffice，无法转换 PPT')

  const script = `tell application "Microsoft PowerPoint"
  activate
  with timeout of 180 seconds
    open POSIX file "${quoteApple(input)}"
    delay 3
    set p to active presentation
    save p
    delay 3
    save p in ((POSIX file "${quoteApple(output)}") as text) as save as PDF
    delay 3
    close p saving no
  end timeout
end tell`
  await run('osascript', ['-e', script], 200000)
  if (!(await exists(output))) throw new Error('PowerPoint 没有生成 PDF')
}

// 把 .ppt/.pptx 转成 PDF：Windows 用 COM，macOS 优先 LibreOffice、否则 PowerPoint AppleScript
export async function pptToPdf(buf, ext) {
  const id = crypto.randomBytes(5).toString('hex')
  const input = path.join(os.tmpdir(), `doctree-${id}${ext}`)
  const output = path.join(os.tmpdir(), `doctree-${id}.pdf`)
  await fs.writeFile(input, buf)
  try {
    if (process.platform === 'win32') {
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
      await run(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', script],
        120000
      )
    } else if (process.platform === 'darwin') {
      const converted = await tryLibreOffice(input, output, 120000)
      if (!converted) await tryPowerPointMac(input, output)
    } else {
      const converted = await tryLibreOffice(input, output, 120000)
      if (!converted) throw new Error('当前系统没有可用的 PPT 转换器，请先导出 PDF')
    }
    const pdf = await fs.readFile(output)
    if (pdf.length < 1000) throw new Error('转换没有生成有效 PDF')
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
