import fs from 'node:fs'
let t=fs.readFileSync('lib/llm.mjs','utf8')
t=t.replace(
  "export async function chat(messages, { maxTokens = 600, temperature } = {}) {\n  const cfg = readConfig()\n  if (!cfg.apiKey) throw new Error('鏈厤缃?API Key锛岃鐐瑰彸涓婅璁剧疆濉啓')\n  const format = resolveFormat(cfg.baseUrl, cfg.apiFormat)\n  const temp = temperature ?? cfg.temperature",
  "export async function chat(messages, { maxTokens = 600, temperature, model, provider } = {}) {\n  const cfg = readConfig()\n  const baseUrl = provider?.baseUrl || cfg.baseUrl\n  const key = provider?.apiKey || cfg.apiKey\n  if (!key) throw new Error('未配置 API Key，请点右上角设置填写')\n  const format = resolveFormat(baseUrl, provider?.format ?? cfg.apiFormat)\n  const temp = temperature ?? cfg.temperature\n  const useModel = model || cfg.model"
)
t=t.replaceAll("model: cfg.model,\n      max_tokens: maxTokens,", "model: useModel,\n      max_tokens: maxTokens,")
t=t.replaceAll("endpointOf(cfg.baseUrl, format), {\n      method: 'POST',\n      headers: headersOf(cfg.apiKey, format),", "endpointOf(baseUrl, format), {\n      method: 'POST',\n      headers: headersOf(key, format),")
t=t.replace("const body = { model: cfg.model, max_tokens: maxTokens, messages: conv.messages, temperature: Math.min(1, Math.max(0, temp)) }", "const body = { model: useModel, max_tokens: maxTokens, messages: conv.messages, temperature: Math.min(1, Math.max(0, temp)) }")
if(!t.includes('export async function ocrImage')){
  t=t.replace("// ---------- 娴佸紡 ----------", `export async function ocrImage(dataUrl) {
  const cfg = readConfig()
  const provider =
    cfg.visionBaseUrl || cfg.visionApiKey
      ? {
          baseUrl: cfg.visionBaseUrl || cfg.baseUrl,
          apiKey: cfg.visionApiKey || cfg.apiKey,
          format: cfg.visionFormat || cfg.apiFormat
        }
      : undefined
  const text = await chat(
    [
      { role: 'system', content: '你是 OCR 引擎。只提取图片中的文字，保持原有段落、标题、列表和表格顺序；不要解释、不要总结、不要补充。图片里没有文字就输出空字符串。' },
      {
        role: 'user',
        content: [
          { type: 'text', text: '提取这张图片里的全部文字。' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
        ]
      }
    ],
    { maxTokens: 4096, temperature: 0, model: cfg.visionModel || cfg.model, provider }
  )
  return String(text || '').trim()
}

// ---------- 娴佸紡 ----------`)
}
fs.writeFileSync('lib/llm.mjs',t)
console.log('ocrImage ok', t.includes('export async function ocrImage'))
