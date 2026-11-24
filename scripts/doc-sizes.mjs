import fs from 'node:fs'
const dir = process.env.APPDATA + '/文档树/docs/'
const rows = []
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(dir + f, 'utf8'))
  if (d.kind !== 'pdf') continue
  rows.push({ id: d.id, title: d.title, pages: d.pages.length, chars: d.pages.reduce((n, p) => n + (p.text || '').length, 0) })
}
rows.sort((a, b) => b.chars - a.chars)
console.log(JSON.stringify(rows.slice(0, 3), null, 1))
