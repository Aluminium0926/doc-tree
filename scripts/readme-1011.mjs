import fs from 'node:fs'
function sub(f,pairs){let t=fs.readFileSync(f,'utf8');for(const[a,b]of pairs)t=t.split(a).join(b);fs.writeFileSync(f,t)}
const ver=[
 ['DocTree-1.0.10-win32-x64.zip','DocTree-1.0.11-win32-x64.zip'],
 ['releases/tag/v1.0.10','releases/tag/v1.0.11'],
 ['[v1.0.10](','[v1.0.11]('],
 ['android-v1.0.9','android-v1.0.10'],
 ['mac-arm64-v1.0.7','mac-arm64-v1.0.8'],
 ['mac-x64-v1.0.7','mac-x64-v1.0.8'],
 ['web-v1.0.7','web-v1.0.8'],
 ['DocTree-web-v1.0.7.zip','DocTree-web-v1.0.8.zip']
]
for(const f of ['README.md','docs/使用手册.md','docs/安卓与鸿蒙.md']) sub(f,ver)
let w=fs.readFileSync('.github/workflows/build-mac-cross.yml','utf8')
w=w.replace("TAG=\"mac-$ARCH-v1.0.7\"","TAG=\"mac-$ARCH-v1.0.8\"")
w=w.replace('--title "DocTree macOS $ARCH v1.0.7"','--title "DocTree macOS $ARCH v1.0.8"')
if(!w.includes('darwin canvas binary')){
  w=w.replace(
    "      - name: cross-build .app",
    `      - name: add darwin canvas binary
        run: |
          V=$(node -p "require('./node_modules/@napi-rs/canvas/package.json').version")
          mkdir -p node_modules/@napi-rs
          npm pack "@napi-rs/canvas-darwin-$ARCH@$V" --pack-destination /tmp
          mkdir -p "/tmp/canvas-$ARCH"
          tar -xzf /tmp/napi-rs-canvas-darwin-$ARCH-*.tgz -C "/tmp/canvas-$ARCH"
          rm -rf "node_modules/@napi-rs/canvas-darwin-$ARCH"
          mv "/tmp/canvas-$ARCH/package" "node_modules/@napi-rs/canvas-darwin-$ARCH"
          ls "node_modules/@napi-rs/canvas-darwin-$ARCH"

      - name: cross-build .app`
  )
}
fs.writeFileSync('.github/workflows/build-mac-cross.yml',w)
console.log('release prep ok')
