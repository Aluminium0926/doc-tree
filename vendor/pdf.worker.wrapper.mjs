// pdf.js worker 入口：先补齐旧环境 API，再加载真正的 worker
import './pdf-worker-polyfill.mjs'
import './pdf.worker.min.mjs'
