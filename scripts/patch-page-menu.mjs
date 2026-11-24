import fs from 'node:fs'

const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

const fn = `
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
    menu.style.left = Math.min(x, window.innerWidth - 160) + 'px'
    menu.style.top = Math.min(y, window.innerHeight - 52) + 'px'
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

`
if (!t.includes('function bindPageMenu')) t = t.replace('function bindWheelZoom() {', fn + 'function bindWheelZoom() {')
t = t.replace('  bindWheelZoom()', '  bindWheelZoom()\n  bindPageMenu()')
fs.writeFileSync(F, t)
console.log('patched')
