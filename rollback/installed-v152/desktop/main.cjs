// 文档树 · 桌面端主进程（服务同进程内启动，避免子进程被拦截）
const { app, BrowserWindow, Menu, shell, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const net = require('node:net')
const { pathToFileURL } = require('node:url')

const APP_ROOT = path.join(__dirname, '..')
const isDev = !app.isPackaged
let mainWindow = null
let serverPort = 4317

const LOG_DIR = path.join(process.env.APPDATA || process.env.HOME || '.', '文档树')
const LOG_FILE = path.join(LOG_DIR, 'desktop.log')
function log(msg) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true })
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`)
  } catch {}
}

// 测试/多实例可用独立数据目录，不影响正在用的那份
if (process.env.DOCTREE_USERDATA) {
  try {
    fs.mkdirSync(process.env.DOCTREE_USERDATA, { recursive: true })
    app.setPath('userData', process.env.DOCTREE_USERDATA)
    log('userData override -> ' + process.env.DOCTREE_USERDATA)
  } catch (e) {
    log('userData override failed: ' + e.message)
  }
}

function failBox(title, detail) {
  try {
    dialog.showErrorBox(title, `${detail}\n\n日志：${LOG_FILE}`)
  } catch {}
}

log(`---- launch pid=${process.pid} packaged=${app.isPackaged} root=${APP_ROOT}`)

process.on('uncaughtException', (e) => {
  log('UNCAUGHT ' + ((e && e.stack) || e))
  failBox('文档树启动失败', String((e && e.message) || e))
})
process.on('unhandledRejection', (e) => {
  log('UNHANDLED ' + ((e && e.stack) || e))
})

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)))
  })
}

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', () => resolve(4317))
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
  })
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

async function waitServer(port, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/state`)
      if (r.ok) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

function boundsFile() {
  return path.join(app.getPath('userData'), 'window.json')
}

function loadBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(boundsFile(), 'utf8'))
    if (b && b.width > 600 && b.height > 400) return b
  } catch {}
  return { width: 1500, height: 950 }
}

function saveBounds() {
  if (!mainWindow) return
  try {
    fs.writeFileSync(boundsFile(), JSON.stringify(mainWindow.getNormalBounds()))
  } catch {}
}

function createWindow() {
  const b = loadBounds()
  log('createWindow ' + JSON.stringify(b))
  mainWindow = new BrowserWindow({
    width: b.width,
    height: b.height,
    x: b.x,
    y: b.y,
    minWidth: 900,
    minHeight: 580,
    backgroundColor: '#0a0c11',
    autoHideMenuBar: true,
    title: '文档树',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false }
  })

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`)
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    log(`did-fail-load ${code} ${desc}`)
  })
  // ---------- 焦点桥 ----------
  // 渲染进程没法可靠判断窗口是否被激活（实测 Electron 里 document.hasFocus() 会误报 true），
  // 所以窗口激活状态由主进程广播给页面，页面再决定要不要聚焦输入框。
  // 以前是从主进程直接 executeJavaScript 抢 #q：窗口没激活时这会造出
  // “document.activeElement 是 #q、屏幕上却没有光标、键盘也打不进字”的状态。
  const sendToRenderer = (name, detail = {}) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    try {
      const js = `window.dispatchEvent(new CustomEvent(${JSON.stringify(name)}, { detail: ${JSON.stringify(detail)} }))`
      mainWindow.webContents.executeJavaScript(js).catch(() => {})
    } catch {}
  }
  const notifyWindowState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    let active = false
    try { active = mainWindow.isFocused() } catch {}
    sendToRenderer('dt:win-state', { active })
  }

  let revealed = false
  const revealWindow = () => {
    if (!mainWindow) return
    if (revealed) {
      notifyWindowState()
      return
    }
    revealed = true
    try { app.focus(process.platform === 'darwin' ? { steal: true } : undefined) } catch {}
    try { mainWindow.show() } catch {}
    // 从脚本/后台进程启动时会被 Windows 前台锁挡住：show() 只把窗口摆出来，不给键盘焦点。
    // 重试把它拉到前台；仍然不行就闪任务栏提示用户点一下。
    const ensureActive = (attempt) => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      let focused = false
      try { focused = mainWindow.isFocused() } catch {}
      if (focused) {
        try { mainWindow.webContents.focus() } catch {}
        try { mainWindow.flashFrame(false) } catch {}
        notifyWindowState()
        return
      }
      try {
        mainWindow.setAlwaysOnTop(true)
        mainWindow.focus()
        mainWindow.webContents.focus()
        mainWindow.setAlwaysOnTop(false)
        mainWindow.moveTop()
      } catch {}
      if (attempt < 4) setTimeout(() => ensureActive(attempt + 1), 260)
      else {
        try { mainWindow.flashFrame(true) } catch {}
        log('window still not focused after retries (foreground lock?)')
        notifyWindowState()
      }
    }
    setTimeout(() => ensureActive(0), 40)
    // 页面脚本可能比这行晚执行，隔一会儿再广播一次状态兜底
    setTimeout(notifyWindowState, 900)
  }

  mainWindow.once('ready-to-show', revealWindow)
  mainWindow.webContents.on('did-finish-load', () => {
    log('did-finish-load')
    revealWindow()
    setTimeout(notifyWindowState, 120)
    setTimeout(notifyWindowState, 1200)
  })
  mainWindow.on('focus', () => {
    try { mainWindow.webContents.focus() } catch {}
    try { mainWindow.flashFrame(false) } catch {}
    notifyWindowState()
  })
  mainWindow.on('blur', () => {
    sendToRenderer('dt:win-blur', {})
  })
  mainWindow.webContents.on('focus', () => {
    notifyWindowState()
  })
  mainWindow.on('close', saveBounds)
  mainWindow.on('closed', () => (mainWindow = null))
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (isDev && !process.env.DOCTREE_NO_DEVTOOLS) mainWindow.webContents.openDevTools({ mode: 'detach' })
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = []

  // macOS 需要 App 菜单与「编辑」菜单，否则 Cmd+C/V 不可用
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 文档树' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出 文档树' }
      ]
    })
    template.push({
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    })
  }

  template.push({
    label: '文件',
    submenu: [
      { label: '打开数据目录', click: () => shell.openPath(app.getPath('userData')) },
      { type: 'separator' },
      { role: 'quit', label: '退出' }
    ]
  })

  template.push({
    label: '视图',
    submenu: [
      { role: 'reload', label: '重新加载' },
      { role: 'forceReload', label: '强制重载' },
      { type: 'separator' },
      { role: 'toggleDevTools', label: '开发者工具' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: '全屏' }
    ]
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function boot() {
  const dataDir = app.getPath('userData')
  log('userData ' + dataDir)

  const bundled = path.join(APP_ROOT, 'data')
  if (!fs.existsSync(path.join(dataDir, 'config.json')) && fs.existsSync(bundled)) {
    try {
      copyDir(bundled, dataDir)
      log('copied bundled data')
    } catch (e) {
      log('copy data failed: ' + e.message)
    }
  }

  // 固定端口：保证 http://127.0.0.1:<port> 这个 origin 稳定，
  // 否则每次启动都换端口，localStorage（欢迎页、缩放、跳过版本等）全部丢失
  serverPort = 43171
  if (!(await portFree(serverPort))) serverPort = await freePort()
  process.env.DOCTREE_DATA = dataDir
  process.env.PORT = String(serverPort)
  log('importing server on ' + serverPort)

  await import(pathToFileURL(path.join(APP_ROOT, 'server.mjs')).href)
  log('server module loaded')

  const ok = await waitServer(serverPort)
  log('server ready=' + ok)
  if (!ok) throw new Error('本地服务启动后没有响应（端口 ' + serverPort + '）')

  buildMenu()
  createWindow()
}

if (!app.requestSingleInstanceLock()) {
  log('second instance, quit')
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(boot).catch((e) => {
    log('BOOT FAIL ' + ((e && e.stack) || e))
    failBox('文档树启动失败', String((e && e.message) || e))
    app.quit()
  })

  app.on('window-all-closed', () => app.quit())
}
