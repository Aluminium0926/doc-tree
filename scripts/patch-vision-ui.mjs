import fs from 'node:fs'

const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

// 打开设置时回填
t = t.replace(
  "  $('#cfg-vision').value = S.cfg?.visionModel || ''",
  "  $('#cfg-vision').value = S.cfg?.visionModel || ''\n  $('#cfg-vision-base').value = S.cfg?.visionBaseUrl || ''\n  $('#cfg-vision-key').value = ''"
)

// 保存时带上视觉端点；Key 留空表示不修改
t = t.replace(
  "    visionModel: $('#cfg-vision').value.trim(),\n    apiKey: $('#cfg-key').value.trim()",
  "    visionModel: $('#cfg-vision').value.trim(),\n    visionBaseUrl: $('#cfg-vision-base').value.trim(),\n    apiKey: $('#cfg-key').value.trim()"
)
t = t.replace(
  "  await fetch('/api/config', {\n    method: 'POST',",
  "  const vk = $('#cfg-vision-key').value.trim()\n  if (vk) body.visionApiKey = vk\n  await fetch('/api/config', {\n    method: 'POST',"
)

fs.writeFileSync(F, t)
console.log('patched')
