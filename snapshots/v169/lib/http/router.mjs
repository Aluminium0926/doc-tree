// 极简路由：把原来一串 if (p === …) 换成路由表
export function createRouter() {
  const routes = []

  const compile = (pattern) => {
    const keys = []
    const re = pattern
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) {
          keys.push(seg.slice(1))
          return '([^/]+)'
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      })
      .join('/')
    return { re: new RegExp(`^${re}$`), keys }
  }

  const add = (method, pattern, handler) => {
    const { re, keys } = compile(pattern)
    routes.push({ method, pattern, re, keys, handler })
    return api
  }

  const api = {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    del: (p, h) => add('DELETE', p, h),
    match(method, pathname) {
      let pathMatched = false
      for (const r of routes) {
        const m = r.re.exec(pathname)
        if (!m) continue
        pathMatched = true
        if (r.method !== method) continue
        const params = {}
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])))
        return { handler: r.handler, params }
      }
      return pathMatched ? { methodNotAllowed: true } : null
    },
    get routes() {
      return routes.map(({ method, pattern }) => `${method} ${pattern}`)
    }
  }
  return api
}
