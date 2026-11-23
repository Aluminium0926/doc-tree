import fs from 'node:fs'
function sub(f,pairs){let t=fs.readFileSync(f,'utf8');for(const[a,b]of pairs)t=t.split(a).join(b);fs.writeFileSync(f,t)}
const ver=[
 ['DocTree-1.0.11-win32-x64.zip','DocTree-1.0.12-win32-x64.zip'],
 ['releases/tag/v1.0.11','releases/tag/v1.0.12'],
 ['[v1.0.11](','[v1.0.12]('],
 ['android-v1.0.10','android-v1.0.11'],
 ['mac-arm64-v1.0.8','mac-arm64-v1.0.9'],
 ['mac-x64-v1.0.8','mac-x64-v1.0.9'],
 ['web-v1.0.8','web-v1.0.9'],
 ['DocTree-web-v1.0.8.zip','DocTree-web-v1.0.9.zip']
]
for(const f of ['README.md','docs/使用手册.md','docs/安卓与鸿蒙.md']) sub(f,ver)
let w=fs.readFileSync('.github/workflows/build-mac-cross.yml','utf8')
w=w.replace('TAG="mac-$ARCH-v1.0.8"','TAG="mac-$ARCH-v1.0.9"')
w=w.replace('--title "DocTree macOS $ARCH v1.0.8"','--title "DocTree macOS $ARCH v1.0.9"')
fs.writeFileSync('.github/workflows/build-mac-cross.yml',w)
console.log('repo versions ok')
