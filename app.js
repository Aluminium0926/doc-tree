import { marked } from './vendor/marked.esm.js'
marked.setOptions({ gfm: true, breaks: true })

// 静态资源基址：兼容「根路径」和「子路径部署」（如 GitHub Pages /doc-tree/）
const VENDOR = new URL('./vendor/', import.meta.url).href

const $ = (s, r = document) => r.querySelector(s)
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const trunc = (s, n) => {
  s = String(s || '')
  return s.length > n ? s.slice(0, n) + '…' : s
}

const EFFORT_IDS = ['low', 'high', 'max']
const EFFORT_LABELS = ['轻', '标准', '深度']
const UI_VERSION = 'v47'
console.log('[DocTree] UI', UI_VERSION)

let hljsPromise = null
function ensureHljs() {
  if (window.hljs) return Promise.resolve(window.hljs)
  hljsPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `${VENDOR}highlight/highlight.min.js`
    s.onload = () => resolve(window.hljs)
    s.onerror = () => reject(new Error('highlight.js 加载失败'))
    document.head.appendChild(s)
  })
  return hljsPromise
}

const EXT_BY_LANG = {
  python: 'py', py: 'py', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
  bash: 'sh', shell: 'sh', sh: 'sh', zsh: 'sh', json: 'json', html: 'html', xml: 'xml',
  css: 'css', sql: 'sql', java: 'java', kotlin: 'kt', c: 'c', cpp: 'cpp', 'c++': 'cpp',
  csharp: 'cs', 'c#': 'cs', go: 'go', rust: 'rs', ruby: 'rb', php: 'php', swift: 'swift',
  yaml: 'yml', yml: 'yml', markdown: 'md', md: 'md', diff: 'diff', plaintext: 'txt', text: 'txt'
}

// 把 <pre><code> 变成带语言标签、复制/下载按钮的代码卡片（对齐 DeepSeek 的样式）
function enhanceCodeBlocks(root) {
  if (!root) return
  const pres = [...root.querySelectorAll('pre')].filter((p) => !p.closest('.code-card') && p.querySelector('code'))
  if (!pres.length) return
  const codes = []
  for (const pre of pres) {
    const code = pre.querySelector('code')
    const lang = (code.className.match(/(?:language|lang)-([\w+#.-]+)/) || [])[1] || ''
    const card = document.createElement('div')
    card.className = 'code-card'
    const head = document.createElement('div')
    head.className = 'code-head'
    const label = document.createElement('span')
    label.className = 'code-lang'
    label.textContent = lang || 'text'
    const actions = document.createElement('div')
    actions.className = 'code-actions'

        const ICON_COPY = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5.5 14.5V6A2.5 2.5 0 0 1 8 3.5h8.5"/></svg>'
    const ICON_DOWN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10"/><path d="m8 10.5 4 4 4-4"/><path d="M4.5 19.5h15"/></svg>'
    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'code-btn'
    copyBtn.innerHTML = ICON_COPY + '<span>复制</span>'
    copyBtn.addEventListener('click', async () => {
      const text = code.innerText
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        try {
          document.execCommand('copy')
        } catch {}
        ta.remove()
      }
      copyBtn.querySelector('span').textContent = '已复制'
      setTimeout(() => (copyBtn.querySelector('span').textContent = '复制'), 1200)
    })

    const dlBtn = document.createElement('button')
    dlBtn.type = 'button'
    dlBtn.className = 'code-btn'
    dlBtn.innerHTML = ICON_DOWN + '<span>下载</span>'
    dlBtn.addEventListener('click', () => {
      const ext = EXT_BY_LANG[lang] || 'txt'
      const blob = new Blob([code.innerText], { type: 'text/plain;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `code.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    })

    actions.append(copyBtn, dlBtn)
    head.append(label, actions)
    pre.replaceWith(card)
    card.append(head, pre)
    codes.push(code)
  }

  const highlight = (h) => {
    if (!h) return
    for (const code of codes) {
      try {
        h.highlightElement(code)
      } catch {}
    }
  }
  if (window.hljs) highlight(window.hljs)
  else ensureHljs().then(highlight).catch(() => {})
}

// 先抽出公式占位，Markdown 渲染完再交给 KaTeX，避免换行/<br> 把 $$ 块切碎
function renderMarkdown(src) {
  const store = []
  const fences = []
  let s = String(src || '')

  s = s.replace(/```[\s\S]*?```/g, (m) => {
    fences.push(m)
    return `\u0001F${fences.length - 1}\u0001F`
  })

  const stash = (tex, display) => {
    store.push({ tex, display })
    return `%%M${store.length - 1}%%`
  }

  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => stash(m.trim(), true))
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => stash(m.trim(), true))
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => stash(m.trim(), false))
  s = s.replace(/\$([^$\n]+?)\$/g, (m, inner) => {
    // 货币写法通常带空格（"$5 and $10"），公式一般紧贴 $；据此排除
    if (/^\s|\s$/.test(inner)) return m
    return stash(inner.trim(), false)
  })

  s = s.replace(/\u0001F(\d+)\u0001F/g, (_, i) => fences[+i])

  let html = marked.parse(s)
  html = html.replace(/%%M(\d+)%%/g, (_, i) => {
    const it = store[+i]
    if (!it) return ''
    if (!window.katex) return `<code>${it.tex}</code>`
    try {
      return window.katex.renderToString(it.tex, { displayMode: it.display, throwOnError: false })
    } catch {
      return `<code>${it.tex}</code>`
    }
  })
  return html
}

const S = {
  cfg: null,
  docs: [],
  doc: null,
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

init()

async function init() {
  bind()
  initTheme()
  applySavedWidths()
  setLeftCollapsed(localStorage.getItem('dt:left') === '1', false)
  await loadState()
  renderLibrary()
  const qs = new URLSearchParams(location.search)
  const want = qs.get('doc') || localStorage.getItem('dt:last')
  if (want && S.docs.some((d) => d.id === want)) openDoc(want)
}

function setLeftCollapsed(v, persist = true) {
  const app = $('#app')
  const wasCollapsed = app.classList.contains('collapsed')
  const [, , rNow] = currentCols()
  app.classList.toggle('collapsed', v)
  if (persist) localStorage.setItem('dt:left', v ? '1' : '0')

  if (v && !wasCollapsed) {
    // 收起时不让右栏趁机变宽，把空间留给文档
    app.style.setProperty('--right', Math.round(rNow) + 'px')
  } else {
    applySavedWidths()
  }

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

  // 先压缩右栏，保证文档区至少 320px
  r = Math.min(r, Math.max(260, Math.min(900, W - (collapsed ? 58 : l) - minViewer)))
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
      if (canvas.width !== 300) {
        await drawPage(n, el)
      }
    }
  } finally {
    relayoutBusy = false
    const max2 = Math.max(0, sc.scrollHeight - sc.clientHeight)
    sc.scrollTop = Math.round(ratio * max2)
    if (relayoutAgain) {
      relayoutAgain = false
      relayoutPages()
    }
  }
}

async function loadState() {
  const r = await fetch('/api/state').then((x) => x.json())
  S.docs = r.docs || []
  S.cfg = r.config || {}
  if (!S.cfg.hasKey) setStatus('未配置 API Key')
  const i = Math.max(0, EFFORT_IDS.indexOf(S.cfg.effort))
  $('#effort').value = i
  $('#effort-label').textContent = EFFORT_LABELS[i]
  paintRange($('#effort'))
}

/* ================= 左侧文档库 ================= */
function renderLibrary() {
  const box = $('#doc-list')
  box.innerHTML = ''
  if (!S.docs.length) {
    box.innerHTML = '<div class="tree-empty">还没有文档</div>'
    return
  }
  for (const d of S.docs) {
    const el = document.createElement('div')
    el.className = 'doc-item' + (S.doc && S.doc.id === d.id ? ' active' : '')
    el.dataset.id = d.id
    el.innerHTML = `<span class="doc-ico" data-kind="${esc(d.kind)}">${esc((d.kind || '?').toUpperCase())}</span>
      <span class="t" title="${esc(d.title)}">${esc(d.title)}</span>
      <button class="x" title="删除">✕</button>`
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('x')) return
      openDoc(d.id)
    })
    el.querySelector('.x').addEventListener('click', async (e) => {
      e.stopPropagation()
      if (!confirm(`删除《${d.title}》及其追问树？`)) return
      await fetch(`/api/doc/${d.id}`, { method: 'DELETE' })
      if (S.doc && S.doc.id === d.id) resetViewer()
      await loadState()
      renderLibrary()
    })
    box.appendChild(el)
  }
}

async function importFiles(files) {
  for (const f of files) {
    setStatus(`解析中：${f.name}`)
    try {
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'x-filename': encodeURIComponent(f.name) },
        body: await f.arrayBuffer()
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '导入失败')
      await loadState()
      renderLibrary()
      await openDoc(j.doc.id)
      setStatus(`已导入 ${j.doc.pages} 页`)
      setTimeout(() => setStatus(''), 3000)
    } catch (e) {
      toast(e.message)
      setStatus('')
    }
  }
}

/* ================= 打开文档 ================= */
function resetViewer() {
  S.doc = null
  S.tree = { nodes: {} }
  S.pdf = null
  $('#pages').innerHTML = ''
  $('#doc-title').textContent = '未打开文档'
  $('#doc-meta').textContent = ''
  $('#hint').hidden = false
  renderTree()
}

async function openDoc(id) {
  setStatus('加载中…')
  const r = await fetch(`/api/doc/${id}`).then((x) => x.json())
  if (r.error) {
    toast(r.error)
    setStatus('')
    return
  }
  S.doc = r.doc
  S.tree = r.tree || { nodes: {} }
  S.highlights = Array.isArray(S.doc.highlights) ? S.doc.highlights : []
  S.rotation = 0
  S.hlMode = false
  S.eraser = false
  S.pendingAnchor = null
  S.pendingParent = null
  S.collapsed.clear()
  localStorage.setItem('dt:last', id)
  $('#doc-title').textContent = S.doc.title
  $('#doc-meta').textContent =
    S.doc.kind === 'pdf'
      ? `${S.doc.pages.length} 页 · PDF`
      : `${(S.doc.kind || '').toUpperCase()} · ${(S.doc.pages?.[0]?.text || '').length.toLocaleString()} 字`
  $('#hint').hidden = true
  renderLibrary()
  renderTree()
  $('#pages').innerHTML = ''
  updateZoomLabel()
  setStatus('')
  if (S.doc.kind === 'pdf') await renderPdf()
  else renderTextDoc()
  updateToolbar()
}

/* ================= PDF 渲染 ================= */
async function renderPdf() {
  S.pdfjs ??= await import(VENDOR + 'pdf.min.mjs')
  S.pdfjs.GlobalWorkerOptions.workerSrc = VENDOR + 'pdf.worker.wrapper.mjs'
  const src = window.DT_LOCAL ? await window.DTLocal.fileUrl(S.doc.id) : `/api/file/${S.doc.id}`
  const pdf = await S.pdfjs.getDocument({
    url: src,
    cMapUrl: VENDOR + 'cmaps/',
    cMapPacked: true
  }).promise
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
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || !nearView(e.target)) continue
        io.unobserve(e.target)
        drawPage(+e.target.dataset.page, e.target)
      }
    },
    { root: scroller, rootMargin: '900px 0px' }
  )

  buildingPdf = true
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
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
          await drawPage(n, el, page)
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
  const dpr = Math.min(2, window.devicePixelRatio || 1)
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
    for (const el of document.querySelectorAll('.page')) {
      if (n >= 6) break
      const canvas = el.querySelector('canvas')
      if (!canvas) continue
      const r = el.getBoundingClientRect()
      if (r.bottom < root.top - 300 || r.top > root.bottom + 300) continue
      const undrawn = canvas.width === 300
      // force：回来就整页重画；否则只补坏掉/没画过的
      if (!force && !undrawn && !canvasBlank(canvas)) continue
      n++
      try {
        await drawPage(+el.dataset.page, el)
      } catch (e) {
        console.warn('[heal]', el.dataset.page, e && e.message)
      }
    }
    if (n) renderHighlights()
  } finally {
    healing = false
  }
}


function renderTextDoc() {
  const text = S.doc.pages?.[0]?.text || ''
  const sheet = document.createElement('div')
  sheet.className = 'sheet'
  sheet.id = 'sheet'
  sheet.style.zoom = S.zoom
  if (S.doc.kind === 'md') {
    sheet.innerHTML = renderMarkdown(text)
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
  S.pendingAnchor = { kind: 'answer', nodeId: card.dataset.id, quote: sel.toString().trim() }
  S.pendingParent = card.dataset.id
  updateChip()
  showFloat(range, [{ label: '追问这段', primary: true, act: 'ask' }])
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
      // 不直接发送：只把引用挂到输入框，由你决定写不写问题、何时点「发送」
      $('#q').focus()
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
function renderTree() {
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
  enhanceCodeBlocks(ans)
  card.appendChild(ans)

  const acts = document.createElement('div')
  acts.className = 'node-actions'
  acts.innerHTML = `<button data-act="again">追问</button><button data-act="copy">复制</button><button data-act="del">删除</button>`
  acts.querySelector('[data-act="again"]').addEventListener('click', () => {
    S.pendingParent = n.id
    S.pendingAnchor = { kind: 'answer', nodeId: n.id, quote: '' }
    updateChip()
    $('#q').focus()
  })
  acts.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(n.answer || '')
    toast('已复制')
  })
  acts.querySelector('[data-act="del"]').addEventListener('click', async () => {
    if (!confirm('删除这条追问及其子分支？')) return
    await fetch('/api/node/delete', {
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
async function send(forced) {
  if (!S.doc) return toast('先打开一份文档')
  if (S.busy) return
  const anchor = S.pendingAnchor
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
  setStatus('思考中…')

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docId: S.doc.id, parentId, anchor, question: q, image })
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || `请求失败 ${res.status}`)
    }
    $('#q').value = ''
    S.pendingAnchor = null
    S.pendingParent = null
    S.pendingShot = null
    updateChip()
    await consumeStream(res)
  } catch (e) {
    toast(e.message)
    setStatus('')
  } finally {
    S.busy = false
    $('#btn-send').disabled = false
  }
}

async function consumeStream(res) {
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let node = null

  const handle = (ev) => {
    if (ev.type === 'meta') {
      node = ev.node
      S.tree.nodes[node.id] = node
      renderTree()
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
    } else if (ev.type === 'error') {
      toast(ev.message)
    } else if (ev.type === 'done' && ev.node) {
      S.tree.nodes[ev.node.id] = ev.node
      renderTree()
      document.querySelector(`.node[data-id="${ev.node.id}"]`)?.scrollIntoView({ block: 'nearest' })
      setStatus('')
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i)
      buf = buf.slice(i + 2)
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data) continue
        try {
          handle(JSON.parse(data))
        } catch {}
      }
    }
  }
}

function scrollTreeEnd() {
  const box = $('#tree')
  box.scrollTop = box.scrollHeight
}

/* ================= 截图 ================= */
function toggleShot(force) {
  if (!S.doc || S.doc.kind !== 'pdf') return toast('截图提问目前只支持 PDF')
  S.shotMode = force ?? !S.shotMode
  $('#btn-shot').classList.toggle('on', S.shotMode)
  $('#pages').classList.toggle('shot-mode', S.shotMode)
  if (S.shotMode) setStatus('拖拽框选区域，松手自动发送')
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
  $('#q').focus()
  setStatus('已截取，可写问题后发送；留空直接点「发送」也行')
}

/* ================= 杂项 UI ================= */
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

function toast(msg) {
  const t = $('#toast')
  t.textContent = msg
  t.hidden = false
  clearTimeout(toast._t)
  toast._t = setTimeout(() => (t.hidden = true), 3800)
}

function updateZoomLabel() {
  $('#zoom-label').textContent = Math.round(S.zoom * 100) + '%'
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
  S.zoom = Math.max(0.5, Math.min(2.5, z))
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

function openSettings() {
  $('#cfg-base').value = S.cfg?.baseUrl || ''
  $('#cfg-model').value = S.cfg?.model || ''
  $('#cfg-vision').value = S.cfg?.visionModel || ''
  $('#cfg-key').value = ''
  $('#settings').hidden = false
}

async function saveSettings() {
  const body = {
    baseUrl: $('#cfg-base').value.trim(),
    model: $('#cfg-model').value.trim(),
    visionModel: $('#cfg-vision').value.trim(),
    apiKey: $('#cfg-key').value.trim()
  }
  await fetch('/api/config', {
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
      await fetch('/api/highlights', {
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
    while (out.length < 800 && (i = hay.indexOf(needle, i)) !== -1) {
      out.push({ page: p.no })
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
    paintInPage(pageEl, q)
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

function paintRects(container, rects) {
  container.querySelectorAll('.search-hit').forEach((x) => x.remove())
  const cr = container.getBoundingClientRect()
  for (const r of rects) {
    if (!r.width || !r.height) continue
    const d = document.createElement('div')
    d.className = 'search-hit'
    d.style.left = ((r.left - cr.left) / cr.width) * 100 + '%'
    d.style.top = ((r.top - cr.top) / cr.height) * 100 + '%'
    d.style.width = (r.width / cr.width) * 100 + '%'
    d.style.height = (r.height / cr.height) * 100 + '%'
    container.appendChild(d)
  }
}

function paintInPage(pageEl, q) {
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
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return
  const end = i + q.length
  let si = 0
  while (si + 1 < spans.length && starts[si + 1] <= i) si++
  let ei = si
  while (ei + 1 < spans.length && starts[ei + 1] < end) ei++
  const sNode = spans[si]?.firstChild
  const eNode = spans[ei]?.firstChild
  if (!sNode || !eNode) return
  const range = document.createRange()
  range.setStart(sNode, Math.max(0, i - starts[si]))
  range.setEnd(eNode, Math.min(eNode.length, end - starts[ei]))
  paintRects(pageEl, [...range.getClientRects()])
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
  paintRects(sheet, [...range.getClientRects()])
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

  $('#btn-send').addEventListener('click', () => send())

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
    await fetch('/api/config', {
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

  $('#btn-zoom-in').addEventListener('click', () => setZoom(S.zoom + 0.1))
  $('#btn-zoom-out').addEventListener('click', () => setZoom(S.zoom - 0.1))
  $('#btn-shot').addEventListener('click', () => toggleShot())

  // 工具条：页码 / 旋转 / 荧光笔 / 擦除
  $('#btn-prev').addEventListener('click', () => turnPage(-1))
  $('#btn-next').addEventListener('click', () => turnPage(1))
  $('#page-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const n = parseInt($('#page-input').value, 10)
      if (n) gotoPage(n)
      $('#page-input').blur()
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
  $('#page-scroll').addEventListener('scroll', () => scheduleHeal(800), { passive: true })

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
  $('#btn-collapse').addEventListener('click', () => setLeftCollapsed(true))
  $('#btn-expand').addEventListener('click', () => setLeftCollapsed(false))
  bindResizers()
  $('#cfg-cancel').addEventListener('click', () => ($('#settings').hidden = true))
  $('#cfg-save').addEventListener('click', saveSettings)
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
