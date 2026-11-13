#!/usr/bin/env node
// Split dist/index.html (standalone, everything inlined) into a multi-file site in public/:
//   public/index.html, public/assets/style.css, public/assets/app.js,
//   public/data/index.json, public/data/days/<date>.json  (all days → full archive)
// The page then loads each day's JSON on demand, so the archive can grow without bloating the page.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const SRC = path.join(ROOT, 'dist', 'index.html');
const OUT = path.join(ROOT, 'public');

const html = fs.readFileSync(SRC, 'utf8');
const grab = (id, tag) => {
  const re = new RegExp(`<${tag} id="${id}">([\\s\\S]*?)</${tag}>`);
  const m = re.exec(html);
  if (!m) throw new Error(`split: #${id} not found in dist/index.html`);
  return m;
};
const css = grab('app-css', 'style');
const js = grab('app-js', 'script');
const data = grab('app-data', 'script');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'data', 'days'), { recursive: true });

fs.writeFileSync(path.join(OUT, 'assets', 'style.css'), css[1]);
fs.writeFileSync(path.join(OUT, 'assets', 'app.js'), js[1]);
const page = html
  .replace(css[0], () => '<link rel="stylesheet" href="assets/style.css">')
  .replace(data[0], () => '')
  .replace(js[0], () => '<script src="assets/app.js" defer></script>');
fs.writeFileSync(path.join(OUT, 'index.html'), page);

fs.copyFileSync(path.join(DATA, 'index.json'), path.join(OUT, 'data', 'index.json'));
let n = 0, bytes = 0;
for (const f of fs.readdirSync(path.join(DATA, 'days'))) {
  if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
  const day = JSON.parse(fs.readFileSync(path.join(DATA, 'days', f), 'utf8'));
  delete day.feeds; // feed health log stays in the repo only
  const s = JSON.stringify(day);
  fs.writeFileSync(path.join(OUT, 'data', 'days', f), s);
  n++; bytes += s.length;
}
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`public/: index.html + assets + ${n} day file(s), ${(bytes / 1048576).toFixed(2)} MB data`);
