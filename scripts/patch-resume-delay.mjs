import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "    if (e && e.name === 'AbortError') {\n      setStatus('已停止')\n      await refreshCurrentTree()\n    } else {",
  "    if (e && e.name === 'AbortError') {\n      setStatus('已停止')\n      // 服务端要先把 stopped 标记落盘，晚一点再拉一次树\n      setTimeout(refreshCurrentTree, 700)\n    } else {"
)
fs.writeFileSync(F, t)
console.log('delayed refresh')
