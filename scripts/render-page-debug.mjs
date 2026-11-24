import fs from 'node:fs'
import path from 'node:path'
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas'
globalThis.DOMMatrix = DOMMatrix
globalThis.ImageData = ImageData
globalThis.Path2D = Path2D
try {
  const file = path.join(process.env.APPDATA, '文档树', 'files', '18e087b051a3.pdf')
  const data = new Uint8Array(fs.readFileSync(file))
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  console.log('pdfjs loaded')
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise
  console.log('doc loaded', doc.numPages)
  const page = await doc.getPage(47)
  console.log('page loaded')
  const vp = page.getViewport({ scale: 1.3 })
  console.log('vp', vp.width, vp.height)
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height)
  const task = page.render({ canvasContext: ctx, viewport: vp })
  await task.promise
  console.log('rendered')
  const jpg = canvas.toBuffer('image/jpeg', 0.82)
  console.log('jpeg', jpg.length)
  fs.writeFileSync('page47.jpg', jpg)
  console.log('saved')
} catch (e) { console.error('ERR', e && (e.stack || e.message || e)) }
