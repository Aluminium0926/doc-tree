const base='http://127.0.0.1:4317'
const st=await (await fetch(base+'/api/state')).json();const doc=st.docs.find(d=>d.kind==='pdf')
const r=await fetch(base+'/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docId:doc.id,anchor:{kind:'doc',page:1,quote:''},question:'请联网搜索今天北京的天气，并给出来源',web:true})})
const reader=r.body.getReader();const dec=new TextDecoder();let buf='',answer='',evs=[]
while(true){const {value,done}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;while((i=buf.indexOf('\n\n'))>=0){const raw=buf.slice(0,i);buf=buf.slice(i+2);if(!raw.startsWith('data: '))continue;let j;try{j=JSON.parse(raw.slice(6))}catch{continue};if(j.type==='delta')answer+=j.text;if(j.type==='web')evs.push(j);if(j.type==='web-sources')console.log('SRC',j.sources);if(j.type==='error')console.log('ERR',j.message)}}
console.log('web events',evs.length,JSON.stringify(evs.slice(0,3)))
console.log('answer tail',answer.slice(-500))
