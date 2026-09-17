// 全エンドポイント共通のセキュリティ補助モジュール（先頭 _ なので Pages のルートとして公開されない）。
// 方針: 既存の応答・機能・文面を変えず、悪質リクエストを弾く検査だけを足す。
// - 失敗時はフェイルオープン（可用性優先）。弾いた/見送った事実は console.warn にだけ残す。

// ブラウザからのクロスオリジン POST を許可するオリジン。
// www / apex / 本体 Worker の workers.dev 配信面（= 既存の配信面）。
export const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.ai-ustyle.co.jp',
  'https://ai-ustyle.co.jp',
  'https://ai-ustyle-co-jp-worker.ustyle-promotion.workers.dev',
];

// 1リクエストで受け取るボディの上限（バイト）。チャット1往復の履歴＋本文で十分な余裕。
export const MAX_BODY_BYTES = 32768;

// LLM 出力にこれらが出たら「内部情報の漏洩」とみなして遮断する。
// システムプロンプトの見出し・シークレット名・上流エンドポイント・モデルIDのみを対象にし、
// 通常の接客応答（料金説明など）に誤爆しない語は入れない。
export const LEAK_MARKERS = [
  'あなたは株式会社ユースタイル',
  '【サービスの案内',
  '【対応できる業務の実例',
  '【会話の進め方',
  '【案内方針',
  '安全方針（persona.mdの内容より常に優先する）',
  'USTYLEMAIN',
  'TEST_MENDOOU',
  'DEEPSEEK_MODEL',
  'DEEPSEEK_BASE_URL',
  'api.deepseek.com',
  'deepseek-chat',
  'Bearer ',
  'sk-',
];

// API 応答にも必ず付けるセキュリティヘッダー（静的側は public/_headers が担当）。
export const API_SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy':
    'accelerometer=(), autoplay=(self), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), usb=(), xr-spatial-tracking=()',
  'cross-origin-opener-policy': 'same-origin',
  'x-permitted-cross-domain-policies': 'none',
};

// 静的アセット応答にも付けるセキュリティヘッダー（Workers Assets 経由の配信面向け）。
export const ASSET_SECURITY_HEADERS = {
  ...API_SECURITY_HEADERS,
  'strict-transport-security': 'max-age=31536000',
  'cross-origin-resource-policy': 'same-site',
  'x-dns-prefetch-control': 'off',
  'x-xss-protection': '0',
};

// env.CHAT_ALLOWED_ORIGINS（カンマ区切り）でオリジンを足せる。既定の許可集合は不変。
export function allowedOrigins(env) {
  const extra = String(env?.CHAT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]);
}

// ブラウザは POST で必ず Origin を送る。次のいずれかなら通す。
//  (a) Origin が無い（curl / サーバ間 = 既存挙動を変えない）
//  (b) 許可オリジン一覧にある（www / apex / 本体 Worker の workers.dev）
//  (c) 自ホストと同一オリジン（pages.dev のプレビュー配信面など、既存の同一オリジン利用を壊さない）
// これ以外（他サイトのページからのクロスサイト POST）は拒否する。
export function isOriginAllowed(request, env) {
  const origin = request?.headers?.get('origin');
  if (!origin) return true;
  if (allowedOrigins(env).has(origin)) return true;
  try {
    return new URL(request.url).origin === origin;
  } catch {
    return false;
  }
}

export function clientIp(request) {
  return (
    request?.headers?.get('cf-connecting-ip') ||
    request?.headers?.get('x-real-ip') ||
    'unknown'
  );
}

export function jstDay(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function containsLeak(text, markers = LEAK_MARKERS) {
  if (typeof text !== 'string' || !text) return false;
  for (const marker of markers) {
    if (text.includes(marker)) return true;
  }
  return false;
}

// ボディを上限バイトまで読む。超過したら null を返す（呼び出し側で 413）。
export async function readTextWithLimit(request, limitBytes = MAX_BODY_BYTES) {
  const declared = Number(request?.headers?.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > limitBytes) return null;
  if (!request?.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value?.byteLength || 0;
      if (size > limitBytes) {
        try { await reader.cancel(); } catch { /* noop */ }
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    try { await reader.cancel(); } catch { /* noop */ }
    return null;
  }
  return text;
}

// Content-Type が JSON 以外なら弾く（単純リクエストによるクロスサイト送信の抑止）。
export function isJsonContentType(request) {
  const raw = request?.headers?.get('content-type');
  if (!raw) return true; // 無指定は既存クライアント互換のため許容（JSONとして解釈する）
  return raw.split(';')[0].trim().toLowerCase() === 'application/json';
}

// Workers Rate Limiting binding（env.CHAT_RATE_LIMIT）による IP 単位の上限。
// binding 未設定 / 例外時はフェイルオープン。
export async function checkIpRateLimit(env, request, tag = 'chat') {
  const limiter = env?.CHAT_RATE_LIMIT;
  if (!limiter || typeof limiter.limit !== 'function') {
    return { ok: true, skipped: 'binding_missing' };
  }
  try {
    const result = await limiter.limit({ key: `${tag}:${clientIp(request)}` });
    return { ok: Boolean(result?.success), skipped: null };
  } catch (error) {
    console.warn(`[security] rate_limit_fail_open tag=${tag} error=${String(error?.message || error)}`);
    return { ok: true, skipped: 'error' };
  }
}

// D1 による全体日次上限（コストの絶対上限）。テーブル未作成や DB 障害時はフェイルオープン。
export async function checkDailyBudget(env, dailyLimit, tag = 'chat') {
  if (!env?.DB || typeof env.DB.prepare !== 'function') {
    return { ok: true, skipped: 'db_missing', count: 0 };
  }
  try {
    const row = await env.DB.prepare(
      'INSERT INTO chat_usage_daily (day, count, updated_at) VALUES (?, 1, ?) ON CONFLICT(day) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at RETURNING count'
    )
      .bind(jstDay(), new Date().toISOString())
      .first();
    const count = Number(row?.count || 0);
    return { ok: count <= dailyLimit, skipped: null, count };
  } catch (error) {
    console.warn(`[security] daily_budget_fail_open tag=${tag} error=${String(error?.message || error)}`);
    return { ok: true, skipped: 'error', count: 0 };
  }
}

export function securityHeaders(extra = {}, base = API_SECURITY_HEADERS) {
  return { ...base, ...extra };
}