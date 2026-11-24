import fs from 'node:fs'

const FILE = 'public/index.html'
let html = fs.readFileSync(FILE, 'utf8')

const svg = (inner, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`

const ICONS = {
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>'),
  rotate: svg('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>'),
  theme: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>'),
  prev: svg('<path d="m15 18-6-6 6-6"/>'),
  next: svg('<path d="m9 18 6-6-6-6"/>'),
  zoomOut: svg('<path d="M5 12h14"/>'),
  zoomIn: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  tree: svg('<rect x="3" y="3" width="7" height="6" rx="1.5"/><rect x="14" y="15" width="7" height="6" rx="1.5"/><path d="M6.5 9v6.5a2 2 0 0 0 2 2H14"/>'),
  export: svg('<path d="M12 3v11"/><path d="m7.5 9.5 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/>')
}

const MAP = [
  ['<button id="btn-search" class="icon" title="搜索文档（Ctrl+F）">⌕</button>', `<button id="btn-search" class="icon" title="搜索文档（Ctrl+F）">${ICONS.search}</button>`],
  ['<button id="btn-rotate" class="icon" title="顺时针旋转 90°">⟳</button>', `<button id="btn-rotate" class="icon" title="顺时针旋转 90°">${ICONS.rotate}</button>`],
  ['<button id="btn-theme" class="icon" title="页面配色">◐</button>', `<button id="btn-theme" class="icon" title="页面配色">${ICONS.theme}</button>`],
  ['<button id="btn-prev" class="icon" title="上一页（←）">‹</button>', `<button id="btn-prev" class="icon" title="上一页（←）">${ICONS.prev}</button>`],
  ['<button id="btn-next" class="icon" title="下一页（→）">›</button>', `<button id="btn-next" class="icon" title="下一页（→）">${ICONS.next}</button>`],
  ['<button id="btn-zoom-out" class="icon" title="缩小">−</button>', `<button id="btn-zoom-out" class="icon" title="缩小">${ICONS.zoomOut}</button>`],
  ['<button id="btn-zoom-in" class="icon" title="放大">＋</button>', `<button id="btn-zoom-in" class="icon" title="放大">${ICONS.zoomIn}</button>`],
  ['<button id="btn-treeview" class="icon" title="树状图">⌗</button>', `<button id="btn-treeview" class="icon" title="树状图">${ICONS.tree}</button>`],
  ['<button id="btn-export" class="icon" title="导出 Markdown">⭳</button>', `<button id="btn-export" class="icon" title="导出 Markdown">${ICONS.export}</button>`]
]

let n = 0
for (const [from, to] of MAP) {
  if (html.includes(from)) {
    html = html.split(from).join(to)
    n++
  } else {
    console.log('未匹配:', from.slice(0, 60))
  }
}
fs.writeFileSync(FILE, html, 'utf8')
console.log(`替换 ${n}/${MAP.length}`)
