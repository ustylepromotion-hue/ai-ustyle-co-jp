#!/usr/bin/env node
const base = process.argv[2] || 'https://www.ai-ustyle.co.jp'
const paths = ['/','/pricing.html','/company.html','/usecase-ebay.html','/test/ai/','/transportation/','/lifecreate/','/care/']
const expected = {
  '/': 200,
  '/pricing.html': 200,
  '/company.html': 200,
  '/usecase-ebay.html': 200,
  '/test/ai/': 200,
  '/transportation/': 200,
  '/lifecreate/': 200,
  '/care/': 200,
}
const results = []
for (const path of paths) {
  const response = await fetch(`${base.replace(/\/$/, '')}${path}?verify=existing-paths-v1`, { redirect: 'follow', headers: { 'cache-control': 'no-cache' } })
  const text = await response.text()
  results.push({ path, status: response.status, final_url: response.url, bytes: Buffer.byteLength(text), ok: response.status === expected[path] })
}
console.log(JSON.stringify({ base, path_count: results.length, pass: results.every((x) => x.ok), results }, null, 2))
if (!results.every((x) => x.ok)) process.exit(1)
