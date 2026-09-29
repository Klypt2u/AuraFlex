/* ============================================================
   AURAFLEX — TMDB + Vidsrc premium streaming front-end
   Zero build. Vanilla JS. LocalStorage settings.
   ============================================================ */
"use strict";

/* ---------------- helpers ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

const debounce = (fn, ms = 350) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

const TMDB_IMG = "https://image.tmdb.org/t/p";
// route images through the local server proxy when available (dodges ISP/browser blocks on image.tmdb.org)
const IMG_PROXY = !!(window.AF_ENV && window.AF_ENV.imgProxy);
const poster = (p, size = "w500") => {
  if (!p) return null;
  const url = p.startsWith("http") ? p : `${TMDB_IMG}/${size}${p}`;
  return IMG_PROXY ? `/img?u=${encodeURIComponent(url)}` : url;
};
const yearOf = (d) => (d || "").slice(0, 4);
const runtimeOf = (m) => (m ? `${Math.floor(m / 60)}h ${m % 60}m` : "");

const STORE = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let toastT;
function toast(msg, ms = 2600) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.classList.remove("show"); setTimeout(() => (el.hidden = true), 350); }, ms);
}

/* ---------------- config ---------------- */
// Priority: browser-saved key (localStorage) > injected /config.js (.env) > demo mode
const CONFIG = {
  key: STORE.get("af_key", "") || (window.AF_ENV && window.AF_ENV.tmdbKey) || "",
  providers: STORE.get("af_providers", null) || (window.AF_ENV && window.AF_ENV.vidsrcHosts) || ["vidsrc.to", "vidsrc.cc"],
  autoplay: STORE.get("af_autoplay", true),
};

// optional server-cached art for demo mode
const DEMO_ART = (window.AF_ENV && window.AF_ENV.demoArt) || null;
const demoArt = (id, kind = "POSTERS") =>
  DEMO_ART && DEMO_ART[kind] ? DEMO_ART[kind][id] : null;

const PROVIDERS = {
  "vidsrc.to": (t, id, s, e) => t === "tv"
    ? `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
    : `https://vidsrc.to/embed/movie/${id}`,
  "vidsrc.cc": (t, id, s, e) => t === "tv"
    ? `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`
    : `https://vidsrc.cc/v2/embed/movie/${id}`,
};

/* ---------------- TMDB layer ---------------- */
const API = "https://api.themoviedb.org/3";
const cache = new Map();

async function tmdb(path, params = {}) {
  const url = new URL(API + path);
  url.searchParams.set("api_key", CONFIG.key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ck = url.toString();
  if (cache.has(ck)) return cache.get(ck);
  const res = await fetch(ck);
  if (!res.ok) {
    const err = new Error(`TMDB ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  cache.set(ck, data);
  return data;
}

let DEMO = false;

async function loadCatalog() {
  if (!CONFIG.key) { DEMO = true; }
  if (DEMO) {
    bootNote("Demo mode — no TMDB key");
    return demoData();
  }
  try {
    bootNote("Pulling catalog from TMDB…");
    const [tr, trTv, pop, top, up, on] = await Promise.all([
      tmdb("/trending/all/week"),
      tmdb("/trending/tv/week"),
      tmdb("/movie/popular"),
      tmdb("/movie/top_rated"),
      tmdb("/movie/upcoming"),
      tmdb("/tv/on_the_air"),
    ]);
    return [
      { key: "trending",  title: "🔥 Trending This Week", items: tr.results.filter(r => r.media_type !== "person").slice(0, 20) },
      { key: "popular",   title: "🍿 Popular Films", items: pop.results.slice(0, 20) },
      { key: "top-rated", title: "🏆 Top Rated of All Time", items: top.results.slice(0, 20) },
      { key: "upcoming",  title: "🎟️ Coming Soon", items: up.results.slice(0, 20) },
      { key: "onair",     title: "📺 On The Air — Series", items: on.results.slice(0, 20) },
      { key: "tvtr",      title: "🌟 Series Spotlight", items: trTv.results.slice(0, 20) },
    ];
  } catch (e) {
    if (e.status === 401) {
      bootNote("TMDB rejected the key — demo mode");
      toast("TMDB key rejected — showing demo data. Set your key via “API Key”.");
    } else {
      bootNote("Network error — demo mode");
    }
    DEMO = true;
    return demoData();
  }
}

/* ---------------- boot ---------------- */
function bootNote(t) { const el = $("#bootNote"); if (el) el.textContent = t; }

/* ---------------- demo detail stubs (offline mode) ---------------- */
function demoDetail(type, id) {
  const it = DEMO_LIST.find((x) => x.id === id);
  if (!it) return null;
  const posterP = demoArt(id, "POSTERS");
  const backdropP = demoArt(id, "BACKDROPS");
  const base = {
    id,
    title: it.title || it.name,
    name: it.name || it.title,
    overview: it.overview,
    poster_path: posterP,
    backdrop_path: backdropP,
    vote_average: it.vote_average,
    genres: [{ id: it.genre_ids?.[0] || 18, name: GENRE[it.genre_ids?.[0]] || "Drama" }],
    credits: { cast: [] },
    production_companies: [],
    homepage: "",
  };
  if (type === "tv") {
    return { ...base, seasons: demoSeasons(id), episode_run_time: [45], imdb_id: null };
  }
  return { ...base, runtime: 130, imdb_id: null };
}

/* ---------------- demo dataset ---------------- */
const DEMO_LIST = [
  { id: 27205, title: "Inception", name: "Inception", media_type: "movie", overview: "A thief who steals corporate secrets through dream-sharing technology is given the inverse task: plant an idea into the mind of a C.E.O.", poster_path: "/9gk7fsG6fn6NsRwe3Zf7cN3vS6t.jpg", backdrop_path: "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg", vote_average: 8.4, release_date: "2010-07-15", genre_ids: [28, 878] },
  { id: 155, title: "The Dark Knight", name: "The Dark Knight", media_type: "movie", overview: "Batman raises the stakes in his war on crime, but a new villain, the Joker, plunges Gotham into anarchy.", poster_path: "/qJ2tW6WMCDuxB9MAnuMf6zj7fGt.jpg", backdrop_path: "/nMKdUUepR0i5zn0y1T4CsSB5chy.jpg", vote_average: 8.5, release_date: "2008-07-16", genre_ids: [28, 80] },
  { id: 1396, name: "Breaking Bad", media_type: "tv", title: "Breaking Bad", overview: "A high-school chemistry teacher diagnosed with cancer teams with a former student to secure his family's future.", poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg", backdrop_path: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg", vote_average: 8.9, first_air_date: "2008-01-20", genre_ids: [18, 80] },
  { id: 1399, name: "Game of Thrones", media_type: "tv", title: "Game of Thrones", overview: "Nine noble families wage war for control of the Seven Kingdoms of Westeros while an ancient enemy returns.", poster_path: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg", backdrop_path: "/suopoADq0k8YZr4mQ3L0VoPYmTy.jpg", vote_average: 8.4, first_air_date: "2011-04-17", genre_ids: [18, 10765] },
  { id: 157336, title: "Interstellar", name: "Interstellar", media_type: "movie", overview: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.", poster_path: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", backdrop_path: "/xJHokMbljvjADYdit5fK5VQsXEG.jpg", vote_average: 8.4, release_date: "2014-11-05", genre_ids: [12, 878] },
  { id: 76479, name: "The Boys", media_type: "tv", title: "The Boys", overview: "A group of vigilantes set out to take down corrupt celebrity superheroes who abuse their powers.", poster_path: "/11sttTM5VUsVdm7nyAyJKbIF4Bn.jpg", backdrop_path: "/m0gWg7S7VOCnW9UnPfx5bSur4Mx.jpg", vote_average: 8.5, first_air_date: "2019-07-25", genre_ids: [10765, 10759] },
  { id: 680, title: "Pulp Fiction", name: "Pulp Fiction", media_type: "movie", overview: "A burger-loving hit man, his philosophical partner and a washed-up boxer converge in this sprawling crime comedy.", poster_path: "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg", backdrop_path: "/4cDFJr4HP4hdcU2mNa1YXlEA9Jh.jpg", vote_average: 8.5, release_date: "1994-09-10", genre_ids: [53, 80] },
  { id: 94605, name: "Arcane", media_type: "tv", title: "Arcane", overview: "Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war.", poster_path: "/fqldf2tOzgcqS6fXqplXG1ysgKX.jpg", backdrop_path: "/6TScqig0Zxq640z0xr5Z0l2XlYv.jpg", vote_average: 8.7, first_air_date: "2021-11-06", genre_ids: [16, 10765] },
  { id: 550, title: "Fight Club", name: "Fight Club", media_type: "movie", overview: "An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into much more.", poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg", backdrop_path: "/hZkgoQYus5vegHoetLkCJzb17zJ.jpg", vote_average: 8.4, release_date: "1999-10-15", genre_ids: [18, 53] },
  { id: 1556, name: "Severance", media_type: "tv", title: "Severance", overview: "Mark leads a team of office workers whose memories have been surgically divided between work and personal life.", poster_path: "/5AtaI5Z5a7nnWnt5uFoXvUEafen.jpg", backdrop_path: "/8aRnCvS8pG6QO5lM8gHsTQeRl9Y.jpg", vote_average: 8.4, first_air_date: "2022-02-18", genre_ids: [18, 9648] },
  { id: 24428, title: "The Avengers", name: "The Avengers", media_type: "movie", overview: "Earth's mightiest heroes must come together and learn to fight as a team to stop Thor's mischievous brother.", poster_path: "/RW0WdgkSqz566666666666.jpg", backdrop_path: "/9BBToToAPrUYaV6Sy6UqIH45rc2.jpg", vote_average: 7.7, release_date: "2012-04-25", genre_ids: [28, 12] },
  { id: 278, title: "The Shawshank Redemption", name: "The Shawshank Redemption", media_type: "movie", overview: "Two imprisoned men bond over years, finding solace and eventual redemption through acts of common decency.", poster_path: "/9O1Iy9od7uEGor5EKfbJ8QYSnZ8.jpg", backdrop_path: "/dqK9Hag1054tghRQSqLSfrkvQnA.jpg", vote_average: 8.7, release_date: "1994-09-23", genre_ids: [18, 80] },
];

function demoData() {
  const mk = (arr) => arr.map((x) => ({
    ...x,
    media_type: x.media_type || "movie",
    poster_path: x.poster_path || demoArt(x.id, "POSTERS"),
    backdrop_path: x.backdrop_path || demoArt(x.id, "BACKDROPS"),
  }));
  return [
    { key: "trending",  title: "🔥 Trending This Week", items: mk(DEMO_LIST) },
    { key: "popular",   title: "🍿 Popular Films", items: mk(DEMO_LIST.filter(x => x.media_type === "movie")) },
    { key: "top-rated", title: "🏆 Top Rated of All Time", items: mk([...DEMO_LIST].reverse()) },
    { key: "upcoming",  title: "🎟️ Coming Soon", items: mk(DEMO_LIST.slice(0, 6)) },
    { key: "onair",     title: "📺 On The Air — Series", items: mk(DEMO_LIST.filter(x => x.media_type === "tv")) },
    { key: "tvtr",      title: "🌟 Series Spotlight", items: mk(DEMO_LIST.filter(x => x.media_type === "tv")) },
  ];
}

// season/episode stubs so the TV UI is fully explorable without a key
function demoEpisodes(showId, season) {
  const counts = { 1396: 7, 1399: 10, 76479: 8, 94605: 9, 1556: 9 };
  const n = counts[showId] || 8;
  return Array.from({ length: n }, (_, i) => ({
    episode_number: i + 1,
    name: i === 0 ? "Pilot" : `Episode ${i + 1}`,
    overview: "Episode synopsis unavailable in demo mode.",
    runtime: 45,
    still_path: demoArt(showId, "BACKDROPS"),
  }));
}
function demoSeasons(showId) {
  return [1, 2, 3].map((s) => ({
    season_number: s,
    name: `Season ${s}`,
    episode_count: (demoEpisodes(showId, s) || []).length,
    poster_path: demoArt(showId, "POSTERS"),
  }));
}

/* ---------------- state ---------------- */
const state = {
  catalog: [],
  currentDetail: null, // {type, id, data}
  watch: null,        // {type, id, data, season, episode}
  heroIdx: 0,
  heroTimer: null,
  demo: false,
};

/* ---------------- continue watching ---------------- */
function cwGet() {
  return STORE.get("af_continue", []); // [{type,id,title,poster,season,episode,at,pct}]
}
function cwUpsert(entry) {
  const list = cwGet().filter((x) => !(x.type === entry.type && x.id === entry.id));
  list.unshift(entry);
  STORE.set("af_continue", list.slice(0, 12));
  renderContinueRow();
}
function cwRemove(type, id) {
  STORE.set("af_continue", cwGet().filter((x) => !(x.type === type && x.id === id)));
  renderContinueRow();
}
function renderContinueRow() {
  const row = $("#row-continue");
  const rail = $("#cwRail");
  if (!row || !rail) return;
  const list = cwGet();
  row.hidden = list.length === 0;
  rail.innerHTML = list.map((x) => {
    const label = x.type === "tv" ? `S${x.season}:E${x.episode}` : "Movie";
    return `
    <div class="card cw-card" data-type="${x.type}" data-id="${x.id}">
      <div class="card-poster">
        ${x.poster ? `<img loading="lazy" src="${esc(x.poster)}" alt="" onerror="this.remove()">` : ""}
        <div class="card-fallback" ${x.poster ? "hidden" : ""}><span>${esc(x.title)}</span></div>
        <span class="card-type">${label}</span>
        <div class="cw-progress"><span style="width:${Math.min(100, Math.max(6, x.pct || 12))}%"></span></div>
      </div>
      <div class="card-info">
        <div class="card-title">${esc(x.title)}</div>
        <div class="card-sub">${label} · ${new Date(x.at).toLocaleDateString()}</div>
      </div>
      <button class="cw-x" title="Remove" data-cw-x="${x.type}:${x.id}">✕</button>
    </div>`;
  }).join("");
  $$("#cwRail .cw-card").forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest("[data-cw-x]")) {
        cwRemove(el.dataset.type, Number(el.dataset.id));
        return;
      }
      const item = cwGet().find((x) => x.type === el.dataset.type && String(x.id) === el.dataset.id);
      openWatch(el.dataset.type, Number(el.dataset.id), { data: null });
      if (item && item.type === "tv") {
        state.watch.season = item.season || 1;
        state.watch.episode = item.episode || 1;
      }
    };
  });
}

// save progress when playback starts and every 30s while the watch view is open
let cwTimer = null;
function cwTrackProgress() {
  clearInterval(cwTimer);
  cwTimer = setInterval(() => {
    if (!state.watch || $("#watch").hidden) return clearInterval(cwTimer);
    const d = state.watch.data || {};
    cwUpsert({
      type: state.watch.type,
      id: state.watch.id,
      title: d.title || d.name || "Untitled",
      poster: poster(d.poster_path, "w500") || "",
      season: state.watch.season,
      episode: state.watch.episode,
      at: Date.now(),
      pct: state.watch.type === "tv" ? (state.watch.episode || 1) * 12 % 100 : 34,
    });
  }, 30000);
}

/* ---------------- rendering ---------------- */
const GENRE = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  53: "Thriller", 10752: "War", 37: "Western", 10765: "Sci-Fi & Fantasy",
  10759: "Action & Adventure", 10768: "War & Politics",
};

function metaLine(item) {
  const type = item.media_type || item.type || "movie";
  const y = yearOf(item.release_date || item.first_air_date);
  const r = item.vote_average ? item.vote_average.toFixed(1) : null;
  const rt = runtimeOf(item.runtime);
  return { type, y, r, rt };
}

function cardHTML(item) {
  const p = poster(item.poster_path, "w500");
  const m = metaLine(item);
  const type = (item.media_type || "movie").toUpperCase();
  const title = esc(item.title || item.name);
  return `
  <article class="card" data-id="${item.id}" data-type="${item.media_type || "movie"}">
    <div class="card-poster">
      ${p ? `<img loading="lazy" src="${esc(p)}" alt="${title}" onerror="this.remove()">
            <div class="card-fallback" hidden><span>${title}</span></div>`
         : `<div class="card-fallback"><span>${title}</span></div>`}
      <span class="card-type">${type}</span>
      ${item.vote_average ? `<span class="card-rating">★ ${item.vote_average.toFixed(1)}</span>` : ""}
      <div class="card-overlay">
        <button class="card-play" aria-label="Play ${title}">
          <svg viewBox="0 0 24 24" class="ic"><path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" fill="currentColor"/></svg>
        </button>
      </div>
    </div>
    <div class="card-info">
      <div class="card-title">${title}</div>
      <div class="card-sub">${m.y || "—"} · ${GENRE[item.genre_ids?.[0]] || type}</div>
    </div>
  </article>`;
}

// if a poster fails to load, retry once via the local /img proxy, then reveal the styled fallback
function watchPosterErrors() {
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || !img.closest(".card-poster")) return;
    if (!img.dataset.retried && !img.src.includes("/img?u=")) {
      img.dataset.retried = "1";
      img.src = `/img?u=${encodeURIComponent(img.src)}`;
      return;
    }
    img.parentElement?.querySelector(".card-fallback")?.removeAttribute("hidden");
  }, true);
}

function skels(n = 8) {
  return Array.from({ length: n }, () => `
    <div class="skeleton">
      <div class="sk-img"></div>
      <div class="sk-line"></div>
      <div class="sk-line short"></div>
    </div>`).join("");
}

function renderRows(catalog) {
  const host = $("#rows");
  // keep the Continue Watching row (rendered separately) at the top
  const cwRow = $("#row-continue");
  host.innerHTML = "";
  if (cwRow) host.appendChild(cwRow);
  host.insertAdjacentHTML("beforeend", catalog.map((sec) => `
    <div class="row" id="${sec.key}">
      <div class="row-head">
        <h2>${sec.title}</h2>
        <span class="row-sub">${sec.items.length} titles</span>
        <div class="row-nav">
          <button class="row-btn" data-dir="-1">‹</button>
          <button class="row-btn" data-dir="1">›</button>
        </div>
      </div>
      <div class="rail-wrap">
        <div class="rail">${skels(8)}</div>
      </div>
    </div>
  `).join(""));

  // fill real cards
  catalog.forEach((sec, i) => {
    const rail = $$('.rail:not(#cwRail)', host)[i];
    rail.dataset.key = sec.key;
    rail.innerHTML = sec.items.map(cardHTML).join("");
  });
}

function bindRailNav() {
  $("#rows").addEventListener("click", (e) => {
    const btn = e.target.closest(".row-btn");
    if (!btn) return;
    const rail = btn.closest(".row").querySelector(".rail");
    const amt = rail.clientWidth * 0.85 * Number(btn.dataset.dir);
    rail.scrollBy({ left: amt, behavior: "smooth" });
  });
}

/* ---------------- hero ---------------- */
function setupHero(items) {
  const picks = items.filter((i) => i.backdrop_path).slice(0, 5);
  if (!picks.length) return;
  const media = $("#heroMedia");
  const dots = $("#heroDots");

  const show = (idx) => {
    state.heroIdx = idx % picks.length;
    const it = picks[state.heroIdx];
    media.style.backgroundImage = `url("${poster(it.backdrop_path, "original")}")`;
    media.style.transform = "scale(1.08)";
    requestAnimationFrame(() => { media.style.transform = "scale(1)"; });
    $("#heroTitle").textContent = it.title || it.name;
    $("#heroOverview").textContent = it.overview || "";
    const m = metaLine(it);
    $("#heroMeta").innerHTML = `
      <span class="imdb">TMDB ${m.r || "—"}</span>
      <span>${m.y || ""}</span>
      <span class="dot-sep">•</span>
      <span>${GENRE[it.genre_ids?.[0]] || (it.media_type === "tv" ? "Series" : "Film")}</span>
      <span class="dot-sep">•</span>
      <span class="tag">${it.media_type === "tv" ? "SERIES" : "FILM"}</span>`;
    $("#heroPlay").dataset.id = it.id;
    $("#heroPlay").dataset.type = it.media_type || "movie";
    $("#heroInfo").dataset.id = it.id;
    $("#heroInfo").dataset.type = it.media_type || "movie";
    $$("#heroDots button").forEach((b, i) => b.classList.toggle("on", i === state.heroIdx));
  };

  dots.innerHTML = picks.map(() => "<button></button>").join("");
  $$("#heroDots button").forEach((b, i) => b.onclick = () => { show(i); resetTimer(); });
  show(0);

  const resetTimer = () => {
    clearInterval(state.heroTimer);
    state.heroTimer = setInterval(() => show(state.heroIdx + 1), 7000);
  };
  resetTimer();
}

function setupTicker(items) {
  const names = items.slice(0, 12).map((i) => i.title || i.name);
  const half = names.map((n) => `<span class="ticker-item"><b>▶</b> ${esc(n)}</span>`).join("");
  $("#tickerTrack").innerHTML = half + half; // duplicate for seamless loop
}

/* ---------------- detail modal ---------------- */
function fillModal(d, type, id) {
  $("#modalHero").style.backgroundImage = `url("${poster(d.backdrop_path, "w780") || poster(d.poster_path, "w780")}")`;
  $("#modalTitle").textContent = d.title || d.name;
  const m = metaLine({ ...d, release_date: d.release_date || d.first_air_date });
  $("#modalMeta").innerHTML = `
    ${m.r ? `<span class="imdb">TMDB ${m.r}</span>` : ""}
    ${m.y ? `<span>${m.y}</span>` : ""}
    ${d.runtime ? `<span class="dot-sep">•</span><span>${m.rt}</span>` : ""}
    ${(d.episode_run_time || [])[0] ? `<span class="dot-sep">•</span><span>~${d.episode_run_time[0]}m/ep</span>` : ""}
    <span class="dot-sep">•</span><span class="tag">${type === "tv" ? "SERIES" : "FILM"}</span>`;
  $("#modalOverview").textContent = d.overview || "No synopsis available.";
  $("#modalPlay").dataset.id = id;
  $("#modalPlay").dataset.type = type;
}

function openDetail(type, id, prefill = null) {
  const modal = $("#modal");
  modal.hidden = false;
  $("#modalTitle").textContent = "Loading…";
  $("#modalOverview").textContent = "";
  $("#modalMeta").innerHTML = "";
  $("#modalHero").style.backgroundImage = "";

  // instant paint from catalog cache — no spinner flash
  if (prefill) {
    fillModal({
      ...prefill,
      runtime: prefill.runtime || null,
      episode_run_time: prefill.episode_run_time || [],
      genres: prefill.genres || null,
      credits: prefill.credits || { cast: [] },
    }, type, id);
  }

  if (DEMO) {
    const stub = demoDetail(type, id);
    if (stub) {
      fillModal(stub, type, id);
      state.currentDetail = { type, id, data: stub };
    } else {
      $("#modalTitle").textContent = "Not in demo catalog";
    }
    return;
  }

  tmdb(`/${type}/${id}`, { append_to_response: "credits" })
    .then((d) => {
      fillModal(d, type, id);
      state.currentDetail = { type, id, data: d };
    })
    .catch(() => {
      if (!prefill) $("#modalTitle").textContent = "Could not load details";
    });
}

function closeModals() {
  $("#modal").hidden = true;
  $("#keyModal").hidden = true;
}

/* ---------------- watch view ---------------- */
function vidsrcUrl(type, id, s, e, provider) {
  const fn = PROVIDERS[provider] || PROVIDERS["vidsrc.to"];
  return fn(type, id, s, e);
}

// probe the active playback host; if it's unreachable from this network, offer the next one.
// no masking/no proxying of playback — just honest reachability + fallback.
async function probeSource() {
  if (!state.watch) return;
  const tryHost = async (host) => {
    try {
      const r = await fetch(`/canary?host=${encodeURIComponent(host)}`);
      return (await r.json()).ok;
    } catch { return false; }
  };
  let ok = await tryHost(state.watch.provider);
  if (!ok) {
    for (const h of CONFIG.providers) {
      if (h === state.watch.provider) continue;
      if (await tryHost(h)) {
        toast(`${state.watch.provider} unreachable on this network — switching to ${h}`);
        state.watch.provider = h;
        $("#srcBtn").textContent = `src: ${h}`;
        loadPlayer();
        return;
      }
    }
    toast("Playback host unreachable on this network (blocked or down). Try another connection.", 4000);
  }
}

function openWatch(type, id, seed = {}) {
  state.watch = { type, id, data: seed.data || null, season: 1, episode: 1, provider: CONFIG.providers[0] };
  $("#watch").hidden = false;
  document.body.style.overflow = "hidden";
  $("#watchTitle").textContent = seed.title || (seed.data && (seed.data.title || seed.data.name)) || "…";
  $("#imdbBtn").hidden = true;
  $("#srcBtn").textContent = `src: ${state.watch.provider}`;
  showCover(true, "Spinning up the projector…");
  $("#playerStart").hidden = false;
  $("#playerFrame").src = "about:blank";

  // custom player cover art
  const seedData = seed.data || null;
  paintPlayerCover(seedData);

  resetTabs(type);
  hydrateWatch();
  loadAbout(type, id);
  if (type === "tv") {
    // seed season dropdown + seasons tab from whatever data we already have
    const seasons = ((state.watch.data || {}).seasons || []).filter((s) => (s.season_number || 0) > 0 && (s.episode_count || 0) > 0);
    if (seasons.length) {
      $("#seasonSelect").innerHTML = seasons.map((s) => `<option value="${s.season_number}">${esc(s.name)} (${s.episode_count} ep)</option>`).join("");
      state.watch.season = Number($("#seasonSelect").value) || 1;
    }
    renderSeasonsGrid(seasons);
    loadEpisodes(id, state.watch.season);
  }
}

function renderSeasonsGrid(seasons) {
  if (!seasons.length) {
    $("#seasonsGrid").innerHTML = `<div class="empty">Season list unavailable.</div>`;
    return;
  }
  $("#seasonsGrid").innerHTML = seasons.map((s) => `
    <div class="season-card" data-s="${s.season_number}">
      ${poster(s.poster_path, "w342") ? `<img loading="lazy" src="${esc(poster(s.poster_path, "w342"))}" alt="">` : `<div class="card-fallback" style="position:relative;aspect-ratio:2/3;border-radius:10px;margin-bottom:10px"><span>${esc(s.name)}</span></div>`}
      <div class="season-name">${esc(s.name)}</div>
      <div class="season-meta">${s.episode_count} episodes</div>
    </div>`).join("");
}

function paintPlayerCover(d) {
  const bg = poster(d?.backdrop_path, "w1280") || "";
  const po = poster(d?.poster_path, "w500") || "";
  $("#pcBackdrop").style.backgroundImage = bg ? `url("${bg}")` : "";
  $("#pcPoster").hidden = !po;
  if (po) { $("#pcPoster").src = po; $("#pcPoster").onerror = () => { $("#pcPoster").hidden = true; }; }
  $("#pcTitle").textContent = d?.title || d?.name || "…";
  const m = d ? metaLine({ ...d, release_date: d.release_date || d.first_air_date }) : null;
  $("#pcSub").textContent = d
    ? [m.r ? `★ ${m.r}` : null, m.y || null, d.title ? "Film" : "Series"].filter(Boolean).join("  ·  ")
    : "loading details…";
}

function resetTabs(type) {
  const tv = type === "tv";
  $('[data-tab="episodes"]').style.display = tv ? "" : "none";
  $('[data-tab="seasons"]').style.display = tv ? "" : "none";
  const first = tv ? 'episodes' : 'about';
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === first));
  $('#tabEpisodes').hidden = !tv;
  $('#tabSeasons').hidden = true;
  $('#tabAbout').hidden = tv;
}

function showCover(show, note) {
  const c = $("#playerCover");
  c.classList.toggle("hide", !show);
  $("#playerNote").textContent = show
    ? "Standard quality · source may show pre-roll ads"
    : "Loading stream…";
}

async function hydrateWatch() {
  const { type, id } = state.watch;
  if (!state.watch.data) {
    try { state.watch.data = await tmdb(`/${type}/${id}`); } catch {}
  }
  const d = state.watch.data;
  if (!d) return;
  paintPlayerCover(d); // refresh cover once real details arrive
  $("#watchTitle").textContent = d.title || d.name;
  $("#imdbBtn").hidden = !d.imdb_id;
  $("#imdbBtn").onclick = () => window.open(`https://www.imdb.com/title/${d.imdb_id}`, "_blank");

  if (type === "tv") {
    // populate season dropdown + seasons grid once full details arrive
    const seasons = (d.seasons || []).filter((s) => s.season_number > 0 && (s.episode_count || 0) > 0);
    if (seasons.length) {
      $("#seasonSelect").innerHTML = seasons.map((s) => `<option value="${s.season_number}">${esc(s.name)} (${s.episode_count} ep)</option>`).join("");
      state.watch.season = Number($("#seasonSelect").value) || 1;
    }
    renderSeasonsGrid(seasons);
  }
}

function loadPlayer() {
  const { type, id, season, episode, provider } = state.watch;
  const url = vidsrcUrl(type, id, season, episode, provider);
  showCover(false);
  $("#playerFrame").src = url;
  $("#playerTopbar").hidden = false;
  cwTrackProgress();
  cwUpsert({
    type, id,
    title: state.watch.data?.title || state.watch.data?.name || "…",
    poster: poster(state.watch.data?.poster_path, "w500") || "",
    season, episode, at: Date.now(),
    pct: type === "tv" ? (episode || 1) * 12 % 100 : 34,
  });
  const p = $("#providerToast");
  p.hidden = false;
  p.textContent = `source: ${provider}`;
  clearTimeout(loadPlayer._t);
  loadPlayer._t = setTimeout(() => (p.hidden = true), 3000);
  // remember position for Continue Watching
  STORE.set("af_last", { type, id, season, episode, at: Date.now() });
  probeSource();
}

async function loadAbout(type, id) {
  const paint = (d) => {
    $("#aboutPoster").src = poster(d.poster_path, "w342") || "";
    $("#aboutTitle").textContent = d.title || d.name;
    const m = metaLine({ ...d, release_date: d.release_date || d.first_air_date });
    $("#aboutMeta").innerHTML = `
      ${m.r ? `<span class="imdb">TMDB ${m.r}</span>` : ""}
      ${m.y ? `<span>${m.y}</span>` : ""}
      ${d.runtime ? `<span class="dot-sep">•</span><span>${m.rt}</span>` : ""}
      ${d.episode_run_time?.[0] ? `<span class="dot-sep">•</span><span>~${d.episode_run_time[0]}m/ep</span>` : ""}
      <span class="dot-sep">•</span><span class="tag">${type === "tv" ? "SERIES" : "FILM"}</span>`;
    $("#aboutOverview").textContent = d.overview || "";
    $("#genreChips").innerHTML = (d.genres || []).map((g) => `<span class="chip">${esc(g.name)}</span>`).join("");
    const cast = (d.credits?.cast || []).slice(0, 8);
    $("#castRow").innerHTML = cast.map((c) => `
      <span class="cast-chip">
        ${c.profile_path ? `<img src="${poster(c.profile_path, "w185")}" alt="">` : `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%2311152a'/%3E%3C/svg%3E">`}
        <span>${esc(c.name)}</span>
      </span>`).join("");
  };
  if (DEMO) {
    const stub = demoDetail(type, id);
    if (stub) { paint(stub); state.watch.data = state.watch.data || stub; }
    $("#sideList").innerHTML = DEMO_LIST.filter((x) => x.id !== id).slice(0, 6).map(sideItem).join("");
    $$("#sideList .side-item").forEach((el) => el.onclick = () => openWatch(type, Number(el.dataset.id)));
    return;
  }
  try {
    const d = await tmdb(`/${type}/${id}`, { append_to_response: "credits" });
    paint(d);
    // similar titles
    const sim = await tmdb(`/${type}/${id}/similar`);
    const list = (sim.results || []).slice(0, 6);
    $("#sideList").innerHTML = list.length ? list.map(sideItem).join("") : `<div class="empty">Nothing here yet.</div>`;
    $$("#sideList .side-item").forEach((el) => el.onclick = () => openWatch(type, Number(el.dataset.id)));
  } catch {}
}

const sideItem = (s) => `
  <div class="side-item" data-id="${s.id}">
    ${poster(s.poster_path, "w185") ? `<img loading="lazy" src="${esc(poster(s.poster_path, "w185"))}" alt="">` : `<div class="card-fallback" style="width:52px;border-radius:8px"><span>${esc((s.title || s.name || "").slice(0, 12))}</span></div>`}
    <div>
      <div class="side-name">${esc(s.title || s.name)}</div>
      <div class="side-sub">★ ${s.vote_average?.toFixed(1) || "—"} · ${yearOf(s.release_date || s.first_air_date) || "—"}</div>
    </div>
  </div>`;

/* ---------------- TV episodes ---------------- */
async function loadEpisodes(id, season) {
  const list = $("#epList");
  list.innerHTML = `<div class="empty">Loading episodes…</div>`;
  if (DEMO) {
    const eps = demoEpisodes(id, season);
    renderEpisodes(eps);
    return;
  }
  try {
    const d = await tmdb(`/tv/${id}/season/${season}`);
    renderEpisodes(d.episodes || []);
  } catch {
    list.innerHTML = `<div class="empty">Could not load episodes.</div>`;
  }
}

function renderEpisodes(eps) {
  const list = $("#epList");
  {
    const watched = STORE.get(`af_watched_${state.watch.id}`, {});
    list.innerHTML = eps.length ? eps.map((ep) => `
      <div class="ep-item" data-e="${ep.episode_number}">
        <div class="ep-num">
          ${ep.still_path ? `<img loading="lazy" src="${poster(ep.still_path, "w300")}" alt="">` : "E" + ep.episode_number}
        </div>
        <div>
          <div class="ep-name">${ep.episode_number}. ${esc(ep.name)}</div>
          <div class="ep-overview">${esc(ep.overview || "No synopsis.")}</div>
        </div>
        <div class="ep-right">
          <span class="ep-runtime">${ep.runtime ? ep.runtime + "m" : ""}</span>
          <button class="ep-play" aria-label="Play episode">
            <svg viewBox="0 0 24 24" class="ic"><path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>`).join("")
      : `<div class="empty">No episode data for this season.</div>`;

    $$("#epList .ep-item").forEach((el) => {
      const n = Number(el.dataset.e);
      if (watched[n]) el.classList.add("watched");
      el.onclick = () => playEpisode(n);
    });
  }
}

function playEpisode(n) {
  state.watch.episode = n;
  $$("#epList .ep-item").forEach((el) => el.classList.toggle("active", Number(el.dataset.e) === n));
  $("#watchTitle").textContent = `${state.watch.data?.name || ""} — S${state.watch.season}:E${n}`;
  loadPlayer();
  const eps = $$("#epList .ep-item").length;
  if (CONFIG.autoplay && eps && n < eps) toast(`Up next: Episode ${n + 1} — press N when ready`, 3200);
  // mark watched
  const key = `af_watched_${state.watch.id}`;
  const w = STORE.get(key, {});
  w[n] = Date.now();
  STORE.set(key, w);
  $$("#epList .ep-item").forEach((el) => {
    if (Number(el.dataset.e) === n) el.classList.add("watched");
  });
}

/* ---------------- search ---------------- */
const doSearch = debounce(async (q) => {
  if (!q || q.length < 2) { closeSearch(); return; }
  const sec = $("#searchSection");
  const grid = $("#searchGrid");
  sec.hidden = false;
  grid.innerHTML = skels(8);
  $("#searchEmpty").hidden = true;
  $("#rows").style.display = "none";
  $("#hero").style.display = "none";
  $("#searchSection").scrollIntoView({ behavior: "smooth", block: "start" });

  let items = [];
  if (DEMO) {
    items = DEMO_LIST.filter((i) => (i.title || i.name).toLowerCase().includes(q.toLowerCase()));
  } else {
    try {
      const r = await tmdb("/search/multi", { query: q, include_adult: false });
      items = (r.results || []).filter((i) => i.media_type === "movie" || i.media_type === "tv");
    } catch {}
  }
  grid.innerHTML = items.length ? items.map(cardHTML).join("") : "";
  $("#searchEmpty").hidden = items.length > 0;
}, 400);

function closeSearch() {
  $("#searchSection").hidden = true;
  $("#rows").style.display = "";
  $("#hero").style.display = "";
}

/* ---------------- provider switcher ---------------- */
function cycleProvider() {
  if (!state.watch || $("#watch").hidden) { toast("Open the player first"); return; }
  const i = CONFIG.providers.indexOf(state.watch.provider);
  state.watch.provider = CONFIG.providers[(i + 1) % CONFIG.providers.length];
  $("#srcBtn").textContent = `src: ${state.watch.provider}`;
  toast(`Switching source → ${state.watch.provider}`);
  loadPlayer();
}

/* ---------------- key modal ---------------- */
function openKeyModal() {
  $("#keyInput").value = CONFIG.key.startsWith("3fa85f64") ? "" : CONFIG.key;
  $("#keyModal").hidden = false;
  $("#keyInput").focus();
}

$("#keySave").onclick = () => {
  const v = $("#keyInput").value.trim();
  if (!v) { toast("Paste a key first, or use demo mode."); return; }
  CONFIG.key = v;
  STORE.set("af_key", v);
  DEMO = false;
  cache.clear();
  $("#keyModal").hidden = true;
  boot();
};

$("#keyDemo").onclick = () => {
  CONFIG.key = "";
  STORE.set("af_key", "");
  DEMO = true;
  $("#keyModal").hidden = true;
  boot();
};

/* ---------------- boot sequence ---------------- */
async function boot() {
  const b = $("#boot");
  b.classList.remove("done");
  bootNote("Initializing uplink…");
  await loadCatalog().then((catalog) => {
    state.catalog = catalog;
    state.demo = DEMO;
    renderRows(catalog);
    setupHero(catalog[0].items);
    setupTicker(catalog[0].items);
    $("#keyBtn span").textContent = DEMO ? "Demo Mode" : "API Key";
    setTimeout(() => b.classList.add("done"), 400);
  });
}

/* ---------------- events ---------------- */
function bindEvents() {
  // nav scroll state + progress
  const nav = $("#nav");
  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 30);
    const max = document.documentElement.scrollHeight - innerHeight;
    $("#scrollProgress").style.width = `${max > 0 ? (scrollY / max) * 100 : 0}%`;
  }, { passive: true });

  // card clicks (delegated): ▶ plays, anywhere else opens details
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) {
      const type = card.dataset.type;
      const id = Number(card.dataset.id);
      if (e.target.closest(".card-play")) {
        openWatch(type, id, { data: catalogItem(card) });
      } else {
        openDetail(type, id, catalogItem(card));
      }
      return;
    }
    if (e.target.closest("[data-close]")) closeModals();
  });

  // hero buttons
  $("#heroPlay").onclick = () => {
    const it = state.catalog[0]?.items[state.heroIdx];
    openWatch($("#heroPlay").dataset.type, Number($("#heroPlay").dataset.id), { data: it || null });
  };
  $("#heroInfo").onclick = () => {
    const it = state.catalog[0]?.items[state.heroIdx];
    openDetail($("#heroInfo").dataset.type, Number($("#heroInfo").dataset.id), it || null);
  };
  $("#modalPlay").onclick = () => {
    const { id, type } = $("#modalPlay").dataset;
    closeModals();
    openWatch(type, Number(id), { data: state.currentDetail?.data });
  };

  // Seasons tab: click a season card -> jump to that season's episodes
  $("#seasonsGrid").addEventListener("click", (e) => {
    const c = e.target.closest(".season-card");
    if (!c || !state.watch) return;
    state.watch.season = Number(c.dataset.s);
    $("#seasonSelect").value = String(state.watch.season);
    loadEpisodes(state.watch.id, state.watch.season);
    $('[data-tab="episodes"]').click();
    toast(`Season ${state.watch.season} loaded`);
  });

  // search
  $("#searchInput").addEventListener("input", (e) => doSearch(e.target.value.trim()));
  $("#closeSearch").onclick = closeSearch;
  document.addEventListener("keydown", (e) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
    if (e.key === "/" && !typing && $("#watch").hidden) {
      e.preventDefault(); $("#searchInput").focus();
    }
    if (e.key === "n" && !typing && !$("#watch").hidden && state.watch?.type === "tv" && CONFIG.autoplay) {
      playEpisode((state.watch.episode || 1) + 1);
    }
    if (e.key === "Escape") {
      closeModals();
      if (!$("#watch").hidden) closeWatch();
    }
  });

  // watch view
  $("#backBtn").onclick = closeWatch;
  $("#playerStart").onclick = loadPlayer;
  $("#playerFs").onclick = () => {
    const shell = $("#playerShell");
    if (document.fullscreenElement) document.exitFullscreen();
    else shell.requestFullscreen?.();
  };
  $$(".tab").forEach((t) => t.onclick = () => {
    $$(".tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    $("#tabEpisodes").hidden = t.dataset.tab !== "episodes";
    $("#tabSeasons").hidden = t.dataset.tab !== "seasons";
    $("#tabAbout").hidden = t.dataset.tab !== "about";
  });
  $("#srcBtn").onclick = cycleProvider;
  $("#seasonSelect").addEventListener("change", (e) => {
    if (!state.watch) return;
    state.watch.season = Number(e.target.value);
    loadEpisodes(state.watch.id, state.watch.season);
  });
  $("#autoplayNext").textContent = `Autoplay next: ${CONFIG.autoplay ? "ON" : "OFF"} (N)`;
  $("#autoplayNext").onclick = () => {
    CONFIG.autoplay = !CONFIG.autoplay;
    STORE.set("af_autoplay", CONFIG.autoplay);
    $("#autoplayNext").textContent = `Autoplay next: ${CONFIG.autoplay ? "ON" : "OFF"} (N)`;
  };
  $("#cwClear").onclick = () => { STORE.set("af_continue", []); renderContinueRow(); toast("History cleared"); };
  $("#srcBtnPlayer").onclick = cycleProvider;
  $("#markWatched").onclick = () => {
    if (!state.watch) { toast("Open something to watch first"); return; }
    const key = `af_watched_${state.watch.id}`;
    const w = STORE.get(key, {});
    w[state.watch.episode] = Date.now();
    STORE.set(key, w);
    $$("#epList .ep-item").forEach((el) => {
      if (Number(el.dataset.e) === state.watch.episode) el.classList.add("watched");
    });
    toast("Marked as watched ✓");
  };
  $("#keyBtn").onclick = openKeyModal;
  $("#brand").onclick = (e) => { e.preventDefault(); closeWatch(); closeSearch(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  $("#navLinks").addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    $$("#navLinks a").forEach((x) => x.classList.remove("active"));
    a.classList.add("active");
  });
}

function catalogItem(cardEl) {
  if (!cardEl) return null;
  const rail = cardEl.closest(".rail");
  const sec = rail && state.catalog.find((s) => s.key === rail.dataset.key);
  if (!sec) return null;
  return sec.items.find((i) => String(i.id) === cardEl.dataset.id) || null;
}

function closeWatch() {
  $("#playerFrame").src = "about:blank";
  $("#watch").hidden = true;
  $("#playerTopbar").hidden = true;
  clearInterval(cwTimer);
  document.body.style.overflow = "";
  renderContinueRow();
}

/* ---------------- init ---------------- */
bindRailNav();
bindEvents();
watchPosterErrors();
renderContinueRow();
boot();
