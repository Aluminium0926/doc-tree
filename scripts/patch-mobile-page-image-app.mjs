import fs from 'node:fs'
const F='public/app.js'
let t=fs.readFileSync(F,'utf8')
if(!t.includes('__dtPageImage')){
  t=t.replace(
    '/* ================= 截图 ================= */',
    `/* ================= 页面截图（移动端问图用） ================= */
window.__dtPageImage = async (pageNo) => {
  if (!S.doc || S.doc.kind !== 'pdf') return null
  const n = Math.max(1, Number(pageNo) || 1)
  const existing = document.querySelector(\`.page[data-page="\${n}"] canvas\`)
  if (existing && existing.width > 1) return existing.toDataURL('image/png')
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

/* ================= 截图 ================= */`
  )
  fs.writeFileSync(F,t)
}
console.log('page image global ok')
