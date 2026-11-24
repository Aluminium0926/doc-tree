import fs from 'node:fs'
const F = 'desktop/main.cjs'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes('function portFree')) {
  t = t.replace(
    "function freePort() {",
    `function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)))
  })
}

function freePort() {`
  )
}
t = t.replace(
  "  serverPort = await freePort()",
  `  // 固定端口：保证 http://127.0.0.1:<port> 这个 origin 稳定，
  // 否则每次启动都换端口，localStorage（欢迎页、缩放、跳过版本等）全部丢失
  serverPort = 43171
  if (!(await portFree(serverPort))) serverPort = await freePort()`
)
fs.writeFileSync(F, t)
console.log('stable port patched')
