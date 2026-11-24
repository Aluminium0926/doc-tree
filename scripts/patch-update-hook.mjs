import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

// 1) 重写 initUpdateCheck：由欢迎弹窗关闭时触发，不再依赖 MutationObserver
const re = /function initUpdateCheck\(\) \{[\s\S]*?\n\}\n/
const next = `function initUpdateCheck() {
  $('#update-later')?.addEventListener('click', () => closeUpdate(false))
  $('#update-go')?.addEventListener('click', () => closeUpdate(true))
  const w = $('#welcome')
  if (!w || w.hidden) setTimeout(() => checkUpdate(), 2000)
}
`
if (!re.test(t)) { console.log('initUpdateCheck not found'); process.exit(1) }
t = t.replace(re, next)

// 2) 关闭欢迎弹窗后触发检查
t = t.replace(
  "      localStorage.setItem('dt:seenWelcome', '1')\n    } catch {}\n  }",
  "      localStorage.setItem('dt:seenWelcome', '1')\n    } catch {}\n    setTimeout(() => checkUpdate(), 500)\n  }"
)

fs.writeFileSync(F, t)
console.log('patched')
