// 移动端启动：本地 API + 抽屉按钮
import { installFetchShim, fileUrl, downloadExport } from './api.js'

window.DT_LOCAL = true
installFetchShim()
window.DTLocal = { fileUrl, downloadExport }

function mobileChrome() {
  if (window.innerWidth > 900) return
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
  document.getElementById('doc-list')?.addEventListener('click', () => setTimeout(close, 80))
}

mobileChrome()
window.addEventListener('resize', mobileChrome)

// 浏览器/PWA 场景注册离线缓存（APK 内有桥接对象，不需要）
if (!window.DocTreeAndroid && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

console.log('[DocTree] local mode ready')
