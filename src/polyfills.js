// 旧版 Android WebView 兜底：补齐 pdf.js / 应用用到的较新 API
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () {
    let resolve
    let reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

if (typeof structuredClone !== 'function') {
  window.structuredClone = function (value) {
    return JSON.parse(JSON.stringify(value))
  }
}

if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value: function (n) {
      const i = Math.trunc(n) || 0
      return this[i < 0 ? this.length + i : i]
    },
    writable: true,
    configurable: true
  })
}

if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function (search, replacement) {
    if (search instanceof RegExp) return this.replace(search, replacement)
    return this.split(String(search)).join(replacement)
  }
}

if (!Object.hasOwn) {
  Object.hasOwn = function (obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key)
  }
}
