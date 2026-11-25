/* ================= 输入框焦点管理（唯一入口） =================
 *
 * 规则只有一条：只要窗口是激活的、没有弹窗、没有别的文本框在用，
 * 焦点就必须在 #q 里。所有“操作类”交互结束后统一回到这里。
 *
 * 两个坑（都已实测）：
 *  1. Electron 里 document.hasFocus() 会误报 true：窗口没被激活时它也可能是 true，
 *     于是 q.focus() 成功、activeElement 是 #q，但系统光标不闪、键盘输入到不了渲染进程。
 *     → 窗口激活状态以主进程的 dt:win-state / dt:win-focus / dt:win-blur 为准。
 *  2. 中文输入法无法用 keydown 重放恢复（首键是 keyCode 229 / key:"Process"，
 *     后面全是 composition 事件，只会送到当前焦点元素）。
 *     → 不再重放字符，只保证焦点归位；焦点对了，输入法自然就对。
 */
export const DTFocus = (() => {
  let known = false // 是否已从主进程拿到窗口激活状态
  let active = true // 最近一次已知的窗口激活状态
  let attempts = 0

  const composer = () => document.querySelector('#q')

  const TEXT_TYPES = new Set([
    'text', 'search', 'email', 'url', 'tel', 'password', 'number',
    'date', 'time', 'datetime-local', 'month', 'week'
  ])

  // 真正“能打字”的控件（range / checkbox / button 不算，它们不该挡住输入框）
  function isTextual(el) {
    if (!el) return false
    if (el.isContentEditable) return true
    if (el.tagName === 'TEXTAREA') return true
    if (el.tagName !== 'INPUT') return false
    return TEXT_TYPES.has((el.getAttribute('type') || 'text').toLowerCase())
  }

  function uiBlocks() {
    if (document.querySelector('.modal:not([hidden])')) return true
    const search = document.querySelector('#search-bar')
    if (search && !search.hidden) return true
    return false
  }

  function winActive() {
    if (known) return active
    // 浏览器 / 还没收到主进程消息时：hasFocus() 为 false 一定不可聚焦，为 true 不确定
    return document.hasFocus() !== false
  }

  function canFocus({ external = false, respectSelection = false } = {}) {
    const q = composer()
    if (!q || q.disabled) return false
    if (uiBlocks()) return false
    if (!external && window.DT_LOCAL) return false // 移动端不自动弹键盘
    if (!winActive()) return false // 窗口没激活就别制造“有焦点没光标”的假象
    const ae = document.activeElement
    if (ae && ae !== q && isTextual(ae)) return false
    if (respectSelection) {
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed && String(sel).trim()) return false
    }
    return true
  }

  function focus({ end = false, clearSelection = false, external = false, respectSelection = false } = {}) {
    const q = composer()
    if (!q) return false
    if (!canFocus({ external, respectSelection })) return false
    if (clearSelection) {
      try { window.getSelection()?.removeAllRanges() } catch {}
    }
    const wasFocused = document.activeElement === q
    try { q.focus({ preventScroll: true }) } catch {}
    if (document.activeElement !== q) return false
    // 只有“刚刚才把焦点拿回来”时才把光标放到末尾；
    // 已经在输入框里打字时不要动光标，否则会把光标从中间弹到末尾。
    if (end && !wasFocused) {
      const n = q.value.length
      try { q.setSelectionRange(n, n) } catch {}
    }
    if (!wasFocused) attempts++
    return true
  }

  function setActive(v) {
    known = true
    active = Boolean(v)
    if (active) {
      // 窗口刚被激活：立刻把焦点还给输入框（除非用户正在别处输入/有弹窗）
      setTimeout(() => focus({ respectSelection: true }), 0)
      setTimeout(() => focus({ respectSelection: true }), 120)
    }
  }

  // 主进程事件：dt:win-state（激活状态广播）、dt:win-focus、dt:win-blur
  window.addEventListener('dt:win-state', (e) => setActive(e.detail?.active !== false))
  window.addEventListener('dt:win-focus', () => setActive(true))
  window.addEventListener('dt:win-blur', () => setActive(false))

  // 浏览器 / 移动端 / 主进程没发消息时的兜底
  window.addEventListener('focus', () => {
    setTimeout(() => focus({ respectSelection: true }), 60)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setTimeout(() => focus({ respectSelection: true }), 60)
  })

  return { focus, canFocus, isTextual, uiBlocks, winActive, setActive, get state() { return { known, active, attempts } } }
})()
window.DTFocus = DTFocus

// 启动时给几次机会（主进程的 dt:win-state 通常在这之前就到了）
setTimeout(() => DTFocus.focus({ respectSelection: true }), 120)
setTimeout(() => DTFocus.focus({ respectSelection: true }), 600)
setTimeout(() => DTFocus.focus({ respectSelection: true }), 1600)

/* ---------- 点击后回焦：所有“操作类”点击统一处理 ---------- */
// 这些区域里的点击不抢焦点（弹窗、搜索条、右键菜单、浮动菜单、分组框、树状图）
const FOCUS_KEEP_ZONE = [
  '.modal', '#treeview', '#settings', '#usage', '#update', '#ask', '#welcome',
  '#search-bar', '#theme-pop', '#instr-pop', '#page-menu', '#float-menu', '#group-bar'
].join(', ')

// 明确“点了就该回到输入框”的控件
const FOCUS_BACK = [
  'button', '.doc-item', '.doc-group', '.doc-arch-head', '.g-chev', '.g-name', '.g-count',
  '.quote', '.chip-x', '.dot', '.collapse', '.hl', 'summary', '.tv-node', '.page-tag'
].join(', ')

// 这个点击是不是“应该保留焦点在别处”
function keepFocusHere(t) {
  if (!(t instanceof Element)) return true
  if (t.closest(FOCUS_KEEP_ZONE)) return true
  // 注意：页码框/组名框没有 type 属性，不能用 input[type="text"] 去匹配，
  // 必须按“是不是真的能打字的控件”来判断，否则会把页码框的焦点抢走。
  const ctl = t.closest('textarea, input, select, [contenteditable="true"]')
  if (ctl && DTFocus.isTextual(ctl)) return true
  return false
}

document.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return
  const t = e.target
  if (!(t instanceof Element)) return
  if (keepFocusHere(t)) return
  // 点按钮这类“操作”时清掉残留选区，避免 document 级 mouseup 拿旧选区重新挂锚点/弹浮层
  if (t.closest(FOCUS_BACK)) {
    try { window.getSelection()?.removeAllRanges() } catch {}
  }
}, true)

document.addEventListener('click', (e) => {
  const t = e.target
  if (keepFocusHere(t)) return
  const explicit = t instanceof Element && Boolean(t.closest(FOCUS_BACK))
  setTimeout(() => {
    if (document.querySelector('.modal:not([hidden])')) return
    if (!explicit) {
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed && String(sel).trim()) return // 用户正在选中文字，别抢
    }
    DTFocus.focus({ end: explicit, clearSelection: explicit, respectSelection: !explicit })
  }, 0)
}, true)

/* ---------- 弹窗 / 搜索条 / 分组建组条关闭后回焦 ---------- */
if (typeof MutationObserver !== 'undefined') {
  const watcher = new MutationObserver(() => {
    if (document.querySelector('.modal:not([hidden])')) return
    const search = document.querySelector('#search-bar')
    if (search && !search.hidden) return
    const bar = document.querySelector('#group-bar')
    if (bar && !bar.hidden) return
    setTimeout(() => DTFocus.focus({ end: false }), 40)
  })
  document.querySelectorAll('.modal, #treeview, #search-bar, #group-bar, #instr-pop, #theme-pop').forEach((el) => {
    watcher.observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] })
  })
}

/* ---------- 键盘兜底（只补焦点，不重放字符） ---------- */
// 正常流程下焦点不会丢；这里只处理极端情况（比如窗口刚激活时的那一拍）。
// 不重放字符：中文输入法首键是 keyCode 229，重放只会把半截拼音塞进输入框。
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
  if (document.querySelector('.modal:not([hidden])')) return
  const ae = document.activeElement
  if (DTFocus.isTextual(ae)) return
  if (!DTFocus.winActive()) return
  const q = document.querySelector('#q')
  if (!q || q.disabled) return
  if (e.keyCode === 229 || e.key === 'Process' || e.key === 'Unidentified') {
    DTFocus.focus({ end: true }) // 输入法首键：只把焦点挪回来，下一次按键就能正常上屏
    return
  }
  if (!DTFocus.focus({ end: true })) return
  if (e.key.length !== 1) return // 退格/回车/方向键等交给浏览器，焦点对了就行
  // 单字符用 insertText 回放：保留光标位置、触发 input 事件
  let inserted = false
  try { inserted = document.execCommand('insertText', false, e.key) } catch {}
  if (inserted) e.preventDefault()
})
