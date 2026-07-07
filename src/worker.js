export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return new Response(JSON.stringify({ ok: true, project: "ai-ustyle-co-jp-worker" }, null, 2), {
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
