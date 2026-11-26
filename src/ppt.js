// 移动端 PPT/PPTX → PDF：前端渲染每页并合成图片 PDF，完全本地
import { PptxViewer, buildTextIndex } from '../vendor/pptx/renderer.js'
import { domToJpeg } from '../vendor/pptx/screenshot.mjs'
import { PDFDocument, rgb } from '../vendor/pptx/pdf-lib.js'
import fontkit from '../vendor/pptx/fontkit.js'

export async function convertPptToPdf(file, onProgress) {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;'
  document.body.appendChild(host)
  const stage = document.createElement('div')
  stage.style.cssText = 'position:fixed;left:-10000px;top:0;'
  document.body.appendChild(stage)
  try {
    onProgress?.({ percent: 2, message: '解析幻灯片…' })
    const viewer = await PptxViewer.open(file, host, { renderMode: 'slide', lazyMedia: false })
    const count = viewer.slideCount
    const w = viewer.slideWidth
    const h = viewer.slideHeight
    if (!count) throw new Error('没有找到幻灯片')
    const pdf = await PDFDocument.create()
    pdf.registerFontkit(fontkit)
    const fontBytes = await fetch(new URL('../vendor/pptx/NotoSansSC.woff2', import.meta.url)).then((r) => r.arrayBuffer())
    const pdfFont = await pdf.embedFont(fontBytes, { subset: true })
    const textIndex = buildTextIndex(viewer.presentationData)
    const safe = (t) => String(t || '').replace(/[\u0000-\u0008\u000B-\u001F]/g, ' ').replace(/[ \t]{2,}/g, ' ').trim()
    for (let i = 0; i < count; i++) {
      stage.innerHTML = ''
      const holder = document.createElement('div')
      holder.style.width = w + 'px'
      holder.style.height = h + 'px'
      holder.style.background = '#fff'
      stage.appendChild(holder)
      const handle = viewer.renderSlideToContainer(i, holder, 1)
      if (!handle) continue
      await new Promise((r) => setTimeout(r, 60))
      try {
        await document.fonts?.ready
      } catch {}
      const dataUrl = await domToJpeg(holder, {
        width: w,
        height: h,
        scale: 1.2,
        quality: 0.88,
        backgroundColor: '#ffffff'
      })
      const jpg = await fetch(dataUrl).then((r) => r.arrayBuffer())
      const img = await pdf.embedJpg(jpg)
      const page = pdf.addPage([w, h])
      page.drawImage(img, { x: 0, y: 0, width: w, height: h })
      // 透明文本层：英文/数字可搜索、可复制，不改变画面
      for (const entry of textIndex.filter((e) => e.slideIndex === i)) {
        const txt = safe(entry.text)
        const lines = txt.split('\n').filter(Boolean)
        if (!lines.length) continue
        const b = entry.bounds
        const size = Math.max(5, Math.min(36, (b.h / lines.length) * 0.55))
        lines.forEach((line, li) => {
          try {
            page.drawText(line, {
              x: b.x,
              y: h - b.y - size * (li + 0.9),
              size,
              font: pdfFont,
              color: rgb(0, 0, 0),
              opacity: 0
            })
          } catch {}
        })
      }
      onProgress?.({ percent: Math.round(((i + 1) / count) * 95), message: `第 ${i + 1}/${count} 页` })
    }
    const bytes = await pdf.save()
    return new Blob([bytes], { type: 'application/pdf' })
  } finally {
    host.remove()
    stage.remove()
  }
}
