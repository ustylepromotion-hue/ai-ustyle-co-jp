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

const encoder = new TextEncoder();
const sse = (event, data) => encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

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
          await onDelta(delta);
        }
      }
    }
  }
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
  let body;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 }); }
  const text = String(body?.message || '').trim();
  if (!text) return new Response(JSON.stringify({ error: 'empty_message' }), { status: 400 });
  if (text.length > 4000) return new Response(JSON.stringify({ error: 'too_long' }), { status: 400 });

  const visitor = await ensureVisitor(env, request);
  const dailyLimit = Number(env.DAILY_FREE_LIMIT || 20);
  const ok = await consumeQuota(env, visitor.visitorId, dailyLimit);
  if (!ok) {
    return new Response(JSON.stringify({ error: 'quota_exceeded', message: '本日ご利用いただける回数の上限に達しました。日付が変わると自動で回復します。LINEからはこのままご相談いただけます。' }), { status: 429 });
  }

  const history = await loadRecentMessages(env, visitor.visitorId, 12);
  const isNewSession = history.length === 0;

  const headers = {
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
  return new Response(null, { status: 204, headers: { ...corsHeaders(env, request), 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
}
