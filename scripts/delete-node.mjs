// 删除节点：node scripts/delete-node.mjs <docId> <nodeId>
const [docId, nodeId] = process.argv.slice(2)
const r = await fetch('http://127.0.0.1:4317/api/node/delete', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ docId, nodeId })
})
console.log(r.status, await r.text())
