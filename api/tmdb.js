// Vercel serverless function: /api/tmdb (CommonJS)
// Proxies TMDB API calls, injecting the server-side TMDB_API_KEY.
// This keeps search + catalog working even if the browser never
// receives a key (blocked /config.js, env var unset, etc).
// Usage: /api/tmdb?path=/search/multi&query=dune  (path must start with /)

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(code).send(JSON.stringify(obj));
  };

  try {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
      return res.status(204).end();
    }

    const key = (process.env.TMDB_API_KEY || "").trim();
    if (!key || key === "your_tmdb_v3_api_key_here") {
      return json(503, { error: "no_key_on_server" });
    }

    const path = String(req.query.path || "");
    if (!/^\/[a-z0-9_\-/.]*$/i.test(path)) {
      return json(400, { error: "bad_path" });
    }

    const url = new URL("https://api.themoviedb.org/3" + path);
    url.searchParams.set("api_key", key);
    for (const [k, v] of Object.entries(req.query)) {
      if (k === "path" || k === "api_key") continue;
      url.searchParams.set(k, String(v));
    }

    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const body = await upstream.text();
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.setHeader("Cache-Control", "public, max-age=120");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(upstream.status).send(body);
  } catch (e) {
    json(502, { error: "tmdb_proxy_failed", detail: String(e && e.message || e).slice(0, 200) });
  }
};
