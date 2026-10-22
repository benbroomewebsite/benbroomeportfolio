#!/usr/bin/env node

import { readdir } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'

const root = resolve(process.cwd())
const staging = join(root, 'r2-staging')
const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const bucket = process.env.R2_BUCKET || 'benbroome-portfolio-media'
const concurrency = 8

const contentTypes = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  }))
  return nested.flat()
}

function upload(path) {
  const key = relative(staging, path).split(sep).join('/')
  const args = [
    'r2', 'object', 'put', `${bucket}/${key}`, '--remote', '--file', path,
    '--content-type', contentTypes[extname(path).toLowerCase()] || 'application/octet-stream', '--force',
  ]
  return new Promise((resolveUpload) => {
    const child = spawn(process.execPath, [wrangler, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let error = ''
    child.stderr.on('data', (chunk) => { error += chunk })
    child.on('close', (code) => resolveUpload({ key, ok: code === 0, error }))
  })
}

const retrySpecialNames = process.env.R2_RETRY_SPECIAL_NAMES === '1'
const files = (await walk(staging)).filter((path) =>
  !['.json', '.csv'].includes(extname(path).toLowerCase()) && (!retrySpecialNames || /[()&]/.test(path)),
)
let cursor = 0
let completed = 0
const failures = []

async function worker() {
  while (cursor < files.length) {
    const path = files[cursor++]
    const result = await upload(path)
    completed += 1
    if (!result.ok) failures.push(result)
    if (completed % 50 === 0 || completed === files.length) {
      process.stdout.write(`Uploaded ${completed}/${files.length}\n`)
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))
if (failures.length) {
  console.error(`${failures.length} uploads failed`)
  failures.slice(0, 10).forEach((failure) => console.error(failure.key, failure.error))
  process.exit(1)
}
console.log(`Uploaded ${files.length} objects to ${bucket}`)
