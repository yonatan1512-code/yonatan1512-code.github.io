/* CourtMaster AI — core: helpers, icons, storage, router, toasts and dialogs.
   Every module adds itself to the global CM namespace (plain scripts, no build step). */
(function (CM) {
'use strict';

/* ---------- DOM and text ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = arr => arr.reduce((a, b) => a + b, 0);
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/* ---------- dates: calendar days at noon, so DST never shifts a day ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseYmd = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const weekStartOf = s => { const d = parseYmd(s || today()); d.setDate(d.getDate() - d.getDay()); return ymd(d); };
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const dow = s => parseYmd(s).getDay();
const fmtDate = s => { const d = parseYmd(s); return d.getDate() + '.' + (d.getMonth() + 1); };
const fmtDateLong = s => { const d = parseYmd(s); return 'יום ' + DAY_NAMES[d.getDay()] + ', ' + d.getDate() + ' ב' + MONTHS[d.getMonth()]; };
const fmtMonth = key => { const p = key.split('-'); return MONTHS[Number(p[1]) - 1] + ' ' + p[0]; };
function fmtMinutes(m) {
  m = Math.round(m);
  if (m < 60) return m + ' דק׳';
  const h = Math.floor(m / 60), r = m % 60;
  return (h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : h + ' שעות') + (r ? ' ו-' + r + ' דק׳' : '');
}
function fmtClock(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + pad(sec % 60); }
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
}
// a small deterministic random, so a day's workout looks the same every time it is opened
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

/* ---------- icons (24px line icons, one sprite) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5A2.5 2.5 0 0 1 6.5 19H20"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" stroke-width="2.6"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  gauge: '<path d="M3.5 17a9 9 0 1 1 17 0"/><path d="M12 17l4-6"/><circle cx="12" cy="17" r="1.6" fill="currentColor" stroke="none"/>',
  chart: '<path d="M3 21h18"/><path d="M6 17v-5M11 17V7M16 17v-8M21 17v-3"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4.5A2.5 2.5 0 0 0 7 10.5M17 6h2.5A2.5 2.5 0 0 1 17 10.5"/>',
  flag: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  ball: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5v19M5.3 5.3c3.2 3 3.2 10.4 0 13.4M18.7 5.3c-3.2 3-3.2 10.4 0 13.4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  bolt: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/>',
  up: '<path d="M12 20V5M6 11l6-6 6 6"/>',
  foot: '<path d="M8.5 3c2 0 3.2 2.2 3.2 5.2S10.4 13 8.6 13 5.6 11 5.6 8.2 6.6 3 8.5 3zM6.8 15.5h3.6v2.6a1.8 1.8 0 0 1-3.6 0zM15.5 7c1.6 0 2.6 1.8 2.6 4.2s-1 3.9-2.5 3.9-2.4-1.6-2.4-3.9S14 7 15.5 7zM14 17.5h3v2.1a1.5 1.5 0 0 1-3 0z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  next: '<path d="M15 6l-6 6 6 6"/>',
  prev: '<path d="M9 6l6 6-6 6"/>',
  arrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  flame: '<path d="M12 22c4 0 7-2.8 7-6.8 0-3.7-2.6-6.3-4.3-8.2-.3 2.2-1.4 3.6-2.7 4.2.3-3.3-1-6.4-3.6-8.7C8.6 6 5 9.6 5 15.2 5 19.2 8 22 12 22z"/>',
  timer: '<circle cx="12" cy="13.5" r="8"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5M12 2.5v3"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  skip: '<path d="M5 5l10 7-10 7z"/><path d="M19 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  sparkle: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  send: '<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l4 6M21 9l-4 6"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M8.5 3 10 9M15.5 3 14 9M9 3h6"/><path d="M12 12.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  more: '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  users: '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="7.5" r="3.5"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.3M15.5 4.2a3.5 3.5 0 0 1 0 6.6"/>',
  court: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  water: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  cone: '<path d="M8.5 19 12 4l3.5 15M5 19h14M9.6 14h4.8"/>',
  wall: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20"/>',
  hoop: '<rect x="4" y="3" width="16" height="9" rx="1"/><path d="M8 12h8M8.5 12l1.2 8M15.5 12l-1.2 8M10 16h4"/>',
  rope: '<path d="M6 4v5M18 4v5"/><path d="M6 9c0 7 3 11 6 11s6-4 6-11"/>',
  whistle: '<circle cx="9" cy="14" r="5"/><path d="M12.5 10.5 20 6v4l-6 2"/>',
  calcheck: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M9 15l2 2 4-4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>'
};
function icon(name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
function mountIcons() {
  if (document.getElementById('cm-sprite')) return;
  const div = document.createElement('div');
  div.innerHTML = '<svg id="cm-sprite" xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' +
    Object.keys(ICONS).map(k => '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + ICONS[k] + '</symbol>').join('') + '</svg>';
  document.body.prepend(div.firstChild);
}

/* ---------- storage: this browser always; the viewer's private claude.ai space when available ---------- */
const KEYS = {};
function defineKey(name, def, norm) { KEYS[name] = {def, norm: norm || (v => v)}; }
const LS = 'cm:';
const IN_CLAUDE = !!(window.claude && typeof window.claude.use === 'function');
function lsGet(k) { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(LS + k); } catch (e) {} }

const store = {
  mode: 'local', db: null, uid: null,
  data: {}, subs: {}, pending: {}, writing: {}, listeners: [],
  init() {
    Object.keys(KEYS).forEach(k => {
      let v = null;
      try { const raw = lsGet(k); v = raw == null ? null : KEYS[k].norm(raw); } catch (e) { v = null; }
      this.data[k] = v == null ? KEYS[k].def() : v;
    });
  },
  get(k) { return this.data[k]; },
  set(k, v) {
    this.data[k] = v;
    lsSet(k, v);
    this.emit(k);
    if (this.mode === 'cloud') { this.pending[k] = {val: v}; this.flush(k); }
  },
  update(k, fn) { const next = fn(clone(this.data[k])); this.set(k, next); return next; },
  on(k, fn) {
    (this.subs[k] = this.subs[k] || []).push(fn);
    return () => { this.subs[k] = (this.subs[k] || []).filter(f => f !== fn); };
  },
  emit(k) { (this.subs[k] || []).slice().forEach(fn => { try { fn(this.data[k]); } catch (e) { console.error(e); } }); },
  onMode(fn) { this.listeners.push(fn); },
  setMode(m) { this.mode = m; this.listeners.forEach(fn => { try { fn(m); } catch (e) {} }); },
  async flush(k) {
    if (this.writing[k]) return;
    this.writing[k] = true;
    try {
      while (this.pending[k] && this.mode === 'cloud') {
        const v = this.pending[k];
        this.pending[k] = null;
        const ref = this.db.doc('data/users/' + this.uid + '/cm-' + k);
        // a stored document must be a plain object, so every value is wrapped
        try { await ref.set({v: v.val}); }
        catch (err) {
          let ok = false;
          if (err && err.code === 'unavailable') {
            await new Promise(r => setTimeout(r, 600 + Math.random() * 900));
            try { await ref.set({v: v.val}); ok = true; } catch (e2) {}
          }
          if (!ok) { this.setMode('local'); break; }
        }
      }
    } finally { this.writing[k] = false; }
  },
  // erase everything (local and, when connected, the private cloud copy)
  async wipe() {
    for (const k of Object.keys(KEYS)) {
      lsDel(k);
      if (this.mode === 'cloud') { try { await this.db.doc('data/users/' + this.uid + '/cm-' + k).delete(); } catch (e) {} }
      this.data[k] = KEYS[k].def();
      this.emit(k);
    }
  }
};

async function connectCloud() {
  if (!IN_CLAUDE) return;
  let db = null, user = null;
  try { [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); } catch (e) { return; }
  if (!db || !user) return;
  let id = null;
  try { id = await user.id(); } catch (e) {}
  if (!id) return;
  store.db = db; store.uid = id;
  store.setMode('cloud');
  Object.keys(KEYS).forEach(k => {
    let settled = false;
    try {
      db.doc('data/users/' + id + '/cm-' + k).onSnapshot(snap => {
        if (snap.exists) {
          settled = true;
          let v = null;
          const body = snap.data();
          try { v = KEYS[k].norm(body ? body.v : null); } catch (e) { v = null; }
          if (v == null && k !== 'live') return;
          // our own write coming back: nothing changed
          if (JSON.stringify(v) === JSON.stringify(store.data[k])) return;
          store.data[k] = v;
          lsSet(k, v);
          store.emit(k);
        } else if (!settled && !(snap.metadata && snap.metadata.fromCache)) {
          settled = true;
          // nothing saved in the account yet: upload what this browser already has
          const local = store.data[k];
          if (JSON.stringify(local) !== JSON.stringify(KEYS[k].def())) { store.pending[k] = {val: local}; store.flush(k); }
        }
      }, () => store.setMode('local'));
    } catch (e) { store.setMode('local'); }
  });
}

/* ---------- router: #page or #page.param ---------- */
const routes = {};
let leaveFns = [];
function page(name, def) { routes[name] = def; }
function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, '')) || 'dashboard';
  const i = raw.indexOf('.');
  return i < 0 ? {name: raw, param: ''} : {name: raw.slice(0, i), param: raw.slice(i + 1)};
}
function go(name, param) { const h = '#' + name + (param ? '.' + param : ''); if (location.hash === h) render(); else location.hash = h; }
function render(opts) {
  const keep = !!(opts && opts.keep === true);
  leaveFns.forEach(f => { try { f(); } catch (e) {} });
  leaveFns = [];
  let {name, param} = parseHash();
  if (!routes[name]) { name = 'dashboard'; param = ''; }
  const prof = store.get('profile');
  if (prof && !prof.onboarded && name !== 'onboarding' && name !== 'account') { location.replace('#onboarding'); return; }
  const def = routes[name];
  // a fresh element each time, so listeners a page added last time are gone
  const old = $('#view');
  const view = old.cloneNode(false);
  old.replaceWith(view);
  const ctx = {
    param,
    watch(k, fn) { leaveFns.push(store.on(k, fn)); },
    onLeave(fn) { leaveFns.push(fn); },
    // redraw after a data change without jumping back to the top
    rerender: () => render({keep: true})
  };
  document.body.dataset.route = name;
  view.classList.remove('enter');
  if (!keep) { void view.offsetWidth; view.classList.add('enter'); }
  try {
    def.render(view, param, ctx);
  } catch (e) {
    console.error(e);
    view.innerHTML = '<div class="empty"><h2>משהו השתבש בעמוד הזה</h2><p>נסה לרענן. אם זה חוזר, חזור ללוח הבקרה.</p><a class="btn" href="#dashboard">ללוח הבקרה</a></div>';
  }
  const t = typeof def.title === 'function' ? def.title(param) : def.title;
  document.title = (t ? t + ' · ' : '') + 'CourtMaster AI';
  if (CM.shell) CM.shell.setActive(def.nav || name, typeof def.full === 'function' ? def.full(param) : def.full);
  if (!keep && !def.keepScroll) { window.scrollTo(0, 0); const m = $('.main'); if (m) m.scrollTop = 0; }
  if (!keep) view.focus({preventScroll: true});
}

/* ---------- toasts ---------- */
function toast(text, kind) {
  let root = $('#toasts');
  if (!root) { root = document.createElement('div'); root.id = 'toasts'; root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'polite'); document.body.append(root); }
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.innerHTML = icon(kind === 'error' ? 'alert' : kind === 'win' ? 'trophy' : 'check') + '<span>' + esc(text) + '</span>';
  root.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3400);
}

/* ---------- dialogs (the claude.ai viewer blocks confirm(), so everything is in-page) ---------- */
function dialog(opts) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'dlg-wrap';
    wrap.innerHTML = '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title">' +
      '<div class="dlg-head"><h2 id="dlg-title">' + esc(opts.title || '') + '</h2><button type="button" class="icon-btn" data-v="__close" aria-label="סגור">' + icon('x') + '</button></div>' +
      '<div class="dlg-body">' + (opts.html || '<p>' + esc(opts.text || '') + '</p>') + '</div>' +
      '<div class="dlg-foot">' + (opts.actions || [{label: 'סגור', value: null}]).map((a, i) =>
        '<button type="button" class="btn ' + (a.kind || (i === 0 ? 'primary' : 'ghost')) + '" data-v="' + i + '">' + esc(a.label) + '</button>').join('') + '</div></div>';
    const prev = document.activeElement;
    const close = v => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 180); document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    wrap.addEventListener('click', e => {
      if (e.target === wrap) return close(null);
      const b = e.target.closest('[data-v]');
      if (!b) return;
      if (b.dataset.v === '__close') return close(null);
      const a = (opts.actions || [])[Number(b.dataset.v)];
      if (!a) return close(null);
      if (a.read) { const v = a.read(wrap); if (v === false) return; return close(v); }
      close(a.value);
    });
    document.addEventListener('keydown', onKey);
    document.body.append(wrap);
    const first = wrap.querySelector('input, select, textarea') || wrap.querySelector('.dlg-foot .btn');
    if (first) first.focus();
    if (opts.onOpen) opts.onOpen(wrap);
  });
}
const confirmBox = (title, text, okLabel, danger) => dialog({title, text, actions: [{label: okLabel || 'אישור', value: true, kind: danger ? 'danger' : 'primary'}, {label: 'ביטול', value: false, kind: 'ghost'}]});

Object.assign(CM, {
  $, $$, esc, uid, clamp, sum, clone, isObj,
  pad, ymd, parseYmd, today, addDays, weekStartOf, daysBetween, dow, DATE_RE, TIME_RE,
  DAY_NAMES, DAY_SHORT, MONTHS, fmtDate, fmtDateLong, fmtMonth, fmtMinutes, fmtClock, greeting, seeded,
  icon, mountIcons, defineKey, KEYS, store, connectCloud, IN_CLAUDE, lsGet, lsSet,
  page, go, render, parseHash, routes, toast, dialog, confirmBox
});
})(window.CM = window.CM || {});
