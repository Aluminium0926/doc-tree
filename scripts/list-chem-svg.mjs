import fs from 'node:fs'
import { createCanvas, loadImage } from '@napi-rs/canvas'
const files=fs.readdirSync('scripts').filter(f=>f.startsWith('chem-')&&f.endsWith('.svg'))
console.log(files)
