# Deploying AURAFLEX

## Local (recommended for dev)

```bash
npm start        # → http://localhost:8788
```

The local `server.js` reads `.env` and provides `/config.js`, `/img`, and `/canary` itself.
No other setup needed.

## Vercel

The repo ships `api/` functions + `vercel.json`, so the same endpoints exist on Vercel.
`vercel.json` maps them to the exact paths the front-end already calls:

| Path | Local (server.js) | Vercel |
|---|---|---|
| `/config.js` | reads `.env` | `api/config.js` reads deployment env |
| `/img` | proxy + disk cache | `api/img.js` proxy + CDN cache |
| `/canary` | host reachability | `api/canary.js` |

### Steps

1. Push this repo to GitHub (`.gitignore` already protects `.env` — your key never leaves your machine).
2. On [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `TMDB_API_KEY` | your real TMDB v3 key |
   | `VIDSRC_HOSTS` | `vidsrc.to,vidsrc.cc` (optional) |

4. Deploy. Posters, search, and rails work on the deployment URL exactly like local.

### Notes & limits

- **`/img` on Vercel has no disk cache** (serverless is ephemeral), but responses carry
  `Cache-Control: s-maxage=604800`, so Vercel's CDN caches them at the edge — effectively
  faster than the local disk cache.
- **The 500 you saw earlier** (`FUNCTION_INVOCATION_FAILED`) happens when the repo is deployed
  *without* the `api/` folder or before this refactor — the platform had no function to serve
  dynamic paths. With `api/` + `vercel.json` committed, it resolves.
- **Player reachability is deployment-specific**: `/canary` tests from *Vercel's* servers, not
  your browser's network. If a school/office network blocks vidsrc, the canary may report OK
  even though your local network can't reach it — the honest check is still the browser itself.

## Anywhere else (Render, Railway, Fly, a VPS)

`server.js` is a zero-dependency Node HTTP server: `npm start` is all any Node host needs.
Set `PORT` (optional) and it binds correctly.
