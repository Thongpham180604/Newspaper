(function () {
  'use strict';

  var I18N = {
    vi: {
      brand: 'Nhật Báo Thế Giới', tagline: 'Tin tức mỗi ngày từ 12 quốc gia · Song ngữ Việt – Anh',
      skip: 'Bỏ qua tới nội dung', edition: 'Số báo', searchPh: 'Tìm tin…', home: 'Trang chủ',
      top: 'Tiêu điểm', byCountry: 'Tin từng nước', more: 'Xem thêm →', all: 'Tất cả',
      readOrig: 'Đọc bài gốc ↗', items: 'tin', noItems: 'Chưa có tin cho mục này trong số báo này.',
      searchTitle: 'Kết quả tìm kiếm', searchAll: 'Tìm trong mọi số báo', searching: 'Đang tìm…',
      results: 'kết quả cho', sources: 'Nguồn', updated: 'Cập nhật lúc', archiveDays: 'số báo trong kho lưu trữ',
      original: 'Bản gốc', machine: 'Dịch máy', latest: 'Mới nhất',
      notTranslated: 'Một số tin chưa có bản dịch nên đang hiển thị ngôn ngữ gốc.',
      about: 'Trang tổng hợp cá nhân. Tiêu đề và tóm tắt lấy từ RSS chính thức của từng tờ báo, kèm đường dẫn tới bài gốc. Bản dịch (nếu có) là dịch máy, hãy đối chiếu với bài gốc.',
      ago: { m: ' phút trước', h: ' giờ trước', now: 'Vừa xong' },
      langs: { vi: 'tiếng Việt', en: 'tiếng Anh', ja: 'tiếng Nhật', de: 'tiếng Đức', fr: 'tiếng Pháp', zh: 'tiếng Trung', ko: 'tiếng Hàn', ru: 'tiếng Nga' }
    },
    en: {
      brand: 'The World Daily', tagline: 'Daily news from 12 countries · Vietnamese – English',
      skip: 'Skip to content', edition: 'Edition', searchPh: 'Search news…', home: 'Home',
      top: 'Top stories', byCountry: 'Around the world', more: 'More →', all: 'All',
      readOrig: 'Read original ↗', items: 'stories', noItems: 'No stories for this section in this edition.',
      searchTitle: 'Search results', searchAll: 'Search all editions', searching: 'Searching…',
      results: 'results for', sources: 'Sources', updated: 'Updated', archiveDays: 'editions in the archive',
      original: 'Original', machine: 'Machine translated', latest: 'Latest',
      notTranslated: 'Some stories have no translation yet and are shown in their original language.',
      about: 'A personal news digest. Headlines and summaries come from each outlet’s official RSS feed, with links to the original articles. Translations, when shown, are machine-made; check the original.',
      ago: { m: ' min ago', h: ' h ago', now: 'Just now' },
      langs: { vi: 'Vietnamese', en: 'English', ja: 'Japanese', de: 'German', fr: 'French', zh: 'Chinese', ko: 'Korean', ru: 'Russian' }
    }
  };

  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  var NEWS = window.__NEWS__ || null;
  var state = { lang: store.get('lang') || 'vi', date: null, route: [], q: '' };
  var dayCache = {};
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var T = function (k) { return I18N[state.lang][k]; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function countries() { return NEWS.index.countries; }
  function topics() { return NEWS.index.topics; }
  function cName(code) { var c = countries().find(function (x) { return x.code === code; }); return c ? c[state.lang] : code; }
  function cFlag(code) { var c = countries().find(function (x) { return x.code === code; }); return c ? c.flag : ''; }
  function tName(code) { var t = topics().find(function (x) { return x.code === code; }); return t ? t[state.lang] : code; }

  // text of an item in the current language, falling back to the original
  function view(it) {
    var L = state.lang;
    if (it.l === L) return { ti: it.ti, su: it.su, orig: false };
    var tr = it.tr && it.tr[L];
    if (tr && tr.ti) return { ti: tr.ti, su: tr.su, orig: false, machine: true };
    return { ti: it.ti, su: it.su, orig: true };
  }

  function ago(iso) {
    if (!iso) return '';
    var d = new Date(iso), diff = (Date.now() - d) / 60000, a = T('ago');
    if (diff >= 0 && diff < 1) return a.now;
    if (diff >= 0 && diff < 60) return Math.round(diff) + a.m;
    if (diff >= 0 && diff < 24 * 60) return Math.round(diff / 60) + a.h;
    return d.toLocaleString(state.lang === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(ymd, opts) {
    var p = ymd.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(state.lang === 'vi' ? 'vi-VN' : 'en-GB', opts || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function loadIndex() {
    if (NEWS) return Promise.resolve();
    return fetch('data/index.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (index) { NEWS = { index: index, days: {} }; });
  }
  function loadDay(date) {
    if (dayCache[date]) return Promise.resolve(dayCache[date]);
    if (NEWS.days && NEWS.days[date]) { dayCache[date] = NEWS.days[date]; return Promise.resolve(dayCache[date]); }
    return fetch('data/days/' + date + '.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { dayCache[date] = d; return d; })
      .catch(function () { dayCache[date] = { date: date, items: [] }; return dayCache[date]; });
  }

  // ---------- rendering atoms ----------
  function img(it, cls) {
    if (!it.img) return '';
    return '<img class="thumb ' + (cls || '') + '" src="' + esc(it.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="var r=this.closest('.row');if(r)r.classList.add('noimg');this.remove()">';
  }
  function badges(it, v) {
    var b = '';
    if (v.orig && it.l !== state.lang) b += '<span class="badge">' + esc(T('original')) + ': ' + esc(T('langs')[it.l] || it.l) + '</span>';
    if (v.machine) b += '<span class="badge">' + esc(T('machine')) + '</span>';
    return b;
  }
  function meta(it, v) {
    return '<div class="meta"><span>' + esc(it.s) + '</span><span>·</span><span>' + esc(ago(it.p || it.f)) + '</span>' + badges(it, v) + '</div>';
  }
  function kicker(it, withCountry) {
    return '<div class="kicker">' + (withCountry ? esc(cFlag(it.c) + ' ' + cName(it.c)) + ' · ' : '') + esc(tName(it.t)) + '</div>';
  }
  function story(it, o) {
    o = o || {};
    var v = view(it);
    return '<a class="story ' + (o.cls || '') + '" href="' + esc(it.u) + '" target="_blank" rel="noopener" lang="' + (v.orig ? esc(it.l) : state.lang) + '">' +
      (o.image ? img(it) : '') + kicker(it, o.country !== false) +
      '<h3 class="h">' + hl(v.ti) + '</h3>' + (o.dek && v.su ? '<p class="dek">' + hl(v.su) + '</p>' : '') + meta(it, v) + '</a>';
  }
  function row(it) {
    var v = view(it);
    return '<a class="row' + (it.img ? '' : ' noimg') + '" href="' + esc(it.u) + '" target="_blank" rel="noopener">' + (it.img ? img(it) : '') +
      '<div>' + kicker(it, true) + '<h3 class="h">' + hl(v.ti) + '</h3>' + (v.su ? '<p class="dek">' + hl(v.su) + '</p>' : '') + meta(it, v) + '</div></a>';
  }
  var hlRe = null;
  function hl(s) {
    var e = esc(s);
    return hlRe ? e.replace(hlRe, '<mark>$1</mark>') : e;
  }
  function section(title, moreHref, body) {
    return '<section class="sec"><div class="sec-h"><h2>' + esc(title) + '</h2>' + (moreHref ? '<a class="more" href="' + moreHref + '">' + esc(T('more')) + '</a>' : '') + '</div>' + body + '</section>';
  }
  function hrefFor(path) { return '#/' + path + (state.date && state.date !== latestDate() ? '?d=' + state.date : ''); }
  function latestDate() { return NEWS.index.days.length ? NEWS.index.days[0].date : null; }

  // pick a varied set: at most `perCountry` per country, prefer items with images
  function diverse(items, n, perCountry, needImg) {
    var seen = {}, out = [];
    for (var i = 0; i < items.length && out.length < n; i++) {
      var it = items[i];
      if (needImg && !it.img) continue;
      if ((seen[it.c] || 0) >= perCountry) continue;
      seen[it.c] = (seen[it.c] || 0) + 1;
      out.push(it);
    }
    return out;
  }

  // ---------- pages ----------
  function pageHome(day) {
    var items = day.items;
    if (!items.length) return '<p class="empty">' + esc(T('noItems')) + '</p>';
    var newsFirst = items.filter(function (x) { return x.t === 'news' || x.t === 'world'; }).concat(items.filter(function (x) { return x.t !== 'news' && x.t !== 'world'; }));
    var lead = diverse(newsFirst, 1, 1, true)[0] || newsFirst[0];
    var used = {}; used[lead.id] = 1;
    var side = diverse(newsFirst.filter(function (x) { return x.c !== lead.c; }), 5, 1, false);
    side.forEach(function (x) { used[x.id] = 1; });
    var h = '<div class="lead-grid"><div class="lead">' + story(lead, { image: true, dek: true }) + '</div><div class="side">' +
      side.map(function (x) { return story(x, { dek: false }); }).join('') + '</div></div>';

    var cards = countries().map(function (c) {
      var list = items.filter(function (x) { return x.c === c.code && !used[x.id]; });
      if (!list.length) return '';
      var top = list.find(function (x) { return x.img; }) || list[0];
      var rest = list.filter(function (x) { return x !== top; }).slice(0, 3);
      return '<div class="country-card"><div class="cc-h"><a href="' + hrefFor('c/' + c.code) + '">' + esc(c.flag + ' ' + c[state.lang]) + '</a><span class="n">' + list.length + ' ' + esc(T('items')) + '</span></div>' +
        '<div class="top">' + story(top, { image: true, country: false }) + '</div><ul>' +
        rest.map(function (x) { var v = view(x); return '<li><a href="' + esc(x.u) + '" target="_blank" rel="noopener"><p class="h">' + esc(v.ti) + '</p></a><div class="meta"><span>' + esc(x.s) + '</span>' + badges(x, v) + '</div></li>'; }).join('') +
        '</ul></div>';
    }).join('');
    h += section(T('byCountry'), null, '<div class="grid-3">' + cards + '</div>');

    topics().forEach(function (t) {
      if (t.code === 'news') return;
      var list = diverse(items.filter(function (x) { return x.t === t.code; }), 4, 1, false);
      if (!list.length) return;
      h += section(t[state.lang], hrefFor('t/' + t.code), '<div class="grid">' + list.map(function (x) { return story(x, { image: true }); }).join('') + '</div>');
    });
    return h;
  }

  function chips(all, active, param) {
    return '<div class="chips">' + all.map(function (o) {
      return '<button class="chip' + (o.code === active ? ' on' : '') + '" data-' + param + '="' + o.code + '">' + esc(o.label) + '</button>';
    }).join('') + '</div>';
  }

  function pageCountry(day, code, sub) {
    var c = countries().find(function (x) { return x.code === code; });
    if (!c) return '<p class="empty">404</p>';
    var all = day.items.filter(function (x) { return x.c === code; });
    var present = topics().filter(function (t) { return all.some(function (x) { return x.t === t.code; }); });
    var list = sub ? all.filter(function (x) { return x.t === sub; }) : all;
    var srcs = Array.from(new Set(all.map(function (x) { return x.s; })));
    return '<div class="page-h"><h1>' + esc(c.flag + ' ' + c[state.lang]) + '</h1><p>' + all.length + ' ' + esc(T('items')) + ' · ' + esc(fmtDate(day.date)) + '</p></div>' +
      chips([{ code: '', label: T('all') }].concat(present.map(function (t) { return { code: t.code, label: t[state.lang] }; })), sub || '', 'sub') +
      transNotice(list) +
      (list.length ? '<div class="list">' + list.map(row).join('') + '</div>' : '<p class="empty">' + esc(T('noItems')) + '</p>') +
      (srcs.length ? '<p class="sources">' + esc(T('sources')) + ': ' + esc(srcs.join(' · ')) + '</p>' : '');
  }

  function pageTopic(day, code, sub) {
    var t = topics().find(function (x) { return x.code === code; });
    if (!t) return '<p class="empty">404</p>';
    var all = day.items.filter(function (x) { return x.t === code; });
    var present = countries().filter(function (c) { return all.some(function (x) { return x.c === c.code; }); });
    var list = sub ? all.filter(function (x) { return x.c === sub; }) : all;
    return '<div class="page-h"><h1>' + esc(t[state.lang]) + '</h1><p>' + all.length + ' ' + esc(T('items')) + ' · ' + esc(fmtDate(day.date)) + '</p></div>' +
      chips([{ code: '', label: T('all') }].concat(present.map(function (c) { return { code: c.code, label: c.flag + ' ' + c[state.lang] }; })), sub || '', 'sub') +
      transNotice(list) +
      (list.length ? '<div class="list">' + list.map(row).join('') + '</div>' : '<p class="empty">' + esc(T('noItems')) + '</p>');
  }

  function transNotice(list) {
    var anyOrig = list.some(function (x) { return view(x).orig && x.l !== state.lang; });
    return anyOrig ? '<p class="notice">' + esc(T('notTranslated')) + '</p>' : '';
  }

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'); }
  function matches(it, terms) {
    var hay = norm([it.ti, it.su, it.s, it.tr && it.tr.vi && it.tr.vi.ti, it.tr && it.tr.vi && it.tr.vi.su, it.tr && it.tr.en && it.tr.en.ti, it.tr && it.tr.en && it.tr.en.su].join(' '));
    return terms.every(function (t) { return hay.indexOf(t) >= 0; });
  }
  function pageSearch(q, everywhere) {
    var terms = norm(q).split(/\s+/).filter(Boolean);
    var dates = everywhere ? NEWS.index.days.map(function (d) { return d.date; }) : [state.date];
    return Promise.all(dates.map(loadDay)).then(function (days) {
      var res = [];
      days.forEach(function (d) { d.items.forEach(function (it) { if (terms.length && matches(it, terms)) res.push(it); }); });
      var safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split(/\s+/).filter(Boolean);
      hlRe = safe.length ? new RegExp('(' + safe.join('|') + ')', 'gi') : null;
      var h = '<div class="page-h"><h1>' + esc(T('searchTitle')) + '</h1><p>' + res.length + ' ' + esc(T('results')) + ' “' + esc(q) + '”' +
        (everywhere ? '' : ' · ' + esc(fmtDate(state.date))) + '</p></div>' +
        (everywhere ? '' : '<div class="chips"><button class="chip" id="searchAll">' + esc(T('searchAll')) + '</button></div>') +
        (res.length ? '<div class="list">' + res.slice(0, 300).map(row).join('') + '</div>' : '<p class="empty">' + esc(T('noItems')) + '</p>');
      var out = h; hlRe = null; return out;
    });
  }

  // ---------- chrome ----------
  function renderChrome() {
    document.documentElement.lang = state.lang;
    document.title = T('brand') + (state.lang === 'vi' ? ' · The World Daily' : ' · Nhật Báo Thế Giới');
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = T(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.placeholder = T(el.getAttribute('data-i18n-ph')); });
    document.querySelectorAll('.lang button').forEach(function (b) { b.classList.toggle('on', b.dataset.lang === state.lang); b.setAttribute('aria-pressed', b.dataset.lang === state.lang); });
    $('#today').textContent = fmtDate(state.date);
    var r = state.route;
    $('#countryNav').innerHTML = '<a href="' + hrefFor('') + '" class="' + (!r[0] ? 'on' : '') + '">' + esc(T('home')) + '</a>' +
      countries().map(function (c) { return '<a href="' + hrefFor('c/' + c.code) + '" class="' + (r[0] === 'c' && r[1] === c.code ? 'on' : '') + '">' + esc(c.flag + ' ' + c[state.lang]) + '</a>'; }).join('');
    $('#topicNav').innerHTML = topics().map(function (t) { return '<a href="' + hrefFor('t/' + t.code) + '" class="' + (r[0] === 't' && r[1] === t.code ? 'on' : '') + '">' + esc(t[state.lang]) + '</a>'; }).join('');
    var sel = $('#daySel');
    sel.innerHTML = NEWS.index.days.map(function (d) { return '<option value="' + d.date + '"' + (d.date === state.date ? ' selected' : '') + '>' + esc(fmtDate(d.date, { day: '2-digit', month: '2-digit', year: 'numeric' })) + (d.date === latestDate() ? ' · ' + esc(T('latest')) : '') + '</option>'; }).join('');
    var dd = NEWS.index.days.find(function (d) { return d.date === state.date; });
    $('#footMeta').textContent = (dd && dd.updated ? T('updated') + ' ' + new Date(dd.updated).toLocaleString(state.lang === 'vi' ? 'vi-VN' : 'en-GB') + ' · ' : '') + NEWS.index.days.length + ' ' + T('archiveDays');
  }

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, ''), qi = h.indexOf('?'), params = {};
    if (qi >= 0) { h.slice(qi + 1).split('&').forEach(function (kv) { var p = kv.split('='); params[p[0]] = decodeURIComponent(p[1] || ''); }); h = h.slice(0, qi); }
    var days = NEWS.index.days.map(function (d) { return d.date; });
    state.date = days.indexOf(params.d) >= 0 ? params.d : latestDate();
    state.route = h.split('/').filter(Boolean).map(decodeURIComponent);
    state.sub = params.sub || '';
    state.all = params.all === '1';
  }

  function render() {
    parseHash();
    renderChrome();
    var main = $('#main');
    if (!state.date) { main.innerHTML = '<p class="empty">' + esc(T('noItems')) + '</p>'; return; }
    var r = state.route;
    if (r[0] === 's') {
      $('#q').value = r[1] || '';
      main.innerHTML = '<p class="loading">' + esc(T('searching')) + '</p>';
      return pageSearch(r[1] || '', state.all).then(function (h) { main.innerHTML = h; });
    }
    return loadDay(state.date).then(function (day) {
      main.innerHTML = r[0] === 'c' ? pageCountry(day, r[1], state.sub) : r[0] === 't' ? pageTopic(day, r[1], state.sub) : pageHome(day);
    });
  }

  function setHash(path, params) {
    var q = [];
    if (state.date && state.date !== latestDate()) q.push('d=' + state.date);
    Object.keys(params || {}).forEach(function (k) { if (params[k]) q.push(k + '=' + encodeURIComponent(params[k])); });
    location.hash = '#/' + path + (q.length ? '?' + q.join('&') : '');
  }

  function bind() {
    window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.addEventListener('click', function () { state.lang = b.dataset.lang; store.set('lang', state.lang); render(); });
    });
    $('#daySel').addEventListener('change', function (e) {
      state.date = e.target.value;
      setHash(state.route.filter(function (x, i) { return state.route[0] !== 's' || i < 2; }).join('/'), {});
    });
    $('#searchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('#q').value.trim();
      if (q) setHash('s/' + encodeURIComponent(q), {});
    });
    $('#main').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip[data-sub]');
      if (chip) { setHash(state.route.join('/'), { sub: chip.dataset.sub }); return; }
      if (e.target.id === 'searchAll') setHash(state.route.map(encodeURIComponent).join('/'), { all: '1' });
    });
    var themeBtn = $('#themeBtn');
    var saved = store.get('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    themeBtn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store.set('theme', next);
    });
  }

  loadIndex().then(function () { bind(); render(); }).catch(function (err) {
    $('#main').innerHTML = '<p class="empty">Không tải được dữ liệu / Could not load data (' + esc(err.message) + ')</p>';
  });
})();
