// 打包移动端 Web 资源到 mobile/www
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(here, 'www')

fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })

const copyFile = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
}
const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true })
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, ent.name)
    const d = path.join(to, ent.name)
    if (ent.isDirectory()) copyDir(s, d)
    else copyFile(s, d)
  }
}
const copy = (from, to) => {
  const st = fs.statSync(from)
  if (st.isDirectory()) copyDir(from, to)
  else copyFile(from, to)
}
copy(path.join(root, 'public', 'app.js'), path.join(out, 'app.js'))
copy(path.join(root, 'public', 'theme.js'), path.join(out, 'theme.js'))
copy(path.join(root, 'public', 'style.css'), path.join(out, 'style.css'))
copy(path.join(root, 'public', 'vendor'), path.join(out, 'vendor'))
copy(path.join(here, 'src'), path.join(out, 'src'))
copy(path.join(here, 'mobile.css'), path.join(out, 'mobile.css'))
copy(path.join(root, 'lib', 'context.mjs'), path.join(out, 'src', 'context.mjs'))
copy(path.join(root, 'node_modules', 'mammoth', 'mammoth.browser.min.js'), path.join(out, 'vendor', 'mammoth.browser.min.js'))
copy(path.join(here, 'icon.svg'), path.join(out, 'icon.svg'))
copy(path.join(here, 'manifest.webmanifest'), path.join(out, 'manifest.webmanifest'))
copy(path.join(here, 'sw.js'), path.join(out, 'sw.js'))

// 子路径部署（如 GitHub Pages /doc-tree/）时，把绝对资源路径改成相对
const appJs = fs.readFileSync(path.join(out, 'app.js'), 'utf8').replace(/'\/vendor\//g, "'./vendor/")
fs.writeFileSync(path.join(out, 'app.js'), appJs, 'utf8')

// index.html：注入移动样式与引导脚本
let html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8')
html = html.replace(/href="\/style\.css\?v=\d+"/, 'href="./style.css"')
html = html.replace(/"\/vendor\//g, '"./vendor/')
html = html.replace('src="/theme.js"', 'src="./theme.js"')
html = html.replace(
  /<link rel="stylesheet" href="\.\/style\.css">/,
  '<link rel="stylesheet" href="./style.css">\n<link rel="stylesheet" href="./mobile.css">\n<link rel="manifest" href="./manifest.webmanifest">\n<meta name="theme-color" content="#0a0c11">\n<script type="module" src="./src/bootstrap.js"></script>'
)
html = html.replace(
  /<script type="module" src="\/app\.js\?v=\d+"><\/script>/,
  '<script type="module" src="./app.js"></script>'
)
fs.writeFileSync(path.join(out, 'index.html'), html, 'utf8')

console.log('mobile www ready:', out)
