import fs from 'node:fs'
let w=fs.readFileSync('.github/workflows/build-mac-cross.yml','utf8')
w=w.replace('TAG="mac-$ARCH-v1.0.9"','TAG="mac-$ARCH-v1.0.10"')
w=w.replace('--title "DocTree macOS $ARCH v1.0.9"','--title "DocTree macOS $ARCH v1.0.10"')
w=w.replace('--notes "macOS 版（$ARCH），在 Ubuntu 上交叉构建，未签名未公证。解压后双击「首次打开.command」，它会自动去隔离、做本地临时签名并启动。"','--notes "macOS 版（$ARCH），在 Ubuntu 上交叉构建，未签名未公证。解压后双击「首次打开.command」，它会自动去隔离、做本地临时签名并启动。\\n\\n本版起支持 PPT/PPTX 自动转 PDF：优先 LibreOffice，否则调用本机 Microsoft PowerPoint（首次会请求自动化权限）。"')
fs.writeFileSync('.github/workflows/build-mac-cross.yml',w)

function sub(f,pairs){let t=fs.readFileSync(f,'utf8');for(const[a,b]of pairs)t=t.split(a).join(b);fs.writeFileSync(f,t)}
for(const f of ['README.md','docs/使用手册.md','docs/安卓与鸿蒙.md']){
  sub(f,[['mac-arm64-v1.0.9','mac-arm64-v1.0.10'],['mac-x64-v1.0.9','mac-x64-v1.0.10']])
}
let r=fs.readFileSync('README.md','utf8')
r=r.replace('## 最近更新\n\n','## 最近更新\n\n- **macOS v1.0.10**\n  - PPT/PPTX 自动转 PDF：优先 LibreOffice，没有则调用 Microsoft PowerPoint（首次需允许自动化）\n  - 其余与桌面 v1.0.12 一致\n')
fs.writeFileSync('README.md',r)
console.log('mac release prep ok')
