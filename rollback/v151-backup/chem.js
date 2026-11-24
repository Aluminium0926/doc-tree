// 化学结构 / 反应式渲染：RDKit.js MinimalLib（本地 WASM，懒加载）
const VENDOR = new URL('./vendor/', import.meta.url).href
const RDKIT_BASE = VENDOR + 'rdkit/'

let rdkitPromise = null
let queue = []
let running = false
const molCache = new Map()

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

function principalAngleDeg(molblock) {
  try {
    const lines = String(molblock || '').split(/\r?\n/)
    if (lines.length < 5) return 0
    const counts = lines[3].trim().split(/\s+/)
    const n = Number(counts[0])
    if (!n) return 0
    const pts = []
    for (let i = 0; i < n; i++) {
      const p = lines[4 + i].trim().split(/\s+/)
      const x = Number(p[0])
      const y = Number(p[1])
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y])
    }
    if (pts.length < 3) return 0
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
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
    const deg = (angle * 180) / Math.PI
    return Number.isFinite(deg) ? Math.max(-90, Math.min(90, deg)) : 0
  } catch {
    return 0
  }
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

async function moleculeSvg(source, bond = 18) {
  if (!String(source || '').trim()) throw new Error('没有提供 SMILES')
  const key = bond + ':' + source
  if (molCache.has(key)) return molCache.get(key)
  const rdkit = await getRDKit()
  const mol = rdkit.get_mol(source)
  if (!mol) throw new Error('SMILES 无法解析：' + source.slice(0, 60))
  let angle = 0
  try {
    angle = principalAngleDeg(mol.get_molblock())
  } catch {}
  const candidates = []
  try {
    for (const rotate of [-angle, 90 - angle]) {
      const raw = mol.get_svg_with_highlights(
        JSON.stringify({ width: 1400, height: 1400, fixedBondLength: bond, rotate })
      )
      if (!raw || !raw.includes('<svg')) continue
      const cropped = cropMoleculeSvg(raw)
      candidates.push({ ...cropped, rotate })
    }
  } finally {
    mol.delete()
  }
  if (!candidates.length) throw new Error('没有生成结构图')
  // 主惯性轴只允许水平/垂直；在两者里选横向宽度更小的
  candidates.sort((a, b) => {
    if (Math.abs(a.w - b.w) > 3) return a.w - b.w
    return a.h - b.h
  })
  const best = candidates[0]
  molCache.set(key, best)
  return best
}

function fitMolecule(svgEl, maxWidth = 460) {
  if (!svgEl) return
  svgEl.style.maxWidth = maxWidth + 'px'
  svgEl.style.height = 'auto'
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
      const body = s && s.svg ? s.svg : `<span class="chem-part-error" title="${esc(p)}">SMILES 无法解析</span>`
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

async function drawReaction(fig, info) {
  const r = reactionParts(info)
  const safe = async (s) => {
    try {
      return await moleculeSvg(s, 18)
    } catch (e) {
      return { error: String(e.message || e), source: s }
    }
  }
  const [leftSvgs, rightSvgs] = await Promise.all([
    Promise.all(r.left.map(safe)),
    Promise.all(r.right.map(safe))
  ])
  const above = info.reagents || (r.agents.length ? r.agents.join(' · ') : '')
  const below = info.conditions || ''
  fig.querySelector('.chem-canvas').innerHTML = `<div class="chem-rxn">
    <div class="chem-side">${partsHtml(r.left, leftSvgs)}</div>
    <div class="chem-rxn-arrow">
      ${above ? `<span class="chem-agents">${esc(above)}</span>` : ''}
      <span class="chem-arrow-line"></span>
      ${below ? `<span class="chem-cond-arrow">${esc(below)}</span>` : ''}
    </div>
    <div class="chem-side">${partsHtml(r.right, rightSvgs)}</div>
  </div>`
  fig.dataset.state = [...leftSvgs, ...rightSvgs].some((x) => x.error) ? 'partial' : 'done'
}

async function draw(fig, kind, info) {
  const canvas = fig.querySelector('.chem-canvas')
  try {
    if (kind === 'reaction') return await drawReaction(fig, info)
    const item = await moleculeSvg(info.source, 30)
      canvas.innerHTML = item.svg
    fitMolecule(canvas.querySelector('svg'), 460)
    const svgEl = canvas.querySelector('svg')
    if (svgEl) {
      svgEl.setAttribute('role', 'img')
      svgEl.setAttribute('aria-label', info.label || info.source)
    }
    fig.dataset.state = 'done'
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
    const parsed = parseBlock(lang, raw)
    if (!parsed.source) continue
    const { fig, info } = makeFigure(lang, raw)
    pre.replaceWith(fig)
    setTimeout(() => {
          if (fig.dataset.state === 'done' || fig.dataset.state === 'error') return
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
    draw(fig, lang, info).catch(() => {})
  }
}
