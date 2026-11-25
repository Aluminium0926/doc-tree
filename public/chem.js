// 化学结构 / 反应式渲染：RDKit.js MinimalLib（本地 WASM，懒加载）
const VENDOR = new URL('./vendor/', import.meta.url).href
const RDKIT_BASE = VENDOR + 'rdkit/'

let rdkitPromise = null
const molCache = new Map()
const MAX_MOL_CACHE = 200

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function withTimeout(promise, ms, message) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms)
    })
  ]).finally(() => clearTimeout(timer))
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const old = document.querySelector(`script[data-rdkit="${src}"]`)
    if (old) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.dataset.rdkit = src
    s.onload = resolve
    s.onerror = () => reject(new Error('RDKit 加载失败'))
    document.head.appendChild(s)
  })
}

async function getRDKit() {
  if (!rdkitPromise) {
    rdkitPromise = (async () => {
      if (!window.initRDKitModule) await loadScript(RDKIT_BASE + 'RDKit_minimal.js')
      if (!window.initRDKitModule) throw new Error('RDKit 初始化函数不存在')
      return await withTimeout(
        window.initRDKitModule({ locateFile: (f) => RDKIT_BASE + f }),
        20000,
        'RDKit 初始化超时'
      )
    })().catch((e) => {
      rdkitPromise = null
      throw e
    })
  }
  return rdkitPromise
}

function safeSvg(svg) {
  return String(svg || '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
}

function normalizeSmiles(s) {
  return String(s || '')
    .replace(/\[N\+\]#N(?=[A-Za-z\[\(])/g, 'N#[N+]')
    .replace(/\[N\+\]#N-/g, 'N#[N+]-')
}

function looksLikeSmiles(s) {
  const x = String(s || '').trim()
  if (!x) return false
  if (x.includes('>>') || x.includes('>')) return true
  if (/[,\s]/.test(x)) return false
  if (/^[A-Za-z][a-z]{2,}$/.test(x)) return false
  if (/[\[\]=#()]/.test(x)) return true
  if (/[cnops][0-9]/.test(x)) return true
  return /^[A-Za-z0-9@+\-\[\]()=#\\/.]+$/.test(x) && /^[A-Z]/.test(x) && !/^[A-Z][a-z]{2,}/.test(x)
}

function splitParts(s) {
  return String(s || '')
    .split(/[+,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function cleanConditions(s) {
  let x = String(s || '')
  // 去掉括号里的机理/位置说明
  x = x.replace(/\([^)]*(?:coupling|position|regio|mechanism|attack|favou?red|ortho|para|meta)[^)]*\)/gi, '')
  // 去掉 ortho/para/meta 相关的解释性分句
  x = x.replace(/[^,;，；]*\b(?:ortho|para|meta)\b[^,;，；]*/gi, '')
  x = x.replace(/\s*->\s*[^,;，；]+/g, '')
  x = x.replace(/\s{2,}/g, ' ').replace(/\s+([,;，；])/g, '$1').replace(/\s*[,;，；]\s*(?=[,;，；]|$)/g, '').trim()
  return x.replace(/^[,;，；\s]+|[,;，；\s]+$/g, '')
}

function parseBlock(kind, raw) {
  const meta = {}
  const body = []
  for (const line of String(raw || '').split(/\r?\n/)) {
    const m = line.match(
      /^(label|name|conditions?|reaction|smiles|reactants?|educts?|substrates?|products?|reagents?)\s*[:：]\s*(.*)$/i
    )
    if (m) meta[m[1].toLowerCase()] = m[2].trim()
    else body.push(line)
  }

  let source = ''
  let conditions = cleanConditions(meta.condition || meta.conditions || '')
  let reagents = String(meta.reagents || meta.reagent || '').trim()

  if (kind === 'reaction') {
    source = meta.reaction || ''
    if (!source && meta.reactants) {
      const left = splitParts(meta.reactants)
      const right = splitParts(meta.products || meta.product)
      let agents = ''
      if (reagents && looksLikeSmiles(reagents)) {
        agents = reagents
        reagents = ''
      }
      if (left.length && right.length) source = left.join('.') + '>' + agents + '>' + right.join('.')
    }
    if (!source) {
      const joined = body.join('\n')
      const m = joined.match(/reactants?\s*[:：]\s*(.+)/i)
      if (m) {
        const left = splitParts(m[1])
        const pm = joined.match(/products?\s*[:：]\s*(.+)/i)
        const rm = joined.match(/reagents?\s*[:：]\s*(.+)/i)
        if (left.length && pm) {
          let agents = (rm?.[1] || '').trim()
          if (agents && looksLikeSmiles(agents)) {
            // keep as structural agent
          } else {
            if (!reagents) reagents = agents
            agents = ''
          }
          source = left.join('.') + '>' + agents + '>' + splitParts(pm[1]).join('.')
        }
      }
    }
  } else {
    source = meta.smiles || body.join(' ')
  }

  if (!source) source = body.join(' ')
  source = normalizeSmiles(source).replace(/\s+/g, '').trim()
  return {
    source,
    label: meta.label || meta.name || '',
    conditions,
    reagents
  }
}

function molPoints(molblock) {
  try {
    const lines = String(molblock || '').split(/\r?\n/)
    if (lines.length < 5) return null
    const n = Number(lines[3].trim().split(/\s+/)[0])
    if (!n) return null
    const pts = []
    for (let i = 0; i < n; i++) {
      const p = lines[4 + i].trim().split(/\s+/)
      const x = Number(p[0])
      const y = Number(p[1])
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y])
    }
    return pts.length >= 2 ? pts : null
  } catch {
    return null
  }
}

// 主惯性轴（PCA）角度：长轴方向。用它生成“长轴水平”和“长轴垂直”两个候选。
function principalAngleDeg(pts) {
  if (!pts || pts.length < 3) return 0
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const [x, y] of pts) {
    const dx = x - mx
    const dy = y - my
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  const deg = (0.5 * Math.atan2(2 * sxy, sxx - syy) * 180) / Math.PI
  return Number.isFinite(deg) ? Math.max(-90, Math.min(90, deg)) : 0
}

function cropMoleculeSvg(svg) {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none'
  host.innerHTML = safeSvg(svg)
  document.body.appendChild(host)
  try {
    const el = host.querySelector('svg')
    if (!el) throw new Error('SVG 为空')
    const bg = el.querySelector(':scope > rect')
    if (bg) bg.remove()
    const bbox = el.getBBox()
    if (!bbox || !bbox.width || !bbox.height) throw new Error('结构图为空')
    const pad = 8
    const w = Math.ceil(bbox.width + pad * 2)
    const h = Math.ceil(bbox.height + pad * 2)
    el.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${w} ${h}`)
    el.setAttribute('width', String(w))
    el.setAttribute('height', String(h))
    return { svg: el.outerHTML, w, h }
  } finally {
    host.remove()
  }
}

/*
 * 结构方向选择算法
 * -----------------
 * 目标：让分子在版面上“横着占满”（比如甲基橙的 N=N 水平），而不是竖成一条，
 * 把两侧留白浪费掉；同时别把小分子放大成糊满整张卡。
 *
 * 1. 从 molblock 取原子坐标，算 PCA 主轴角 a（长轴方向）。
 * 2. 生成候选旋转角：-a（长轴转水平）、90-a（长轴转垂直），外加 0°（RDKit 默认布局），去重。
 * 3. 每个候选按固定键长（单分子 30 / 反应组分 18）渲染，裁切出真实包围盒 (w,h)。
 * 4. 排序：宽高比 w/h 越大越好（越横越省纵向空间）；
 *    比值接近时，比“按可用框能画多大”（scale），再接近就取更宽的。
 * 5. 落地尺寸：scale = min(可用宽/ w, 高度上限 / h, 1.5)，
 *    1.5 倍上限保证三五个原子的分子不会被放大成巨幅。
 */
const UPSCALE_MAX = 1.5 // 显示时最多放大到原始绘制的 1.5 倍，避免三原子分子糊满整张卡

async function moleculeSvg(source, { bond = 30, availW = 460, maxH = 420 } = {}) {
  const bucket = Math.round(availW / 80)
  const key = `b${bond}:${bucket}:${source}`
  if (molCache.has(key)) return molCache.get(key)

  const rdkit = await getRDKit()
  const mol = rdkit.get_mol(source)
  if (!mol) throw new Error('SMILES 无法解析：' + source.slice(0, 60))

  const candidates = []
  try {
    const pts = molPoints(mol.get_molblock())
    const base = principalAngleDeg(pts)
    const angles = []
    for (const a of [-base, 90 - base, 0]) {
      const norm = Math.round((((a % 360) + 360) % 360) * 10) / 10
      if (!angles.includes(norm)) angles.push(norm)
    }
    for (const rotate of angles) {
      const opt = { width: 1400, height: 1400, rotate, fixedBondLength: bond }
      let raw = ''
      try {
        raw = mol.get_svg_with_highlights(JSON.stringify(opt))
      } catch {
        continue
      }
      if (!raw || !raw.includes('<svg')) continue
      const cropped = cropMoleculeSvg(raw)
      const aspect = cropped.w / Math.max(1, cropped.h)
      // 落地后实际能画多大：受可用宽度、高度上限、放大倍数上限共同约束
      const scale = Math.min(availW / cropped.w, maxH / cropped.h, UPSCALE_MAX)
      candidates.push({ ...cropped, rotate, aspect, scale })
    }
  } finally {
    mol.delete()
  }
  if (!candidates.length) throw new Error('没有生成结构图')

  candidates.sort((a, b) => {
    const da = b.aspect - a.aspect
    if (Math.abs(da) > 0.06) return da // 明显更横的优先
    if (Math.abs(b.scale - a.scale) > 0.01) return b.scale - a.scale // 差不多横时，画得更大的优先
    return b.w - a.w
  })
  const best = candidates[0]
  molCache.set(key, best)
  if (molCache.size > MAX_MOL_CACHE) molCache.delete(molCache.keys().next().value)
  return best
}

// 显示尺寸：等比放大到填满可用宽度，但最多 1.5 倍；同时不许超过高度上限
function fitMolecule(svgEl, item, availW, maxH = 420) {
  if (!svgEl || !item) return
  const scale = Math.min(availW / item.w, maxH / item.h, UPSCALE_MAX)
  svgEl.style.width = Math.round(item.w * scale) + 'px'
  svgEl.style.height = 'auto'
  svgEl.style.maxWidth = '100%'
}

function reactionParts(info) {
  const source = info.source
  const m = source.match(/^([^>]*)>([^>]*)>([^>]*)$/)
  if (!m) throw new Error('反应式需要 反应物>>产物')
  const split = (s) => s.split('.').map((x) => x.trim()).filter(Boolean)
  const spectators = new Set(['[Cl-]', '[Br-]', '[I-]', '[Na+]', '[K+]', '[Li+]', 'Cl', 'Br', 'I', 'Na', 'K'])
  const clean = (arr) => {
    if (arr.length <= 1) return arr
    const keep = arr.filter((x) => !spectators.has(x))
    return keep.length ? keep : arr
  }
  const left = clean(split(m[1]))
  const right = clean(split(m[3]))
  const agents = split(m[2])
  if (!left.length || !right.length) throw new Error('反应物或产物为空')
  return { left, right, agents, conditions: info.conditions || '' }
}

function partsHtml(parts, svgs) {
  return parts
    .map((p, i) => {
      const s = svgs[i]
      const tip = s?.error ? `${p}：${s.error}` : p
      const body = s && s.svg ? s.svg : `<span class="chem-part-error" title="${esc(tip)}">SMILES 无法解析</span>`
      return `${i ? '<span class="chem-plus">+</span>' : ''}<span class="chem-part">${body}</span>`
    })
    .join('')
}

function makeFigure(kind, raw) {
  const info = parseBlock(kind, raw)
  const fig = document.createElement('figure')
  fig.className = 'chem-figure'
  fig.dataset.kind = kind
  fig.dataset.source = info.source

  const canvas = document.createElement('div')
  canvas.className = 'chem-canvas'
  canvas.innerHTML = '<div class="chem-loading">结构加载中…</div>'
  fig.appendChild(canvas)

  const cap = document.createElement('figcaption')
  cap.className = 'chem-cap'
  if (info.label) {
    const l = document.createElement('span')
    l.className = 'chem-label'
    l.textContent = info.label
    cap.appendChild(l)
  }
  if (info.conditions && kind !== 'reaction') {
    const c = document.createElement('span')
    c.className = 'chem-cond'
    c.textContent = info.conditions
    cap.appendChild(c)
  }
  const copy = document.createElement('button')
  copy.type = 'button'
  copy.className = 'chem-copy'
  copy.textContent = '复制 SMILES'
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(info.source)
    } catch {}
    copy.textContent = '已复制'
    setTimeout(() => (copy.textContent = '复制 SMILES'), 1200)
  })
  cap.appendChild(copy)
  fig.appendChild(cap)
  return { fig, info }
}

// 模型有时把「分子式」写成 reaction 块（左右同一个分子），或者只写一个分子。
// 这两种情况都不该画箭头，按单一结构显示。
function sameSet(a, b) {
  const norm = (arr) => arr.map((x) => x.replace(/\s+/g, '')).sort().join('.')
  return a.length > 0 && norm(a) === norm(b)
}

// “-”“—”“无”“none”这类占位条件不该渲染成一个孤零零的横杠
const PLACEHOLDER = /^(?:[-—–~·.。_]+|none|n\/a|null|无|空|不适用|无需)$/i
const cleanMeta = (s) => {
  const t = String(s || '').trim()
  return PLACEHOLDER.test(t) ? '' : t
}

async function drawSingle(fig, info, source) {
  const canvas = fig.querySelector('.chem-canvas')
  // 用卡片实际可用宽度决定朝向和显示尺寸（换窗口/窄屏都会重新算）
  const availW = Math.min(460, Math.max(200, Math.round((canvas?.clientWidth || 460) - 24)))
  const item = await moleculeSvg(source, { bond: 30, availW, maxH: 420 })
  canvas.innerHTML = item.svg
  const svgEl = canvas.querySelector('svg')
  fitMolecule(svgEl, item, availW, 420)
  if (svgEl) {
    svgEl.setAttribute('role', 'img')
    svgEl.setAttribute('aria-label', info.label || source)
  }
  fig.dataset.state = 'done'
}

async function drawReaction(fig, info, r) {
  r ??= reactionParts(info)
  const safe = async (s) => {
    try {
      return await moleculeSvg(s, { bond: 18 })
    } catch (e) {
      return { error: String(e.message || e), source: s }
    }
  }
  const [leftSvgs, rightSvgs] = await Promise.all([
    Promise.all(r.left.map(safe)),
    Promise.all(r.right.map(safe))
  ])
  const all = [...leftSvgs, ...rightSvgs]
  const canvas = fig.querySelector('.chem-canvas')

  // 引擎没起来（CSP 拦了 eval、wasm 缺失、初始化超时）时，别再逐个显示“SMILES 无法解析”误导人
  const initError = all.length && all.every((x) => x.error && /RDKit|Content Security|Refused|wasm|初始化/i.test(x.error))
  if (initError) {
    fig.dataset.state = 'error'
    canvas.textContent = ''
    const err = document.createElement('div')
    err.className = 'chem-error'
    err.textContent = '化学引擎未能加载：' + String(all[0].error).slice(0, 160)
    const pre = document.createElement('pre')
    pre.textContent = info.source
    canvas.append(err, pre)
    return
  }

  const above = cleanMeta(info.reagents || (r.agents.length ? r.agents.join(' · ') : ''))
  const below = cleanMeta(info.conditions)
  canvas.innerHTML = `<div class="chem-rxn">
    <div class="chem-side">${partsHtml(r.left, leftSvgs)}</div>
    <div class="chem-rxn-arrow${above || below ? ' has-labels' : ''}">
      ${above ? `<span class="chem-agents">${esc(above)}</span>` : ''}
      <span class="chem-arrow-line"></span>
      ${below ? `<span class="chem-cond-arrow">${esc(below)}</span>` : ''}
    </div>
    <div class="chem-side">${partsHtml(r.right, rightSvgs)}</div>
  </div>`
  fig.dataset.state = all.some((x) => x.error) ? 'partial' : 'done'
}

async function draw(fig, kind, info) {
  const canvas = fig.querySelector('.chem-canvas')
  try {
    if (kind === 'reaction') {
      const src = String(info.source || '')
      // 没有 > 的「反应式」其实只是一个分子（模型标错了块类型）
      if (!src.includes('>')) {
        fig.dataset.kind = 'smiles'
        return await drawSingle(fig, info, src)
      }
      const r = reactionParts(info)
      if (sameSet(r.left, r.right)) {
        // 左右完全一样：模型把「分子式」写成了 reaction，画一个结构就够了，别画箭头
        fig.dataset.kind = 'smiles'
        return await drawSingle(fig, info, r.left.join('.'))
      }
      return await drawReaction(fig, info, r)
    }
    return await drawSingle(fig, info, info.source)
  } catch (e) {
    fig.dataset.state = 'error'
    canvas.textContent = ''
    const err = document.createElement('div')
    err.className = 'chem-error'
    err.textContent = '结构解析失败：' + String(e.message || e)
    const pre = document.createElement('pre')
    pre.textContent = info.source
    canvas.append(err, pre)
  }
}

export function enhanceChemBlocks(root) {
  if (!root || root.classList?.contains('streaming')) return
  const pres = [...root.querySelectorAll('pre')].filter((p) => p.querySelector('code'))
  for (const pre of pres) {
    const code = pre.querySelector('code')
    const lang = (code.className.match(/(?:language|lang)-([\w+#.-]+)/) || [])[1] || ''
    if (lang !== 'smiles' && lang !== 'reaction') continue
    const raw = code.textContent || ''
    if (!raw.trim()) continue
    // 只有 label:/conditions:、没有 SMILES 的空块：保留原代码块，
    // 不要交给 RDKit（否则会渲染出一个空分子，报“结构图为空”——v147 用户报过）
    const probe = parseBlock(lang, raw)
    if (!probe.source || !probe.source.trim()) continue
    const { fig, info } = makeFigure(lang, raw)
    fig.dataset.state = 'rendering'
    pre.replaceWith(fig)
    const guard = setTimeout(() => {
      // 只有「还在渲染」才算超时；partial（部分组分画不出来）和 done/error 都是终态，
      // 以前 partial 被当成没完成，15 秒后把已经画好的图覆盖成“渲染超时”
      if (fig.dataset.state !== 'rendering') return
      fig.dataset.state = 'error'
      const c = fig.querySelector('.chem-canvas')
      if (!c) return
      c.textContent = ''
      const e = document.createElement('div')
      e.className = 'chem-error'
      e.textContent = '结构渲染超时，请刷新后重试'
      const p = document.createElement('pre')
      p.textContent = info.source
      c.append(e, p)
    }, 15000)
    draw(fig, lang, info)
      .catch(() => {
        if (fig.dataset.state === 'rendering') fig.dataset.state = 'error'
      })
      .finally(() => clearTimeout(guard))
  }
}
