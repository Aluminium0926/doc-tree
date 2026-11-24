import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')
j=j.replace(
`async function runQueue() {
  running = true
  while (queue.length) {
    const job = queue.shift()
    try {
      await withTimeout(job(), 20000, '结构渲染超时')
    } catch {}
  }
  running = false
}`,
`async function runQueue() {
  if (running) return
  running = true
  try {
    while (queue.length) {
      const job = queue.shift()
      try {
        await withTimeout(job(), 20000, '结构渲染超时')
      } catch {}
    }
  } finally {
    running = false
    if (queue.length) runQueue()
  }
}`
)
fs.writeFileSync('public/chem.js',j)
console.log('queue race fixed', j.includes('if (queue.length) runQueue()'))
