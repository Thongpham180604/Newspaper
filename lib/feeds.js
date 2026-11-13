// Fetch and parse RSS 2.0 / RDF (RSS 1.0) / Atom feeds into plain items.
const { XMLParser } = require('fast-xml-parser');
const crypto = require('crypto');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  removeNSPrefix: false,
  processEntities: true,
  htmlEntities: true,
});

const UA = 'Mozilla/5.0 (compatible; NewspaperDigestBot/1.0; personal news reader)';

function arr(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }
function text(x) {
  if (x == null) return '';
  if (typeof x === 'string' || typeof x === 'number') return String(x);
  if (Array.isArray(x)) return text(x[0]);
  if (typeof x === 'object') return text(x['#text'] ?? x['@href'] ?? '');
  return '';
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
function stripHtml(s) {
  return decode(String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}
function clip(s, n) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 20)).trim() + '…';
}
function firstImg(html) {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(String(html || ''));
  return m ? decode(m[1]) : '';
}
function pickImage(it, rawDesc) {
  const cands = [
    ...arr(it['media:content']).filter((m) => !m['@medium'] || m['@medium'] === 'image').map((m) => m['@url']),
    ...arr(it['media:group']).flatMap((g) => arr(g['media:content']).map((m) => m['@url'])),
    ...arr(it['media:thumbnail']).map((m) => m['@url']),
    ...arr(it.enclosure).filter((e) => /^image\//.test(e['@type'] || 'image/')).map((e) => e['@url']),
    firstImg(rawDesc),
    firstImg(text(it['content:encoded'])),
  ];
  const url = cands.find((u) => typeof u === 'string' && /^https?:\/\//.test(u));
  return url || '';
}
function toISO(d) {
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
}
function idFor(link) {
  return crypto.createHash('sha1').update(link.replace(/[?#].*$/, '')).digest('hex').slice(0, 12);
}

function parseFeed(xml) {
  const doc = parser.parse(xml);
  let entries = [];
  if (doc.rss) entries = arr(doc.rss.channel?.item);
  else if (doc['rdf:RDF']) entries = arr(doc['rdf:RDF'].item);
  else if (doc.feed) entries = arr(doc.feed.entry);
  return entries.map((it) => {
    const rawDesc = text(it.description ?? it.summary ?? it.content ?? '');
    let link = text(it.link);
    if (Array.isArray(it.link)) {
      const alt = it.link.find((l) => !l['@rel'] || l['@rel'] === 'alternate');
      link = text(alt || it.link[0]);
    } else if (it.link && typeof it.link === 'object' && it.link['@href']) link = it.link['@href'];
    if (!link) link = text(it.guid);
    return {
      title: stripHtml(text(it.title)),
      summary: clip(stripHtml(rawDesc), 320),
      link: link.trim(),
      published: toISO(text(it.pubDate ?? it['dc:date'] ?? it.published ?? it.updated ?? '')),
      image: pickImage(it, rawDesc),
    };
  }).filter((x) => x.title && /^https?:\/\//.test(x.link));
}

async function fetchFeed(feed, { timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml).map((x) => ({
      id: idFor(x.link),
      c: feed.country,
      t: feed.topic,
      s: feed.source,
      l: feed.lang,
      u: x.link,
      p: x.published,
      img: x.image,
      ti: x.title,
      su: x.summary === x.title ? '' : x.summary,
    }));
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchFeed, parseFeed, stripHtml };
