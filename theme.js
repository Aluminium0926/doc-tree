// 主题引擎：一个主色 → 整套派生色（深色 / 浅色）
// 作为阻塞脚本放在 <head>，首屏不会闪白
;(function () {
  const KEY = 'dt:theme'
  const BASE = document.currentScript && document.currentScript.src ? new URL('./', document.currentScript.src).href : new URL('./', location.href).href
  const DEFAULT = { mode: 'dark', color: '#6d8dff', gradient: false, angle: 135, alpha: 100 }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

  function hexToRgb(hex) {
    let s = String(hex || '').replace('#', '')
    if (s.length === 3) s = s.split('').map((c) => c + c).join('')
    if (s.length !== 6 || /[^0-9a-f]/i.test(s)) s = '6d8dff'
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
  }

  function rgbToHsl([r, g, b]) {
    r /= 255
    g /= 255
    b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const l = (max + min) / 2
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
      else if (max === g) h = (b - r) / d + 2
      else h = (r - g) / d + 4
      h /= 6
    }
    return [h * 360, s * 100, l * 100]
  }

  function hslToRgb([h, s, l]) {
    h = ((h % 360) + 360) % 360 / 360
    s = clamp(s, 0, 100) / 100
    l = clamp(l, 0, 100) / 100
    if (s === 0) {
      const v = Math.round(l * 255)
      return [v, v, v]
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    const hue = (t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map((v) => Math.round(v * 255))
  }

  function luminance([r, g, b]) {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }

  function contrast(a, b) {
    const la = luminance(a)
    const lb = luminance(b)
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  }

  const hsl = (h, s, l, a) =>
    a == null ? `hsl(${Math.round(h)} ${clamp(s, 0, 100).toFixed(1)}% ${clamp(l, 0, 100).toFixed(1)}%)`
              : `hsla(${Math.round(h)}, ${clamp(s, 0, 100).toFixed(1)}%, ${clamp(l, 0, 100).toFixed(1)}%, ${a})`

  // 让主色在对应底上有足够对比度
  function tuneAccent(rgb, mode) {
    let [h, s, l] = rgbToHsl(rgb)
    const base = mode === 'light' ? [255, 255, 255] : hexToRgb('#0a0c11')
    let cur = rgb
    let guard = 0
    while (contrast(cur, base) < 4.5 && guard++ < 60) {
      l = mode === 'light' ? l - 1.5 : l + 1.5
      if (l < 8 || l > 92) break
      cur = hslToRgb([h, s, l])
    }
    return { h, s, l: clamp(l, 8, 92) }
  }

  function derive(opt) {
    const mode = opt.mode === 'light' ? 'light' : 'dark'
    const alpha = clamp(Number(opt.alpha ?? 100) / 100, 0.55, 1)
    const rgb = hexToRgb(opt.color)
    const [h0, s0] = rgbToHsl(rgb)
    const acc = tuneAccent(rgb, mode)
    const a = acc
    const accentRgb = hslToRgb([a.h, a.s, a.l])
    const accentContrast = contrast(accentRgb, [255, 255, 255]) >= 4.2 ? '#ffffff' : '#0a0c11'

    const t = {}
    if (mode === 'dark') {
      const h = h0
      t.bg = hsl(h, 32, 5)
      t.bg2 = hsl(h + 24, 26, 9)
      t.panel = hsl(h, 26, 9, alpha)
      t['panel-2'] = hsl(h, 24, 12.5, alpha)
      t['panel-3'] = hsl(h, 22, 16, alpha)
      t.line = hsl(h, 20, 19)
      t['line-2'] = hsl(h, 20, 26)
      t.text = hsl(h, 18, 94)
      t.dim = hsl(h, 12, 64)
      t['dim-2'] = hsl(h, 10, 46)
      t.quote = hsl(h, 10, 58)
      t.accent = hsl(a.h, a.s, a.l)
      t['accent-2'] = hsl(a.h, a.s, Math.min(a.l + 9, 84))
      t['accent-deep'] = hsl(a.h, a.s, Math.max(a.l - 12, 40))
      t['accent-line'] = hsl(a.h, a.s * 0.72, 46)
      t['accent-contrast'] = accentContrast
      t['accent-soft'] = hsl(a.h, a.s, a.l, 0.14)
      t.ok = hsl(150, 55, 58)
      t['ok-bg'] = hsl(150, 35, 30, 0.28)
      t.warn = hsl(35, 92, 62)
      t.err = hsl(0, 78, 68)
      t['err-bg'] = hsl(0, 55, 55, 0.16)
      t['err-line'] = hsl(0, 55, 55, 0.4)
      t.shadow = '0 14px 34px rgba(0, 0, 0, 0.45)'
      t['code-bg'] = '#171b22'
      t['code-head'] = '#12161c'
      t['code-line'] = '#262e3b'
      t['code-text'] = '#dbe4f0'
      t['code-dim'] = '#8b96ab'
    } else {
      t.bg = hsl(h0, 40, 97)
      t.bg2 = hsl(h0 + 18, 38, 94)
      t.panel = hsl(h0, 36, 100, alpha)
      t['panel-2'] = hsl(h0, 30, 96.5, alpha)
      t['panel-3'] = hsl(h0, 26, 93, alpha)
      t.line = hsl(h0, 20, 86)
      t['line-2'] = hsl(h0, 18, 78)
      t.text = hsl(h0, 30, 12)
      t.dim = hsl(h0, 14, 40)
      t['dim-2'] = hsl(h0, 10, 54)
      t.quote = hsl(h0, 12, 38)
      t.accent = hsl(a.h, a.s, a.l)
      t['accent-2'] = hsl(a.h, a.s, Math.max(a.l - 8, 18))
      t['accent-deep'] = hsl(a.h, a.s, Math.max(a.l - 14, 14))
      t['accent-line'] = hsl(a.h, a.s * 0.8, 62)
      t['accent-contrast'] = accentContrast
      t['accent-soft'] = hsl(a.h, a.s, Math.max(a.l - 6, 30), 0.12)
      t.ok = hsl(150, 55, 30)
      t['ok-bg'] = hsl(150, 45, 92)
      t.warn = hsl(32, 85, 38)
      t.err = hsl(0, 65, 46)
      t['err-bg'] = hsl(0, 70, 96)
      t['err-line'] = hsl(0, 55, 82)
      t.shadow = '0 10px 26px rgba(15, 23, 42, 0.12)'
      t['code-bg'] = '#f6f8fa'
      t['code-head'] = '#eef1f5'
      t['code-line'] = '#e1e6ee'
      t['code-text'] = '#24292f'
      t['code-dim'] = '#6e7781'
    }
    t['app-bg'] = opt.gradient ? `linear-gradient(${Math.round(opt.angle || 135)}deg, ${t.bg}, ${t.bg2})` : t.bg
    if (!opt.gradient) delete t.bg2
    return { tokens: t, mode, alpha }
  }

  function apply(opt) {
    const o = { ...DEFAULT, ...(opt || {}) }
    const { tokens, mode, alpha } = derive(o)
    const root = document.documentElement
    for (const [k, v] of Object.entries(tokens)) root.style.setProperty(`--${k}`, v)
    root.dataset.mode = mode
    root.dataset.glass = alpha < 0.995 ? '1' : '0'
    root.style.colorScheme = mode
    const hl = document.getElementById('hljs-theme')
    if (hl) {
      const want = mode === 'light' ? 'atom-one-light.min.css' : 'atom-one-dark.min.css'
      if (!hl.href.endsWith(want)) hl.href = new URL('vendor/highlight/' + want, BASE).href
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', mode === 'light' ? '#f7f8fc' : '#0a0c11')
    return o
  }

  function save(opt) {
    try {
      localStorage.setItem(KEY, JSON.stringify(opt))
    } catch {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return { ...DEFAULT }
      return { ...DEFAULT, ...JSON.parse(raw) }
    } catch {
      return { ...DEFAULT }
    }
  }

  function reset() {
    try {
      localStorage.removeItem(KEY)
    } catch {}
    apply(DEFAULT)
    return { ...DEFAULT }
  }

  window.DTTheme = { DEFAULT, apply, save, load, reset, derive }

  // 首屏立即应用
  const cur = load()
  apply(cur)
  // head 里的语法主题 link 在脚本执行时还没解析，DOM 就绪后补一次
  document.addEventListener('DOMContentLoaded', () => apply(load()))
})()
