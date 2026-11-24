import { enhanceChemBlocks } from './chem.js?v=1.0.43'
import { $, esc, trunc, formatTokens, usageLine } from './modules/util.js'
import { renderMarkdown, enhanceCodeBlocks } from './modules/markdown.js'
import { apiFetch, apiJson, apiStream, uploadFile, fileUrl, exportUrl } from './modules/api.js'
import { readSSE } from './modules/sse.js'
import './modules/focus.js' // 焦点管理：副作用导入，自己注册监听

// 静态资源基址：兼容「根路径」和「子路径部署」（如 GitHub Pages /doc-tree/）
const VENDOR = new URL('./vendor/', import.meta.url).href

const EFFORT_IDS = ['low', 'high', 'max']
const EFFORT_LABELS = ['轻', '标准', '深度']
const UI_VERSION = 'v153'
const APP_VERSION = '1.0.43'
const RELEASES_API = 'https://api.github.com/repos/Aluminium0926/doc-tree/releases?per_page=30'
const RELEASES_PAGE = 'https://github.com/Aluminium0926/doc-tree/releases'
console.log('[DocTree] UI', UI_VERSION)

const S = {
  cfg: null,
  docs: [],
  groups: [],
  groupTarget: null,
  instrMode: false,
  webSearch: false,
  abort: null,
  selecting: false,
  selected: new Set(),
  collapsedGroups: new Set(JSON.parse(localStorage.getItem('dt:collapsedGroups') || '[]')),
  doc: null,
  views: (() => { try { return JSON.parse(localStorage.getItem('dt:views') || '{}') || {} } catch { return {} } })(),
  tree: { nodes: {} },
  pdfjs: null,
  pdf: null,
  baseScale: 1,
  zoom: Number(localStorage.getItem('dt:zoom') || 1),
  collapsed: new Set(),
  pendingAnchor: null,
  pendingParent: null,
  pendingShot: null,
  shotMode: false,
  busy: false,
  rotation: 0,
  hlMode: false,
  eraser: false,
  hlColor: '#ffe066',
  highlights: [],
  hlSaveTimer: 0,
  searchQ: '',
  matches: [],
  matchIdx: -1
}

let refitTimer = 0
let resizeTimer = 0
let buildingPdf = false
const renderTasks = new WeakMap()
const DEFAULT_LEFT = 244
const DEFAULT_RIGHT = 460

/* ================= 页面配色 ================= */
function initTheme() {
  const pop = $('#theme-pop')
  const btn = $('#btn-theme')
  if (!pop || !btn || !window.DTTheme) return

  let cur = window.DTTheme.load()
  const colorEl = $('#tp-color')
  const hexEl = $('#tp-hex')
  const gradEl = $('#tp-grad')
  const angleEl = $('#tp-angle')
  const angleV = $('#tp-angle-v')
  const alphaEl = $('#tp-alpha')
  const alphaV = $('#tp-alpha-v')
  const angleRow = $('#tp-angle-row')

  const sync = () => {
    colorEl.value = cur.color
    hexEl.textContent = cur.color
    gradEl.checked = Boolean(cur.gradient)
    angleEl.value = cur.angle
    angleV.textContent = cur.angle + '°'
    alphaEl.value = cur.alpha
    alphaV.textContent = cur.alpha + '%'
    document.querySelectorAll('#tp-mode button').forEach((b) => b.classList.toggle('on', b.dataset.mode === cur.mode))
    document
      .querySelectorAll('#tp-presets button')
      .forEach((b) => b.classList.toggle('on', b.dataset.color.toLowerCase() === String(cur.color).toLowerCase()))
    angleRow.classList.toggle('tp-angle-off', !cur.gradient)
    pop.querySelectorAll('input[type="range"]').forEach(paintRange)
  }

  const commit = (patch, persist = true) => {
    cur = { ...cur, ...patch }
    window.DTTheme.apply(cur)
    if (persist) window.DTTheme.save(cur)
    sync()
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    pop.hidden = !pop.hidden
    if (!pop.hidden) sync()
  })
  $('#tp-close').addEventListener('click', () => (pop.hidden = true))
  document.addEventListener('mousedown', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) pop.hidden = true
  })
  colorEl.addEventListener('input', () => commit({ color: colorEl.value }))
  document.querySelectorAll('#tp-mode button').forEach((b) => b.addEventListener('click', () => commit({ mode: b.dataset.mode })))
  document.querySelectorAll('#tp-presets button').forEach((b) => b.addEventListener('click', () => commit({ color: b.dataset.color })))
  gradEl.addEventListener('change', () => commit({ gradient: gradEl.checked }))
  angleEl.addEventListener('input', () => commit({ angle: Number(angleEl.value) }))
  alphaEl.addEventListener('input', () => commit({ alpha: Number(alphaEl.value) }))
  $('#tp-reset').addEventListener('click', () => {
    cur = window.DTTheme.reset()
    sync()
  })
  sync()
}


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
    const res = await fetch(RELEASES_API, { headers: { accept: 'application/vnd.github+json' } })
    if (!res.ok) return
    const list = await res.json()
    localStorage.setItem('dt:verCheckAt', String(Date.now()))
    const tags = list
      .filter((r) => !r.draft && !r.prerelease)
      .map((r) => r.tag_name)
      .filter((x) => /^v\d+\.\d+\.\d+$/.test(x))
    if (!tags.length) return
    tags.sort(cmpVer)
    const latest = tags[tags.length - 1]
    if (cmpVer(latest, 'v' + APP_VERSION) <= 0) return
    if (localStorage.getItem('dt:skipVersion') === latest) return
    latestTag = latest
    const el = $('#update-text')
    if (el) {
      el.innerHTML = `当前版本 ${UI_VERSION}（${APP_VERSION}），最新版本 <b>${latest}</b>。
        官方版本永远免费，不需要向任何人付费购买。`
    }
    const u = $('#update')
    if (u) u.hidden = false
  } catch {}
}

function closeUpdate(go) {
  const u = $('#update')
  if (u) u.hidden = true
  if ($('#update-skip')?.checked && latestTag) localStorage.setItem('dt:skipVersion', latestTag)
  if (go) window.open(latestTag ? `${RELEASES_PAGE}/tag/${latestTag}` : RELEASES_PAGE, '_blank', 'noopener')
}

function initUpdateCheck() {
  $('#update-later')?.addEventListener('click', () => closeUpdate(false))
  $('#update-go')?.addEventListener('click', () => closeUpdate(true))
  const w = $('#welcome')
  if (!w || w.hidden) setTimeout(() => checkUpdate(), 2000)
}

function maybeWelcome() {
  const m = $('#welcome')
  if (!m) return
  const seen = S.flags?.welcomeSeen === true || localStorage.getItem('dt:seenWelcome') === '1'
  if (seen) return

  const ver = $('#welcome-ver')
  if (ver) ver.textContent = `当前版本 ${UI_VERSION} · ${APP_VERSION}`
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
      await apiFetch('/api/flags', {
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

async function init() {
  bind()
  initUpdateCheck()

  initTheme()
  applySavedWidths()
  const savedLeft = localStorage.getItem('dt:left')
  // 窄窗口首次打开时默认收起左栏，避免一进来就三栏挤在一起；用户手动展开后会记住
  if (savedLeft === null && window.innerWidth < 980) setLeftCollapsed(true, false)
  else setLeftCollapsed(savedLeft === '1', false)
  if (await loadStateWithRetry()) {
    renderLibrary()
    maybeWelcome()
  }
  const qs = new URLSearchParams(location.search)
  const want = qs.get('doc') || localStorage.getItem('dt:last')
  if (want && S.docs.some((d) => d.id === want)) openDoc(want)
}

init()

function setLeftCollapsed(v, persist = true) {
  const app = $('#app')
  const wasCollapsed = app.classList.contains('collapsed')
  const [, , rNow] = currentCols()
  app.classList.toggle('collapsed', v)
  if (persist) localStorage.setItem('dt:left', v ? '1' : '0')

  applySavedWidths()

  clearTimeout(refitTimer)
  refitTimer = setTimeout(refitPdf, 280)
}

function applySavedWidths(fromCurrent = false) {
  const W = window.innerWidth
  const collapsed = $('#app').classList.contains('collapsed')
  const cols = fromCurrent ? currentCols() : null

  let l = fromCurrent && !collapsed ? cols[0] : Number(localStorage.getItem('dt:leftw')) || DEFAULT_LEFT
  let r = fromCurrent ? cols[2] : Number(localStorage.getItem('dt:rightw')) || DEFAULT_RIGHT
  const minViewer = 320

  // 窄窗口先限制右栏占比，否则收起左栏后文档区仍然很窄
  if (W < 1180) r = Math.min(r, Math.max(280, Math.round(W * 0.38)))
  // 再压缩右栏，保证文档区至少 320px
  r = Math.min(r, Math.max(260, Math.min(900, W - (collapsed ? 0 : l) - minViewer)))
  r = Math.max(260, r)
  // 再压缩左栏
  l = Math.min(l, Math.max(180, Math.min(460, W - r - minViewer)))
  l = Math.max(180, l)

  if (!collapsed) $('#app').style.setProperty('--left', l + 'px')
  $('#app').style.setProperty('--right', r + 'px')
}

function currentCols() {
  return getComputedStyle($('#app'))
    .gridTemplateColumns.split(' ')
    .map((v) => parseFloat(v))
}

// 滑杆填充比例（到头时填满，不留空）
function paintRange(el) {
  if (!el) return
  const min = Number(el.min || 0)
  const max = Number(el.max || 100)
  const v = Number(el.value)
  el.style.setProperty('--pct', ((v - min) / (max - min)) * 100 + '%')
}

// 追问树底部留白 = 输入框高度，保证最后一行（含操作按钮）不被悬浮卡片挡住
function syncTreeGap() {
  const c = $('#composer')
  const t = $('#tree')
  if (!c || !t) return
  t.style.paddingBottom = `${Math.round(c.offsetHeight + 28)}px`
}

function bindResizers() {
  const rightStrips = [$('#resizer-in')].filter(Boolean)
  const syncComposerGap = () => {
    const c = $('#composer')
    if (!c) return
    const gap = Math.round(c.offsetHeight + 10) + 'px'
    for (const rz of rightStrips) rz.style.bottom = gap
    syncTreeGap()
  }
  syncComposerGap()
  if (window.ResizeObserver && $('#composer')) {
    new ResizeObserver(syncComposerGap).observe($('#composer'))
  }
  window.addEventListener('resize', syncComposerGap)

  const attach = (el, side) => {
    if (!el) return
    el.addEventListener('mousedown', (e) => {
      // 输入框（含思考强度滑块）范围内一律不算拖分栏
      const composer = $('#composer')
      if (composer) {
        const c = composer.getBoundingClientRect()
        if (e.clientX >= c.left - 4 && e.clientX <= c.right + 4 && e.clientY >= c.top - 4 && e.clientY <= c.bottom + 4) return
      }
      if (e.target instanceof Element && e.target.closest('#composer')) return
      startResize(side, e)
    })
    el.addEventListener('dblclick', () => {
      $('#app').style.setProperty(side === 'left' ? '--left' : '--right', (side === 'left' ? DEFAULT_LEFT : DEFAULT_RIGHT) + 'px')
      localStorage.removeItem(side === 'left' ? 'dt:leftw' : 'dt:rightw')
      refitPdf()
    })
  }

  attach($('#resizer-left'), 'left')
  attach($('#resizer-in'), 'right')
}

function startResize(side, e) {
  const app = $('#app')
  if (side === 'left' && app.classList.contains('collapsed')) return
  e.preventDefault()

  const el = side === 'right' ? ($('#resizer-in') || $('#resizer-right')) : $(`#resizer-${side}`)
  if (!el) return
  const [l0, , r0] = currentCols()
  const x0 = e.clientX
  el.classList.add('dragging')
  app.classList.add('resizing')
  document.body.classList.add('col-resizing')

  const move = (ev) => {
    const W = window.innerWidth
    if (side === 'left') {
      const maxL = Math.max(180, Math.min(460, W - r0 - 320))
      const w = Math.min(maxL, Math.max(180, l0 + ev.clientX - x0))
      app.style.setProperty('--left', w + 'px')
    } else {
      const maxR = Math.max(260, Math.min(900, W - l0 - 320))
      const w = Math.min(maxR, Math.max(260, r0 + x0 - ev.clientX))
      app.style.setProperty('--right', w + 'px')
    }
  }
  const up = () => {
    el.classList.remove('dragging')
    app.classList.remove('resizing')
    document.body.classList.remove('col-resizing')
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    const [l, , r] = currentCols()
    if (!app.classList.contains('collapsed')) localStorage.setItem('dt:leftw', Math.round(l))
    localStorage.setItem('dt:rightw', Math.round(r))
    refitPdf()
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}

// 左栏宽度变化后重排 PDF，避免只是多出一片空白
function pageScale() {
  return S.baseScale * (S.zoom || 1)
}

function rotationNow() {
  return ((S.rotation % 360) + 360) % 360
}

function pageDims(p) {
  const s = pageScale()
  const w = p?.w || 792
  const h = p?.h || 612
  return rotationNow() % 180 === 0
    ? { w: Math.floor(w * s), h: Math.floor(h * s) }
    : { w: Math.floor(h * s), h: Math.floor(w * s) }
}

async function refitPdf() {
  if (!S.doc || S.doc.kind !== 'pdf' || !S.pdf) return
  const pw = S.doc.pages?.[0]?.w
  if (!pw) return
  const avail = $('#page-scroll').clientWidth - 64
  const next = Math.max(0.35, Math.min(2.4, avail / pw))
  if (Math.abs(next - S.baseScale) < 0.004) return
  S.baseScale = next
  await relayoutPages()
}

// 缩放或窗口变化后，按新比例重排并重绘已渲染的页
let relayoutBusy = false
let relayoutAgain = false

async function relayoutPages() {
  if (!S.doc || S.doc.kind !== 'pdf' || !S.pdf) return
  if (buildingPdf) {
    relayoutAgain = true
    return
  }
  if (relayoutBusy) {
    relayoutAgain = true
    return
  }
  relayoutBusy = true

  const sc = $('#page-scroll')
  const maxScroll = Math.max(0, sc.scrollHeight - sc.clientHeight)
  const ratio = maxScroll > 0 ? sc.scrollTop / maxScroll : 0

  try {
    for (const el of document.querySelectorAll('.page')) {
      const n = +el.dataset.page
      const d = pageDims(S.doc.pages[n - 1])
      el.style.width = d.w + 'px'
      el.style.height = d.h + 'px'
      const layer = el.querySelector('.textLayer')
      layer.style.width = d.w + 'px'
      layer.style.height = d.h + 'px'
      const canvas = el.querySelector('canvas')
      if (canvas.width > 0 && canvas.width !== 300) {
        await drawPage(n, el)
      }
    }
  } finally {
    relayoutBusy = false
    const max2 = Math.max(0, sc.scrollHeight - sc.clientHeight)
    sc.scrollTop = Math.round(ratio * max2)
    scheduleHeal(0)
    if (relayoutAgain) {
      relayoutAgain = false
      relayoutPages()
    }
  }
}


function checkStaleServer() {
  const el = $('#stale')
  if (!el) return
  const v = S.serverVersion
  const isWeb = window.DT_LOCAL === true
  if (!isWeb && !v) {
    $('#stale-text').textContent = '当前界面已更新，但服务端仍在运行旧代码（未返回版本号）。请完全退出应用后重新打开——Ctrl+R 只刷新界面，不会重载服务端。'
    el.hidden = false
    return
  }
  if (!v || v === APP_VERSION) {
    el.hidden = true
    return
  }
  $('#stale-text').textContent = `服务端版本 ${v}，界面版本 ${APP_VERSION}：代码已更新，但服务端还在用旧版本。请完全退出应用后重新打开（Ctrl+R 只刷新界面，不会重载服务端）。`
  el.hidden = false
}

async function loadStateWithRetry() {
  let last = null
  for (let i = 0; i < 6; i++) {
    try {
      await loadState()
      return true
    } catch (e) {
      last = e
      setStatus('数据加载失败，正在重试 ' + (i + 1) + '/6…')
      await new Promise((r) => setTimeout(r, 700))
    }
  }
  setStatus('')
  toast('数据加载失败：' + (last?.message || '服务端未响应') + '。请完全退出应用后重新打开。', 'error')
  return false
}

async function loadState() {
  const res = await apiFetch('/api/state')
  if (!res.ok) throw new Error('服务端返回 ' + res.status)
  const r = await res.json()
  if (!Array.isArray(r.docs)) throw new Error('返回数据不完整')
  S.docs = r.docs
  S.groups = r.groups || []
  S.flags = r.flags || {}
  S.cfg = r.config || {}
  S.serverVersion = r.serverVersion || ''
  if (!S.cfg.hasKey) setStatus('未配置 API Key')
  const i = Math.max(0, EFFORT_IDS.indexOf(S.cfg.effort))
  $('#effort').value = i
  $('#effort-label').textContent = EFFORT_LABELS[i]
  paintRange($('#effort'))
  checkStaleServer()
}

const NO_ASK_REMOVE = 'dt:noAskRemove'

function confirmRemove(title) {
  if (localStorage.getItem(NO_ASK_REMOVE) === '1') return Promise.resolve(true)
  const m = $('#ask')
  if (!m) return Promise.resolve(window.confirm(`把《${title}》移出列表？`))
  $('#ask-text').textContent = `把《${title}》移出列表？\n提问树和对话会保留，下次导入同一份文件即可恢复。`
  $('#ask-never').checked = false
  m.hidden = false
  return new Promise((resolve) => {
    const done = (ok) => {
      m.hidden = true
      $('#ask-ok').removeEventListener('click', onOk)
      $('#ask-cancel').removeEventListener('click', onCancel)
      m.removeEventListener('click', onBackdrop)
      document.removeEventListener('keydown', onKey)
      if (ok && $('#ask-never').checked) localStorage.setItem(NO_ASK_REMOVE, '1')
      resolve(ok)
    }
    const onOk = () => done(true)
    const onCancel = () => done(false)
    const onBackdrop = (e) => { if (e.target === m) done(false) }
    const onKey = (e) => { if (e.key === 'Escape') done(false) }
    $('#ask-ok').addEventListener('click', onOk)
    $('#ask-cancel').addEventListener('click', onCancel)
    m.addEventListener('click', onBackdrop)
    document.addEventListener('keydown', onKey)
  })
}
/* ================= 左侧文档库 ================= */
function docRow(d, inGroup) {
  const el = document.createElement('div')
  const active = S.doc && S.doc.id === d.id
  el.className = 'doc-item' + (active ? ' active' : '') + (inGroup ? ' in-group' : '') + (S.selecting && !inGroup ? ' selecting' : '')
  el.dataset.id = d.id
  const check = S.selecting && !inGroup ? `<span class="doc-check${S.selected.has(d.id) ? ' on' : ''}"></span>` : ''
  el.innerHTML = `${check}<span class="doc-ico" data-kind="${esc(d.kind)}">${esc((d.kind || '?').toUpperCase())}</span>
    <span class="t" title="${esc(d.title)}">${esc(d.title)}</span>
    ${S.selecting ? '' : (inGroup ? '<button class="ungroup" title="移出组（提问树留给这份文档）">移出</button>' : '') + '<button class="x" title="移出列表（保留提问树）">✕</button>'}`
  el.addEventListener('click', (e) => {
    if (e.target.closest('button')) return
    if (S.selecting && !inGroup) {
      if (S.selected.has(d.id)) S.selected.delete(d.id)
      else S.selected.add(d.id)
      renderLibrary()
      updateGroupBar()
      return
    }
    openDoc(d.id)
  })
  el.querySelector('.ungroup')?.addEventListener('click', async (e) => {
    e.stopPropagation()
    const g = (S.groups || []).find((x) => x.docIds.includes(d.id))
    if (!g) return
    const r = await apiFetch('/api/group/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: g.id, remove: [d.id] })
    })
    const j = await r.json().catch(() => ({}))
    await loadState()
    renderLibrary()
    toast(j.dissolved ? '组只剩 1 份，已自动解散，提问树已保留' : `已把《${d.title}》移出组`)
  })
  el.querySelector('.x')?.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (!(await confirmRemove(d.title))) return
    await apiFetch(`/api/doc/${d.id}`, { method: 'DELETE' })
    if (S.doc && S.doc.id === d.id) resetViewer()
    await loadState()
    renderLibrary()
    toast('已移出列表，重新导入同一文件即可恢复')
  })
  return el
}

function renderLibrary() {
  const box = $('#doc-list')
  box.innerHTML = ''
  const visible = S.docs.filter((d) => !d.hidden)
  const hidden = S.docs.filter((d) => d.hidden)
  if (!visible.length && !hidden.length) {
    box.innerHTML = '<div class="tree-empty">还没有文档</div>'
    return
  }
  const groups = S.groups || []

  // 正在为某个组挑选文档：平铺所有候选（含其他组里的）
  if (S.groupTarget) {
    const g = groups.find((x) => x.id === S.groupTarget)
    const head = document.createElement('div')
    head.className = 'lib-sel-head'
    head.textContent = `选择要加入「${g ? g.name : '组'}」的文档`
    box.appendChild(head)
    for (const d of visible) {
      if (g && g.docIds.includes(d.id)) continue
      box.appendChild(docRow(d, false))
    }
    return
  }

  const groupedIds = new Set(groups.flatMap((g) => g.docIds))
  const rootDocs = visible.filter((d) => !groupedIds.has(d.id))

  for (const g of groups) {
    const members = g.docIds.map((id) => visible.find((d) => d.id === id)).filter(Boolean)
    if (!members.length) continue
    const open = !S.collapsedGroups.has(g.id)
    const row = document.createElement('div')
    row.className = 'doc-group'
    row.innerHTML = `<span class="g-chev">${open ? '▾' : '▸'}</span><span class="g-name" title="${esc(g.name)}">${esc(g.name)}</span><em class="g-count">${members.length}</em><button class="g-add" title="移入文档">＋</button><button class="g-x" title="解散组">✕</button>`
    row.addEventListener('click', (e) => {
      if (e.target.closest('.g-x') || e.target.closest('.g-add')) return
      if (S.collapsedGroups.has(g.id)) S.collapsedGroups.delete(g.id)
      else S.collapsedGroups.add(g.id)
      localStorage.setItem('dt:collapsedGroups', JSON.stringify([...S.collapsedGroups]))
      renderLibrary()
    })
    row.querySelector('.g-name').addEventListener('dblclick', (e) => {
      e.stopPropagation()
      const input = document.createElement('input')
      input.className = 'g-rename'
      input.value = g.name
      input.maxLength = 24
      const nameEl = row.querySelector('.g-name')
      nameEl.replaceWith(input)
      input.focus()
      input.select()
      let done = false
      const finish = async (save) => {
        if (done) return
        done = true
        const val = input.value.trim()
        if (save && val && val !== g.name) {
          await apiFetch('/api/group/update', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: g.id, name: val })
          })
          await loadState()
        }
        renderLibrary()
      }
      input.addEventListener('keydown', (ev) => {
        ev.stopPropagation()
        if (ev.key === 'Enter') finish(true)
        else if (ev.key === 'Escape') finish(false)
      })
      input.addEventListener('blur', () => finish(true))
      input.addEventListener('click', (ev) => ev.stopPropagation())
    })
    row.querySelector('.g-add').addEventListener('click', (e) => {
      e.stopPropagation()
      startSelecting(g.id)
    })
    row.querySelector('.g-x').addEventListener('click', async (e) => {
      e.stopPropagation()
      if (!confirm(`解散「${g.name}」？\n提问树会复制给组内每份文档，内容不会丢。`)) return
      await apiFetch('/api/group/dissolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: g.id }) })
      await loadState()
      renderLibrary()
      toast('已解散，提问树已复制到各文档')
    })
    box.appendChild(row)
    if (open) for (const d of members) box.appendChild(docRow(d, true))
  }

  for (const d of rootDocs) box.appendChild(docRow(d, false))

  if (hidden.length) {
    const collapsed = localStorage.getItem('dt:archCollapsed') === '1'
    const head = document.createElement('div')
    head.className = 'doc-arch-head'
    head.innerHTML = `<span>已移除（${hidden.length}）</span><span class="arch-chev">${collapsed ? '▸' : '▾'}</span>`
    head.title = collapsed ? '展开已移除的文档' : '折叠已移除的文档'
    head.addEventListener('click', () => {
      const next = localStorage.getItem('dt:archCollapsed') === '1' ? '0' : '1'
      localStorage.setItem('dt:archCollapsed', next)
      renderLibrary()
    })
    box.appendChild(head)
    for (const d of collapsed ? [] : hidden) {
      const el = document.createElement('div')
      el.className = 'doc-item archived'
      el.dataset.id = d.id
      el.innerHTML = `<span class="doc-ico" data-kind="${esc(d.kind)}">${esc((d.kind || '?').toUpperCase())}</span>
        <span class="t" title="${esc(d.title)}">${esc(d.title)}</span>
        <button class="restore" title="恢复到列表">↩</button>
        <button class="x" title="彻底删除（含提问树）">✕</button>`
      el.querySelector('.restore').addEventListener('click', async (e) => {
        e.stopPropagation()
        await apiFetch('/api/doc/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: d.id }) })
        await loadState()
        renderLibrary()
      })
      el.querySelector('.x').addEventListener('click', async (e) => {
        e.stopPropagation()
        if (!confirm(`彻底删除《${d.title}》及其提问树？\n此操作不可恢复。`)) return
        await apiFetch('/api/doc/purge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: d.id }) })
        await loadState()
        renderLibrary()
      })
      box.appendChild(el)
    }
  }
}

function updateGroupBar() {
  const n = S.selected.size
  const c = $('#group-bar-count')
  if (c) c.textContent = `已选 ${n} 份`
  const btn = $('#group-create')
  if (btn) btn.disabled = n < (S.groupTarget ? 1 : 2)
}

function startSelecting(targetId = null) {
  S.selecting = true
  S.groupTarget = targetId || null
  S.selected = new Set()
  const bar = $('#group-bar')
  if (bar) bar.hidden = false
  const nameInput = $('#group-name')
  if (nameInput) nameInput.hidden = Boolean(targetId)
  const createBtn = $('#group-create')
  if (createBtn) createBtn.textContent = targetId ? '加入组' : '创建组'
  $('#btn-group')?.classList.add('on')
  updateGroupBar()
  renderLibrary()
}

function cancelSelecting() {
  S.selecting = false
  S.groupTarget = null
  S.selected = new Set()
  const bar = $('#group-bar')
  if (bar) bar.hidden = true
  const nameInput = $('#group-name')
  if (nameInput) nameInput.hidden = false
  const createBtn = $('#group-create')
  if (createBtn) createBtn.textContent = '创建组'
  $('#btn-group')?.classList.remove('on')
  renderLibrary()
}

async function createGroupFromSelection() {
  const ids = [...S.selected]
  if (!ids.length) return toast('先选文档')
  const target = S.groupTarget
  if (target) {
    const r = await apiFetch('/api/group/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: target, add: ids })
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return toast(j.error || '加入失败')
    cancelSelecting()
    await loadState()
    renderLibrary()
    toast(j.dissolved ? '组已解散' : `已加入 ${ids.length} 份文档`)
    return
  }
  if (ids.length < 2) return toast('至少选两份文档')
  const name = ($('#group-name')?.value || '').trim() || `组 ${(S.groups || []).length + 1}`
  const r = await apiFetch('/api/group', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, docIds: ids })
  })
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    return toast(j.error || '创建失败')
  }
  cancelSelecting()
  await loadState()
  renderLibrary()
  toast(`已创建「${name}」，组内共享提问树`)
}

async function importFiles(files) {
  for (const f of files) {
    const ext = (f.name.match(/\.[^.]+$/) || [''])[0].toLowerCase()
    if (!/\.(pdf|docx?|md|markdown|txt|pptx?|png|jpe?g|webp|gif|bmp)$/.test(ext)) {
      toast(`暂不支持 ${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPT / PPTX / 图片`)
      continue
    }
    if (f.size > 150 * 1024 * 1024) {
      toast('文件超过 150MB，建议先压缩或导出成 PDF')
      continue
    }

    let target = f
    let converted = false
    if (window.DT_LOCAL && /\.(pptx?)$/i.test(ext)) {
      setStatus(`正在渲染 PPT：${f.name}`)
      try {
        const { convertPptToPdf } = await import('./src/ppt.js')
        const blob = await convertPptToPdf(f, (p) => {
          if (p?.percent != null) setStatus(`PPT 转换中… ${Math.round(p.percent)}%`)
        })
        target = new File([blob], f.name.replace(/\.[^.]+$/, '') + '.pdf', { type: 'application/pdf' })
        converted = true
      } catch (e) {
        console.warn('[ppt]', e)
        if (ext === '.ppt') {
          toast('PPT 转换失败：' + (e.message || e) + '，请先导出 PDF 再导入')
          setStatus('')
          continue
        }
        toast('PPT 版式转换失败，按文字导入：' + (e.message || e))
      }
    }

    setStatus(`解析中：${target.name}`)
    try {
      const r = await apiFetch('/api/import', {
        method: 'POST',
        headers: { 'x-filename': encodeURIComponent(target.name) },
        body: await target.arrayBuffer()
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '导入失败')
      await loadState()
      renderLibrary()
      await openDoc(j.doc.id)
      setStatus(converted ? `已转换并导入 ${j.doc.pages} 页` : `已导入 ${j.doc.pages} 页`)
      setTimeout(() => setStatus(''), 3000)
    } catch (e) {
      toast(e.message)
      setStatus('')
    }
  }
}

/* ================= 打开文档 ================= */
function renderDocMeta() {
  const el = $('#doc-meta')
  if (!el) return
  if (!S.doc) {
    el.textContent = ''
    return
  }
  const base =
    S.doc.kind === 'pdf'
      ? `${S.doc.pages.length} 页 · PDF`
      : S.doc.kind === 'image'
        ? (S.doc.pages?.[0]?.text ? `图片 · OCR ${S.doc.pages[0].text.length.toLocaleString()} 字` : '图片 · 未识别文字')
        : `${(S.doc.kind || '').toUpperCase()} · ${(S.doc.pages?.[0]?.text || '').length.toLocaleString()} 字`
  const n = (S.doc.instructions || []).length
  el.innerHTML = esc(base) + (n ? ` · <span class="meta-instr">指令 ${n}</span>` : '')
}

function closeInstrPop() {
  const pop = $('#instr-pop')
  if (pop) pop.hidden = true
}

function openInstrPop() {
  if (!S.doc) return
  const list = S.doc.instructions || []
  const pop = $('#instr-pop')
  const box = $('#instr-list')
  if (!pop || !box || !list.length) return
  box.innerHTML = ''
  list.forEach((text, i) => {
    const row = document.createElement('div')
    row.className = 'instr-item'
    const span = document.createElement('span')
    span.textContent = text
    const del = document.createElement('button')
    del.title = '删除这条指令'
    del.textContent = '✕'
    del.addEventListener('click', async (e) => {
      e.stopPropagation()
      const r = await apiFetch('/api/instruction/remove', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ docId: S.doc.id, index: i })
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return toast(j.error || '删除失败', 'error')
      S.doc.instructions = j.instructions || []
      renderDocMeta()
      if (S.doc.instructions.length) openInstrPop()
      else closeInstrPop()
    })
    row.append(span, del)
    box.appendChild(row)
  })
  pop.hidden = false
  const r = $('#doc-meta').getBoundingClientRect()
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 300)) + 'px'
  pop.style.top = Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 12) + 'px'
}

async function clearInstructions() {
  if (!S.doc) return
  const r = await apiFetch('/api/instruction/remove', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docId: S.doc.id, clear: true })
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return toast(j.error || '清空失败', 'error')
  S.doc.instructions = []
  renderDocMeta()
  closeInstrPop()
  toast('已清除所有指令')
}

function resetViewer() {
  zoomPreviewZ = null
  const _pv = document.getElementById('pages')
  if (_pv) _pv.style.zoom = ''
  S.doc = null
  S.tree = { nodes: {} }
  S.pdf = null
  $('#pages').innerHTML = ''
  $('#doc-title').textContent = '未打开文档'
  $('#doc-meta').textContent = ''
  $('#hint').hidden = false
  renderTree()
}

let docOpenSeq = 0

async function openDoc(id) {
  const seq = ++docOpenSeq
  if (S.doc) saveViewState(S.doc.id)
  beginDocSwitch()
  viewRestoring = true
  setStatus('加载中…')
  const r = await apiFetch(`/api/doc/${id}`).then((x) => x.json())
  if (seq !== docOpenSeq) return // 用户又点了别的文档，这次结果作废
  if (r.error) {
    viewRestoring = false
    endDocSwitch()
    toast(r.error)
    setStatus('')
    return
  }
  const savedView = S.views[id] || null
  S.doc = r.doc
  S.tree = r.tree || { nodes: {} }
  S.highlights = Array.isArray(S.doc.highlights) ? S.doc.highlights : []
  S.rotation = 0
  S.hlMode = false
  S.eraser = false
  S.pendingAnchor = null
  S.pendingParent = null
  S.collapsed = new Set(savedView?.collapsed || [])
  localStorage.setItem('dt:last', id)
  $('#doc-title').textContent = S.doc.title
  renderDocMeta()
  $('#hint').hidden = true
  renderLibrary()
  renderTree({ preserve: false })
  $('#pages').innerHTML = ''
  updateZoomLabel()
  setStatus('')
  if (S.doc.kind === 'pdf') await renderPdf(seq)
  else if (S.doc.kind === 'image') await renderImageDoc()
  else renderTextDoc()
  if (seq !== docOpenSeq) return
  updateToolbar()
  if (savedView) restoreViewState(id, savedView, endDocSwitch)
  else requestAnimationFrame(() => requestAnimationFrame(endDocSwitch))
  // 切换文档后焦点回到输入框（以前会掉到 body，接着打中文就打不进去）
  setTimeout(() => window.DTFocus?.focus({ end: false, respectSelection: true }), 60)
  setTimeout(() => window.DTFocus?.focus({ end: false, respectSelection: true }), 700)
}

function beginDocSwitch() {
  const sc = $('#page-scroll')
  const load = $('#view-loading')
  sc?.classList.add('is-switching')
  $('#tree')?.classList.add('is-switching')
  if (load) load.hidden = false
}

function endDocSwitch() {
  const sc = $('#page-scroll')
  const load = $('#view-loading')
  sc?.classList.remove('is-switching')
  $('#tree')?.classList.remove('is-switching')
  if (load) load.hidden = true
}

function saveViewState(docId = S.doc?.id) {
  if (!docId) return
  const sc = $('#page-scroll')
  const tree = $('#tree')
  const v = { scrollTop: sc ? sc.scrollTop : 0, treeTop: tree ? tree.scrollTop : 0, treeLeft: tree ? tree.scrollLeft : 0, collapsed: [...S.collapsed], at: Date.now() }
  if (S.doc && S.doc.id === docId && S.doc.kind === 'pdf' && sc) {
    v.page = currentPage()
    const el = document.querySelector(`.page[data-page="${v.page}"]`)
    if (el) {
      const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop
      v.pageOffset = sc.scrollTop - top
    }
  }
  S.views[docId] = v
  try {
    localStorage.setItem('dt:views', JSON.stringify(S.views))
  } catch {}
}

let viewRestoring = false

function restoreViewState(docId, view, onDone) {
  const v = view || S.views[docId]
  if (!v) {
    viewRestoring = false
    onDone?.()
    return
  }
  viewRestoring = true
  const apply = () => {
    if (!S.doc || S.doc.id !== docId) return
    const sc = $('#page-scroll')
    const tree = $('#tree')
    if (sc) {
      if (typeof v.scrollTop === 'number') {
        sc.scrollTop = v.scrollTop
      } else if (S.doc.kind === 'pdf' && v.page) {
        const el = document.querySelector(`.page[data-page="${v.page}"]`)
        if (el) {
          const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop
          sc.scrollTop = Math.max(0, top + (v.pageOffset || 0))
        }
      }
      updatePageNav()
    }
    if (tree) {
      if (typeof v.treeTop === 'number') tree.scrollTop = v.treeTop
      if (typeof v.treeLeft === 'number') tree.scrollLeft = v.treeLeft
    }
  }
  let revealed = false
  const reveal = () => {
    if (revealed) return
    revealed = true
    onDone?.()
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    apply()
    reveal()
  }))
  setTimeout(apply, 260)
  setTimeout(apply, 650)
  setTimeout(() => {
    if (!S.doc || S.doc.id !== docId) return
    viewRestoring = false
    saveViewState(docId)
  }, 1100)
}

let viewSaveTimer = 0
function scheduleViewSave() {
  if (viewRestoring) return
  clearTimeout(viewSaveTimer)
  viewSaveTimer = setTimeout(() => saveViewState(), 160)
}
window.addEventListener('beforeunload', () => saveViewState())
$('#page-scroll')?.addEventListener('scroll', scheduleViewSave, { passive: true })
$('#tree')?.addEventListener('scroll', scheduleViewSave, { passive: true })


/* ================= PDF 渲染 ================= */
async function renderPdf(seq = docOpenSeq) {
  S.pdfjs ??= await import(VENDOR + 'pdf.min.mjs?v=4.10.38')
  S.pdfjs.GlobalWorkerOptions.workerSrc = VENDOR + 'pdf.worker.wrapper.mjs?v=4.10.38'
  const src = window.DT_LOCAL ? await window.DTLocal.fileUrl(S.doc.id) : `/api/file/${S.doc.id}`
  const pdf = await S.pdfjs.getDocument({
    url: src,
    cMapUrl: VENDOR + 'cmaps/',
    cMapPacked: true
  }).promise
  if (seq !== docOpenSeq) {
    try {
      await pdf.destroy()
    } catch {}
    return
  }
  S.pdf = pdf

  const first = await pdf.getPage(1)
  const vp = first.getViewport({ scale: 1 })
  const avail = $('#page-scroll').clientWidth - 64
  S.baseScale = Math.max(0.35, Math.min(2.4, avail / vp.width))

  const pages = $('#pages')
  const scroller = $('#page-scroll')
  const nearView = (el, pad = 900) => {
    const root = scroller.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return r.bottom > root.top - pad && r.top < root.bottom + pad
  }
  const drawOne = async (el) => {
    try {
      await drawPage(+el.dataset.page, el)
      el.dataset.drawn = '1'
    } catch (e) {
      console.warn('[draw]', el.dataset.page, e && e.message)
      el.dataset.drawn = '0'
      // 失败了重新挂回观察区，稍后再试，避免永久空白
      setTimeout(() => {
        try {
          io.observe(el)
        } catch {}
        scheduleHeal(300)
      }, 300)
    }
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || !nearView(e.target)) continue
        io.unobserve(e.target)
        drawOne(e.target)
      }
    },
    { root: scroller, rootMargin: '900px 0px' }
  )
  S.pdfIO = io

  buildingPdf = true
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      if (seq !== docOpenSeq) return // 已经切到别的文档，别再往 #pages 里塞页
      const page = await pdf.getPage(n)
      const v = page.getViewport({ scale: pageScale(), rotation: (page.rotate + rotationNow()) % 360 })
      const el = document.createElement('div')
      el.className = 'page'
      el.dataset.page = n
      el.style.width = Math.floor(v.width) + 'px'
      el.style.height = Math.floor(v.height) + 'px'
      el.innerHTML = '<canvas></canvas><div class="textLayer"></div>'
      pages.appendChild(el)
      if (n <= 3) {
        try {
          await drawOne(el)
        } catch (e) {
          console.warn('[draw]', n, e?.message)
          io.observe(el) // 失败了留着观察位，滚动时再试
        }
      } else {
        io.observe(el)
      }
    }
  } finally {
    buildingPdf = false
    if (relayoutAgain) {
      relayoutAgain = false
      relayoutPages()
    }
  }
  renderHighlights()
}

async function drawPage(n, el, page) {
  page ??= await S.pdf.getPage(n)
  const canvas = el.querySelector('canvas')
  el.dataset.drawn = '0'

  // 同一块 canvas 上有未完成的渲染时，先取消并等它结束，避免并发报错
  const prev = renderTasks.get(canvas)
  if (prev) {
    try {
      prev.cancel()
    } catch {}
    try {
      await prev.promise
    } catch {}
  }

  const viewport = page.getViewport({ scale: pageScale(), rotation: (page.rotate + rotationNow()) % 360 })
  // 依据真实缩放与屏幕像素比渲染，避免放大后发虚
  // 缩小查看时文字很小，保留完整屏幕像素比；放大到 120% 以上再限制，兼顾清晰度和内存
  const dpr = Math.min(window.devicePixelRatio || 1, S.zoom > 1.2 ? 1.5 : 2)
  canvas.width = Math.max(1, Math.floor(viewport.width * dpr))
  canvas.height = Math.max(1, Math.floor(viewport.height * dpr))
  canvas.style.width = Math.floor(viewport.width) + 'px'
  canvas.style.height = Math.floor(viewport.height) + 'px'
  const params = { canvasContext: canvas.getContext('2d'), viewport }
  if (dpr !== 1) params.transform = [dpr, 0, 0, dpr, 0, 0]

  const task = page.render(params)
  renderTasks.set(canvas, task)
  try {
    await task.promise
  } catch (e) {
    if (e && (e.name === 'RenderingCancelledException' || /cancel/i.test(String(e.message)))) return
    throw e
  } finally {
    if (renderTasks.get(canvas) === task) renderTasks.delete(canvas)
  }
  await buildTextLayer(page, viewport, el.querySelector('.textLayer'))
  el.dataset.drawn = '1'
}

async function buildTextLayer(page, viewport, layer) {
  layer.innerHTML = ''
  layer.style.width = viewport.width + 'px'
  layer.style.height = viewport.height + 'px'
  const tc = await page.getTextContent()
  const frag = document.createDocumentFragment()
  const spans = []
  let prevEnd = null
  let prevY = null
  let prevStr = ''

  for (const it of tc.items) {
    if (!it.str) continue
    const tx = S.pdfjs.Util.transform(viewport.transform, it.transform)
    const fh = Math.hypot(tx[2], tx[3])
    if (!fh) continue
    const angle = Math.atan2(tx[1], tx[0])

    let text = it.str
    if (
      Math.abs(angle) < 0.001 &&
      prevEnd !== null &&
      Math.abs(tx[5] - prevY) < fh * 0.5 &&
      tx[4] - prevEnd > fh * 0.18 &&
      !/\s$/.test(prevStr) &&
      !/^\s/.test(text)
    ) {
      text = ' ' + text
    }

    const span = document.createElement('span')
    span.textContent = text
    span.style.left = tx[4].toFixed(2) + 'px'
    span.style.top = (tx[5] - fh).toFixed(2) + 'px'
    span.style.fontSize = fh.toFixed(2) + 'px'
    span.dataset.w = (it.width * viewport.scale).toFixed(2)
    span.dataset.angle = angle.toFixed(4)
    frag.appendChild(span)
    spans.push(span)

    prevEnd = tx[4] + it.width * viewport.scale
    prevY = tx[5]
    prevStr = it.str
  }
  layer.appendChild(frag)

  for (const s of spans) {
    const want = parseFloat(s.dataset.w)
    const got = s.getBoundingClientRect().width
    const angle = parseFloat(s.dataset.angle) || 0
    const parts = []
    if (Math.abs(angle) > 0.001) parts.push(`rotate(${angle}rad)`)
    if (want > 0 && got > 0 && Math.abs(want - got) > 0.6) parts.push(`scaleX(${(want / got).toFixed(3)})`)
    if (parts.length) s.style.transform = parts.join(' ')
  }
}

/* ================= 休眠/切后台后画布白屏自愈 ================= */
function canvasBlank(canvas) {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const x = Math.floor(canvas.width / 2)
    const y = Math.floor(canvas.height / 2)
    const d = ctx.getImageData(x, y, 1, 1).data
    return d[3] === 0
  } catch {
    // 读不出来通常意味着画布已被回收，按“需要重画”处理
    return true
  }
}

let healTimer = 0
let healing = false

function releaseFarCanvases() {
  if (!S.doc || S.doc.kind !== 'pdf' || !S.pdf || buildingPdf) return
  const sc = $('#page-scroll')
  if (!sc) return
  const root = sc.getBoundingClientRect()
  const keep = 2400
  for (const el of document.querySelectorAll('.page')) {
    const c = el.querySelector('canvas')
    if (!c || !c.width) continue
    const r = el.getBoundingClientRect()
    if (r.bottom < root.top - keep || r.top > root.bottom + keep) {
      // 释放 canvas 的像素缓冲；文字层保留，选区和高亮不受影响
      c.width = 0
      c.height = 0
      el.dataset.drawn = '0'
      try {
        S.pdfIO?.observe(el)
      } catch {}
    }
  }
}

let releaseTimer = 0
function scheduleRelease(delay = 500) {
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(releaseFarCanvases, delay)
}

function scheduleHeal(delay = 350, force = false) {
  clearTimeout(healTimer)
  healTimer = setTimeout(() => healBlankPages(force), delay)
}

async function healBlankPages(force = false) {
  if (healing || buildingPdf || relayoutBusy) return
  if (!S.doc || S.doc.kind !== 'pdf' || !S.pdf) return
  const sc = $('#page-scroll')
  const root = sc.getBoundingClientRect()
  healing = true
  try {
    let n = 0
    let left = 0
    for (const el of document.querySelectorAll('.page')) {
      const canvas = el.querySelector('canvas')
      if (!canvas) continue
      const r = el.getBoundingClientRect()
      const visible = r.bottom > root.top - 600 && r.top < root.bottom + 600
      if (!visible) continue
      const undrawn = el.dataset.drawn !== '1'
      if (force || undrawn || canvasBlank(canvas)) {
        if (n < 12) {
          n++
          try {
            await drawPage(+el.dataset.page, el)
          } catch (e) {
            console.warn('[heal]', el.dataset.page, e && e.message)
          }
        } else {
          left++
        }
      }
    }
    if (n) renderHighlights()
    if (left) scheduleHeal(300)
    else scheduleRelease(200)
  } finally {
    healing = false
  }
}


async function renderImageDoc() {
  const src = window.DT_LOCAL ? await window.DTLocal.fileUrl(S.doc.id) : `/api/file/${S.doc.id}`
  const page = document.createElement('div')
  page.className = 'page image-page'
  page.dataset.page = '1'
  const img = document.createElement('img')
  img.src = src
  img.alt = S.doc.title || '图片'
  img.draggable = false
  page.appendChild(img)
  $('#pages').appendChild(page)
}

function renderTextDoc() {
  const text = S.doc.pages?.[0]?.text || ''
  const sheet = document.createElement('div')
  sheet.className = 'sheet'
  sheet.id = 'sheet'
  sheet.style.zoom = S.zoom
  if (S.doc.kind === 'md' || S.doc.kind === 'pptx') {
    sheet.innerHTML = renderMarkdown(text)
    enhanceChemBlocks(sheet)
  enhanceCodeBlocks(sheet)
  } else {
    sheet.innerHTML = text
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
      .join('')
  }
  $('#pages').appendChild(sheet)
}

/* ================= 选区 → 锚点 ================= */
function onMouseUp(e) {
  if (S.shotMode) return
  const t = e.target
  if (
    t instanceof Element &&
    (t.closest('#float-menu') || t.closest('#toolbar') || t.closest('#search-bar') || t.closest('#composer'))
  ) {
    return
  }
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return hideFloat()

  const range = sel.getRangeAt(0)
  const startEl = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement
  if (!startEl) return
  if (startEl.closest('#tree')) return markAnswerSelection(range, startEl, sel)
  if (startEl.closest('#pages')) return markDocSelection(range, startEl, sel)
  hideFloat()
}

function markDocSelection(range, startEl, sel) {
  const pageEl = startEl.closest('.page')
  const quote = sel.toString().trim()
  let anchor

  if (pageEl) {
    const layer = pageEl.querySelector('.textLayer')
    let cum = 0
    let start = -1
    let end = -1
    for (const sp of layer.querySelectorAll('span')) {
      const len = sp.textContent.length
      const hit = range.intersectsNode(sp)
      if (hit && start < 0) start = cum
      if (hit) end = cum + len
      cum += len
    }
    const pr = pageEl.getBoundingClientRect()
    const rects = Array.from(range.getClientRects()).map((r) => ({
      x: (r.left - pr.left) / pr.width,
      y: (r.top - pr.top) / pr.height,
      w: r.width / pr.width,
      h: r.height / pr.height
    }))
    anchor = { kind: 'doc', page: +pageEl.dataset.page, quote, charStart: start, charEnd: end, rects }
  } else {
    const sheet = startEl.closest('#sheet')
    let charStart = 0
    if (sheet) {
      const pre = range.cloneRange()
      pre.selectNodeContents(sheet)
      pre.setEnd(range.startContainer, range.startOffset)
      charStart = pre.toString().length
    }
    anchor = { kind: 'doc', page: 1, quote, charStart }
  }

  if (S.hlMode) {
    addHighlight(anchor)
    hideFloat()
    return
  }

  S.pendingAnchor = anchor
  S.pendingParent = null
  updateChip()
  showFloat(range, [{ label: '用这段提问', primary: true, act: 'ask' }])
}

function markAnswerSelection(range, startEl, sel) {
  const card = startEl.closest('.node')
  if (!card) return hideFloat()
  const parentNode = S.tree?.nodes?.[card.dataset.id]
  const anchor = {
    kind: 'answer',
    nodeId: card.dataset.id,
    quote: sel.toString().trim(),
    page: parentNode?.anchor?.page || currentPage()
  }
  const parentId = card.dataset.id
  showFloat(range, [
    {
      label: '追问这段',
      primary: true,
      run: () => {
        S.pendingAnchor = anchor
        S.pendingParent = parentId
        updateChip()
      }
    }
  ])
}

/* ================= 浮层 ================= */
function showFloat(range, buttons) {
  const menu = $('#float-menu')
  menu.innerHTML = ''
  for (const b of buttons) {
    const btn = document.createElement('button')
    btn.textContent = b.label
    if (b.primary) btn.className = 'primary'
    btn.addEventListener('mousedown', (e) => e.preventDefault())
    btn.addEventListener('click', () => {
      hideFloat()
      try { b.run?.() } catch {}
      // 不直接发送：只把引用挂到输入框，由你决定写不写问题、何时点「发送」
      window.DTFocus?.focus({ end: true, clearSelection: true, external: true })
      setStatus('已选中，可写问题后发送；留空直接点「发送」也行')
    })
    menu.appendChild(btn)
  }
  const r = range.getBoundingClientRect()
  menu.hidden = false
  const w = menu.offsetWidth
  const h = menu.offsetHeight
  let left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))
  let top = r.top - h - 8
  if (top < 8) top = r.bottom + 8
  menu.style.left = left + 'px'
  menu.style.top = top + 'px'
}

function hideFloat() {
  $('#float-menu').hidden = true
}

/* ================= 追问树 ================= */
function renderTree({ preserve = true } = {}) {
  const treeRoot = $('#tree')
  const prevTop = treeRoot ? treeRoot.scrollTop : 0
  const prevLeft = treeRoot ? treeRoot.scrollLeft : 0
  const g = (S.groups || []).find((x) => (x.docIds || []).includes(S.doc?.id))
  const tag = $('#tree-group')
  if (tag) {
    tag.hidden = !g
    tag.textContent = g ? g.name : ''
  }
  const nodes = Object.values(S.tree.nodes || {})
  $('#node-count').textContent = nodes.length ? `(${nodes.length})` : ''
  const locate = $('#btn-locate')
  if (locate) locate.hidden = !nodes.length
  const root = $('#tree')
  root.innerHTML = ''
  if (!nodes.length) {
    root.innerHTML = '<div class="tree-empty">还没有追问。<br>在文档里选中一段文字试试。</div>'
    return
  }
  const kids = new Map()
  for (const n of nodes) {
    const k = n.parentId || 'root'
    if (!kids.has(k)) kids.set(k, [])
    kids.get(k).push(n)
  }
  for (const arr of kids.values()) arr.sort((a, b) => a.createdAt - b.createdAt)

  const build = (parent, depth) => {
    const arr = kids.get(parent) || []
    for (const n of arr) root.appendChild(nodeEl(n, depth, kids))
  }
  build('root', 0)
  syncTreeGap()
  if (preserve) {
    requestAnimationFrame(() => {
      if (!treeRoot || !S.doc) return
      treeRoot.scrollTop = prevTop
      treeRoot.scrollLeft = prevLeft
    })
  }
}

/* ---------- 增量更新：提问流式返回时只动一个节点，不再整棵树重建 ---------- */
function kidsMap() {
  const kids = new Map()
  for (const n of Object.values(S.tree.nodes || {})) {
    const k = n.parentId || 'root'
    if (!kids.has(k)) kids.set(k, [])
    kids.get(k).push(n)
  }
  for (const arr of kids.values()) arr.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  return kids
}

function nodeDepth(id) {
  let d = 0
  let cur = S.tree.nodes[id]
  while (cur && cur.parentId && d < 40) {
    d++
    cur = S.tree.nodes[cur.parentId]
  }
  return d
}

function syncTreeMeta() {
  const nodes = Object.values(S.tree.nodes || {})
  const count = $('#node-count')
  if (count) count.textContent = nodes.length ? `(${nodes.length})` : ''
  const locate = $('#btn-locate')
  if (locate) locate.hidden = !nodes.length
  if (!nodes.length) {
    const root = $('#tree')
    if (root) root.innerHTML = '<div class="tree-empty">还没有追问。<br>在文档里选中一段文字试试。</div>'
  }
  syncTreeGap()
}

function appendNodeEl(n) {
  const root = $('#tree')
  if (!root) return
  const kids = kidsMap()
  const el = nodeEl(n, nodeDepth(n.id), kids)
  if (!n.parentId) {
    if (!root.querySelector('.node')) root.innerHTML = ''
    root.appendChild(el)
  } else {
    const parentEl = document.querySelector(`.node[data-id="${n.parentId}"]`)
    if (!parentEl) return renderTree()
    let box = parentEl.querySelector(':scope > .children')
    if (!box) {
      box = document.createElement('div')
      box.className = 'children'
      parentEl.appendChild(box)
    }
    box.appendChild(el)
  }
  syncTreeMeta()
}

function refreshNodeEl(n) {
  const el = document.querySelector(`.node[data-id="${n.id}"]`)
  if (!el) return renderTree()
  el.replaceWith(nodeEl(n, nodeDepth(n.id), kidsMap()))
  syncTreeMeta()
}

function nodeEl(n, depth, kids) {
  const hasKids = (kids.get(n.id) || []).length > 0
  const el = document.createElement('div')
  el.className = 'node' + (S.collapsed.has(n.id) ? ' collapsed' : '')
  el.dataset.id = n.id
  el.dataset.depth = depth

  const card = document.createElement('div')
  card.className = 'node-card'

  const top = document.createElement('div')
  top.className = 'node-top'
  if (n.anchor?.kind === 'answer') {
    top.innerHTML = `<span class="quote">「${esc(trunc(n.anchor.quote, 40))}」</span><span class="page-tag alt">追问</span>`
  } else if (n.anchor?.quote) {
    top.innerHTML = `<span class="quote" title="点击定位原文">「${esc(trunc(n.anchor.quote, 40))}」</span>` +
      (n.anchor.page ? `<span class="page-tag">P${n.anchor.page}</span>` : '')
  } else {
    top.innerHTML = `<span class="page-tag">全文</span>`
  }
  if (hasKids) {
    const c = document.createElement('button')
    c.className = 'collapse'
    c.textContent = S.collapsed.has(n.id) ? '▸' : '▾'
    c.addEventListener('click', () => {
      if (S.collapsed.has(n.id)) S.collapsed.delete(n.id)
      else S.collapsed.add(n.id)
      renderTree()
    })
    top.appendChild(c)
  }
  card.appendChild(top)

  const q = document.createElement('div')
  q.className = 'node-q'
  q.textContent = n.question || '（无问题）'
  card.appendChild(q)

  if (n.reasoning) {
    const th = document.createElement('details')
    th.className = 'think'
    th.innerHTML = `<summary>思考过程 · ${n.reasoning.length} 字</summary><pre>${esc(n.reasoning)}</pre>`
    card.appendChild(th)
  }

  const ans = document.createElement('div')
  ans.className = 'answer markdown' + (n.status === 'streaming' ? ' streaming' : '')
  ans.innerHTML = renderMarkdown(n.answer || '')
  enhanceChemBlocks(ans)
  enhanceCodeBlocks(ans)
  card.appendChild(ans)

  const acts = document.createElement('div')
  acts.className = 'node-actions'
  acts.innerHTML = (n.stopped ? '<button data-act="resume">继续</button>' : '') + `<button data-act="again">追问</button><button data-act="copy">复制</button><button data-act="del">删除</button>`
  acts.querySelector('[data-act="resume"]')?.addEventListener('click', () => resumeNode(n.id))
  acts.querySelector('[data-act="again"]').addEventListener('click', () => {
    S.pendingParent = n.id
    S.pendingAnchor = { kind: 'answer', nodeId: n.id, quote: '', page: n.anchor?.page || currentPage() }
    updateChip()
    window.DTFocus?.focus({ end: true, clearSelection: true, external: true })
  })
  acts.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(n.answer || '')
    toast('已复制')
  })
  const usageEl = document.createElement('div')
  usageEl.className = 'node-usage'
  usageEl.textContent = usageLine(n.usage)
  usageEl.hidden = !usageEl.textContent
  card.appendChild(usageEl)
  acts.querySelector('[data-act="del"]').addEventListener('click', async () => {
    if (!confirm('删除这条追问及其子分支？')) return
    await apiFetch('/api/node/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docId: S.doc.id, nodeId: n.id })
    })
    const dead = new Set([n.id])
    let grew = true
    while (grew) {
      grew = false
      for (const x of Object.values(S.tree.nodes)) {
        if (x.parentId && dead.has(x.parentId) && !dead.has(x.id)) {
          dead.add(x.id)
          grew = true
        }
      }
    }
    for (const id of dead) delete S.tree.nodes[id]
    renderTree()
  })
  card.appendChild(acts)

  if (n.anchor?.kind === 'doc' && n.anchor.rects) {
    top.querySelector('.quote')?.addEventListener('click', () => locate(n.anchor))
  }

  el.appendChild(card)

  const children = document.createElement('div')
  children.className = 'children'
  for (const c of (kids.get(n.id) || [])) children.appendChild(nodeEl(c, depth + 1, kids))
  el.appendChild(children)
  return el
}

function locate(anchor) {
  const pageEl = document.querySelector(`.page[data-page="${anchor.page}"]`)
  if (!pageEl) return
  pageEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
  for (const old of document.querySelectorAll('.anchor-hl')) old.remove()
  setTimeout(() => {
    for (const r of anchor.rects || []) {
      const d = document.createElement('div')
      d.className = 'anchor-hl'
      d.style.left = r.x * 100 + '%'
      d.style.top = r.y * 100 + '%'
      d.style.width = r.w * 100 + '%'
      d.style.height = r.h * 100 + '%'
      pageEl.appendChild(d)
    }
    setTimeout(() => document.querySelectorAll('.anchor-hl').forEach((x) => x.remove()), 2600)
  }, 280)
}

/* ================= 提问 ================= */
function setWebSearch(on) {
  S.webSearch = Boolean(on)
  const btn = $('#btn-web')
  if (btn) btn.classList.toggle('on', S.webSearch)
  setStatus(S.webSearch ? '联网已开启：Search API 按次计费（约 5 元/1000 次），可与本地文档同时用' : '')
  setTimeout(() => { if (S.webSearch) setStatus('') }, 1800)
}

function setInstrMode(on) {
  S.instrMode = Boolean(on)
  const btn = $('#btn-instr')
  if (btn) btn.classList.toggle('on', S.instrMode)
  const q = $('#q')
  if (q) {
    q.placeholder = S.instrMode
      ? '输入指令，例如：以后用英文回答 / 少用公式 / 只讲结论'
      : '选中文字后点「发送」提问，留空也行'
    window.DTFocus?.focus({ external: true })
  }
}

async function sendInstruction(text) {
  if (!S.doc) return toast('先打开一份文档')
  setStatus('指令发送中…')
  try {
    const r = await apiFetch('/api/instruction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docId: S.doc.id, text })
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || '指令发送失败')
    $('#q').value = ''
    autoGrowComposer()
    setInstrMode(false)
    toast(j.count === 0 ? '已清除所有指令' : j.reply ? `指令已生效：${j.reply}` : '指令已生效')
    // 当前打开文档的指令数要立刻反映到标题下面，不用重新打开
    if (S.doc) {
      S.doc.instructions = j.count === 0 ? [] : [...(S.doc.instructions || []), text]
      renderDocMeta()
    }
    await loadState()
    renderLibrary()
  } catch (e) {
    toast(String(e.message || e))
  } finally {
    setStatus('')
  }
}

async function send(forced) {
  if (!S.doc) return toast('先打开一份文档')
  if (S.busy) return
  if (S.instrMode) {
    const text = String(forced ?? $('#q').value).trim()
    if (!text) return toast('先输入一条指令')
    return sendInstruction(text)
  }
  let anchor = S.pendingAnchor
  if (!anchor && S.doc) {
    // 没选文字：锚定到当前正在看的那一页，而不是第 1 页
    anchor = { kind: 'doc', page: S.doc.kind === 'pdf' ? currentPage() : 1, quote: '', free: true }
    S.pendingAnchor = anchor
  }
  let q = (forced ?? $('#q').value).trim()
  if (!q) {
    if (!anchor) return toast('先选中文字，或输入一个问题')
    q =
      anchor.kind === 'answer'
        ? '请把这段展开讲讲'
        : anchor.kind === 'image'
          ? '请解释框选的这部分内容'
          : '请讲解这段内容'
  }

  const parentId = S.pendingParent || null
  const image = S.pendingShot || undefined

  S.busy = true
  $('#btn-send').disabled = true
  $('#btn-stop').hidden = false
  setStatus('思考中…')
  const ac = new AbortController()
  S.abort = ac

  try {
    const res = await apiFetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docId: S.doc.id, parentId, anchor, question: q, image, web: S.webSearch }),
      signal: ac.signal
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || `请求失败 ${res.status}`)
    }
    $('#q').value = ''
    autoGrowComposer()
    S.pendingAnchor = null
    S.pendingParent = null
    S.pendingShot = null
    updateChip()
    await consumeStream(res)
  } catch (e) {
    if (e && e.name === 'AbortError') {
      setStatus('已停止')
      // 服务端要先把 stopped 标记落盘，晚一点再拉一次树
      setTimeout(refreshCurrentTree, 700)
    } else {
      toast(e.message)
      setStatus('')
    }
  } finally {
    S.abort = null
    S.busy = false
    $('#btn-send').disabled = false
    $('#btn-stop').hidden = true
    // 发送完把焦点还给输入框：按钮被 disable 过，焦点已经掉到 body 上了
    window.DTFocus?.focus({ end: true })
  }
}

async function refreshCurrentTree() {
  if (!S.doc) return
  try {
    const d = await apiFetch('/api/doc/' + S.doc.id).then((r) => r.json())
    if (d && d.tree) {
      S.tree = d.tree
      renderTree()
    }
  } catch {}
}

async function resumeNode(id) {
  if (!S.doc || S.busy) return
  S.busy = true
  $('#btn-send').disabled = true
  $('#btn-stop').hidden = false
  setStatus('继续生成…')
  const ac = new AbortController()
  S.abort = ac
  try {
    const res = await apiFetch('/api/ask/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docId: S.doc.id, nodeId: id }),
      signal: ac.signal
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || `请求失败 ${res.status}`)
    }
    await consumeStream(res)
  } catch (e) {
    if (e && e.name === 'AbortError') setStatus('已停止')
    else {
      toast(e.message)
      setStatus('')
    }
  } finally {
    S.abort = null
    S.busy = false
    $('#btn-send').disabled = false
    $('#btn-stop').hidden = true
    window.DTFocus?.focus({ end: true })
  }
}

async function consumeStream(res) {
  let node = null

  const handle = (ev) => {
    if (ev.type === 'meta') {
      node = ev.node
      const isNew = !S.tree.nodes[node.id]
      S.tree.nodes[node.id] = node
      if (isNew) appendNodeEl(node)
      else refreshNodeEl(node)
      scrollTreeEnd()
    } else if (ev.type === 'reasoning' && node) {
      node.reasoning = (node.reasoning || '') + ev.text
      const card = document.querySelector(`.node[data-id="${node.id}"]`)
      if (card) {
        let th = card.querySelector('.think')
        if (!th) {
          th = document.createElement('details')
          th.className = 'think'
          th.innerHTML = '<summary></summary><pre></pre>'
          const ansEl = card.querySelector('.answer')
          ansEl.parentNode.insertBefore(th, ansEl)
        }
        th.querySelector('summary').textContent = `思考中… ${node.reasoning.length} 字`
        th.querySelector('pre').textContent = node.reasoning
      }
      setStatus(`思考中… ${node.reasoning.length} 字`)
    } else if (ev.type === 'delta' && node) {
      node.answer += ev.text
      const el = document.querySelector(`.node[data-id="${node.id}"] .answer`)
      if (el) el.textContent = node.answer
      setStatus('生成中…')
    } else if (ev.type === 'usage' && node) {
      node.usage = ev.usage
      const card = document.querySelector(`.node[data-id="${node.id}"]`)
      const el = card?.querySelector('.node-usage')
      if (el) {
        el.textContent = usageLine(node.usage)
        el.hidden = !el.textContent
      }
    } else if (ev.type === 'web') {
      setStatus('正在联网搜索…')
    } else if (ev.type === 'tool') {
      const args = ev.args || {}
      const label =
        ev.name === 'read_page'
          ? `正在读第 ${args.page} 页…`
          : ev.name === 'read_pages'
            ? `正在读第 ${args.from}–${args.to} 页…`
          : ev.name === 'search_docs'
            ? `正在检索「${args.query || ''}」…`
            : '正在查看文档…'
      setStatus(label)
    } else if (ev.type === 'stopped') {
      setStatus('已停止')
    } else if (ev.type === 'error') {
      toast(ev.message)
    } else if (ev.type === 'done' && ev.node) {
      S.tree.nodes[ev.node.id] = ev.node
      refreshNodeEl(ev.node)
      document.querySelector(`.node[data-id="${ev.node.id}"]`)?.scrollIntoView({ block: 'nearest' })
      setStatus('')
    }
  }

  await readSSE(res, handle)
}

function scrollTreeEnd() {
  const box = $('#tree')
  box.scrollTop = box.scrollHeight
}

/* ================= 页面截图（移动端问图用） ================= */
window.__dtPageImage = async (pageNo) => {
  if (!S.doc || S.doc.kind !== 'pdf') return null
  const n = Math.max(1, Number(pageNo) || 1)
  const existing = document.querySelector(`.page[data-page="${n}"] canvas`)
  if (existing && existing.width >= 900 && existing.closest('.page')?.dataset.drawn === '1') return existing.toDataURL('image/png')
  if (!S.pdf) return null
  try {
    const page = await S.pdf.getPage(n)
    const vp = page.getViewport({ scale: 1.3, rotation: (page.rotate + rotationNow()) % 360 })
    const c = document.createElement('canvas')
    c.width = Math.ceil(vp.width)
    c.height = Math.ceil(vp.height)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    await page.render({ canvasContext: ctx, viewport: vp }).promise
    return c.toDataURL('image/png')
  } catch {
    return null
  }
}

/* ================= 截图 ================= */
function toggleShot(force) {
  if (!S.doc || S.doc.kind !== 'pdf') return toast('截图提问目前只支持 PDF')
  S.shotMode = force ?? !S.shotMode
  $('#btn-shot').classList.toggle('on', S.shotMode)
  $('#pages').classList.toggle('shot-mode', S.shotMode)
  if (S.shotMode) setStatus('拖拽框选区域，松手后带到输入框')
  else setStatus('')
}

let drag = null

function onShotDown(e) {
  if (!S.shotMode) return
  const page = e.target.closest('.page')
  if (!page || !page.querySelector('canvas')) return
  e.preventDefault()
  drag = { page, x0: e.clientX, y0: e.clientY, box: document.createElement('div') }
  drag.box.className = 'shot-box'
  page.appendChild(drag.box)
  const pr = page.getBoundingClientRect()
  drag.pr = pr
}

function onShotMove(e) {
  if (!drag) return
  const { pr, x0, y0, box } = drag
  const x = Math.min(x0, e.clientX) - pr.left
  const y = Math.min(y0, e.clientY) - pr.top
  const w = Math.abs(e.clientX - x0)
  const h = Math.abs(e.clientY - y0)
  Object.assign(box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' })
}

function onShotUp(e) {
  if (!drag) return
  const { page, x0, y0, pr, box } = drag
  drag = null
  box.remove()
  const x = Math.min(x0, e.clientX) - pr.left
  const y = Math.min(y0, e.clientY) - pr.top
  const w = Math.abs(e.clientX - x0)
  const h = Math.abs(e.clientY - y0)
  if (w < 12 || h < 12) return

  const canvas = page.querySelector('canvas')
  const sx = canvas.width / pr.width
  const sy = canvas.height / pr.height
  const tmp = document.createElement('canvas')
  const rawW = Math.max(1, Math.round(w * sx))
  const rawH = Math.max(1, Math.round(h * sy))
  const k = Math.min(1, 1400 / rawW) // 控制体积与视觉 token 成本
  tmp.width = Math.max(1, Math.round(rawW * k))
  tmp.height = Math.max(1, Math.round(rawH * k))
  tmp.getContext('2d').drawImage(canvas, x * sx, y * sy, w * sx, h * sy, 0, 0, tmp.width, tmp.height)

  S.pendingShot = tmp.toDataURL('image/png')
  S.pendingAnchor = { kind: 'image', page: +page.dataset.page, quote: '（框选区域）' }
  S.pendingParent = null
  toggleShot(false)
  updateChip()
  // 不直接发送：图先挂到输入框，由你决定写不写问题、何时点「发送」
  window.DTFocus?.focus({ end: true, clearSelection: true, external: true })
  setStatus('已截取，可写问题后发送；留空直接点「发送」也行')
}

/* ================= 杂项 UI ================= */
// 输入框跟着内容长高（以前 rows=2 固定高度，长问题要在框里滚动）
function autoGrowComposer() {
  const q = $('#q')
  if (!q) return
  const min = 54
  const max = 170
  q.style.height = 'auto'
  const h = Math.max(min, Math.min(max, q.scrollHeight))
  q.style.height = h + 'px'
  q.style.overflowY = q.scrollHeight > max ? 'auto' : 'hidden'
}

function updateChip() {
  const chip = $('#anchor-chip')
  const text = chip.querySelector('.chip-text')
  const a = S.pendingAnchor
  if (a) {
    chip.hidden = false
    const where =
      a.kind === 'answer' ? '回答片段' : a.kind === 'image' ? `第 ${a.page} 页框选` : a.page ? `第 ${a.page} 页` : '全文'
    text.textContent = `${where} · 「${trunc(a.quote || '整段提问', 24)}」`
  } else {
    chip.hidden = true
  }

  const sh = $('#shot-chip')
  if (S.pendingShot) {
    sh.hidden = false
    sh.querySelector('img').src = S.pendingShot
  } else {
    sh.hidden = true
  }
}

function setStatus(t) {
  $('#status').textContent = t || ''
}

function toast(msg, kind = 'ok') {
  const t = $('#toast')
  t.classList.toggle('err', kind === 'error')
  t.textContent = msg
  t.hidden = false
  clearTimeout(toast._t)
  toast._t = setTimeout(() => (t.hidden = true), 3800)
}

function clampZoom(z) {
  return Math.max(0.35, Math.min(3, z))
}

function updateZoomLabel(z = zoomPreviewZ ?? S.zoom) {
  $('#zoom-label').textContent = Math.round(z * 100) + '%'
}

/* ---------- 无极缩放 ---------- */
var zoomPreviewZ = null
var zoomPreviewTimer = 0

// 先把画面按目标比例预览（不动画布），停止操作后再按新比例重绘
function previewZoom(target) {
  if (!S.doc) return
  const z = clampZoom(target)
  zoomPreviewZ = z
  updateZoomLabel(z)
  if (S.doc.kind === 'pdf') {
    const pages = $('#pages')
    if (pages) pages.style.zoom = z / S.zoom
  } else {
    const sheet = $('#sheet')
    if (sheet) sheet.style.zoom = z
  }
  clearTimeout(zoomPreviewTimer)
  zoomPreviewTimer = setTimeout(commitZoom, 160)
}

function commitZoom() {
  if (zoomPreviewZ == null) return
  const z = zoomPreviewZ
  zoomPreviewZ = null
  const pages = $('#pages')
  if (pages) pages.style.zoom = ''
  setZoom(z)
}


/* ---------- 页面右键：讲解本页 ---------- */
function bindPageMenu() {
  const pages = $('#pages')
  const menu = $('#page-menu')
  if (!pages || !menu) return
  let pageNo = 0
  const hide = () => {
    menu.hidden = true
  }
  const showAt = (x, y) => {
    menu.hidden = false
    const w = menu.offsetWidth || 110
    const h = menu.offsetHeight || 32
    menu.style.left = Math.min(x, window.innerWidth - w - 8) + 'px'
    menu.style.top = Math.min(y, window.innerHeight - h - 8) + 'px'
  }

  pages.addEventListener('contextmenu', (e) => {
    if (!S.doc || S.doc.kind !== 'pdf') return
    const el = e.target.closest('.page')
    if (!el) return
    e.preventDefault()
    pageNo = Number(el.dataset.page || 0)
    showAt(e.clientX, e.clientY)
  })

  // 触屏长按
  let lp = 0
  pages.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1 || !S.doc || S.doc.kind !== 'pdf') return
      const el = e.target.closest('.page')
      if (!el) return
      const touch = e.touches[0]
      clearTimeout(lp)
      lp = setTimeout(() => {
        pageNo = Number(el.dataset.page || 0)
        showAt(touch.clientX, touch.clientY)
      }, 550)
    },
    { passive: true }
  )
  pages.addEventListener('touchmove', () => clearTimeout(lp), { passive: true })
  pages.addEventListener('touchend', () => clearTimeout(lp), { passive: true })

  $('#pm-explain')?.addEventListener('click', (e) => {
    e.stopPropagation()
    hide()
    if (!pageNo) return
    hideFloat()
    S.pendingParent = null
    S.pendingShot = null
    S.pendingAnchor = { kind: 'doc', page: pageNo, quote: '' }
    // 讲解整页时始终带上这一页的渲染图：文字层经常漏掉图片、公式和表格
    const cv = document.querySelector(`.page[data-page="${pageNo}"] canvas`)
    if (cv) {
      try {
        S.pendingShot = cv.toDataURL('image/jpeg', 0.9)
      } catch {}
    }
    send('讲解本页内容')
  })

  document.addEventListener('mousedown', (e) => {
    if (!menu.hidden && !menu.contains(e.target)) hide()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide()
  })
  $('#page-scroll')?.addEventListener('scroll', hide, { passive: true })
  window.addEventListener('resize', hide)
}

function bindWheelZoom() {
  const sc = $('#page-scroll')
  if (!sc) return
  sc.addEventListener(
    'wheel',
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (!S.doc || S.doc.kind !== 'pdf') return
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.0007)
      previewZoom((zoomPreviewZ ?? S.zoom) * factor)
    },
    { passive: false }
  )

  // 双指捏合
  let pinch = null
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  sc.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2 && S.doc?.kind === 'pdf') pinch = { d: dist(e.touches), z: zoomPreviewZ ?? S.zoom }
    },
    { passive: true }
  )
  sc.addEventListener(
    'touchmove',
    (e) => {
      if (!pinch || e.touches.length !== 2) return
      e.preventDefault()
      const k = dist(e.touches) / Math.max(1, pinch.d)
      previewZoom(pinch.z * k)
    },
    { passive: false }
  )
  sc.addEventListener('touchend', () => {
    pinch = null
  })
  sc.addEventListener('touchcancel', () => {
    pinch = null
  })
}

// 当前页：以视口顶部最近的页为准
function currentPage() {
  const sc = $('#page-scroll')
  const top = sc.getBoundingClientRect().top
  let best = 1
  let bestD = Infinity
  for (const el of document.querySelectorAll('.page')) {
    const d = Math.abs(el.getBoundingClientRect().top - top - 10)
    if (d < bestD) {
      bestD = d
      best = +el.dataset.page
    }
  }
  return best
}

function gotoPage(n) {
  if (!S.doc || S.doc.kind !== 'pdf') return
  const total = document.querySelectorAll('.page').length
  const page = Math.min(total, Math.max(1, n))
  const el = document.querySelector(`.page[data-page="${page}"]`)
  if (!el) return
  const sc = $('#page-scroll')
  const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 10
  sc.scrollTop = Math.max(0, top) // 直接切页，不做平滑滚动
  updatePageNav()
}

function turnPage(dir) {
  gotoPage(currentPage() + dir)
}

function setZoom(z) {
  S.zoom = clampZoom(z)
  localStorage.setItem('dt:zoom', S.zoom)
  updateZoomLabel()
  hideFloat()
  if (!S.doc) return
  if (S.doc.kind === 'pdf') relayoutPages()
  else {
    const sheet = $('#sheet')
    if (sheet) sheet.style.zoom = S.zoom
  }
}


function syncAnthropicNote() {
  const note = $('#anthropic-note')
  if (!note) return
  const fmt = $('#cfg-format')?.value
  const vfmt = $('#cfg-vision-format')?.value
  const base = ($('#cfg-base')?.value || '').toLowerCase()
  const vbase = ($('#cfg-vision-base')?.value || '').toLowerCase()
  const isAnthropic = fmt === 'anthropic' || vfmt === 'anthropic' || /anthropic\.com/.test(base) || /anthropic\.com/.test(vbase)
  note.hidden = !isAnthropic
}

function openSettings() {
  $('#cfg-base').value = S.cfg?.baseUrl || ''
  $('#cfg-model').value = S.cfg?.model || ''
  $('#cfg-vision').value = S.cfg?.visionModel || ''
  $('#cfg-vision-base').value = S.cfg?.visionBaseUrl || ''
  $('#cfg-vision-key').value = ''
  $('#cfg-format').value = S.cfg?.apiFormat || 'auto'
  $('#cfg-vision-format').value = S.cfg?.visionFormat || 'auto'
  $('#cfg-key').value = ''
  const sver = $('#settings-ver')
  if (sver) sver.textContent = `当前版本 ${UI_VERSION} · ${APP_VERSION}`
  const upChk = $('#cfg-update-check')
  if (upChk) upChk.checked = localStorage.getItem('dt:verCheckOff') !== '1'
  syncAnthropicNote()
  $('#cfg-format')?.addEventListener('change', syncAnthropicNote)
  $('#cfg-vision-format')?.addEventListener('change', syncAnthropicNote)
  $('#cfg-base')?.addEventListener('input', syncAnthropicNote)
  const noAsk = $('#cfg-ask-remove')
  if (noAsk) noAsk.checked = localStorage.getItem(NO_ASK_REMOVE) !== '1'
  $('#settings').hidden = false
}

async function openUsage() {
  const m = $('#usage')
  if (!m) return
  m.hidden = false
  const body = $('#usage-body')
  body.innerHTML = '<p class="usage-empty">加载中…</p>'
  try {
    const data = await apiFetch('/api/usage').then((r) => r.json())
    const t = data.totals || {}
    const pct = Math.round((t.hitRate || 0) * 100)
    const fmt = (n) => formatTokens(n)
    const rows = (data.days || [])
      .slice()
      .reverse()
      .map(
        (d) => `<tr><td>${esc(d.date)}</td><td class="num">${fmt(d.total)}</td><td class="num">${fmt(d.cacheHit)}</td><td class="num">${d.requests}</td></tr>`
      )
      .join('')
    const docs = (data.docs || [])
      .map((d) => `<tr><td>${esc(d.title)}</td><td class="num">${fmt(d.total)}</td><td class="num">${d.requests}</td></tr>`)
      .join('')
    body.innerHTML = `
      <div class="usage-total">
        <div><b>${fmt(t.total)}</b><span>总 tokens</span></div>
        <div><b>${pct}%</b><span>缓存命中率</span></div>
        <div><b>${fmt(t.cacheHit)}</b><span>缓存命中</span></div>
        <div><b>${t.requests || 0}</b><span>提问数</span></div>
      </div>
      <div class="usage-sec">最近 14 天</div>
      <table class="usage-table"><thead><tr><th>日期</th><th class="num">tokens</th><th class="num">缓存命中</th><th class="num">提问</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="usage-empty">还没有记录</td></tr>'}</tbody></table>
      <div class="usage-sec">按文档</div>
      <table class="usage-table"><thead><tr><th>文档</th><th class="num">tokens</th><th class="num">提问</th></tr></thead><tbody>${docs || '<tr><td colspan="3" class="usage-empty">还没有记录</td></tr>'}</tbody></table>`
  } catch (e) {
    body.innerHTML = '<p class="usage-empty">加载失败：' + esc(String(e.message || e)) + '</p>'
  }
}

async function saveSettings() {
  const body = {
    baseUrl: $('#cfg-base').value.trim(),
    model: $('#cfg-model').value.trim(),
    visionModel: $('#cfg-vision').value.trim(),
    visionBaseUrl: $('#cfg-vision-base').value.trim(),
    apiFormat: $('#cfg-format').value,
    visionFormat: $('#cfg-vision-format').value,
    apiKey: $('#cfg-key').value.trim()
  }
  const vk = $('#cfg-vision-key').value.trim()
  if (vk) body.visionApiKey = vk
  await apiFetch('/api/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  await loadState()
  $('#settings').hidden = true
  toast('设置已保存')
}

/* ================= 绑定 ================= */
/* ================= 工具条：页码 / 旋转 / 高亮 ================= */
function updateToolbar() {
  const pdf = Boolean(S.doc && S.doc.kind === 'pdf')
  $('#page-nav').hidden = !pdf
  $('#btn-rotate').hidden = !pdf
  $('#btn-hl').classList.toggle('on', S.hlMode)
  $('#btn-eraser').classList.toggle('on', S.eraser)
  $('#hl-colors').hidden = !S.hlMode
  $('#pages').classList.toggle('eraser', S.eraser)
  for (const d of document.querySelectorAll('#hl-colors .dot')) {
    d.style.background = d.dataset.color
    d.classList.toggle('sel', d.dataset.color === S.hlColor)
  }
  updatePageNav()
}

function updatePageNav() {
  if (!S.doc || S.doc.kind !== 'pdf') return
  const total = document.querySelectorAll('.page').length
  const cur = currentPage()
  const inp = $('#page-input')
  if (document.activeElement !== inp) inp.value = cur
  $('#page-total').textContent = String(total)
  $('#btn-prev').disabled = cur <= 1
  $('#btn-next').disabled = cur >= total
}

let navTimer = 0
function onScrollerScroll() {
  clearTimeout(navTimer)
  navTimer = setTimeout(updatePageNav, 120)
}

function renderHighlights() {
  // 旋转视图下坐标会错位，先不画（避免高亮跑到别处）
  const hide = rotationNow() !== 0
  for (const el of document.querySelectorAll('.page')) {
    let layer = el.querySelector('.hl-layer')
    if (!layer) {
      layer = document.createElement('div')
      layer.className = 'hl-layer'
      el.insertBefore(layer, el.firstChild)
    }
    layer.innerHTML = ''
    if (hide) continue
    const n = +el.dataset.page
    for (const h of S.highlights) {
      if (h.page !== n || !Array.isArray(h.rects)) continue
      for (const r of h.rects) {
        const d = document.createElement('div')
        d.className = 'hl'
        d.dataset.id = h.id
        d.style.setProperty('--c', h.color || '#ffe066')
        d.style.left = r.x * 100 + '%'
        d.style.top = r.y * 100 + '%'
        d.style.width = r.w * 100 + '%'
        d.style.height = r.h * 100 + '%'
        layer.appendChild(d)
      }
    }
  }
}

function saveHighlights() {
  clearTimeout(S.hlSaveTimer)
  S.hlSaveTimer = setTimeout(async () => {
    if (!S.doc) return
    try {
      await apiFetch('/api/highlights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ docId: S.doc.id, highlights: S.highlights })
      })
    } catch {}
  }, 400)
}

function addHighlight(anchor) {
  if (!anchor || !Array.isArray(anchor.rects) || !anchor.rects.length) return
  const sig = `${anchor.page}|${anchor.rects
    .map((r) => [r.x, r.y, r.w, r.h].map((v) => Number(v).toFixed(3)).join(','))
    .join(';')}`
  if (S.highlights.some((h) => h.page === anchor.page && h.sig === sig)) return
  S.highlights.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    page: anchor.page,
    rects: anchor.rects,
    color: S.hlColor,
    text: (anchor.quote || '').slice(0, 300),
    sig,
    createdAt: Date.now()
  })
  renderHighlights()
  saveHighlights()
}

async function rotateView() {
  if (!S.doc || S.doc.kind !== 'pdf') return
  S.rotation = (S.rotation + 90) % 360
  await relayoutPages()
  renderHighlights()
  updateToolbar()
}

/* ================= 文档内搜索 ================= */
let searchTimer = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function openSearch() {
  if (!S.doc) return
  $('#search-bar').hidden = false
  $('#search-input').focus()
  $('#search-input').select()
}

function closeSearch() {
  clearTimeout(searchTimer) // 防抖里还排着一次 runSearch，不清掉会在关掉后画出高亮并滚动页面
  $('#search-bar').hidden = true
  S.matches = []
  S.matchIdx = -1
  S.searchQ = ''
  $('#search-count').textContent = '0/0'
  document.querySelectorAll('.search-hit').forEach((x) => x.remove())
}

function collectMatches(q) {
  const needle = q.toLowerCase()
  const out = []
  for (const p of S.doc?.pages || []) {
    const hay = (p.text || '').toLowerCase()
    let i = 0
    let ordinal = 0
    while (out.length < 800 && (i = hay.indexOf(needle, i)) !== -1) {
      out.push({ page: p.no, ordinal })
      ordinal++
      i += Math.max(1, needle.length)
    }
  }
  return out
}

function runSearch(q) {
  S.searchQ = q
  S.matches = q ? collectMatches(q) : []
  S.matchIdx = S.matches.length ? 0 : -1
  if (!S.matches.length) {
    $('#search-count').textContent = q ? '0/0' : ''
    document.querySelectorAll('.search-hit').forEach((x) => x.remove())
    return
  }
  jumpMatch(0)
}

async function jumpMatch(dir) {
  if (!S.matches.length) return
  const total = S.matches.length
  S.matchIdx = dir === 0 ? 0 : (S.matchIdx + dir + total) % total
  const m = S.matches[S.matchIdx]
  $('#search-count').textContent = `${S.matchIdx + 1}/${total}`
  const q = S.searchQ
  if (!q) return
  if (S.doc.kind === 'pdf') {
    gotoPage(m.page)
    const pageEl = await waitPageRendered(m.page)
    paintInPage(pageEl, q, m.ordinal || 0)
    pageEl?.scrollIntoView({ block: 'center' })
  } else {
    paintInSheet(q)
  }
}

async function waitPageRendered(n, timeout = 2500) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const el = document.querySelector(`.page[data-page="${n}"]`)
    if (el && el.querySelectorAll('.textLayer span').length) return el
    await sleep(80)
  }
  return document.querySelector(`.page[data-page="${n}"]`)
}

function paintRects(container, rects, active = false) {
  const cr = container.getBoundingClientRect()
  for (const r of rects) {
    if (!r.width || !r.height) continue
    const d = document.createElement('div')
    d.className = 'search-hit' + (active ? ' current' : '')
    d.style.left = ((r.left - cr.left) / cr.width) * 100 + '%'
    d.style.top = ((r.top - cr.top) / cr.height) * 100 + '%'
    d.style.width = (r.width / cr.width) * 100 + '%'
    d.style.height = (r.height / cr.height) * 100 + '%'
    container.appendChild(d)
  }
}

function paintInPage(pageEl, q, activeOrdinal = 0) {
  if (!pageEl) return
  document.querySelectorAll('.page .search-hit').forEach((x) => x.remove())
  const layer = pageEl.querySelector('.textLayer')
  if (!layer) return
  const spans = [...layer.querySelectorAll('span')]
  let text = ''
  const starts = []
  for (const s of spans) {
    starts.push(text.length)
    text += s.textContent
  }
  const low = text.toLowerCase()
  const ql = q.toLowerCase()
  let i = 0
  let ordinal = 0
  while (ordinal < 200 && (i = low.indexOf(ql, i)) !== -1) {
    const end = i + q.length
    let si = 0
    while (si + 1 < spans.length && starts[si + 1] <= i) si++
    let ei = si
    while (ei + 1 < spans.length && starts[ei + 1] < end) ei++
    const sNode = spans[si]?.firstChild
    const eNode = spans[ei]?.firstChild
    if (sNode && eNode) {
      const range = document.createRange()
      try {
        range.setStart(sNode, Math.max(0, i - starts[si]))
        range.setEnd(eNode, Math.min(eNode.length, end - starts[ei]))
        paintRects(pageEl, [...range.getClientRects()], ordinal === activeOrdinal)
      } catch {}
    }
    ordinal++
    i += Math.max(1, q.length)
  }
}

function paintInSheet(q) {
  const sheet = $('#sheet')
  if (!sheet) return
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT)
  const nodes = []
  const starts = []
  let text = ''
  let n
  while ((n = walker.nextNode())) {
    nodes.push(n)
    starts.push(text.length)
    text += n.textContent
  }
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return
  const end = i + q.length
  let si = 0
  while (si + 1 < nodes.length && starts[si + 1] <= i) si++
  let ei = si
  while (ei + 1 < nodes.length && starts[ei + 1] < end) ei++
  const range = document.createRange()
  range.setStart(nodes[si], Math.max(0, i - starts[si]))
  range.setEnd(nodes[ei], Math.min(nodes[ei].length, end - starts[ei]))
  paintRects(sheet, [...range.getClientRects()], true)
  range.startContainer.parentElement?.scrollIntoView({ block: 'center' })
}

/* ================= 追问树结构图 ================= */
const SVGNS = 'http://www.w3.org/2000/svg'
const tv = { x: 40, y: 30, k: 1, g: null }

function openTreeView() {
  if (!S.doc) return
  $('#treeview').hidden = false
  renderTreeGraph()
}

function closeTreeView() {
  $('#treeview').hidden = true
}

function renderTreeGraph() {
  const svg = $('#tv-svg')
  svg.innerHTML = ''
  const nodes = Object.values(S.tree.nodes || {})
  if (!nodes.length) {
    const t = document.createElementNS(SVGNS, 'text')
    t.setAttribute('x', '40')
    t.setAttribute('y', '60')
    t.setAttribute('fill', '#7f8aa0')
    t.setAttribute('font-size', '14')
    t.textContent = '还没有追问'
    svg.appendChild(t)
    return
  }

  const NODE_W = 216
  const NODE_H = 62
  const GAP_X = 64
  const GAP_Y = 22

  const byParent = new Map()
  for (const n of nodes) {
    const key = n.parentId || 'root'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(n)
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.createdAt - b.createdAt)

  const pos = new Map()
  let cursor = 0
  let maxX = 0
  const walk = (id, depth) => {
    const kids = byParent.get(id) || []
    let y
    if (!kids.length) {
      y = cursor
      cursor += NODE_H + GAP_Y
    } else {
      const ys = kids.map((k) => walk(k.id, depth + 1))
      y = (ys[0] + ys[ys.length - 1]) / 2
    }
    pos.set(id, { x: depth * (NODE_W + GAP_X), y })
    maxX = Math.max(maxX, depth * (NODE_W + GAP_X) + NODE_W)
    return y
  }
  ;(byParent.get('root') || []).forEach((r) => walk(r.id, 0))

  const g = document.createElementNS(SVGNS, 'g')
  svg.appendChild(g)
  tv.g = g

  for (const n of nodes) {
    if (!n.parentId) continue
    const p = pos.get(n.parentId)
    const c = pos.get(n.id)
    if (!p || !c) continue
    const x1 = p.x + NODE_W
    const y1 = p.y + NODE_H / 2
    const x2 = c.x
    const y2 = c.y + NODE_H / 2
    const mx = (x1 + x2) / 2
    const path = document.createElementNS(SVGNS, 'path')
    path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`)
    path.setAttribute('fill', 'none')
    path.style.stroke = 'var(--line-2)'
    path.setAttribute('stroke-width', '1.6')
    g.appendChild(path)
  }

  for (const n of nodes) {
    const p = pos.get(n.id)
    if (!p) continue
    const grp = document.createElementNS(SVGNS, 'g')
    grp.setAttribute('transform', `translate(${p.x},${p.y})`)
    grp.style.cursor = 'pointer'

    const rect = document.createElementNS(SVGNS, 'rect')
    rect.setAttribute('width', NODE_W)
    rect.setAttribute('height', NODE_H)
    rect.setAttribute('rx', '10')
    rect.style.fill = 'var(--panel-3)'
    rect.style.stroke = n.anchor?.kind === 'answer' ? 'var(--accent-line)' : 'var(--line-2)'
    grp.appendChild(rect)

    const fo = document.createElementNS(SVGNS, 'foreignObject')
    fo.setAttribute('x', '0')
    fo.setAttribute('y', '0')
    fo.setAttribute('width', String(NODE_W))
    fo.setAttribute('height', String(NODE_H))
    const div = document.createElement('div')
    div.className = 'tv-node'
    div.innerHTML = `<div class="tv-q">${esc(trunc(n.question || '（无问题）', 48))}</div><div class="tv-quote">${esc(
      trunc(n.anchor?.quote || '整篇文档', 26)
    )}</div>`
    fo.appendChild(div)
    grp.appendChild(fo)
    grp.addEventListener('click', (e) => {
      e.stopPropagation()
      jumpToNode(n.id)
    })
    g.appendChild(grp)
  }

  const box = svg.getBoundingClientRect()
  const contentW = maxX
  const contentH = Math.max(cursor, NODE_H)
  const k = Math.min(1.5, (box.width - 80) / Math.max(1, contentW), (box.height - 80) / Math.max(1, contentH))
  tv.k = Math.max(0.2, k)
  tv.x = Math.max(40, (box.width - contentW * tv.k) / 2)
  tv.y = Math.max(30, (box.height - contentH * tv.k) / 2)
  applyTv()
}

function applyTv() {
  if (tv.g) tv.g.setAttribute('transform', `translate(${tv.x},${tv.y}) scale(${tv.k})`)
}

function jumpToNode(id) {
  let cur = S.tree.nodes[id]
  while (cur) {
    S.collapsed.delete(cur.id)
    cur = cur.parentId ? S.tree.nodes[cur.parentId] : null
  }
  closeTreeView()
  renderTree()
  const el = document.querySelector(`.node[data-id="${id}"]`)
  if (!el) return
  el.scrollIntoView({ block: 'center' })
  el.classList.add('tv-flash')
  setTimeout(() => el.classList.remove('tv-flash'), 1200)
}

function bindTreeView() {
  const canvas = $('#tv-canvas')
  if (!canvas) return
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const r = canvas.getBoundingClientRect()
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      const k2 = Math.min(2.5, Math.max(0.2, tv.k * Math.exp(-e.deltaY * 0.0012)))
      tv.x = mx - ((mx - tv.x) * k2) / tv.k
      tv.y = my - ((my - tv.y) * k2) / tv.k
      tv.k = k2
      applyTv()
    },
    { passive: false }
  )

  let drag = null
  canvas.addEventListener('mousedown', (e) => {
    if (e.target.closest('.tv-node')) return
    drag = { dx: e.clientX - tv.x, dy: e.clientY - tv.y }
    canvas.classList.add('dragging')
  })
  window.addEventListener('mousemove', (e) => {
    if (!drag) return
    tv.x = e.clientX - drag.dx
    tv.y = e.clientY - drag.dy
    applyTv()
  })
  window.addEventListener('mouseup', () => {
    drag = null
    canvas.classList.remove('dragging')
  })
}

function bind() {
  $('#file-input').addEventListener('change', (e) => {
    importFiles(Array.from(e.target.files || []))
    e.target.value = ''
  })

  window.addEventListener('dragover', (e) => e.preventDefault())
  window.addEventListener('drop', (e) => {
    e.preventDefault()
    if (e.dataTransfer?.files?.length) importFiles(Array.from(e.dataTransfer.files))
  })

  $('#cfg-update-check')?.addEventListener('change', (e) => {
    if (e.target.checked) localStorage.removeItem('dt:verCheckOff')
    else localStorage.setItem('dt:verCheckOff', '1')
  })

  $('#cfg-ask-remove')?.addEventListener('change', (e) => {
    if (e.target.checked) localStorage.removeItem(NO_ASK_REMOVE)
    else localStorage.setItem(NO_ASK_REMOVE, '1')
  })

  $('#btn-send').addEventListener('click', () => send())
  $('#stale-x')?.addEventListener('click', () => { const el = $('#stale'); if (el) el.hidden = true })

  const locateBtn = $('#btn-locate')
  if (locateBtn) {
    locateBtn.addEventListener('click', () => {
      const items = document.querySelectorAll('#tree .node')
      const el = items[items.length - 1]
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.remove('flash')
      void el.offsetWidth
      el.classList.add('flash')
      setTimeout(() => el.classList.remove('flash'), 1100)
    })
  }

  $('#effort').addEventListener('input', () => {
    $('#effort-label').textContent = EFFORT_LABELS[Number($('#effort').value)]
    paintRange($('#effort'))
  })
  $('#effort').addEventListener('change', async () => {
    const i = Number($('#effort').value)
    S.cfg.effort = EFFORT_IDS[i]
    await apiFetch('/api/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ effort: S.cfg.effort })
    })
    toast(`思考强度：${EFFORT_LABELS[i]}`)
  })
  $('#q').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      send()
    }
  })
  $('#q').addEventListener('input', autoGrowComposer)
  setTimeout(autoGrowComposer, 0)

  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('mousedown', (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('#float-menu')) hideFloat()
  })

  // iOS Safari：长按选中后不触发 mouseup，用 touchend 补一次浮层
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) {
    document.addEventListener(
      'touchend',
      (e) => {
        const t = e.target
        if (
          t instanceof Element &&
          (t.closest('#float-menu') || t.closest('#toolbar') || t.closest('#composer') || t.closest('#search-bar'))
        ) {
          return
        }
        setTimeout(() => {
          const sel = window.getSelection()
          if (sel && !sel.isCollapsed && sel.toString().trim()) onMouseUp(e)
        }, 260)
      },
      { passive: true }
    )
  }

  const zoomHold = (btn, dir) => {
    if (!btn) return
    let hold = 0
    let rep = 0
    const bump = () => previewZoom((zoomPreviewZ ?? S.zoom) + dir * 0.01)
    const stop = () => {
      clearTimeout(hold)
      clearInterval(rep)
      rep = 0
    }
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      bump()
      hold = setTimeout(() => {
        rep = setInterval(bump, 60)
      }, 320)
    })
    btn.addEventListener('pointerup', stop)
    btn.addEventListener('pointerleave', stop)
    btn.addEventListener('pointercancel', stop)
  }
  zoomHold($('#btn-zoom-in'), 1)
  zoomHold($('#btn-zoom-out'), -1)
  $('#zoom-label').addEventListener('dblclick', () => setZoom(1))
  bindWheelZoom()
  bindPageMenu()
  $('#btn-shot').addEventListener('click', () => toggleShot())
  $('#btn-instr')?.addEventListener('click', () => setInstrMode(!S.instrMode))
  $('#btn-web')?.addEventListener('click', () => setWebSearch(!S.webSearch))

  document.addEventListener('paste', (e) => {
    const items = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith('image/'))
    if (!items.length) return
    e.preventDefault()
    const files = items
      .map((i) => i.getAsFile())
      .filter(Boolean)
      .map((f, i) => {
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
        const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
        return new File([f], `剪贴板-${stamp}${i ? '-' + i : ''}.${ext}`, { type: f.type })
      })
    if (files.length) {
      toast(`从剪贴板导入 ${files.length} 张图片`)
      importFiles(files)
    }
  })
  $('#btn-stop')?.addEventListener('click', () => {
    if (S.abort) S.abort.abort()
  })
  $('#doc-meta')?.addEventListener('click', (e) => {
    if (e.target.closest('.meta-instr')) {
      e.stopPropagation()
      openInstrPop()
    }
  })
  $('#instr-clear')?.addEventListener('click', clearInstructions)
  document.addEventListener('mousedown', (e) => {
    const pop = $('#instr-pop')
    if (!pop || pop.hidden) return
    if (!pop.contains(e.target) && !e.target.closest('.meta-instr')) closeInstrPop()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeInstrPop()
  })
  const comp = $('#composer')
  comp?.addEventListener('pointerdown', (e) => {
    if (!(e.target instanceof Element)) return
    if (e.target.closest('input, textarea, button, .chip-x')) return
    setTimeout(() => window.DTFocus?.focus({ end: true, external: true }), 0)
  })
  $('#btn-group')?.addEventListener('click', () => (S.selecting ? cancelSelecting() : startSelecting()))
  $('#group-create')?.addEventListener('click', createGroupFromSelection)
  $('#group-cancel')?.addEventListener('click', cancelSelecting)

  // 工具条：页码 / 旋转 / 荧光笔 / 擦除
  $('#btn-prev').addEventListener('click', () => turnPage(-1))
  $('#btn-next').addEventListener('click', () => turnPage(1))
  $('#page-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const n = parseInt($('#page-input').value, 10)
      if (n) gotoPage(n)
      $('#page-input').blur()
      // blur 之后焦点会掉到 body，直接还给输入框
      setTimeout(() => window.DTFocus?.focus({ end: true, external: true }), 0)
    }
  })
  $('#page-input').addEventListener('blur', updatePageNav)
  $('#btn-rotate').addEventListener('click', rotateView)
  $('#btn-search').addEventListener('click', openSearch)
  $('#btn-hl').addEventListener('click', () => {
    S.hlMode = !S.hlMode
    if (S.hlMode) S.eraser = false
    updateToolbar()
  })
  $('#btn-eraser').addEventListener('click', () => {
    S.eraser = !S.eraser
    if (S.eraser) S.hlMode = false
    updateToolbar()
  })
  $('#hl-colors').addEventListener('click', (e) => {
    const dot = e.target.closest('.dot')
    if (!dot) return
    S.hlColor = dot.dataset.color
    updateToolbar()
  })
  $('#page-scroll').addEventListener('scroll', onScrollerScroll, { passive: true })
  $('#page-scroll').addEventListener('scroll', () => {
    scheduleRelease(600)
    scheduleHeal(500)
  }, { passive: true })
  $('#page-scroll').addEventListener('scrollend', () => {
    scheduleRelease(150)
    scheduleHeal(120)
  }, { passive: true })
  $('#pages').addEventListener('pointerdown', () => {
    if (S.doc && S.doc.kind === 'pdf') scheduleHeal(0)
  })

  // 休眠 / 切后台后画布可能被系统回收成白板，回来时自动重绘
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleHeal(500, true)
  })
  window.addEventListener('focus', () => scheduleHeal(600, true))
  window.addEventListener('pageshow', () => scheduleHeal(700, true))
  document.addEventListener('resume', () => scheduleHeal(400, true))

  // 兜底巡检：休眠唤醒偶尔不触发任何事件，每 20 秒查一次可视区画布
  setInterval(() => {
    if (document.visibilityState === 'visible') healBlankPages()
  }, 20000)
  $('#pages').addEventListener('click', (e) => {
    if (!S.eraser) return
    const hl = e.target.closest('.hl')
    if (!hl) return
    e.preventDefault()
    e.stopPropagation()
    S.highlights = S.highlights.filter((h) => h.id !== hl.dataset.id)
    renderHighlights()
    saveHighlights()
    toast('已删除一条高亮')
  })

  // 搜索
  $('#search-input').addEventListener('input', () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => runSearch($('#search-input').value.trim()), 220)
  })
  $('#search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      jumpMatch(e.shiftKey ? -1 : 1)
    }
  })
  $('#search-next').addEventListener('click', () => jumpMatch(1))
  $('#search-prev').addEventListener('click', () => jumpMatch(-1))
  $('#search-close').addEventListener('click', closeSearch)

  $('#pages').addEventListener('mousedown', onShotDown, true)
  window.addEventListener('mousemove', onShotMove)
  window.addEventListener('mouseup', onShotUp)

  $('#anchor-chip .chip-x').addEventListener('click', () => {
    S.pendingAnchor = null
    S.pendingParent = null
    updateChip()
  })
  $('#shot-chip .chip-x').addEventListener('click', () => {
    S.pendingShot = null
    S.pendingAnchor = null
    updateChip()
  })

  $('#btn-settings').addEventListener('click', openSettings)
  $('#btn-sidebar')?.addEventListener('click', () => setLeftCollapsed(!$('#app').classList.contains('collapsed')))
  $('#btn-collapse')?.addEventListener('click', () => setLeftCollapsed(true))
  $('#btn-expand')?.addEventListener('click', () => setLeftCollapsed(false))
  bindResizers()
  $('#cfg-cancel').addEventListener('click', () => ($('#settings').hidden = true))
  $('#cfg-save').addEventListener('click', saveSettings)
  $('#btn-usage')?.addEventListener('click', openUsage)
  $('#usage-close')?.addEventListener('click', () => ($('#usage').hidden = true))
  $('#usage')?.addEventListener('click', (e) => { if (e.target.id === 'usage') $('#usage').hidden = true })
  $('#settings').addEventListener('click', (e) => {
    if (e.target.id === 'settings') $('#settings').hidden = true
  })

  $('#btn-export').addEventListener('click', () => {
    if (!S.doc) return toast('先打开文档')
    if (window.DT_LOCAL) return window.DTLocal.downloadExport(S.doc.id)
    location.href = `/api/export/${S.doc.id}`
  })
  $('#btn-treeview').addEventListener('click', openTreeView)
  $('#tv-close').addEventListener('click', closeTreeView)
  $('#treeview').addEventListener('click', (e) => {
    if (e.target.id === 'treeview') closeTreeView()
  })
  bindTreeView()

  document.addEventListener('keydown', (e) => {
    // 这里只管快捷键；“焦点丢了还能打字”的兜底统一由文件末尾的 DTFocus 负责
    // Ctrl/Cmd +/- 缩放页面，Ctrl/Cmd 0 回到 100%
    if ((e.ctrlKey || e.metaKey) && !e.altKey && S.doc) {
      const k = e.key
      const cur = zoomPreviewZ ?? S.zoom
      if (k === '=' || k === '+') {
        e.preventDefault()
        previewZoom(cur * 1.12)
        return
      }
      if (k === '-' || k === '_') {
        e.preventDefault()
        previewZoom(cur / 1.12)
        return
      }
      if (k === '0') {
        e.preventDefault()
        previewZoom(1)
        return
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      openSearch()
      return
    }
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, [contenteditable="true"], .modal')) return
      if (!S.doc || S.shotMode) return
      e.preventDefault()
      const sc = $('#page-scroll')
      if (e.key === 'Home') sc.scrollTop = 0
      else if (e.key === 'End') sc.scrollTop = sc.scrollHeight
      else if (e.key === 'PageUp') sc.scrollTop -= sc.clientHeight * 0.9
      else if (e.key === 'PageDown') sc.scrollTop += sc.clientHeight * 0.9
      else sc.scrollTop += (e.key === 'ArrowUp' ? -1 : 1) * 90
      updatePageNav()
      return
    }
    if (e.key === 'Escape' && !$('#search-bar').hidden) {
      closeSearch()
      return
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, [contenteditable="true"], .modal')) return
      if (S.shotMode) return
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed && sel.toString().trim()) return
      if (!S.doc || S.doc.kind !== 'pdf') return
      e.preventDefault()
      turnPage(e.key === 'ArrowRight' ? 1 : -1)
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      setLeftCollapsed(!$('#app').classList.contains('collapsed'))
      return
    }
    if (e.key === 'Escape') {
      hideFloat()
      $('#settings').hidden = true
      $('#treeview').hidden = true
      if (S.shotMode) toggleShot(false)
      if (S.hlMode || S.eraser) {
        S.hlMode = false
        S.eraser = false
        updateToolbar()
      }
    }
  })

  window.addEventListener('resize', () => {
    hideFloat()
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      applySavedWidths(true)
      refitPdf()
    }, 160)
  })
}

