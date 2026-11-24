import fs from 'node:fs'
const F='scripts/mhchem-test.mjs'
let t=fs.readFileSync(F,'utf8')
t=t.replace("  const katex=await p.evaluate(()=>{try{return {ok:true,html:window.katex.renderToString('\\\\ce{NH3(aq) + H2O(l) <=> NH4+(aq) + OH-(aq)}',{throwOnError:true}).slice(0,80)}}catch(e){return {ok:false,err:String(e)}}})\n", "")
t=t.replace("  await new Promise(r=>setTimeout(r,800))\n  await p.click('#q')", "  await new Promise(r=>setTimeout(r,800))\n  const katex=await p.evaluate(()=>{try{return {ok:true,html:window.katex.renderToString('\\\\ce{NH3(aq) + H2O(l) <=> NH4+(aq) + OH-(aq)}',{throwOnError:true}).slice(0,80)}}catch(e){return {ok:false,err:String(e)}}})\n  await p.click('#q')")
t=t.replace("  const ans=await p.evaluate(", "  await p.evaluate(()=>{const a=[...document.querySelectorAll('.answer')].pop(); if(a) a.scrollIntoView({block:'center'})})\n  await p.screenshot({path:'mhchem.png'})\n  const ans=await p.evaluate(")
fs.writeFileSync(F,t)
console.log('test updated')
