import fs from 'node:fs'
let s=fs.readFileSync('mobile/src/websearch.js','utf8')
s=s.replace(
`      type: 'function',
      function: {
        name: 'web_search',`,
`      name: 'web_search',`
)
s=s.replace(
`        description: '联网搜索实时网页；可与 read_page/search_docs 在同一轮混用。返回标题、URL、摘要、日期。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索词，支持 site: after: 等操作符' },
            count: { type: 'integer', description: '1-10，默认 5' }
          },
          required: ['query']
        }
      }
    },`,
`      description: '联网搜索实时网页；可与 read_page/search_docs 在同一轮混用。返回标题、URL、摘要、日期。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索词，支持 site: after: 等操作符' },
          count: { type: 'integer', description: '1-10，默认 5' }
        },
        required: ['query']
      }
    },`
)
s=s.replace(
`      type: 'function',
      function: {
        name: 'web_fetch',
        description: '读取网页并返回 Markdown 正文。',
        parameters: {
          type: 'object',
          properties: { url: { type: 'string' } },
          required: ['url']
        }
      }
    }`,
`      name: 'web_fetch',
      description: '读取网页并返回 Markdown 正文。',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url']
      }
    }`
)
fs.writeFileSync('mobile/src/websearch.js',s)
console.log('mobile specs unwrapped', s.includes("name: 'web_search'") && !s.includes("type: 'function'"))
