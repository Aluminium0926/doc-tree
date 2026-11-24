import fs from 'node:fs'
let s=fs.readFileSync('mobile/static-server.mjs','utf8')
s=s.replace(
`    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache'
    })`,
`    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'cross-origin-resource-policy': 'same-origin'
    })`
)
fs.writeFileSync('mobile/static-server.mjs',s)

let j=fs.readFileSync('mobile/android/java/com/doctree/app/LocalServer.java','utf8')
j=j.replace(
`String head = "HTTP/1.1 200 OK\\r\\n"
+ "content-type: " + mime + "\\r\\n"`,
`String head = "HTTP/1.1 200 OK\\r\\n"
+ "content-type: " + mime + "\\r\\n"
+ "cross-origin-opener-policy: same-origin\\r\\n"
+ "cross-origin-embedder-policy: require-corp\\r\\n"
+ "cross-origin-resource-policy: same-origin\\r\\n"`
)
fs.writeFileSync('mobile/android/java/com/doctree/app/LocalServer.java',j)
console.log('COOP/COEP headers ok', j.includes('cross-origin-embedder-policy'))
