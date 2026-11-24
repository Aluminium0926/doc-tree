const base='http://127.0.0.1:4317'
const st=await (await fetch(base+'/api/state')).json();const doc=st.docs.find(d=>d.kind==='pdf')
const r=await fetch(base+'/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docId:doc.id,anchor:{kind:'doc',page:1,quote:''},question:'请用结构式和有机反应式解释乙醇与乙酸生成乙酸乙酯的反应。必须使用 smiles 和 reaction 代码块，反应式写 reaction:，条件写 conditions:。'})})
const reader=r.body.getReader();const dec=new TextDecoder();let buf='',ans=''
while(true){const {value,done}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;while((i=buf.indexOf('\n\n'))>=0){const raw=buf.slice(0,i);buf=buf.slice(i+2);if(!raw.startsWith('data: '))continue;let j;try{j=JSON.parse(raw.slice(6))}catch{continue};if(j.type==='delta')ans+=j.text;if(j.type==='error')ans+='[ERR]'+j.message}}
console.log(ans.slice(-1200))
