import { onRequestOptions, onRequestPost } from '../functions/api/chat/stream.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/chat/stream') {
      if (request.method === 'POST') return onRequestPost({ request, env });
      if (request.method === 'OPTIONS') return onRequestOptions({ request, env });
      return new Response(JSON.stringify({ error: 'method_not_allowed', message: 'POSTで送信してください。' }), {
        status: 405,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', allow: 'POST, OPTIONS' },
      });
    }

    if (url.pathname === '/healthz') {
      return new Response(JSON.stringify({ ok: true, project: 'ai-ustyle-co-jp-worker' }, null, 2), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
