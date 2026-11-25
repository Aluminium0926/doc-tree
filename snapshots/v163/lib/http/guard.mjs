// 写操作守卫：
// 1) 浏览器跨站页面无法在不触发预检的情况下带上自定义请求头 → 要求 x-doctree-client
// 2) 有 Origin 时必须与 Host 同源（纵深防御）
// 3) JSON 接口要求 content-type: application/json
import { BadRequest } from '../ids.mjs'

const CLIENT_HEADER = 'x-doctree-client'

export function guardWrite(req, { json = false } = {}) {
  if (!req.headers[CLIENT_HEADER]) throw new BadRequest('缺少客户端标识（拒绝跨站请求）')
  const origin = req.headers.origin
  if (origin) {
    let host = ''
    try {
      host = new URL(origin).host
    } catch {
      throw new BadRequest('来源不被允许')
    }
    if (host !== req.headers.host) throw new BadRequest('来源不被允许')
  }
  if (json) {
    const ct = String(req.headers['content-type'] || '')
    if (!/application\/json/i.test(ct)) throw new BadRequest('需要 content-type: application/json')
  }
}

export const CLIENT_HEADER_NAME = CLIENT_HEADER
