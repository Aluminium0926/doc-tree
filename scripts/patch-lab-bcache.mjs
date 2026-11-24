import fs from 'node:fs'
let s=fs.readFileSync('ppt-lab/lab.js','utf8')
s=s.replace(
  "$('#btnB').addEventListener('click', async () => {",
  `let bConverter = null
async function getBConverter() {
  if (bConverter) return bConverter
  const converter = new WorkerBrowserConverter({
    ...createWasmPaths('/wasm/'),
    browserWorkerJs: '/node_modules/@matbee/libreoffice-converter/dist/browser.worker.global.js',
    onProgress: (p) => {
      if (p.percent % 20 === 0) log('B:', p.percent + '%', p.message || '')
    }
  })
  await converter.initialize()
  bConverter = converter
  return converter
}

$('#btnB').addEventListener('click', async () => {`
)
s=s.replace(
`    log('B: 初始化 WASM（首次约 236 MB）…')
    const converter = new WorkerBrowserConverter({
      ...createWasmPaths('/wasm/'),
      browserWorkerJs: '/node_modules/@matbee/libreoffice-converter/dist/browser.worker.global.js',
      onProgress: (p) => {
        if (p.percent % 10 === 0) log('B:', p.percent + '%', p.message || '')
      }
    })
    await converter.initialize()
    log('B: WASM 就绪，转换中…')`,
`    log('B: 初始化 WASM（首次约 236 MB）…')
    const converter = await getBConverter()
    log('B: WASM 就绪，转换中…')`
)
s=s.replace("    await converter.destroy()\n", "")
fs.writeFileSync('ppt-lab/lab.js',s)
console.log('B cache ok')
