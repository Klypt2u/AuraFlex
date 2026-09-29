// Vercel serverless function: /api/canary
// Reports whether a playback host is reachable from this deployment's network.
export default async function handler(req, res) {
  const host = req.query.host || "";
  if (!/^[a-z0-9.-]+$/i.test(host)) {
    res.status(400).json({ ok: false, status: 0 });
    return;
  }
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 4000);
    const r = await fetch(`https://${host}/`, { signal: ac.signal, headers: { "User-Agent": "auraflex/1.0" } });
    clearTimeout(timer);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ t: Date.now(), ok: r.status < 500, status: r.status });
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ t: Date.now(), ok: false, status: 0 });
  }
}
