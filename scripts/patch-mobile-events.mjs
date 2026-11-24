import fs from 'node:fs'
let t=fs.readFileSync('mobile/src/llm.js','utf8')
t=t.replace(
`        const j = JSON.parse(data)
        if (j.usage) usage = j.usage
        const delta = j.choices?.[0]?.delta
        if (!delta) continue`,
`        const j = JSON.parse(data)
        if (j.usage) usage = j.usage
        const evt = j.choices?.[0]?.server_tool_event
        if (evt) onWebEvent?.(evt)
        const delta = j.choices?.[0]?.delta
        if (delta?.annotations?.length) sources = delta.annotations
        if (!delta) continue`
)
fs.writeFileSync('mobile/src/llm.js',t)
console.log('mobile parse events ok', t.includes('server_tool_event'))
