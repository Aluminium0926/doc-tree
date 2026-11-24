// 用假 electron 模块模拟运行桌面端主进程，定位卡在哪一步
const Module = require('module')
const path = require('node:path')

const appRoot = process.argv[2] || path.resolve(__dirname, '..', 'release', 'DocTree-win32-x64', 'resources', 'app')
const mainPath = path.join(appRoot, 'desktop', 'main.cjs')

const logs = []
const fakeApp = {
  isPackaged: true,
  getPath: (n) => path.join(process.env.TEMP, 'dt-sim', n),
  whenReady: () => Promise.resolve(),
  on: () => {},
  quit: () => { logs.push('app.quit()'); throw new Error('QUIT') },
  requestSingleInstanceLock: () => true,
  disableHardwareAcceleration: () => {}
}

const fakeElectron = {
  app: fakeApp,
  BrowserWindow: class {
    constructor(opts) {
      logs.push('BrowserWindow ' + JSON.stringify({ w: opts.width, h: opts.height }))
      this.webContents = { setWindowOpenHandler() {}, openDevTools() {}, on() {} }
    }
    loadURL(u) { logs.push('loadURL ' + u) }
    once(ev, cb) { logs.push('once ' + ev); if (ev === 'ready-to-show') setTimeout(cb, 10) }
    on() {}
    getNormalBounds() { return { width: 1, height: 1 } }
    show() { logs.push('show()') }
  },
  Menu: { setApplicationMenu() {}, buildFromTemplate: () => ({}) },
  shell: { openExternal() {}, openPath() {} },
  dialog: { showErrorBox: (t, m) => logs.push('ERRORBOX ' + t + ' :: ' + m) }
}

const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return fakeElectron
  return origLoad.apply(this, arguments)
}

process.on('unhandledRejection', (e) => { logs.push('UNHANDLED ' + (e && e.stack || e)) })
process.on('uncaughtException', (e) => { logs.push('UNCAUGHT ' + (e && e.stack || e)) })

try {
  require(mainPath)
} catch (e) {
  logs.push('THROW ' + (e && e.stack || e))
}

setTimeout(() => {
  console.log(logs.join('\n'))
  process.exit(0)
}, 6000)
