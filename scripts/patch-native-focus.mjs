import fs from 'node:fs'
let s=fs.readFileSync('desktop/main.cjs','utf8')
s=s.replace("mainWindow.on('focus', () => {\n    try {\n      mainWindow.webContents.focus()\n    } catch {}\n  })", `mainWindow.on('focus', () => {
    try {
      mainWindow.webContents.focus()
      mainWindow.webContents.executeJavaScript("window.dispatchEvent(new CustomEvent('dt:native-focus'))").catch(() => {})
    } catch {}
  })
  mainWindow.webContents.on('focus', () => {
    try {
      mainWindow.webContents.executeJavaScript("window.dispatchEvent(new CustomEvent('dt:native-focus'))").catch(() => {})
    } catch {}
  })`)
s=s.replace("mainWindow.webContents.executeJavaScript(\"document.querySelector('#q')?.focus({preventScroll:true})\")", "mainWindow.webContents.executeJavaScript(\"window.dispatchEvent(new CustomEvent('dt:native-focus'))\")")
fs.writeFileSync('desktop/main.cjs',s)
console.log('native focus bridge', s.includes("dt:native-focus"))
