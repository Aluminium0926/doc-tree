import JSZip from 'jszip'
import fs from 'node:fs'
const zip=new JSZip()
zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
zip.file('ppt/slides/slide1.xml','<?xml version="1.0"?><p:sld xmlns:p="x" xmlns:a="y"><a:t>Hello Neuron</a:t><a:t>Second line</a:t></p:sld>')
zip.file('ppt/slides/slide2.xml','<?xml version="1.0"?><p:sld xmlns:p="x" xmlns:a="y"><a:t>Action potential &amp; channels</a:t></p:sld>')
const buf=await zip.generateAsync({type:'nodebuffer'})
fs.writeFileSync('scripts/fixture-test.pptx',buf)
const base='http://127.0.0.1:4317'
const r=await fetch(base+'/api/import',{method:'POST',headers:{'x-filename':encodeURIComponent('神经测试.pptx')},body:buf})
const j=await r.json()
console.log('import',r.status,j.doc?.kind,j.doc?.pages)
if(j.doc){const d=await (await fetch(base+'/api/doc/'+j.doc.id)).json();console.log(JSON.stringify(d.doc.pages[0].text))}
const bad=await fetch(base+'/api/import',{method:'POST',headers:{'x-filename':encodeURIComponent('旧格式.ppt')},body:Buffer.from('xx')})
console.log('ppt reject',bad.status,await bad.text())
