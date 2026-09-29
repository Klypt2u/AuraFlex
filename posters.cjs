// Server-cached poster art for demo mode + an optional fetch script.
// These are public TMDB image URLs (image.tmdb.org serves them without an API key).

const POSTERS = {
  27205: "https://image.tmdb.org/t/p/w500/9gk7fsG6fn6NsRwe3Zf7cN3vS6t.jpg", // Inception
  155:   "https://image.tmdb.org/t/p/w500/qJ2tW6WMCDuxB9MAnuMf6zj7fGt.jpg", // The Dark Knight
  1396:  "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",  // Breaking Bad
  1399:  "https://image.tmdb.org/t/p/w500/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg", // Game of Thrones
  157336:"https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", // Interstellar
  76479: "https://image.tmdb.org/t/p/w500/11sttTM5VUsVdm7nyAyJKbIF4Bn.jpg", // The Boys
  680:   "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg", // Pulp Fiction
  94605: "https://image.tmdb.org/t/p/w500/fqldf2tOzgcqS6fXqplXG1ysgKX.jpg", // Arcane
  550:   "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg", // Fight Club
  1556:  "https://image.tmdb.org/t/p/w500/5AtaI5Z5a7nnWnt5uFoXvUEafen.jpg", // Severance
  24428: "https://image.tmdb.org/t/p/w500/RW0WdgkSqz566666666666.jpg",      // The Avengers
  278:   "https://image.tmdb.org/t/p/w500/9O1Iy9od7uEGor5EKfbJ8QYSnZ8.jpg", // Shawshank
};

const BACKDROPS = {
  27205: "https://image.tmdb.org/t/p/w1280/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
  155:   "https://image.tmdb.org/t/p/w1280/nMKdUUepR0i5zn0y1T4CsSB5chy.jpg",
  1396:  "https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
  1399:  "https://image.tmdb.org/t/p/w1280/suopoADq0k8YZr4mQ3L0VoPYmTy.jpg",
  157336:"https://image.tmdb.org/t/p/w1280/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
  76479: "https://image.tmdb.org/t/p/w1280/m0gWg7S7VOCnW9UnPfx5bSur4Mx.jpg",
  680:   "https://image.tmdb.org/t/p/w1280/4cDFJr4HP4hdcU2mNa1YXlEA9Jh.jpg",
  94605: "https://image.tmdb.org/t/p/w1280/6TScqig0Zxq640z0xr5Z0l2XlYv.jpg",
  550:   "https://image.tmdb.org/t/p/w1280/hZkgoQYus5vegHoetLkCJzb17zJ.jpg",
  1556:  "https://image.tmdb.org/t/p/w1280/8aRnCvS8pG6QO5lM8gHsTQeRl9Y.jpg",
  24428: "https://image.tmdb.org/t/p/w1280/9BBToToAPrUYaV6Sy6UqIH45rc2.jpg",
  278:   "https://image.tmdb.org/t/p/w1280/dqK9Hag1054tghRQSqLSfrkvQnA.jpg",
};

// Optional download helper — not used by the site.
if (typeof require !== "undefined" && require.main === module) {
  const fs = require("fs");
  const https = require("https");
  const map = { ...POSTERS, ...BACKDROPS };
  fs.mkdirSync("posters", { recursive: true });
  fs.mkdirSync("backdrops", { recursive: true });
  let done = 0;
  const total = Object.keys(map).length;
  for (const [id, url] of Object.entries(map)) {
    const isBackdrop = BACKDROPS[id] === url;
    const local = isBackdrop ? `backdrops/${id}.jpg` : `posters/${id}.jpg`;
    https.get(url, (res) => {
      if (res.statusCode !== 200) { console.error(`FAIL ${res.statusCode} ${url}`); if (++done === total) console.log("done"); return; }
      const file = fs.createWriteStream(local);
      res.pipe(file);
      file.on("finish", () => { file.close(); if (++done === total) console.log(`done: ${total} images`); });
    }).on("error", (e) => { console.error("ERR", url, e.message); if (++done === total) console.log("done"); });
  }
}

module.exports = { POSTERS, BACKDROPS };
