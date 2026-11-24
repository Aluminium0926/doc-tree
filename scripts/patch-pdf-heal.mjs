import fs from 'node:fs'

const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

// ---------- 1) drawPage 标记渲染状态 ----------
t = t.replace(
  "  const canvas = el.querySelector('canvas')\n\n  // 同一块 canvas 上有未完成的渲染时，先取消并等它结束，避免并发报错",
  "  const canvas = el.querySelector('canvas')\n  el.dataset.drawn = '0'\n\n  // 同一块 canvas 上有未完成的渲染时，先取消并等它结束，避免并发报错"
)
t = t.replace(
  "  await buildTextLayer(page, viewport, el.querySelector('.textLayer'))\n}",
  "  await buildTextLayer(page, viewport, el.querySelector('.textLayer'))\n  el.dataset.drawn = '1'\n}"
)

// ---------- 2) IntersectionObserver：失败要重试 ----------
t = t.replace(
  `  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || !nearView(e.target)) continue
        io.unobserve(e.target)
        drawPage(+e.target.dataset.page, e.target)
      }
    },
    { root: scroller, rootMargin: '900px 0px' }
  )`,
  `  const drawOne = async (el) => {
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
  )`
)
t = t.replace(
  "          await drawPage(n, el, page)\n        } catch (e) {",
  "          await drawOne(el)\n        } catch (e) {"
)

// ---------- 3) 自愈：按 drawn 标记 + 不限制 6 页 + 循环补 ----------
t = t.replace(
  `    let n = 0
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
    if (n) renderHighlights()`,
  `    let n = 0
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
    if (left) scheduleHeal(300)`
)

// ---------- 4) 点击/滚动结束立即自愈 ----------
t = t.replace(
  "  $('#page-scroll').addEventListener('scroll', () => scheduleHeal(800), { passive: true })",
  `  $('#page-scroll').addEventListener('scroll', () => scheduleHeal(500), { passive: true })
  $('#page-scroll').addEventListener('scrollend', () => scheduleHeal(120), { passive: true })
  $('#pages').addEventListener('pointerdown', () => {
    if (S.doc && S.doc.kind === 'pdf') scheduleHeal(0)
  })`
)

fs.writeFileSync(F, t)
console.log('pdf heal patched')
