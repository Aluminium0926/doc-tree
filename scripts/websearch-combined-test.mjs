const base='http://127.0.0.1:4317'
const st=await (await fetch(base+'/api/state')).json();const doc=st.docs.find(d=>d.kind==='pdf'&&d.pages>2)
const r=await fetch(base+'/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docId:doc.id,anchor:{kind:'doc',page:2,quote:''},question:'先用 read_page 读第 2 页讲了什么，再联网搜索 2026 年 11 月 24 日北京的天气，最后把两者一起回答并给出来源',web:true})})
const reader=r.body.getReader();const dec=new TextDecoder();let buf='',answer='',tools=[],sources=[]
while(true){const {value,done}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;while((i=buf.indexOf('\n\n'))>=0){const raw=buf.slice(0,i);buf=buf.slice(i+2);if(!raw.startsWith('data: '))continue;let j;try{j=JSON.parse(raw.slice(6))}catch{continue};if(j.type==='delta')answer+=j.text;if(j.type==='tool')tools.push(j.name);if(j.type==='web-sources')sources=j.sources;if(j.type==='error')answer+='[ERR]'+j.message;if(j.type==='web')console.log('web',j.status)}}
console.log('tools',tools,'sources',sources?.length)
console.log('answer tail',answer.slice(-500))
