#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const mode = process.argv[2]
const allowedModes = new Set(['plan', 'preview', 'production'])
if (!allowedModes.has(mode)) {
  throw new Error('Usage: node scripts/pages_safe_deploy.mjs plan|preview|production')
}

const require = createRequire(import.meta.url)
const { hash } = require('/Users/ust/.npm/_npx/2230cd9b5abd26ce/node_modules/blake3-wasm')

const ACCOUNT_ID = 'd1b74546929d99a7d941d4b503a5e1b3'
const PROJECT_NAME = 'ai-ustyle-co-jp-web'
const API_BASE = 'https://api.cloudflare.com/client/v4'
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const PROTECTION_PATH = path.join(ROOT, 'scripts/pages-main-protection.json')
const REDIRECTS_PATH = path.join(ROOT, 'public/_redirects')
const SOURCE_DIR = path.join(ROOT, 'public')
const PREVIEW_BRANCH = 'main-page-restore-preview'

function getApiToken() {
  const config = fs.readFileSync(path.join(process.env.HOME, '.wrangler/config/default.toml'), 'utf8')
  const token = config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1]
  if (!token) throw new Error('Wrangler OAuth token is unavailable')
  return token
}

function apiError(label, response, payload) {
  const messages = Array.isArray(payload?.errors)
    ? payload.errors.map((error) => `${error.code ?? 'unknown'}:${error.message ?? 'unknown'}`).join(', ')
    : 'unknown API error'
  return new Error(`${label} failed (HTTP ${response.status}): ${messages}`)
}

async function requestJson(urlPath, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${API_BASE}${urlPath}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body,
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) throw apiError(urlPath, response, payload)
  return payload.result
}

function hashFile(filePath) {
  const bytes = fs.readFileSync(filePath)
  const extension = path.extname(filePath).slice(1)
  return hash(bytes.toString('base64') + extension).toString('hex').slice(0, 32)
}

function sha256File(filePath) {
  const crypto = require('node:crypto')
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function loadProtection() {
  const protection = JSON.parse(fs.readFileSync(PROTECTION_PATH, 'utf8'))
  if (protection.project !== PROJECT_NAME) throw new Error('Protection project mismatch')
  for (const [relativePath, expectedSha] of Object.entries(protection.paths)) {
    const sourcePath = path.join(SOURCE_DIR, relativePath)
    if (!fs.existsSync(sourcePath)) throw new Error(`Protected source is missing: ${sourcePath}`)
    const actualSha = sha256File(sourcePath)
    if (actualSha !== expectedSha) {
      throw new Error(`Protected source changed: ${relativePath} expected=${expectedSha} actual=${actualSha}`)
    }
  }
  return protection
}

function loadRedirects() {
  const redirects = fs.readFileSync(REDIRECTS_PATH, 'utf8')
  for (const requiredRule of [
    '/lifecreate /lifecreate/ 301',
    '/lifecreate/* https://ai-ustyle.co.jp/lifecreate/:splat 301',
    '/transportation /transportation/ 200',
    '/care https://ai-ustyle.co.jp/care/ 301',
    '/care/* https://ai-ustyle.co.jp/care/:splat 301',
  ]) {
    if (!redirects.includes(requiredRule)) throw new Error(`Required redirect rule is missing: ${requiredRule}`)
  }
  return redirects
}

async function getLatestProduction(apiToken) {
  const deployments = await requestJson(
    `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments?env=production`,
    { token: apiToken },
  )
  const latest = deployments[0]
  if (!latest?.id) throw new Error('No production Pages deployment was found')
  const detail = await requestJson(
    `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments/${latest.id}`,
    { token: apiToken },
  )
  if (!detail.files || typeof detail.files !== 'object') throw new Error('Production manifest unavailable')
  return detail
}

function loadTargetFiles() {
  const files = [
    ['index.html', 'text/html; charset=utf-8'],
    ['main.js', 'text/javascript; charset=utf-8'],
    ['style.css', 'text/css; charset=utf-8'],
    ['assets/business_tech.jpg', 'image/jpeg'],
    ['assets/contact_image.png', 'image/png'],
    ['assets/hero_bg.jpg', 'image/jpeg'],
    ['assets/performance_tech.jpg', 'image/jpeg'],
    ['assets/security_tech.jpg', 'image/jpeg'],
    ['assets/solution_auto.jpg', 'image/jpeg'],
    ['assets/solution_llm.jpg', 'image/jpeg'],
    ['assets/tech_growth.jpg', 'image/jpeg'],
    ['screenshots/usecase/01-bulk-upload.png', 'image/png'],
  ]
  return files.map(([relativePath, contentType]) => {
    const sourcePath = path.join(SOURCE_DIR, relativePath)
    return {
      relativePath,
      manifestPath: `/${relativePath}`,
      sourcePath,
      contentType,
      hash: hashFile(sourcePath),
    }
  })
}

async function uploadMissingFiles(uploadToken, files) {
  const hashes = files.map((file) => file.hash)
  const missing = await requestJson('/pages/assets/check-missing', {
    token: uploadToken,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes }),
  })
  const missingSet = new Set(missing)
  const uploads = files.filter((file) => missingSet.has(file.hash)).map((file) => ({
    key: file.hash,
    value: fs.readFileSync(file.sourcePath).toString('base64'),
    metadata: { contentType: file.contentType },
    base64: true,
  }))
  if (uploads.length) {
    await requestJson('/pages/assets/upload', {
      token: uploadToken,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uploads),
    })
  }
  await requestJson('/pages/assets/upsert-hashes', {
    token: uploadToken,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes }),
  })
  return uploads.length
}

async function createDeployment(apiToken, manifest, redirects, branch, message) {
  const form = new FormData()
  form.set('manifest', JSON.stringify(manifest))
  form.set('branch', branch)
  form.set('commit_dirty', 'false')
  form.set('commit_message', message)
  form.set('_redirects', new Blob([redirects], { type: 'text/plain; charset=utf-8' }), '_redirects')
  return requestJson(`/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`, {
    token: apiToken,
    method: 'POST',
    body: form,
  })
}

const apiToken = getApiToken()
const protection = loadProtection()
const redirects = loadRedirects()
const latest = await getLatestProduction(apiToken)
const targetFiles = loadTargetFiles()
const manifest = { ...latest.files }
const existingProtected = {}
for (const file of targetFiles) {
  if (file.relativePath !== 'index.html' && latest.files[file.manifestPath]) {
    existingProtected[file.manifestPath] = latest.files[file.manifestPath]
  }
  manifest[file.manifestPath] = file.hash
}

const plan = {
  mode,
  source_protection_version: protection.version,
  previous_production_deployment_id: latest.id,
  previous_production_url: latest.url,
  previous_manifest_file_count: Object.keys(latest.files).length,
  output_manifest_file_count: Object.keys(manifest).length,
  protected_paths: targetFiles.map((file) => file.manifestPath),
  preserved_redirect_rules: 5,
  guard: {
    no_file_deletion: true,
    only_protected_paths_replaced: true,
    source_sha256_verified: true,
  },
}

if (mode === 'plan') {
  console.log(JSON.stringify(plan, null, 2))
  process.exit(0)
}

if (Object.keys(existingProtected).length && latest.files['/index.html'] === targetFiles[0].hash) {
  throw new Error('Production already has the protected main index; refusing redundant deployment')
}
const uploadToken = await requestJson(
  `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/upload-token`,
  { token: apiToken },
)
const uploadedFileCount = await uploadMissingFiles(uploadToken.jwt, targetFiles)
const branch = mode === 'preview' ? PREVIEW_BRANCH : 'main'
const message = mode === 'preview' ? 'restore-main-page-preview' : 'restore-main-page-production'
const deployment = await createDeployment(apiToken, manifest, redirects, branch, message)
console.log(JSON.stringify({ ...plan, uploaded_file_count: uploadedFileCount, deployment_id: deployment.id, url: deployment.url, branch }, null, 2))
