# 🎬 AURAFLEX — Premium Streaming UI

A sleek, dark, glassmorphic streaming front-end built on **TMDB metadata** + **Vidsrc embeds**.
Zero dependencies — one tiny Node static server, pure HTML/CSS/JS.

## 🚀 Run it

```bash
npm start
# → http://localhost:8788
```

## 🔑 Connect TMDB (via .env)

1. Get a free **v3 API key**: https://www.themoviedb.org/settings/api
2. Open `.env` and set:
   ```
   TMDB_API_KEY=your_real_key_here
   ```
3. Restart (`npm start`). The server injects the key at `/config.js` — **`.env` itself is never served** (returns 403) and is git-ignored.

You can also paste a key at runtime via the **API Key** button (stored in your browser's localStorage).

Without any key the site boots in **demo mode**: full UI, 12-title catalog, working episode picker (synthetic data), player included.

| File | Committed? | Purpose |
|---|---|---|
| `.env` | ❌ never | Your real key (local only) |
| `.env.example` | ✅ | Template showing the shape |
| `.gitignore` | ✅ | Blocks `.env`, logs, junk |

## 📺 Playback (Vidsrc)

Public embed URLs keyed by TMDB ID:

- Movie: `https://vidsrc.to/embed/movie/{tmdbId}`
- TV: `https://vidsrc.to/embed/tv/{tmdbId}/{season}/{episode}`

Switch hosts with the **src:** chip in the watch bar (`vidsrc.to` ⇄ `vidsrc.cc`), configurable in `.env` via `VIDSRC_HOSTS`.

## 😬 "Will I get banned on GitHub?"

**Not for this repo as written.** Here's the honest breakdown:

- **What's in the repo:** your own code + the `.gitignore`'d `.env`. That's fine. TMDB API *terms* say non-commercial personal use, keep attribution, don't expose your key — a personal demo with the key in gitignored `.env` respects that.
- **The real risk is the content, not the code.** Vidsrc serves movies/TV it doesn't have rights to. Linking/embedding it is legally gray-to-infringing depending on your country, and **GitHub's DMCA process does take down repos whose purpose is streaming pirated content** (they've processed thousands, including big streaming-UI projects).
- **The short version:** *a* streaming-UI project on GitHub ≠ ban. But a repo whose read-me says "watch any movie free via vidsrc" can get DMCA'd, and repeated strikes can get your account suspended. If you're posting this publicly, consider shipping it **metadata-only** (drop the Vidsrc embeds, keep TMDB — like Letterboxd-style watchlists) or keeping this build private.

GitHub does not scan your commits for what Vidsrc serves. Takedowns are reactive (rights-holder reports), not automated bans.

## ✨ Features

- Cinematic auto-rotating hero carousel, ambient gradient orbs, boot splash
- 6 content rails with skeleton loaders, hover-▶ (plays instantly) and click (details)
- Search (`/`), details modal with cast/genres, "More like this" sidebar
- Watch view: Vidsrc player, source switcher, fullscreen, IMDb link
- TV: season dropdown + Seasons tab with clickable season cards, episode stills, watched marks, `N` = next episode
- Demo mode fallback everywhere

## ⚖️ Disclaimer

UI demo. AURAFLEX hosts nothing and stores nothing; playback is delegated to third-party public embeds. Uses the TMDB API but is not endorsed by TMDB.
