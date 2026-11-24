import path from 'node:path'
import fsp from 'node:fs/promises'
import * as store from './store.mjs'

// 已渲染页面缓存：data URL -> 直接复用，避免反复栅格化
const cache = new Map()
const locks = new Map()
const MAX_CACHE = 24

const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' }

export async function renderPageImage(doc, pageNo) {
  if (doc && doc.kind === 'image') {
    const mime = IMAGE_MIME[doc.ext] || 'image/png'
    const buf = await fsp.readFile(store.filePath(doc.id, doc.ext))
    return 'data:' + mime + ';base64,' + buf.toString('base64')
  }
  if (!doc || doc.kind !== 'pdf') return null
  const page = Math.max(1, Number(pageNo) || 1)
  const key = `${doc.id}:${page}`
  if (cache.has(key)) {
    const v = cache.get(key)
    cache.delete(key)
    cache.set(key, v)
    return v
  }
  if (locks.has(key)) return locks.get(key)

  const job = (async () => {
    const { pdf } = await import('pdf-to-img')
    const file = store.filePath(doc.id, doc.ext || '.pdf')
    const docImg = await pdf(file, { scale: 1.4 })
    try {
      if (page > docImg.length) return null
      const buf = await docImg.getPage(page)
      const url = 'data:image/png;base64,' + Buffer.from(buf).toString('base64')
      cache.set(key, url)
      if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value)
      return url
    } finally {
      try {
        await docImg.destroy()
      } catch {}
    }
  })()

  locks.set(key, job)
  try {
    return await job
  } finally {
    locks.delete(key)
  }
}

export function pageImageCacheSize() {
  return cache.size
}
