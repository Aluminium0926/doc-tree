// 移动端文档解析：PDF(pdf.js) / DOCX(mammoth) / 文本
let pdfjsPromise = null

async function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('/vendor/pdf.min.mjs').then((m) => {
      m.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.wrapper.mjs'
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
    cMapUrl: '/vendor/cmaps/',
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

async function extractDocx(buf) {
  if (!window.mammoth) await loadScript('/vendor/mammoth.browser.min.js')
  const r = await window.mammoth.extractRawText({ arrayBuffer: buf })
  const text = normalize(r.value || '')
  return { kind: 'docx', pages: [{ no: 1, text }] }
}

export async function extract(buf, ext) {
  const e = String(ext || '').toLowerCase()
  if (e === '.pdf') return extractPdf(buf)
  if (e === '.docx') return extractDocx(buf)
  const text = normalize(decodeText(buf))
  return { kind: 'text', pages: [{ no: 1, text }] }
}
