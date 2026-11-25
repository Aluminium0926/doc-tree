// id 白名单：所有来自请求体的 id 必须先过这里，杜绝 ../ 之类的路径穿越
export const DOC_ID = /^[0-9a-f]{6,32}$/
export const GROUP_ID = /^[0-9a-f]{6,32}$/

export class BadRequest extends Error {
  constructor(message) {
    super(message)
    this.status = 400
  }
}

export class NotFound extends Error {
  constructor(message = '不存在') {
    super(message)
    this.status = 404
  }
}

export class CorruptData extends Error {
  constructor(message, file) {
    super(message)
    this.status = 500
    this.file = file
  }
}

export const isDocId = (v) => typeof v === 'string' && DOC_ID.test(v)
export const isGroupId = (v) => typeof v === 'string' && GROUP_ID.test(v)

export function assertDocId(v) {
  if (!isDocId(v)) throw new BadRequest('文档 id 不合法')
  return v
}

export function assertGroupId(v) {
  if (!isGroupId(v)) throw new BadRequest('分组 id 不合法')
  return v
}
