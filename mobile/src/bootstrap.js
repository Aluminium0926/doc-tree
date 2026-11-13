// 移动端启动：本地 API + 抽屉按钮
import './polyfills.js'
import { installFetchShim, fileUrl, downloadExport } from './api.js'

window.DT_LOCAL = true
installFetchShim()
window.DTLocal = { fileUrl, downloadExport }

// 按钮始终注入，桌面宽度下由 CSS 隐藏
function mobileChrome() {
  const app = document.getElementById('app')
  if (!app || document.getElementById('btn-mobile-lib')) return
  const btn = document.createElement('button')
  btn.id = 'btn-mobile-lib'
  btn.type = 'button'
  btn.textContent = '☰'
  btn.setAttribute('aria-label', '文档库')
  const bd = document.createElement('div')
  bd.id = 'lib-backdrop'
  document.body.append(btn, bd)
  const close = () => app.classList.remove('mobile-lib-open')
  btn.addEventListener('click', () => app.classList.toggle('mobile-lib-open'))
  bd.addEventListener('click', close)
  const list = document.getElementById('doc-list')
  if (list) list.addEventListener('click', () => setTimeout(close, 80))
  // 导入完成后收起抽屉，避免盖住刚打开的文档
  const fileInput = document.getElementById('file-input')
  if (fileInput) fileInput.addEventListener('change', () => setTimeout(close, 400))
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mobileChrome)
}
mobileChrome()
setTimeout(mobileChrome, 300)
setTimeout(mobileChrome, 1200)
window.addEventListener('orientationchange', () => setTimeout(mobileChrome, 200))

// 浏览器/PWA 场景注册离线缓存（APK 内有桥接对象，不需要）
if (!window.DocTreeAndroid && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}

console.log('[DocTree] local mode ready')
