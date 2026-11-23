// 移动端文档解析：PDF(pdf.js) / DOCX(mammoth) / 文本
const VENDOR = new URL('../vendor/', import.meta.url).href
let pdfjsPromise = null

async function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(VENDOR + 'pdf.min.mjs').then((m) => {
      m.GlobalWorkerOptions.workerSrc = VENDOR + 'pdf.worker.wrapper.mjs'
      return m
    })
  }
  return pdfjsPromise
}

function decodeText(buf) {
  const bytes = new Uint8Array(buf)
  let utf8 = ''
  try {
    utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    utf8 = ''
  }
  const bad = (utf8.match(/\uFFFD/g) || []).length
  if (bad > Math.max(3, utf8.length * 0.002)) {
    try {
      return new TextDecoder('gbk').decode(bytes)
    } catch {}
  }
  return utf8
}

function normalize(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractPdf(buf) {
  const pdfjsLib = await pdfjs()
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buf),
    cMapUrl: VENDOR + 'cmaps/',
    cMapPacked: true,
    isEvalSupported: false
  }).promise
  const pages = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const tc = await page.getTextContent()
    let text = ''
    for (const item of tc.items) {
      if (item.str) text += item.str
      if (item.hasEOL) text += '\n'
    }
    pages.push({ no: n, text: normalize(text) })
  }
  return { kind: 'pdf', pages }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error('加载失败: ' + src))
    document.head.appendChild(s)
  })
}

async function extractPptx(buf) {
  if (!window.JSZip) await loadScript(VENDOR + 'jszip.min.js')
  const zip = await window.JSZip.loadAsync(buf)
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]))
  if (!slides.length) throw new Error('这个 PPTX 里没有找到幻灯片')
  const decode = (s) => String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  const out = []
  for (let i = 0; i < slides.length; i++) {
    const xml = await zip.file(slides[i]).async('string')
    const texts = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => decode(m[1]))
    out.push(`## 第 ${i + 1} 页\n\n${texts.join('\n').trim() || '（本页没有文字）'}`)
  }
  return { kind: 'pptx', pages: [{ no: 1, text: normalize(out.join('\n\n---\n\n')) }] }
}

async function extractDocx(buf) {
  if (!window.mammoth) await loadScript(VENDOR + 'mammoth.browser.min.js')
  const r = await window.mammoth.extractRawText({ arrayBuffer: buf })
  const text = normalize(r.value || '')
  return { kind: 'docx', pages: [{ no: 1, text }] }
}

export async function extract(buf, ext) {
  const e = String(ext || '').toLowerCase()
  if (e === '.pdf') return extractPdf(buf)
  if (e === '.docx') return extractDocx(buf)
  if (e === '.pptx') return extractPptx(buf)
  const text = normalize(decodeText(buf))
  if (e === '.md' || e === '.markdown' || e === '.mdown') return { kind: 'md', pages: [{ no: 1, text }] }
  return { kind: 'text', pages: [{ no: 1, text }] }
}
