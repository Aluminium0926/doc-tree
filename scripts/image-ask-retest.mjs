const base='http://127.0.0.1:4317'
const st=await (await fetch(base+'/api/state')).json();const doc=st.docs.find(d=>d.kind==='image')
const r=await fetch(base+'/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docId:doc.id,anchor:{kind:'doc',page:1,quote:''},question:'这张图里有什么？用一句话描述'})})
const reader=r.body.getReader();const dec=new TextDecoder();let b='',ans=''
while(true){const {value,done}=await reader.read();if(done)break;b+=dec.decode(value,{stream:true});let i;while((i=b.indexOf('\n\n'))>=0){const raw=b.slice(0,i);b=b.slice(i+2);if(!raw.startsWith('data: '))continue;let e;try{e=JSON.parse(raw.slice(6))}catch{continue};if(e.type==='delta')ans+=e.text;if(e.type==='error')ans+='[ERR]'+e.message}}
console.log(ans.slice(-400))
