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
    show: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false }
  })

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`)
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    log(`did-fail-load ${code} ${desc}`)
  })
  mainWindow.webContents.on('did-finish-load', () => {
    log('did-finish-load')
    // 启动后主动拿一次焦点，避免窗口开在前台但没有键盘焦点（输入框不显示光标）
    try {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.focus()
    } catch {}
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
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '打开数据目录', click: () => shell.openPath(app.getPath('userData')) },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重载' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    }
  ]
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

  serverPort = await freePort()
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
