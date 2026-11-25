// 文档解析：PDF（pdfjs legacy，含 CID/中文 cmap）、docx（mammoth）、md/txt
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PDFJS_DIR = path.join(root, 'node_modules', 'pdfjs-dist')

export const SUPPORTED_EXT = new Set(['.pdf', '.docx', '.doc', '.md', '.markdown', '.txt', '.pptx', '.ppt', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])

export function kindOf(ext) {
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx' || ext === '.doc') return 'docx'
  if (ext === '.md' || ext === '.markdown') return 'md'
  if (ext === '.pptx') return 'pptx'
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext)) return 'image'
  return 'text'
}

export async function extract(buf, ext) {
  const kind = kindOf(ext)
  if (kind === 'pdf') return { kind, pages: await extractPdf(buf) }
  if (kind === 'docx') return { kind, pages: await extractDocx(buf) }
  if (kind === 'pptx') return { kind, pages: await extractPptx(buf) }
  if (kind === 'image') return { kind, pages: await extractImage(buf) }
  const text = decodeText(buf)
  return { kind, pages: [{ no: 1, text: clean(text) }] }
}

function clean(s) {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractPdf(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    cMapUrl: path.join(PDFJS_DIR, 'cmaps') + path.sep,
    cMapPacked: true,
    standardFontDataUrl: path.join(PDFJS_DIR, 'standard_fonts') + path.sep,
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0
  }).promise

  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const tc = await page.getTextContent()
    let text = ''
    for (const it of tc.items) {
      if (typeof it.str !== 'string') continue
      text += it.str
      if (it.hasEOL) text += '\n'
    }
    const vp = page.getViewport({ scale: 1 })
    pages.push({ no: i, text: clean(text), w: vp.width, h: vp.height })
  }
  await doc.destroy()
  return pages
}

async function extractDocx(buf) {
  const mammoth = (await import('mammoth')).default
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) })
  // 按空行切成小节，便于检索；仍视为单页文档
  return [{ no: 1, text: clean(value) }]
}

function decodeXml(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

async function extractPptx(buf) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(Buffer.from(buf))
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]))
  if (!slides.length) throw new Error('这个 PPTX 里没有找到幻灯片')
  const out = []
  for (let i = 0; i < slides.length; i++) {
    const xml = await zip.file(slides[i]).async('string')
    const texts = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1]))
    const body = texts.join('\n').trim()
    out.push(`## 第 ${i + 1} 页\n\n${body || '（本页没有文字）'}`)
  }
  return [{ no: 1, text: clean(out.join('\n\n---\n\n')) }]
}

function decodeText(buf) {
  const b = Buffer.from(buf)
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2))
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b).replace(/^\uFEFF/, '')
  } catch {
    try {
      return new TextDecoder('gbk').decode(b)
    } catch {
      return b.toString('utf8')
    }
  }
}

async function extractImage(buf) {
  const { loadImage } = await import('@napi-rs/canvas')
  const img = await loadImage(Buffer.from(buf))
  return [{ no: 1, text: '', w: img.width, h: img.height }]
}
