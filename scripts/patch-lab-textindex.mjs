import fs from 'node:fs'
let s=fs.readFileSync('ppt-lab/lab.js','utf8')
s=s.replace("import { PptxViewer } from '/node_modules/@aiden0z/pptx-renderer/dist/aiden0z-pptx-renderer.browser.es.js'", "import { PptxViewer, buildTextIndex } from '/node_modules/@aiden0z/pptx-renderer/dist/aiden0z-pptx-renderer.browser.es.js'")
s=s.replace("    const count = viewer.slideCount", "    window.__viewer = viewer\n    window.__textIndex = buildTextIndex(viewer.presentationData)\n    const count = viewer.slideCount")
fs.writeFileSync('ppt-lab/lab.js',s)
console.log('expose text index')
