// 移动端本地存储：IndexedDB
const DB_NAME = 'doctree'
const DB_VER = 1
let dbp = null

function open() {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('trees')) db.createObjectStore('trees', { keyPath: 'docId' })
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

async function tx(store, mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    let out
    try {
      out = fn(s)
    } catch (e) {
      reject(e)
      return
    }
    t.oncomplete = () => resolve(out?.result ?? out)
    t.onerror = () => reject(t.error)
  })
}

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

export async function listDocs() {
  const db = await open()
  const all = await wrap(db.transaction('docs').objectStore('docs').getAll())
  return all
    .map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      pages: d.pages?.length || 0,
      bytes: d.bytes || 0,
      createdAt: d.createdAt || 0
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function getDoc(id) {
  const db = await open()
  return wrap(db.transaction('docs').objectStore('docs').get(id))
}

export async function saveDoc(doc) {
  const db = await open()
  return wrap(db.transaction('docs', 'readwrite').objectStore('docs').put(doc))
}

export async function deleteDoc(id) {
  const db = await open()
  await wrap(db.transaction('docs', 'readwrite').objectStore('docs').delete(id))
  await wrap(db.transaction('trees', 'readwrite').objectStore('trees').delete(id))
  await wrap(db.transaction('files', 'readwrite').objectStore('files').delete(id))
}

export async function getTree(docId) {
  const db = await open()
  const t = await wrap(db.transaction('trees').objectStore('trees').get(docId))
  return t || { docId, nodes: {} }
}

export async function saveTree(docId, tree) {
  const db = await open()
  return wrap(db.transaction('trees', 'readwrite').objectStore('trees').put({ ...tree, docId }))
}

export async function saveFile(id, blob, ext) {
  const db = await open()
  return wrap(db.transaction('files', 'readwrite').objectStore('files').put({ id, blob, ext }))
}

export async function getFile(id) {
  const db = await open()
  return wrap(db.transaction('files').objectStore('files').get(id))
}
