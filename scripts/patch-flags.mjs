import fs from 'node:fs'

// store: flags
let s = fs.readFileSync('lib/store.mjs', 'utf8')
if (!s.includes('getFlags')) {
  s = s.replace(
    "// ---------- 文档 ----------",
    `const FLAGS = path.join(DATA, 'flags.json')

export async function getFlags() {
  try {
    return JSON.parse(await fsp.readFile(FLAGS, 'utf8'))
  } catch {
    return {}
  }
}

export async function setFlags(patch) {
  const cur = await getFlags()
  const next = { ...cur, ...patch }
  await ensureDirs()
  await fsp.writeFile(FLAGS, JSON.stringify(next))
  return next
}

// ---------- 文档 ----------`
  )
  fs.writeFileSync('lib/store.mjs', s)
}

// server: state flags + POST /api/flags
let t = fs.readFileSync('server.mjs', 'utf8')
t = t.replace(
  "return json(res, 200, { docs: await store.listDocs(), groups: await store.listGroups(), config: llm.publicConfig(), serverVersion: SERVER_VERSION })",
  "return json(res, 200, { docs: await store.listDocs(), groups: await store.listGroups(), flags: await store.getFlags(), config: llm.publicConfig(), serverVersion: SERVER_VERSION })"
)
if (!t.includes("/api/flags")) {
  t = t.replace(
    "  if (p === '/api/group' && req.method === 'POST') {",
    `  if (p === '/api/flags' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const patch = {}
    for (const k of ['welcomeSeen', 'guideSeen']) if (typeof body[k] === 'boolean') patch[k] = body[k]
    const flags = await store.setFlags(patch)
    return json(res, 200, { flags })
  }

  if (p === '/api/group' && req.method === 'POST') {`
  )
}
fs.writeFileSync('server.mjs', t)
console.log('flags wired')
