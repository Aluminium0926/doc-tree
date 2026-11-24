import http from 'node:http'
import fs from 'node:fs'
import * as llm from '../lib/llm.mjs'
const seen=[]
const srv=http.createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{seen.push(JSON.parse(b||'{}'));res.writeHead(200,{'content-type':'text/event-stream'});res.write('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n');res.end('data: [DONE]\n\n')})})
await new Promise(r=>srv.listen(4444,'127.0.0.1',r))
const cfg=JSON.parse(fs.readFileSync(process.env.APPDATA+'/文档树/config.json','utf8'))
try{
  await llm.streamChatWithTools([{role:'system',content:'test'},{role:'user',content:'hi'}],()=>{},{model:'deepseek-flash',webSearch:true,provider:{baseUrl:'http://127.0.0.1:4444/v1',apiKey:cfg.apiKey,format:'openai'}})
  console.log('tools',JSON.stringify(seen[0].tools),'tool_choice',seen[0].tool_choice)
}finally{srv.close()}

