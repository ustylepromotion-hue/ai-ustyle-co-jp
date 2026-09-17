#!/usr/bin/env node
// セキュリティヘッダー / API防壁の実測チェック（デプロイ後・プレビュー時に叩く）。
// 使い方:
//   node scripts/security-headers-check.mjs https://www.ai-ustyle.co.jp
//   node scripts/security-headers-check.mjs https://<hash>.ai-ustyle-co-jp-web.pages.dev
//   node scripts/security-headers-check.mjs https://ai-ustyle-co-jp-worker.ustyle-promotion.workers.dev
// 注意: ここで投げるPOSTは「弾かれる」ことが期待値のものだけ（LLM課金は発生しない）。

const base = (process.argv[2] || 'https://www.ai-ustyle.co.jp').replace(/\/$/, '');

const REQUIRED_STATIC_HEADERS = {
  'strict-transport-security': /max-age=\d+/,
  'x-content-type-options': /^nosniff$/,
  'x-frame-options': /^DENY$/,
  'referrer-policy': /^strict-origin-when-cross-origin$/,
  'permissions-policy': /camera=\(\)/,
  'cross-origin-opener-policy': /^same-origin$/,
  'cross-origin-resource-policy': /^same-site$/,
  'x-permitted-cross-domain-policies': /^none$/,
  'x-dns-prefetch-control': /^off$/,
  'content-security-policy': /default-src 'self'/,
};

const PAGES = ['/', '/index.html', '/pricing.html', '/company.html', '/usecase-ebay.html', '/test/ai/', '/transportation/', '/style.css'];
const results = [];
let failures = 0;

function record(name, pass, detail) {
  results.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `\n      ${JSON.stringify(detail)}`}`);
}

async function fetchWithHeaders(path, init = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'follow', ...init });
  return response;
}

// 1) 静的ページのヘッダー
for (const path of PAGES) {
  const response = await fetchWithHeaders(path, { headers: { 'cache-control': 'no-cache' } });
  const missing = [];
  for (const [name, pattern] of Object.entries(REQUIRED_STATIC_HEADERS)) {
    const value = response.headers.get(name);
    if (!value || !pattern.test(value)) missing.push(`${name}=${value}`);
  }
  const csp = response.headers.get('content-security-policy') || '';
  const cspRules = (csp.match(/default-src/g) || []).length;
  const expectLoose = path.startsWith('/test/ai');
  const cspKindOk = expectLoose ? csp.includes("'unsafe-eval'") : !csp.includes("'unsafe-eval'");
  record(
    `GET ${path} ヘッダー`,
    response.status === 200 && missing.length === 0 && cspRules === 1 && cspKindOk && !csp.includes(','),
    { status: response.status, missing, csp_default_src_count: cspRules, csp_kind_ok: cspKindOk, joined_with_comma: csp.includes(',') },
  );
}

// 2) チャットAPIの防壁（すべてLLM到達前・課金ゼロで弾かれるものだけを投げる）
// 伝播待ちは「JSON以外は415」という無課金シグナルで判定する
// （Pages/Functionsはデプロイ直後に旧版が数十秒〜数分残ることがある。実測で約90秒の遅延を確認）。
const isWorkerHost = base.includes('.workers.dev');
const waitApiPropagation = async (timeoutMs = 240000) => {
  const started = Date.now();
  for (;;) {
    const response = await fetchWithHeaders('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'message=probe',
    });
    if (response.status === 415) return { status: response.status, waited_ms: Date.now() - started };
    if (Date.now() - started > timeoutMs) return { status: response.status, waited_ms: Date.now() - started, timed_out: true };
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
};

if (isWorkerHost) {
  const response = await fetchWithHeaders('/api/chat/stream');
  record('GET /api/chat/stream は405（生成しない）', response.status === 405 && response.headers.get('x-content-type-options') === 'nosniff', {
    status: response.status,
    allow: response.headers.get('allow'),
    nosniff: response.headers.get('x-content-type-options'),
  });
} else {
  console.log('SKIP  GET /api/chat/stream の405確認（Pages配信面ではFunctionsが該当メソッド未exportのため静的アセットへフォールバックする既存挙動。Worker面で確認する）');
}

{
  const propagation = await waitApiPropagation();
  record('チャットAPIの新実装が反映されている（無課金シグナル: JSON以外は415）', propagation.status === 415, propagation);
}

{
  // ゲートが無い版に当たっても空メッセージなので生成には到達しない（400で分かる）。
  const response = await fetchWithHeaders('/api/chat/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: JSON.stringify({ message: '' }),
  });
  record('許可外OriginのPOSTは403（クロスサイト遮断）', response.status === 403, {
    status: response.status,
    cacao: response.headers.get('access-control-allow-origin'),
    note: response.status === 400 ? 'origin_gate_missing_or_origin_not_sent' : undefined,
  });
}

{
  const response = await fetchWithHeaders('/api/chat/stream', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'message=probe',
  });
  record('Content-TypeがJSON以外は415', response.status === 415, { status: response.status });
}

{
  const response = await fetchWithHeaders('/api/chat/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'あ'.repeat(40000) }),
  });
  record('巨大ボディは413', response.status === 413, { status: response.status });
}

{
  const response = await fetchWithHeaders('/api/chat/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: '   ' }),
  });
  record('空メッセージは400（既存の入力検査が生きている）', response.status === 400, { status: response.status });
}

if (isWorkerHost) {
  const response = await fetchWithHeaders('/api/whatever');
  record('未定義の /api/* は404 JSON', response.status === 404, { status: response.status });
} else {
  console.log('SKIP  未定義 /api/* の404確認（Pages配信面は本体Workerのルーティングを通らないため）');
}

console.log(`\n${results.length - failures}/${results.length} PASS  base=${base}`);
console.log(JSON.stringify({ base, pass: failures === 0, results }, null, 2));
process.exit(failures === 0 ? 0 : 1);
