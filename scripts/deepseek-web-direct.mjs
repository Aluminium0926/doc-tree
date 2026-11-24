import fs from 'node:fs'
const cfg=JSON.parse(fs.readFileSync(process.env.APPDATA+'/文档树/config.json','utf8'))
const r=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+cfg.apiKey},body:JSON.stringify({model:'deepseek-flash',messages:[{role:'user',content:'请联网搜索：2026年11月22日前后有什么科技新闻？给出来源。'}],stream:true,tools:[{type:'deepseek_web_search'},{type:'deepseek_read_url'}]})})
console.log('status',r.status, r.headers.get('content-type'))
const reader=r.body.getReader();const dec=new TextDecoder();let buf='';let text='';let evs=0
while(true){const {value,done}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).trim();buf=buf.slice(i+1);if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(data==='[DONE]')continue;let j;try{j=JSON.parse(data)}catch{continue};const e=j.choices?.[0]?.server_tool_event;if(e){evs++;console.log('EVT',JSON.stringify(e).slice(0,300))}const d=j.choices?.[0]?.delta;if(d?.content)text+=d.content;if(d?.annotations)console.log('ANN',JSON.stringify(d.annotations).slice(0,400))}}
console.log('events',evs,'text',text.slice(-400))
