// 文档：导入 / 读取 / 软删除 / 恢复 / 彻底删除 / 原文件（支持 Range）/ 导出
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import * as store from '../store.mjs'
import * as llm from '../llm.mjs'
import { extract, SUPPORTED_EXT } from '../extract.mjs'
import { pptToPdf } from '../office.mjs'
import { renderPageImage } from '../render.mjs'
import { buildSummaryMessages, treeToMarkdown } from '../context.mjs'
import { json, text } from '../http/respond.mjs'
import { readBuffer, readJson } from '../http/body.mjs'
import { guardWrite } from '../http/guard.mjs'
import { assertDocId, BadRequest, NotFound } from '../ids.mjs'

const MIME = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

function filenameOf(req) {
  const raw = String(req.headers['x-filename'] || 'document')
  try {
    return decodeURIComponent(raw).slice(0, 300)
  } catch {
    throw new BadRequest('文件名编码异常')
  }
}

export async function importDoc({ req, res }) {
  guardWrite(req)
  const name = filenameOf(req)
  const ext = path.extname(name).toLowerCase()
  if (!SUPPORTED_EXT.has(ext)) {
    return json(res, 415, { error: `暂不支持 ${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPTX / 图片` })
  }
  const buf = await readBuffer(req)
  if (!buf.length) return json(res, 400, { error: '文件是空的' })
  const hash = crypto.createHash('sha256').update(buf).digest('hex')

  // 同一份文件再次导入（可能之前被移出列表）→ 复用原文档，提问树与上下文都还在
  for (const meta of await store.listDocs()) {
    let old
    try {
      old = await store.getDoc(meta.id)
    } catch {
      continue
    }
    if (!old) continue
    if (!old.hash) {
      try {
        const fb = await fsp.readFile(store.filePath(old.id, old.ext))
        old.hash = crypto.createHash('sha256').update(fb).digest('hex')
        await store.saveDoc(old)
      } catch {}
    }
    if (old.hash !== hash) continue
    old.hidden = false
    old.updatedAt = Date.now()
    old.filename = name
    await store.saveDoc(old)
    return json(res, 200, { doc: { id: old.id, title: old.title, kind: old.kind, pages: (old.pages || []).length }, revived: true })
  }

  let sourceBuf = buf
  let sourceExt = ext
  if (ext === '.ppt' || ext === '.pptx') {
    try {
      sourceBuf = await pptToPdf(buf, ext)
      sourceExt = '.pdf'
    } catch (e) {
      if (ext === '.ppt') {
        return json(res, 415, { error: '这个 .ppt 转换失败：' + String(e.message || e).slice(0, 160) + '。可以先用 PowerPoint 另存为 PDF 再导入。' })
      }
      // pptx 转换失败时退回纯文字提取
    }
  }
  const { kind, pages } = await extract(sourceBuf, sourceExt)
  const id = crypto.randomBytes(6).toString('hex')
  await store.saveFile(id, sourceExt, sourceBuf)
  const doc = {
    id,
    title: path.basename(name, path.extname(name)) || '未命名文档',
    filename: name,
    kind,
    ext: sourceExt,
    pages,
    summary: '',
    hash,
    hidden: false,
    bytes: sourceBuf.length,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  await store.saveDoc(doc)

  if (kind === 'image') {
    try {
      const dataUrl = await renderPageImage(doc, 1)
      const ocrText = await llm.ocrImage(dataUrl)
      if (ocrText) {
        doc.pages[0].text = ocrText
        doc.ocr = true
        await store.saveDoc(doc)
      }
    } catch (e) {
      console.warn('[ocr] failed:', e.message)
    }
  }

  ;(async () => {
    if (kind === 'image') return
    try {
      const s = await llm.chat(buildSummaryMessages(doc), { maxTokens: 700, effort: 'low' })
      if (s.trim()) {
        doc.summary = s.trim()
        await store.saveDoc(doc)
      }
    } catch (e) {
      console.warn('[summary] failed:', e.message)
    }
  })()

  json(res, 200, { doc: { id: doc.id, title: doc.title, kind: doc.kind, pages: pages.length } })
}

export async function getDoc({ res, params }) {
  const id = assertDocId(params.id)
  const doc = await store.getDoc(id)
  if (!doc) return json(res, 404, { error: '文档不存在' })
  json(res, 200, { doc, tree: await store.getTree(id) })
}

export async function hideDoc({ req, res, params }) {
  guardWrite(req)
  const id = assertDocId(params.id)
  if (!(await store.setHidden(id, true))) return json(res, 404, { error: '文档不存在' })
  json(res, 200, { ok: true, hidden: true })
}

export async function restoreDoc({ req, res }) {
  guardWrite(req, { json: true })
  const body = await readJson(req)
  const id = assertDocId(body.id)
  if (!(await store.setHidden(id, false))) return json(res, 404, { error: '文档不存在' })
  json(res, 200, { ok: true })
}

export async function purgeDoc({ req, res }) {
  guardWrite(req, { json: true })
  const body = await readJson(req)
  const id = assertDocId(body.id)
  await store.deleteDoc(id)
  json(res, 200, { ok: true })
}

// 原文件：支持 Range，pdf.js 才能只取需要的分片
export async function getFile({ req, res, params }) {
  const id = assertDocId(params.id)
  const doc = await store.getDoc(id)
  if (!doc) return json(res, 404, { error: '文档不存在' })
  let file
  try {
    file = store.filePath(doc.id, doc.ext)
    const stat = await fsp.stat(file)
    const type = MIME[doc.ext] || 'application/octet-stream'
    const range = String(req.headers.range || '')
    const m = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : null
      let end = m[2] ? Number(m[2]) : null
      if (start == null) {
        start = Math.max(0, stat.size - (end || 0))
        end = stat.size - 1
      } else {
        end = end == null ? stat.size - 1 : Math.min(end, stat.size - 1)
      }
      if (start > end || start >= stat.size) {
        res.writeHead(416, { 'content-range': `bytes */${stat.size}` })
        return res.end()
      }
      res.writeHead(206, {
        'content-type': type,
        'content-length': end - start + 1,
        'content-range': `bytes ${start}-${end}/${stat.size}`,
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=3600'
      })
      if (req.method === 'HEAD') return res.end()
      return fs.createReadStream(file, { start, end }).pipe(res)
    }
    res.writeHead(200, {
      'content-type': type,
      'content-length': stat.size,
      'accept-ranges': 'bytes',
      'cache-control': 'public, max-age=3600'
    })
    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(file).pipe(res)
  } catch (e) {
    if (e instanceof NotFound || e.status === 404) return json(res, 404, { error: '文件不存在' })
    if (e.code === 'ENOENT') return json(res, 404, { error: '文件不存在' })
    throw e
  }
}

export async function exportDoc({ res, params }) {
  const id = assertDocId(params.id)
  const doc = await store.getDoc(id)
  if (!doc) return json(res, 404, { error: '文档不存在' })
  const md = treeToMarkdown(doc, await store.getTree(id))
  text(res, 200, md, {
    'content-type': 'text/markdown; charset=utf-8',
    'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.title + '-追问树.md')}`
  })
}
