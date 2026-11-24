import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

const sanitizer = `
// 轻量 HTML 清洗：保留排版/公式，去掉脚本、事件属性与危险 URL
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'select', 'video', 'audio', 'source', 'track'])
function sanitizeHtml(html) {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  const walk = (node) => {
    for (const el of [...node.children]) {
      const tag = el.tagName.toLowerCase()
      if (DROP_TAGS.has(tag)) {
        el.remove()
        continue
      }
      for (const attr of [...el.attributes]) {
        const n = attr.name.toLowerCase()
        const v = attr.value || ''
        if (n.startsWith('on') || n === 'srcdoc' || n === 'formaction') {
          el.removeAttribute(attr.name)
          continue
        }
        if (n === 'style') {
          if (/url\\s*\\(|expression\\s*\\(|javascript:/i.test(v)) el.removeAttribute('style')
          continue
        }
        if ((n === 'href' || n === 'xlink:href') && /^\\s*(javascript|vbscript|data):/i.test(v)) el.removeAttribute(attr.name)
        if (n === 'src' && !/^(https?:|data:image\\/|\\/|\\.\\/|blob:)/i.test(v)) el.removeAttribute(attr.name)
      }
      walk(el)
    }
  }
  walk(tpl.content)
  return tpl.innerHTML
}

`
if (!t.includes('function sanitizeHtml')) t = t.replace('function renderMarkdown(src) {', sanitizer + 'function renderMarkdown(src) {')
t = t.replace("  return html\n}\n\nconst S = {", "  return sanitizeHtml(html)\n}\n\nconst S = {")
fs.writeFileSync(F, t)
console.log('sanitizer added')
