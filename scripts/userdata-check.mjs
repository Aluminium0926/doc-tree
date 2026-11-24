import * as store from '../lib/store.mjs'
try {
  const docs = await store.listDocs()
  console.log('docs', docs.length)
  console.log(docs.slice(0,3).map(d=>({title:d.title,hidden:d.hidden,kind:d.kind})))
  const groups = await store.listGroups()
  console.log('groups', groups.length)
} catch (e) { console.error('ERR', e && (e.stack||e)) }

