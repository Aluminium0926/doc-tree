import fs from 'node:fs'
let t=fs.readFileSync('mobile/src/llm.js','utf8')
if(!t.includes('export async function ocrImage')){
  t += `
export async function ocrImage(dataUrl) {
  const cfg = readConfig()
  const provider =
    cfg.visionBaseUrl || cfg.visionApiKey
      ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat || cfg.apiFormat }
      : undefined
  let out = ''
  await streamChatWithTools(
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
    (d) => {
      out += d
    },
    { model: cfg.visionModel || cfg.model, provider }
  )
  return out.trim()
}
`
}
fs.writeFileSync('mobile/src/llm.js',t)

let a=fs.readFileSync('mobile/src/api.js','utf8')
a=a.replace("import { chat, streamChat, streamChatWithTools } from './llm.js'", "import { chat, streamChat, streamChatWithTools, ocrImage } from './llm.js'")
const needle=`    await db.saveDoc(doc)
    makeSummary(doc)`
const repl=`    await db.saveDoc(doc)
    if (kind === 'image') {
      try {
        const dataUrl = await imageDocDataUrl(doc)
        const text = await ocrImage(dataUrl)
        if (text) {
          doc.pages[0].text = text
          doc.ocr = true
          await db.saveDoc(doc)
        }
      } catch (e) {
        console.warn('[ocr]', e)
      }
    }
    makeSummary(doc)`
if(!a.includes(needle)) throw new Error('mobile import needle')
a=a.replace(needle,repl)
fs.writeFileSync('mobile/src/api.js',a)
console.log('mobile OCR ok', a.includes('ocrImage(dataUrl)'))
