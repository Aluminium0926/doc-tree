import fs from 'node:fs'
import path from 'node:path'
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas'

globalThis.DOMMatrix = DOMMatrix
globalThis.ImageData = ImageData
globalThis.Path2D = Path2D

const file = path.join(process.env.APPDATA, '文档树', 'files', '18e087b051a3.pdf')
const data = new Uint8Array(fs.readFileSync(file))
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise
console.log('pages', doc.numPages)
const page = await doc.getPage(47)
const vp = page.getViewport({ scale: 1.3 })
const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height))
const ctx = canvas.getContext('2d')
ctx.fillStyle = '#fff'
ctx.fillRect(0, 0, canvas.width, canvas.height)
await page.render({ canvasContext: ctx, viewport: vp }).promise
const jpg = canvas.toBuffer('image/jpeg', 0.82)
const png = canvas.toBuffer('image/png')
console.log(JSON.stringify({ w: canvas.width, h: canvas.height, jpgKB: Math.round(jpg.length / 1024), pngKB: Math.round(png.length / 1024) }))
fs.writeFileSync('page47.jpg', jpg)
const ops = await page.getOperatorList()
console.log('ops', ops.fnArray.length, 'images', ops.fnArray.filter((f) => f === pdfjs.OPS.paintImageXObject || f === pdfjs.OPS.paintJpegXObject || f === pdfjs.OPS.paintInlineImageXObject).length)
await doc.destroy()
