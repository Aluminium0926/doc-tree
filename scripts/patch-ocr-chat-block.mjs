import fs from 'node:fs'
let t=fs.readFileSync('lib/llm.mjs','utf8')
const start=t.indexOf('export async function chat')
const end=t.indexOf('// ----------',start)
if(start<0||end<0) throw new Error('markers')
const block=fs.readFileSync('scripts/chat-ocr-block.txt','utf8').trimEnd()+'\n\n'
t=t.slice(0,start)+block+t.slice(end)
fs.writeFileSync('lib/llm.mjs',t)
console.log('chat+ocr replaced', t.includes('export async function ocrImage'))
