// Vercel serverless function: /api/img (CommonJS)
// Same-origin image proxy with caching headers.
// Only https://image.tmdb.org/t/p/* URLs are allowed.
module.exports = async (req, res) => {
  const placeholder = () => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='500' height='750'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#1b1440'/><stop offset='.55' stop-color='#0e2038'/><stop offset='1' stop-color='#0d1020'/></linearGradient></defs><rect width='500' height='750' fill='url(#g)'/><circle cx='110' cy='130' r='150' fill='rgba(124,58,237,0.28)'/><circle cx='420' cy='650' r='170' fill='rgba(34,211,238,0.18)'/><text x='250' y='380' font-size='64' text-anchor='middle'>🎬</text><text x='250' y='445' font-size='20' letter-spacing='6' text-anchor='middle' fill='#8f97bd' font-family='sans-serif'>AURAFLEX</text></svg>`;
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(svg);
  };

  try {
    const target = (req.query && req.query.u) || "";
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      placeholder();
      return;
    }
    if (parsed.protocol !== "https:" || parsed.hostname !== "image.tmdb.org" || !parsed.pathname.startsWith("/t/p/")) {
      placeholder();
      return;
    }

    const r = await fetch(target, { headers: { "User-Agent": "auraflex/1.0" } });
    if (!r.ok) { placeholder(); return; }
    const ctype = r.headers.get("content-type") || "image/jpeg";
    if (!ctype.startsWith("image/")) { placeholder(); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", ctype);
    res.setHeader("Cache-Control", "public, max-age=604800, s-maxage=604800");
    res.status(200).send(buf);
  } catch {
    placeholder();
  }
};
