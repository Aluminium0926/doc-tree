import fs from 'node:fs'

const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

// 版本常量
t = t.replace(
  /const UI_VERSION = 'v\d+'/,
  "const UI_VERSION = 'v55'\nconst APP_VERSION = '1.0.4'\nconst RELEASES_API = 'https://api.github.com/repos/Aluminium0926/doc-tree/releases?per_page=30'\nconst RELEASES_PAGE = 'https://github.com/Aluminium0926/doc-tree/releases'"
)

// 在 maybeWelcome 之前插入版本工具与检查逻辑
const block = `
function verParts(v) {
  return String(v || '').replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
}

function cmpVer(a, b) {
  const A = verParts(a)
  const B = verParts(b)
  for (let i = 0; i < 3; i++) {
    const d = (A[i] || 0) - (B[i] || 0)
    if (d) return d
  }
  return 0
}

let latestTag = ''

async function checkUpdate() {
  try {
    if (localStorage.getItem('dt:verCheckOff') === '1') return
    const last = Number(localStorage.getItem('dt:verCheckAt') || 0)
    if (Date.now() - last < 86400000) return
    const res = await fetch(RELEASES_API, { headers: { accept: 'application/vnd.github+json' } })
    if (!res.ok) return
    const list = await res.json()
    localStorage.setItem('dt:verCheckAt', String(Date.now()))
    const tags = list
      .filter((r) => !r.draft && !r.prerelease)
      .map((r) => r.tag_name)
      .filter((x) => /^v\\d+\\.\\d+\\.\\d+$/.test(x))
    if (!tags.length) return
    tags.sort(cmpVer)
    const latest = tags[tags.length - 1]
    if (cmpVer(latest, 'v' + APP_VERSION) <= 0) return
    if (localStorage.getItem('dt:skipVersion') === latest) return
    latestTag = latest
    const el = $('#update-text')
    if (el) {
      el.innerHTML = \`当前版本 \${UI_VERSION}（\${APP_VERSION}），最新版本 <b>\${latest}</b>。
        官方版本永远免费，不需要向任何人付费购买。\`
    }
    const u = $('#update')
    if (u) u.hidden = false
  } catch {}
}

function closeUpdate(go) {
  const u = $('#update')
  if (u) u.hidden = true
  if ($('#update-skip')?.checked && latestTag) localStorage.setItem('dt:skipVersion', latestTag)
  if (go) window.open(latestTag ? \`\${RELEASES_PAGE}/tag/\${latestTag}\` : RELEASES_PAGE, '_blank', 'noopener')
}

function initUpdateCheck() {
  const w = $('#welcome')
  const run = () => setTimeout(() => checkUpdate(), 2000)
  if (w && !w.hidden) {
    const obs = new MutationObserver(() => {
      if (w.hidden) {
        obs.disconnect()
        run()
      }
    })
    obs.observe(w, { attributes: true, attributeFilter: ['hidden'] })
  } else {
    run()
  }
  $('#update-later')?.addEventListener('click', () => closeUpdate(false))
  $('#update-go')?.addEventListener('click', () => closeUpdate(true))
}

`
const marker = 'function maybeWelcome() {'
if (!t.includes('function checkUpdate')) t = t.replace(marker, block + marker)

// 欢迎弹窗里显示版本
t = t.replace(
  "  const ok = $('#welcome-ok')",
  "  const ver = $('#welcome-ver')\n  if (ver) ver.textContent = `当前版本 ${UI_VERSION} · ${APP_VERSION}`\n  const ok = $('#welcome-ok')"
)

// 设置里显示版本
t = t.replace(
  "  const noAsk = $('#cfg-ask-remove')",
  "  const sver = $('#settings-ver')\n  if (sver) sver.textContent = `当前版本 ${UI_VERSION} · ${APP_VERSION}`\n  const noAsk = $('#cfg-ask-remove')"
)

// 初始化时启动版本检查
t = t.replace('  maybeWelcome()', '  maybeWelcome()\n  initUpdateCheck()')

fs.writeFileSync(F, t)
console.log('patched')
