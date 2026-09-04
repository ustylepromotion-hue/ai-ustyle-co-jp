#!/usr/bin/env node
import fs from 'node:fs'
import crypto from 'node:crypto'

const base = process.argv[2] || 'https://www.ai-ustyle.co.jp'
const protection = JSON.parse(fs.readFileSync(new URL('./pages-main-protection.json', import.meta.url), 'utf8'))
const paths = Object.keys(protection.paths)
const checks = []

for (const relativePath of paths) {
  const url = `${base.replace(/\/$/, '')}/${relativePath}?verify=main-protection-v1`
  const response = await fetch(url, { redirect: 'follow', headers: { 'cache-control': 'no-cache' } })
  const body = Buffer.from(await response.arrayBuffer())
  const sha256 = crypto.createHash('sha256').update(body).digest('hex')
  const expected = protection.paths[relativePath]
  checks.push({ path: `/${relativePath}`, status: response.status, sha256, expected, ok: response.status === 200 && sha256 === expected })
}

const missing = checks.filter((check) => !check.ok)
console.log(JSON.stringify({ base, protected_path_count: checks.length, pass: missing.length === 0, checks }, null, 2))
if (missing.length) process.exit(1)
