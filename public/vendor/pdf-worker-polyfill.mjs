// pdf.worker 线程内的兜底：旧版 WebView（< Chrome 119）没有 Promise.withResolvers
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
