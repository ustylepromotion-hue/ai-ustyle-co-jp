import { onRequestOptions, onRequestPost } from '../functions/api/chat/stream.js';
import { API_SECURITY_HEADERS, ASSET_SECURITY_HEADERS } from '../functions/_security.js';

const CHAT_ENDPOINT = '/api/chat/stream';

function json(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...API_SECURITY_HEADERS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

// セキュリティヘッダーの後掛け（既に付いている値は _headers を正として上書きしない）。
function withSecurityHeaders(response, base = API_SECURITY_HEADERS) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(base)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === CHAT_ENDPOINT) {
      if (request.method === 'POST') return withSecurityHeaders(await onRequestPost({ request, env }));
      if (request.method === 'OPTIONS') return withSecurityHeaders(await onRequestOptions({ request, env }));
      return json(405, { error: 'method_not_allowed', message: 'POSTで送信してください。' }, { allow: 'POST, OPTIONS' });
    }

    // 未定義の API パスは HTML にフォールバックさせず 404 JSON で返す。
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return json(404, { error: 'not_found' });
    }

    if (url.pathname === '/healthz') {
      return json(200, { ok: true, project: 'ai-ustyle-co-jp-worker' });
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request), ASSET_SECURITY_HEADERS);
  },
};
