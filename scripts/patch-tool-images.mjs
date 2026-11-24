import fs from 'node:fs'

const F = 'lib/llm.mjs'
let t = fs.readFileSync(F, 'utf8')

// data URL -> Anthropic image block
if (!t.includes('function anthropicImageBlock')) {
  t = t.replace(
    'function normalizeUsage(u, format, rounds = 1) {',
    `function anthropicImageBlock(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(String(dataUrl || ''))
  return {
    type: 'image',
    source: { type: 'base64', media_type: m?.[1] || 'image/png', data: m?.[2] || '' }
  }
}

function normalizeUsage(u, format, rounds = 1) {`
  )
}

// 重写工具执行段：支持 {text, image}，Anthropic 用 tool_result，OpenAI 用 tool + 后续 user 图片
const start = t.indexOf('    for (const c of round.calls) {')
const end = t.indexOf('  }\n\n  // 轮次用尽', start)
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
          content: r.image
            ? [{ type: 'text', text: r.text }, anthropicImageBlock(r.image)]
            : r.text
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
console.log('tool image loop rewritten')
