// 请求体读取：区分「原始字节」（导入）和「JSON」（普通接口）
import { BadRequest } from '../ids.mjs'

const MAX_JSON = 2 * 1024 * 1024
const MAX_FILE = 300 * 1024 * 1024

export function readBuffer(req, limit = MAX_FILE) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let failed = false
    req.on('data', (c) => {
      if (failed) return
      size += c.length
      if (size > limit) {
        failed = true
        reject(new BadRequest('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (!failed) resolve(Buffer.concat(chunks))
    })
    req.on('error', reject)
  })
}

// 空 body 一律当 {}，而不是让 JSON.parse('') 抛 500
export async function readJson(req, limit = MAX_JSON) {
  const buf = await readBuffer(req, limit)
  const raw = buf.toString('utf8').trim()
  if (!raw) return {}
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new BadRequest('请求体不是合法 JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequest('请求体必须是对象')
  return parsed
}
