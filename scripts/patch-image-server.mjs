import fs from 'node:fs'
let s=fs.readFileSync('server.mjs','utf8')
s=s.replace("暂不支持 ${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPTX", "暂不支持 ${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPTX / 图片")
s=s.replace("    if (!pageImage && doc.kind === 'pdf') {", "    if (!pageImage && (doc.kind === 'pdf' || doc.kind === 'image')) {")
s=s.replace("    const summary = doc.pages?.[0]?.text || ''", "    const summary = doc.pages?.[0]?.text || ''") // noop
s=s.replace("    ;(async () => {\n      try {\n        const s = await llm.chat(buildSummaryMessages(doc)", "    ;(async () => {\n      if (kind === 'image') return\n      try {\n        const s = await llm.chat(buildSummaryMessages(doc)")
s=s.replace("      if (target && target.kind === 'pdf') {", "      if (target && (target.kind === 'pdf' || target.kind === 'image')) {")
fs.writeFileSync('server.mjs',s)
console.log('server image ask/exec ok')
