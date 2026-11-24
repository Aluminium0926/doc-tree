import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

// 1) 记录 observer
t = t.replace(
  "  const io = new IntersectionObserver(",
  "  S.pdfIO = io = new IntersectionObserver("
).replace(
  "  S.pdfIO = io = new IntersectionObserver(",
  "  const io = new IntersectionObserver("
)
// 正确：在创建后挂到 S
t = t.replace(
  "    { root: scroller, rootMargin: '900px 0px' }\n  )",
  "    { root: scroller, rootMargin: '900px 0px' }\n  )\n  S.pdfIO = io"
)

// 2) DPR 上限 1.5
t = t.replace("const dpr = Math.min(2, window.devicePixelRatio || 1)", "const dpr = Math.min(1.5, window.devicePixelRatio || 1)")

// 3) 释放远处画布
if (!t.includes('function releaseFarCanvases')) {
  t = t.replace(
    "function scheduleHeal(delay = 350, force = false) {",
    `function releaseFarCanvases() {
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

function scheduleHeal(delay = 350, force = false) {`
  )
}

// 4) 滚动时释放
t = t.replace(
  "  $('#page-scroll').addEventListener('scroll', () => scheduleHeal(500), { passive: true })\n  $('#page-scroll').addEventListener('scrollend', () => scheduleHeal(120), { passive: true })",
  "  $('#page-scroll').addEventListener('scroll', () => {\n    scheduleRelease(600)\n    scheduleHeal(500)\n  }, { passive: true })\n  $('#page-scroll').addEventListener('scrollend', () => {\n    scheduleRelease(150)\n    scheduleHeal(120)\n  }, { passive: true })"
)

// 5) heal 后顺手释放
t = t.replace(
  "    if (n) renderHighlights()\n    if (left) scheduleHeal(300)\n  } finally {",
  "    if (n) renderHighlights()\n    if (left) scheduleHeal(300)\n    else scheduleRelease(200)\n  } finally {"
)

// 6) relayout 只重画已经有像素的画布，不复活已释放的远处页
t = t.replace(
  "      const canvas = el.querySelector('canvas')\n      if (canvas.width !== 300) {\n        await drawPage(n, el)\n      }",
  "      const canvas = el.querySelector('canvas')\n      if (canvas.width > 0 && canvas.width !== 300) {\n        await drawPage(n, el)\n      }"
)
fs.writeFileSync(F, t)
console.log('canvas release + dpr cap ok')
