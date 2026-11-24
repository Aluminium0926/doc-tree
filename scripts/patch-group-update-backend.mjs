import fs from 'node:fs'
let s = fs.readFileSync('lib/store.mjs', 'utf8')
s = s.replace(
  `  const cleaned = groups.filter((x) => x.docIds.length > 0)
  await saveGroups(cleaned)
  return cleaned.find((x) => x.id === id) || null
}`,
  `  // 少于 2 份的组自动解散：树复制给剩下的文档
  for (const x of [...groups]) {
    if (x.docIds.length >= 2) continue
    const tree = await readTreeFile(groupTreePath(x.id))
    for (const docId of x.docIds) {
      await fsp.writeFile(path.join(TREES, \`\${docId}.json\`), JSON.stringify(tree))
    }
    await fsp.rm(groupTreePath(x.id), { force: true })
    groups.splice(groups.indexOf(x), 1)
  }
  await saveGroups(groups)
  return groups.find((x) => x.id === id) || null
}`
)
fs.writeFileSync('lib/store.mjs', s)

let t = fs.readFileSync('server.mjs', 'utf8')
t = t.replace(
  "    if (!g) return json(res, 404, { error: '组不存在' })\n    return json(res, 200, { group: g })",
  "    return json(res, 200, { group: g, dissolved: !g })"
)
fs.writeFileSync('server.mjs', t)
console.log('group update dissolves small groups')
