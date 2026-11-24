import fs from 'node:fs'
let s=fs.readFileSync('desktop/main.cjs','utf8')
s=s.replace("    show: true,", "    show: false,")
const start=s.indexOf("  mainWindow.webContents.on('did-finish-load', () => {")
if(start<0) throw new Error('did-finish-load missing')
const end=s.indexOf("  mainWindow.on('close'", start)
if(end<0) throw new Error('close missing')
const reveal=`  const revealWindow = () => {
    if (!mainWindow) return
    try { app.focus({ steal: true }) } catch {}
    try {
      mainWindow.show()
      mainWindow.setAlwaysOnTop(true)
      mainWindow.focus()
      mainWindow.webContents.focus()
      mainWindow.setAlwaysOnTop(false)
      mainWindow.moveTop()
    } catch {}
    const focusComposer = () => {
      if (!mainWindow) return
      try {
        mainWindow.focus()
        mainWindow.webContents.focus()
        mainWindow.webContents.executeJavaScript("document.querySelector('#q')?.focus({preventScroll:true})")
      } catch {}
    }
    setTimeout(focusComposer, 350)
    setTimeout(focusComposer, 1200)
  }

  mainWindow.once('ready-to-show', revealWindow)
  mainWindow.webContents.on('did-finish-load', () => {
    log('did-finish-load')
    revealWindow()
  })
  mainWindow.on('focus', () => {
    try {
      mainWindow.webContents.focus()
    } catch {}
  })
`
s=s.slice(0,start)+reveal+s.slice(end)
fs.writeFileSync('desktop/main.cjs',s)
console.log('electron reveal/focus patched', s.includes('revealWindow'))
