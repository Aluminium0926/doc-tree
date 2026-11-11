// 文档解析：PDF（pdfjs legacy，含 CID/中文 cmap）、docx（mammoth）、md/txt
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PDFJS_DIR = path.join(root, 'node_modules', 'pdfjs-dist')

export function kindOf(ext) {
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx' || ext === '.doc') return 'docx'
  if (ext === '.md' || ext === '.markdown') return 'md'
  return 'text'
}

export async function extract(buf, ext) {
  const kind = kindOf(ext)
  if (kind === 'pdf') return { kind, pages: await extractPdf(buf) }
  if (kind === 'docx') return { kind, pages: await extractDocx(buf) }
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
