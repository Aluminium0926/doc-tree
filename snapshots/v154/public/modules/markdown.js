// Markdown → 安全 HTML，以及代码卡片增强
import { marked } from '../vendor/marked.esm.js'

marked.setOptions({ gfm: true, breaks: true })

// 相对 modules/ 的 vendor 目录：桌面（/vendor/）和移动端（./vendor/）都成立
const VENDOR = new URL('../vendor/', import.meta.url).href

let hljsPromise = null
function ensureHljs() {
  if (window.hljs) return Promise.resolve(window.hljs)
  hljsPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `${VENDOR}highlight/highlight.min.js`
    s.onload = () => resolve(window.hljs)
    s.onerror = () => reject(new Error('highlight.js 加载失败'))
    document.head.appendChild(s)
  })
  return hljsPromise
}

const EXT_BY_LANG = {
  python: 'py', py: 'py', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
  bash: 'sh', shell: 'sh', sh: 'sh', zsh: 'sh', json: 'json', html: 'html', xml: 'xml',
  css: 'css', sql: 'sql', java: 'java', kotlin: 'kt', c: 'c', cpp: 'cpp', 'c++': 'cpp',
  csharp: 'cs', 'c#': 'cs', go: 'go', rust: 'rs', ruby: 'rb', php: 'php', swift: 'swift',
  yaml: 'yml', yml: 'yml', markdown: 'md', md: 'md', diff: 'diff', plaintext: 'txt', text: 'txt'
}

// 把 <pre><code> 变成带语言标签、复制/下载按钮的代码卡片（对齐 DeepSeek 的样式）
export function enhanceCodeBlocks(root) {
  if (!root) return
  const pres = [...root.querySelectorAll('pre')].filter((p) => !p.closest('.code-card') && p.querySelector('code'))
  if (!pres.length) return
  const codes = []
  for (const pre of pres) {
    const code = pre.querySelector('code')
    const lang = (code.className.match(/(?:language|lang)-([\w+#.-]+)/) || [])[1] || ''
    const card = document.createElement('div')
    card.className = 'code-card'
    const head = document.createElement('div')
    head.className = 'code-head'
    const label = document.createElement('span')
    label.className = 'code-lang'
    label.textContent = lang || 'text'
    const actions = document.createElement('div')
    actions.className = 'code-actions'

    const ICON_COPY = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5.5 14.5V6A2.5 2.5 0 0 1 8 3.5h8.5"/></svg>'
    const ICON_DOWN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10"/><path d="m8 10.5 4 4 4-4"/><path d="M4.5 19.5h15"/></svg>'
    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'code-btn'
    copyBtn.innerHTML = ICON_COPY + '<span>复制</span>'
    copyBtn.addEventListener('click', async () => {
      const text = code.innerText
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        try {
          document.execCommand('copy')
        } catch {}
        ta.remove()
      }
      copyBtn.querySelector('span').textContent = '已复制'
      setTimeout(() => (copyBtn.querySelector('span').textContent = '复制'), 1200)
    })

    const dlBtn = document.createElement('button')
    dlBtn.type = 'button'
    dlBtn.className = 'code-btn'
    dlBtn.innerHTML = ICON_DOWN + '<span>下载</span>'
    dlBtn.addEventListener('click', () => {
      const ext = EXT_BY_LANG[lang] || 'txt'
      const blob = new Blob([code.innerText], { type: 'text/plain;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `code.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    })

    actions.append(copyBtn, dlBtn)
    head.append(label, actions)
    pre.replaceWith(card)
    card.append(head, pre)
    codes.push(code)
  }

  const highlight = (h) => {
    if (!h) return
    for (const code of codes) {
      try {
        h.highlightElement(code)
      } catch {}
    }
  }
  if (window.hljs) highlight(window.hljs)
  else ensureHljs().then(highlight).catch(() => {})
}

// 轻量 HTML 清洗：保留排版/公式，去掉脚本、事件属性与危险 URL
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'select', 'video', 'audio', 'source', 'track'])

export function sanitizeHtml(html) {
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
          if (/url\s*\(|expression\s*\(|javascript:/i.test(v)) el.removeAttribute('style')
          continue
        }
        if ((n === 'href' || n === 'xlink:href') && /^\s*(javascript|vbscript|data):/i.test(v)) el.removeAttribute(attr.name)
        if (n === 'src' && !/^(https?:|data:image\/|\/|\.\/|blob:)/i.test(v)) el.removeAttribute(attr.name)
      }
      walk(el)
    }
  }
  walk(tpl.content)
  // 外链一律新开窗口：Electron 里没有地址栏，原地跳转会让应用「消失」
  for (const a of tpl.content.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || ''
    if (/^https?:/i.test(href)) {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    }
  }
  return tpl.innerHTML
}

export function stashBareChem(s, stash) {
  const re = /\\(ce|pu)\s*\{/g
  let out = ''
  let last = 0
  let m
  while ((m = re.exec(s))) {
    const start = m.index
    let i = re.lastIndex
    let depth = 1
    while (i < s.length && depth > 0) {
      if (s[i] === '{') depth++
      else if (s[i] === '}') depth--
      i++
    }
    if (depth > 0) break
    out += s.slice(last, start) + stash(s.slice(start, i))
    last = i
    re.lastIndex = i
  }
  return out + s.slice(last)
}

export function renderMarkdown(src) {
  const store = []
  const fences = []
  let s = String(src || '')

  s = s.replace(/```[\s\S]*?```/g, (m) => {
    fences.push(m)
    return `\u0001F${fences.length - 1}\u0001F`
  })

  const stash = (tex, display) => {
    store.push({ tex, display })
    return `%%M${store.length - 1}%%`
  }

  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => stash(m.trim(), true))
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => stash(m.trim(), true))
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => stash(m.trim(), false))
  s = s.replace(/\$([^$\n]+?)\$/g, (m, inner) => {
    // 货币写法通常带空格（"$5 and $10"），公式一般紧贴 $；据此排除
    if (/^\s|\s$/.test(inner)) return m
    return stash(inner.trim(), false)
  })

  // 模型有时直接写 \ce{...} 而不包 $...$，这里补成行内公式
  s = stashBareChem(s, (tex) => stash(tex, false))
  s = s.replace(/\u0001F(\d+)\u0001F/g, (_, i) => fences[+i])

  let html = marked.parse(s)
  html = html.replace(/%%M(\d+)%%/g, (_, i) => {
    const it = store[+i]
    if (!it) return ''
    if (!window.katex) return `<code>${it.tex}</code>`
    try {
      return window.katex.renderToString(it.tex, { displayMode: it.display, throwOnError: false })
    } catch {
      return `<code>${it.tex}</code>`
    }
  })
  return sanitizeHtml(html)
}
