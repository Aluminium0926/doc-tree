import fs from 'node:fs'

// ---------- 1) index.html：新欢迎页 ----------
let h = fs.readFileSync('public/index.html', 'utf8')
const s = h.indexOf('<div id="welcome"')
const e = h.indexOf('<div id="update"')
if (s < 0 || e < 0) throw new Error('welcome block markers')
const block = `<div id="welcome" class="modal" hidden>
  <div class="modal-card welcome-card">
    <h3>文档树 · DocTree</h3>
    <p class="welcome-ver" id="welcome-ver"></p>

    <div id="welcome-start">
      <p class="ask-text">本地阅读器 + 提问树。免费开源，不提供模型服务，需要你自己的 API Key。</p>
      <div class="welcome-choices">
        <button id="welcome-newbie" class="welcome-choice">
          <strong>我是新手</strong>
          <span>从注册到拿到 Key，一步步来</span>
        </button>
        <button id="welcome-havekey" class="welcome-choice">
          <strong>我有 API Key</strong>
          <span>直接填进设置，马上用</span>
        </button>
      </div>
      <p class="welcome-link">完全免费：<a href="https://github.com/Aluminium0926/doc-tree/releases" target="_blank" rel="noopener">GitHub Releases</a> · 第三方购买与本项目无关</p>
    </div>

    <div id="welcome-guide" hidden>
      <ol class="welcome-steps">
        <li>打开 <a href="https://platform.deepseek.com/sign_in" target="_blank" rel="noopener">DeepSeek 开放平台</a>，用手机号或邮箱注册并登录。</li>
        <li>进入 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">API Keys</a> 页面，点「创建 API Key」，名字随意。</li>
        <li>复制生成的 <code>sk-...</code>（只显示一次，丢了就重建一个）。</li>
        <li>账户里要有余额：<a href="https://platform.deepseek.com/top_up" target="_blank" rel="noopener">充值页面</a>。新账号一般有赠送额度，够用很久。</li>
        <li>回到 DocTree，打开右上角设置，把 Key 粘进去，保存。</li>
      </ol>
      <div class="modal-actions">
        <button id="welcome-guide-back" class="ghost">返回</button>
        <button id="welcome-open-ds" class="ghost">打开 DeepSeek 平台</button>
        <button id="welcome-guide-done">我已拿到 Key，去填写</button>
      </div>
    </div>

    <p class="welcome-disclaimer">免责声明：本项目仅为本地文档阅读与提问工具，不提供任何模型服务，也不代表任何模型厂商。你自行配置的模型服务受其服务条款、地区限制与计费规则约束；由此产生的费用、限流、停用或账号风险由使用者自行承担。</p>
  </div>
</div>

`
h = h.slice(0, s) + block + h.slice(e)
fs.writeFileSync('public/index.html', h)

// ---------- 2) CSS ----------
let css = fs.readFileSync('public/style.css', 'utf8')
if (!css.includes('.welcome-choices')) {
  css += `

/* ---------- 新手引导 ---------- */
.welcome-choices { display: grid; gap: 8px; margin: 14px 0 10px; }
.welcome-choice {
  display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
  text-align: left; padding: 11px 13px; border-radius: 11px;
  border: 1px solid var(--line-2); background: var(--panel);
  color: var(--text); cursor: pointer;
}
.welcome-choice:hover { border-color: var(--accent); background: var(--panel-2); }
.welcome-choice strong { font-size: 13px; }
.welcome-choice span { font-size: 11.5px; color: var(--dim); }
.welcome-steps { margin: 12px 0; padding-left: 20px; font-size: 12.5px; line-height: 1.85; color: var(--text); }
.welcome-steps li { margin-bottom: 2px; }
.welcome-steps a { color: var(--accent-2); }
.welcome-steps code { font-size: 11.5px; padding: 1px 5px; border-radius: 4px; background: var(--panel-3); }
`
  fs.writeFileSync('public/style.css', css)
}

// ---------- 3) app.js：欢迎逻辑 ----------
let a = fs.readFileSync('public/app.js', 'utf8')
const ws = a.indexOf('function maybeWelcome() {')
const we = a.indexOf('async function init() {')
if (ws < 0 || we < 0) throw new Error('maybeWelcome markers')

const fn = `function maybeWelcome() {
  const m = $('#welcome')
  if (!m) return
  const seen = S.flags?.welcomeSeen === true || localStorage.getItem('dt:seenWelcome') === '1'
  if (seen) return

  const ver = $('#welcome-ver')
  if (ver) ver.textContent = \`当前版本 \${UI_VERSION} · \${APP_VERSION}\`
  const start = $('#welcome-start')
  const guide = $('#welcome-guide')
  const showGuide = (on) => {
    start.hidden = on
    guide.hidden = !on
  }
  m.hidden = false
  showGuide(false)

  const markSeen = async (openCfg) => {
    try {
      localStorage.setItem('dt:seenWelcome', '1')
    } catch {}
    try {
      await fetch('/api/flags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ welcomeSeen: true })
      })
    } catch {}
    m.hidden = true
    if (openCfg) {
      openSettings()
      setTimeout(() => $('#cfg-key')?.focus(), 260)
    }
    setTimeout(() => checkUpdate(), 600)
  }

  $('#welcome-newbie').onclick = () => showGuide(true)
  $('#welcome-havekey').onclick = () => markSeen(true)
  $('#welcome-guide-back').onclick = () => showGuide(false)
  $('#welcome-open-ds').onclick = () => window.open('https://platform.deepseek.com/api_keys', '_blank', 'noopener')
  $('#welcome-guide-done').onclick = () => markSeen(true)
}

`
a = a.slice(0, ws) + fn + a.slice(we)

// init 顺序：先拿状态（含 flags），再决定是否弹欢迎
a = a.replace(
  "  bind()\n  maybeWelcome()\n  initUpdateCheck()",
  "  bind()\n  initUpdateCheck()"
)
a = a.replace(
  "  await loadState()\n  renderLibrary()",
  "  await loadState()\n  renderLibrary()\n  maybeWelcome()"
)
// flags 进状态
a = a.replace("  S.groups = r.groups || []", "  S.groups = r.groups || []\n  S.flags = r.flags || {}")

fs.writeFileSync('public/app.js', a)
console.log('welcome ui wired')
