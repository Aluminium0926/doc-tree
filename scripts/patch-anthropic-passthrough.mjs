import fs from 'node:fs'
const F='lib/llm.mjs'
let t=fs.readFileSync(F,'utf8')
t=t.replace(
  `        .map((part) => {
          if (part.type === 'text') return { type: 'text', text: part.text || '' }
          if (part.type === 'image_url') {`,
  `        .map((part) => {
          if (part.type === 'text') return { type: 'text', text: part.text || '' }
          if (part.type === 'tool_use' || part.type === 'tool_result' || part.type === 'image') return part
          if (part.type === 'image_url') {`
)
fs.writeFileSync(F,t)
console.log('anthropic passthrough ok')
