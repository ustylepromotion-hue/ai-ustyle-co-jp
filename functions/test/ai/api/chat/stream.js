// Cloudflare Pages Function。ルート: POST /test/ai/api/chat/stream （OPTIONSも同ルート）
// 抽出元: チャットエクスポート用/template/functions/api/chat/stream.js（＝APIまとめうり案件の同名関数）。
// callDeepSeekStream() がこのテンプレの心臓部。DeepSeekのSSEを中継してブラウザにそのまま流す。
//
// テンプレとの差分:
//   1. persona は .md の text-import ではなく _persona.js から文字列importに変更（Pages安定化のため）
//   2. Cookie名を mn_vid に変更（他LPと衝突しない名前空間）
//   3. それ以外のロジック（無料枠・記憶・SSE中継）はテンプレ無改変

import { ensureVisitor, consumeQuota, loadRecentMessages, saveTurn, buildResumeLine, buildSystemPrompt, now } from './_shared.js';
import { PERSONA_MD } from './_persona.js';
import {
  API_SECURITY_HEADERS,
  DEFAULT_DAILY_TOTAL,
  DEFAULT_IP_DAILY_TOTAL,
  MAX_BODY_BYTES,
  browserSignals,
  bumpDailyCounter,
  bumpObservationCounter,
  checkIpRateLimit,
  clientIp,
  containsLeak,
  isJsonContentType,
  isOriginAllowed,
  limitFromEnv,
  readTextWithLimit,
  requireBrowserSignals,
} from '../../../../_security.js';

const encoder = new TextEncoder();
const sse = (event, data) => encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

// JSON エラー応答にもセキュリティヘッダーを付ける（テキスト/HTMLとして解釈されないようにする）。
function jsonError(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...API_SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders },
  });
}

async function callDeepSeekStream(env, messages, onDelta, { maxTokens = 1200, temperature = 0.6 } = {}) {
  const key = env.TEST_MENDOOU;
  if (!key) throw new Error('missing_config');
  const base = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = env.DEEPSEEK_MODEL || 'deepseek-chat';
  const upstream = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
    signal: AbortSignal.timeout(45000),
  });
  if (!upstream.ok) throw new Error(`upstream_http_${upstream.status}`);

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() || '';
      for (const part of parts) {
        for (const line of part.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const raw = trimmed.slice(5).trim();
          if (raw === '[DONE]') continue;
          let chunk;
          try { chunk = JSON.parse(raw); } catch { continue; }
          const delta = chunk?.choices?.[0]?.delta?.content || '';
          if (delta) {
            full += delta;
            // 内部プロンプト・シークレット・上流エンドポイントの漏洩はここで遮断する。
            if (containsLeak(full)) throw new Error('leak_blocked');
            await onDelta(delta);
          }
        }
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* noop */ }
  }
  if (containsLeak(full)) throw new Error('leak_blocked');
  return { full };
}

function corsHeaders(env, request) {
  const allowed = String(env.ALLOWED_ORIGIN || '').trim();
  if (!allowed) return {};
  const origin = request.headers.get('origin') || '';
  if (origin !== allowed) return {};
  return { 'access-control-allow-origin': allowed, 'access-control-allow-credentials': 'true' };
}

export async function onRequestPost({ request, env }) {
  // 1) クロスサイト POST を弾く（同一オリジン / 許可オリジン / Origin 無しは既存どおり通す）。
  if (!isOriginAllowed(request, env)) {
    console.warn('[security] origin_rejected endpoint=/test/ai/api/chat/stream');
    return jsonError(403, { error: 'forbidden_origin', message: 'このページからは送信できません。' });
  }
  // 2) JSON 以外の単純リクエストを弾く。
  if (!isJsonContentType(request)) {
    return jsonError(415, { error: 'unsupported_media_type', message: '入力形式を確認してください。' });
  }
  // 2.5) 非ブラウザらしさの観測（既定は観測のみ。CHAT_REQUIRE_BROWSER_SIGNALS=1 で遮断）。
  const signals = browserSignals(request);
  if (!signals.browserish) {
    if (requireBrowserSignals(env)) {
      console.warn('[security] non_browser_blocked endpoint=/test/ai/api/chat/stream');
      return jsonError(403, { error: 'forbidden_client', message: 'このページからは送信できません。' });
    }
    console.warn(`[security] non_browser_observed endpoint=/test/ai/api/chat/stream sec_fetch_mode=${signals.mode || '-'} origin=${signals.origin ? 'yes' : 'no'} ua=${signals.user_agent_present ? 'yes' : 'no'}`);
    await bumpObservationCounter(env, 'obs:nonbrowser', 'testai');
  }
  // 3) IP 単位のレート制限（binding 未設定・障害時はフェイルオープン）。
  const rate = await checkIpRateLimit(env, request, 'testai');
  if (!rate.ok) {
    console.warn('[security] ip_rate_limited endpoint=/test/ai/api/chat/stream');
    return jsonError(429, { error: 'rate_limited', message: 'ただいまご利用が集中しています。少し時間を置いてもう一度お試しください。' });
  }
  // 4) ボディは上限バイトまで読む。
  const raw = await readTextWithLimit(request, MAX_BODY_BYTES);
  if (raw === null) {
    console.warn('[security] body_too_large endpoint=/test/ai/api/chat/stream');
    return jsonError(413, { error: 'too_large', message: '送信内容が大きすぎます。' });
  }

  let body;
  try { body = JSON.parse(raw || ''); } catch { return jsonError(400, { error: 'invalid_json' }); }
  const text = String(body?.message || '').trim();
  if (!text) return jsonError(400, { error: 'empty_message' });
  if (text.length > 4000) return jsonError(400, { error: 'too_long' });

  // 5) 日次上限（1IPあたり30通/日 → 全IP合計100通/日 の順。IPで止まった要求に全体枠を消費させない）。
  const ipBudget = await bumpDailyCounter(env, `ip:${clientIp(request)}`, limitFromEnv(env, 'CHAT_IP_DAILY_TOTAL', DEFAULT_IP_DAILY_TOTAL), 'testai');
  if (!ipBudget.ok) {
    console.warn(`[security] daily_budget_exceeded scope=ip endpoint=/test/ai/api/chat/stream count=${ipBudget.count}`);
    return jsonError(429, { error: 'daily_limit', message: 'ただいまご利用が集中しています。少し時間を置いてもう一度お試しください。' });
  }
  const globalBudget = await bumpDailyCounter(env, 'global', limitFromEnv(env, 'CHAT_DAILY_TOTAL', DEFAULT_DAILY_TOTAL), 'testai');
  if (!globalBudget.ok) {
    console.warn(`[security] daily_budget_exceeded scope=global endpoint=/test/ai/api/chat/stream count=${globalBudget.count}`);
    return jsonError(429, { error: 'daily_limit', message: 'ただいまご利用が集中しています。少し時間を置いてもう一度お試しください。' });
  }

  let visitor;
  try {
    visitor = await ensureVisitor(env, request);
  } catch (error) {
    console.error(`[security] visitor_store_failed endpoint=/test/ai/api/chat/stream error=${String(error?.message || error)}`);
    return jsonError(503, { error: 'unavailable', message: '一時的に利用できません。少し時間を置いてもう一度お試しください。' });
  }
  const dailyLimit = Number(env.DAILY_FREE_LIMIT || 20);
  const ok = await consumeQuota(env, visitor.visitorId, dailyLimit);
  if (!ok) {
    return jsonError(429, { error: 'quota_exceeded', message: '本日ご利用いただける回数の上限に達しました。日付が変わると自動で回復します。LINEからはこのままご相談いただけます。' });
  }

  const history = await loadRecentMessages(env, visitor.visitorId, 12);
  const isNewSession = history.length === 0;

  const headers = {
    ...API_SECURITY_HEADERS,
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    'x-accel-buffering': 'no',
    ...corsHeaders(env, request),
  };
  if (visitor.setCookie) headers['set-cookie'] = visitor.setCookie;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messages = [
          { role: 'system', content: buildSystemPrompt({ personaMd: PERSONA_MD, lastSummary: visitor.lastSummary, isNewSession }) },
          ...history,
          { role: 'user', content: text },
        ];
        const result = await callDeepSeekStream(env, messages, async (delta) => controller.enqueue(sse('delta', { delta })));
        const reply = result.full.trim();
        if (!reply) throw new Error('empty_reply');

        const resumeLine = buildResumeLine(text, reply) || visitor.lastSummary;
        await saveTurn(env, { visitorId: visitor.visitorId, userText: text, replyText: reply, resumeLine });

        controller.enqueue(sse('done', { ok: true, at: now() }));
      } catch (e) {
        controller.enqueue(sse('error', { message: 'うまく送信できませんでした。少し時間を置いてもう一度お試しください。' }));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers });
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, {
    status: 204,
    headers: { ...API_SECURITY_HEADERS, 'cache-control': 'no-store', ...corsHeaders(env, request), 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' },
  });
}
