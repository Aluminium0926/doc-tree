import fs from 'node:fs'

// 1) server：接口格式字段 + 视觉 provider 带上格式
let s = fs.readFileSync('server.mjs', 'utf8')
s = s.replace(
  "    for (const k of ['baseUrl', 'model', 'visionModel', 'visionBaseUrl']) {",
  "    for (const k of ['baseUrl', 'model', 'visionModel', 'visionBaseUrl', 'apiFormat', 'visionFormat']) {"
)
s = s.replace(
  "  const provider = body.image ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey } : null",
  "  const provider = body.image\n    ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat }\n    : null"
)
fs.writeFileSync('server.mjs', s)

// 2) 设置面板：接口格式下拉
let h = fs.readFileSync('public/index.html', 'utf8')
const sel = (id) =>
  `<select id="${id}"><option value="auto">自动（按地址判断）</option><option value="openai">OpenAI 兼容</option><option value="anthropic">Anthropic</option></select>`
if (!h.includes('cfg-format')) {
  h = h.replace(
    '    <label>对话模型<input id="cfg-model" placeholder="deepseek-flash"></label>',
    '    <label>对话模型<input id="cfg-model" placeholder="deepseek-flash"></label>\n    <label>接口格式' + sel('cfg-format') + '</label>'
  )
  h = h.replace(
    '    <label>视觉 API Key（可选）<input id="cfg-vision-key" placeholder="留空则用上面的 Key" autocomplete="off"></label>',
    '    <label>视觉 API Key（可选）<input id="cfg-vision-key" placeholder="留空则用上面的 Key" autocomplete="off"></label>\n    <label>视觉接口格式' + sel('cfg-vision-format') + '</label>'
  )
  fs.writeFileSync('public/index.html', h)
}

// 3) app.js：回填与保存
let a = fs.readFileSync('public/app.js', 'utf8')
a = a.replace(
  "  $('#cfg-vision-key').value = ''",
  "  $('#cfg-vision-key').value = ''\n  $('#cfg-format').value = S.cfg?.apiFormat || 'auto'\n  $('#cfg-vision-format').value = S.cfg?.visionFormat || 'auto'"
)
a = a.replace(
  "    visionBaseUrl: $('#cfg-vision-base').value.trim(),",
  "    visionBaseUrl: $('#cfg-vision-base').value.trim(),\n    apiFormat: $('#cfg-format').value,\n    visionFormat: $('#cfg-vision-format').value,"
)
fs.writeFileSync('public/app.js', a)
console.log('patched')
