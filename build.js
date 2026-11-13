#!/usr/bin/env node
// Build the newspaper:
//   1. fetch every feed in sources.json (skip with --no-fetch)
//   2. merge into data/days/<YYYY-MM-DD>.json (Vietnam time) — past days are kept as the archive
//   3. optionally translate (ANTHROPIC_API_KEY)
//   4. write data/index.json and a standalone dist/index.html (CSS, JS and recent days inlined)
// Then run `node split/split.js` to produce the multi-file site in public/.
const fs = require('fs');
const path = require('path');
const { fetchFeed } = require('./lib/feeds');
const { refineTopic } = require('./lib/classify');
const { translateItems } = require('./lib/translate');

const ROOT = __dirname;
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const DAYS = path.join(DATA, 'days');
const DIST = path.join(ROOT, 'dist');
const args = new Set(process.argv.slice(2));
const INLINE_DAYS = +(process.env.INLINE_DAYS || 7);
const PER_FEED = +(process.env.PER_FEED || 20);
const TZ = 'Asia/Ho_Chi_Minh';

const sources = JSON.parse(fs.readFileSync(process.env.SOURCES_FILE || path.join(ROOT, 'sources.json'), 'utf8'));

function today() {
  if (process.env.BUILD_DATE) return process.env.BUILD_DATE;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function readJSON(f, fallback) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; }
}
function writeJSON(f, obj) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(obj));
}

async function pool(list, n, fn) {
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < list.length) { const k = i++; out[k] = await fn(list[k], k); }
  }));
  return out;
}

async function fetchAll(date) {
  const file = path.join(DAYS, `${date}.json`);
  const day = readJSON(file, { date, items: [], feeds: [] });
  const known = new Set();
  // links already stored on earlier days are not repeated as "new" today
  for (const f of fs.existsSync(DAYS) ? fs.readdirSync(DAYS) : []) {
    if (!f.endsWith('.json') || f === `${date}.json`) continue;
    for (const it of readJSON(path.join(DAYS, f), { items: [] }).items) known.add(it.id);
  }
  const byId = new Map(day.items.map((x) => [x.id, x]));
  const status = [];
  await pool(sources.feeds, 8, async (feed) => {
    const t0 = Date.now();
    try {
      const items = (await fetchFeed(feed)).slice(0, PER_FEED);
      let added = 0;
      for (const it of items) {
        if (known.has(it.id) || byId.has(it.id)) continue;
        it.t = refineTopic(it);
        it.f = new Date().toISOString();
        byId.set(it.id, it);
        added++;
      }
      status.push({ url: feed.url, source: feed.source, ok: true, n: items.length, added, ms: Date.now() - t0 });
      console.log(`ok   ${feed.country} ${feed.source} [${feed.topic}] ${items.length} (+${added})`);
    } catch (err) {
      status.push({ url: feed.url, source: feed.source, ok: false, error: String(err.message || err) });
      console.log(`FAIL ${feed.country} ${feed.source} [${feed.topic}] ${feed.url}: ${err.message || err}`);
    }
  });
  day.items = [...byId.values()].sort((a, b) => (b.p || b.f).localeCompare(a.p || a.f));
  day.feeds = status;
  day.updated = new Date().toISOString();
  return { day, file };
}

function validateDay(day) {
  const codes = new Set(sources.countries.map((c) => c.code));
  const topics = new Set(sources.topics.map((t) => t.code));
  const problems = [];
  const ids = new Set();
  for (const it of day.items) {
    if (!it.id || ids.has(it.id)) problems.push(`duplicate/missing id ${it.id}`);
    ids.add(it.id);
    if (!codes.has(it.c)) problems.push(`${it.id}: bad country ${it.c}`);
    if (!topics.has(it.t)) problems.push(`${it.id}: bad topic ${it.t}`);
    if (!it.ti) problems.push(`${it.id}: empty title`);
    if (!/^https?:\/\//.test(it.u)) problems.push(`${it.id}: bad url`);
    if (it.tr) for (const l of ['vi', 'en']) if (it.tr[l] && !it.tr[l].ti) problems.push(`${it.id}: empty ${l} title`);
  }
  return problems;
}

function buildIndex() {
  const files = (fs.existsSync(DAYS) ? fs.readdirSync(DAYS) : []).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
  const days = files.map((f) => {
    const d = readJSON(path.join(DAYS, f), { items: [] });
    const counts = {};
    for (const it of d.items) counts[it.c] = (counts[it.c] || 0) + 1;
    return { date: f.slice(0, 10), n: d.items.length, counts, updated: d.updated };
  });
  const index = { generated: new Date().toISOString(), countries: sources.countries, topics: sources.topics, days };
  writeJSON(path.join(DATA, 'index.json'), index);
  return index;
}

function renderStandalone(index) {
  const tpl = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'src', 'style.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  new (require('vm').Script)(js, { filename: 'src/app.js' }); // fail the build on a syntax error
  const inline = {};
  for (const d of index.days.slice(0, INLINE_DAYS)) inline[d.date] = readJSON(path.join(DAYS, `${d.date}.json`), null);
  for (const day of Object.values(inline)) if (day) delete day.feeds;
  const data = JSON.stringify({ index, days: inline }).replace(/</g, '\\u003c');
  const html = tpl
    .replace('/*__CSS__*/', () => css)
    .replace('/*__DATA__*/', () => `window.__NEWS__=${data};`)
    .replace('/*__JS__*/', () => js);
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, 'index.html'), html);
  return Buffer.byteLength(html);
}

(async () => {
  const date = today();
  console.log(`build ${date}${args.has('--no-fetch') ? ' (no fetch)' : ''}`);
  if (!args.has('--no-fetch')) {
    const { day, file } = await fetchAll(date);
    await translateItems(day.items);
    const problems = validateDay(day);
    if (problems.length) {
      console.log(`validate: ${problems.length} problem(s)\n  ` + problems.slice(0, 20).join('\n  '));
      const bad = new Set(problems.map((p) => p.split(':')[0]));
      day.items = day.items.filter((it) => !bad.has(it.id));
    }
    writeJSON(file, day);
    const ok = day.feeds.filter((f) => f.ok).length;
    console.log(`feeds ok ${ok}/${day.feeds.length}, items today ${day.items.length}`);
  }
  const index = buildIndex();
  const bytes = renderStandalone(index);
  console.log(`dist/index.html ${(bytes / 1048576).toFixed(2)} MB, ${index.days.length} day(s) in archive`);
  if (bytes > 15.5 * 1048576) console.log('WARNING: standalone page is close to the 16 MB artifact limit; lower INLINE_DAYS');
})().catch((err) => { console.error(err); process.exit(1); });
