import fs from 'node:fs'

const F = 'mobile/src/llm.js'
let t = fs.readFileSync(F, 'utf8')

// 格式回退
t = t.replace(
  "  const format = resolveFormat(base, provider?.format ?? cfg.apiFormat)",
  "  const explicitFormat = provider?.format && provider.format !== 'auto' ? provider.format : cfg.apiFormat\n  const format = resolveFormat(base, explicitFormat)"
)

// 图片块
if (!t.includes('function anthropicImageBlock')) {
  t = t.replace(
    'function normalizeUsage(u, format, rounds = 1) {',
    `function anthropicImageBlock(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(String(dataUrl || ''))
  return { type: 'image', source: { type: 'base64', media_type: m?.[1] || 'image/png', data: m?.[2] || '' } }
}

function normalizeUsage(u, format, rounds = 1) {`
  )
}

// 透传 tool_use / tool_result / image
t = t.replace(
  "          if (part.type === 'text') return { type: 'text', text: part.text || '' }",
  "          if (part.type === 'text') return { type: 'text', text: part.text || '' }\n          if (part.type === 'tool_use' || part.type === 'tool_result' || part.type === 'image') return part"
)

// 重写执行段
const start = t.indexOf('    for (const c of round.calls) {')
const end = t.indexOf('  }\n  const finalUsage', start)
if (start < 0 || end < 0) throw new Error('loop markers missing')

const block = `    const results = []
    for (const c of round.calls) {
      try {
        onTool?.({ name: c.name, args: parseToolArgs(c.arguments) })
      } catch {}
      let raw
      try {
        raw = await exec(c.name, parseToolArgs(c.arguments))
      } catch (e) {
        raw = '工具执行失败：' + (e.message || e)
      }
      const text = typeof raw === 'string' ? raw : String(raw?.text ?? '')
      const image = raw && typeof raw === 'object' && raw.image ? raw.image : null
      results.push({ call: c, text, image })
    }

    if (format === 'anthropic') {
      messages.push({
        role: 'user',
        content: results.map((r) => ({
          type: 'tool_result',
          tool_use_id: r.call.id,
          content: r.image ? [{ type: 'text', text: r.text }, anthropicImageBlock(r.image)] : r.text
        }))
      })
    } else {
      for (const r of results) {
        messages.push({ role: 'tool', tool_call_id: r.call.id, content: r.text })
      }
      const imgs = results.filter((r) => r.image)
      if (imgs.length) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: '（下面是工具读取的页面截图，供识别图表、公式和文字层遗漏的内容。）' },
            ...imgs.map((r) => ({ type: 'image_url', image_url: { url: r.image, detail: 'high' } }))
          ]
        })
      }
    }
`
t = t.slice(0, start) + block + t.slice(end)
fs.writeFileSync(F, t)
console.log('mobile tool image loop ok')
