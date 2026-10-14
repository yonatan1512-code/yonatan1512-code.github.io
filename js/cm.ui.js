/* CourtMaster AI — interface kit: the app shell (sidebar, top bar, bottom bar, "more" sheet),
   charts, progress rings, video cards, technique drawings, a small markdown renderer and sounds. */
(function (CM) {
'use strict';
const {$, $$, esc, icon, store} = CM;

/* ---------- navigation ---------- */
CM.NAV = [
  {id: 'dashboard', t: 'לוח הבקרה', i: 'home'},
  {id: 'plan', t: 'התוכנית השבועית', i: 'cal'},
  {id: 'live', t: 'אימון עכשיו', i: 'play'},
  {id: 'lessons', t: 'מסלול הלמידה', i: 'book'},
  {id: 'library', t: 'ספריית תרגילים', i: 'grid'},
  {id: 'tests', t: 'מבחנים ומדידות', i: 'gauge'},
  {id: 'progress', t: 'התקדמות', i: 'chart'},
  {id: 'goals', t: 'מטרות והישגים', i: 'trophy'},
  {id: 'nba', t: 'לומדים מה-NBA', i: 'eye'},
  {id: 'coach', t: 'המאמן שלי', i: 'chat'},
  {id: 'profile', t: 'פרופיל והגדרות', i: 'user'}
];
const BOTTOM = ['dashboard', 'plan', 'live', 'coach'];
const navItem = n => CM.NAV.find(x => x.id === n);

const shell = CM.shell = {
  mount() {
    const app = document.createElement('div');
    app.className = 'app';
    app.innerHTML =
      '<aside class="side" aria-label="ניווט ראשי">' +
        '<a class="brand" href="#dashboard" aria-label="CourtMaster AI, לוח הבקרה">' + logo() + '<span><b>CourtMaster</b> AI</span></a>' +
        '<nav class="side-nav">' + CM.NAV.map(n => '<a href="#' + n.id + '" data-nav="' + n.id + '">' + icon(n.i) + '<span>' + n.t + '</span></a>').join('') + '</nav>' +
        '<div class="side-foot"><a class="save-state" href="#account" data-save></a></div>' +
      '</aside>' +
      '<div class="main">' +
        '<header class="top"><a class="brand sm" href="#dashboard" aria-label="לוח הבקרה">' + logo() + '<span><b>CourtMaster</b> AI</span></a><span class="top-title" data-top-title></span></header>' +
        '<main id="view" tabindex="-1"></main>' +
      '</div>' +
      '<nav class="bnav" aria-label="ניווט מהיר">' +
        BOTTOM.map(id => { const n = navItem(id); return '<a href="#' + id + '" data-nav="' + id + '"' + (id === 'live' ? ' class="bn-live"' : '') + '>' + icon(n.i) + '<span>' + (id === 'live' ? 'אימון' : id === 'dashboard' ? 'בית' : id === 'plan' ? 'תוכנית' : 'מאמן') + '</span></a>'; }).join('') +
        '<button type="button" data-more aria-haspopup="dialog">' + icon('more') + '<span>עוד</span></button>' +
      '</nav>';
    document.body.append(app);
    app.querySelector('[data-more]').addEventListener('click', shell.openMore);
    shell.saveState();
    store.onMode(shell.saveState);
  },
  saveState() {
    const el = $('[data-save]');
    if (!el) return;
    const b = CM.backup || {}, s = CM.sync || {};
    const SYNC = {ok: ['check', 'מסונכרן לחשבון שלך'], syncing: ['refresh', 'מסנכרן…'], offline: ['alert', 'אין אינטרנט. יסונכרן כשיחזור'], error: ['alert', 'הסנכרון נכשל. הנתונים שמורים במכשיר']};
    if (s.user && SYNC[s.state]) { el.innerHTML = icon(SYNC[s.state][0]) + SYNC[s.state][1]; return; }
    el.innerHTML = store.mode === 'cloud'
      ? icon('check') + 'נשמר בחשבון claude.ai הפרטי שלך'
      : b.on && !b.lastError ? icon('check') + 'נשמר בדפדפן ובקובץ גיבוי במחשב'
      : b.on ? icon('alert') + 'נשמר בדפדפן. הגיבוי במחשב לא הצליח, ודא שהשרת פועל'
      : icon('info') + 'נשמר בדפדפן הזה בלבד';
  },
  setActive(id, full) {
    $$('[data-nav]').forEach(a => {
      const on = a.dataset.nav === id;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const more = $('[data-more]');
    if (more) more.classList.toggle('on', !BOTTOM.includes(id) && id !== 'onboarding');
    document.body.classList.toggle('full', !!full);
    const n = navItem(id);
    const t = $('[data-top-title]');
    if (t) t.textContent = n ? n.t : '';
  },
  openMore() {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="כל העמודים"><div class="sheet-grab"></div>' +
      '<div class="sheet-grid">' + CM.NAV.filter(n => !BOTTOM.includes(n.id)).map(n => '<a href="#' + n.id + '">' + icon(n.i) + '<span>' + n.t + '</span></a>').join('') + '</div></div>';
    const close = () => { wrap.classList.add('out'); document.removeEventListener('keydown', onKey); setTimeout(() => wrap.remove(), 200); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('a')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(wrap);
    const first = wrap.querySelector('a');
    if (first) first.focus();
  }
};
function logo() {
  return '<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="var(--accent)"/>' +
    '<path d="M2 16h28M16 2v28M6.2 6.2c4.6 4.4 4.6 15.2 0 19.6M25.8 6.2c-4.6 4.4-4.6 15.2 0 19.6" fill="none" stroke="#1a1410" stroke-width="1.6"/></svg>';
}

/* ---------- small building blocks ---------- */
const UI = CM.UI = {};
UI.head = (title, sub, actions) => '<header class="page-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p class="lead">' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="head-actions">' + actions + '</div>' : '') + '</header>';
UI.bar = (pct, cls) => '<div class="pbar' + (cls ? ' ' + cls : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '"><span style="width:' + CM.clamp(pct, 0, 100) + '%"></span></div>';
UI.ring = (pct, size, label) => {
  const r = 15.5, c = 2 * Math.PI * r, p = CM.clamp(pct, 0, 100);
  return '<div class="ring" style="--s:' + (size || 64) + 'px" role="img" aria-label="' + esc(label || Math.round(p) + '%') + '"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="' + r + '" class="ring-bg"/>' +
    '<circle cx="18" cy="18" r="' + r + '" class="ring-fg" stroke-dasharray="' + (c * p / 100).toFixed(2) + ' ' + c.toFixed(2) + '"/></svg><b>' + Math.round(p) + '%</b></div>';
};
UI.chip = (text, kind, ic) => '<span class="chip' + (kind ? ' ' + kind : '') + '">' + (ic ? icon(ic) : '') + esc(text) + '</span>';
UI.empty = (title, text, action) => '<div class="empty">' + icon('info') + '<h3>' + esc(title) + '</h3>' + (text ? '<p>' + text + '</p>' : '') + (action || '') + '</div>';
UI.stars = n => '<span class="lvl" aria-label="רמת קושי ' + n + '">' + [1, 2, 3, 4].slice(0, n > 3 ? 4 : 3).map(i => '<i class="' + (i <= n ? 'on' : '') + '"></i>').join('') + '</span>';
UI.equip = list => list.length ? list.map(e => UI.chip(CM.EQUIP[e], 'soft')).join('') : UI.chip('בלי ציוד', 'soft');
UI.drillCard = d => {
  const fav = store.get('favs').drills.includes(d.id);
  return '<a class="card drill-card" href="#drill.' + d.id + '"><div class="dc-top">' + '<span class="cat-ic">' + icon(CM.CATS[d.cat].icon) + '</span>' +
    (fav ? '<span class="fav-dot" title="במועדפים">' + icon('heart') + '</span>' : '') + '</div>' +
    '<h3>' + esc(d.name) + '</h3><p class="muted">' + esc(d.goal) + '</p>' +
    '<div class="meta">' + UI.chip(CM.CATS[d.cat].name, 'soft') + UI.chip(d.reps || CM.fmtMinutes(d.min), 'soft', d.timed ? 'timer' : 'check') + '<span class="lvl-txt">רמה ' + d.lvl + '</span>' + (d.video ? UI.chip('סרטון', 'soft', 'play') : '') + '</div></a>';
};
UI.lessonState = st => st ? '<span class="lstate s-' + st + '">' + esc(CM.LSTATES[st]) + '</span>' : '';

/* ---------- mini markdown (coach answers): escape first, then a few safe patterns ---------- */
UI.md = function (src) {
  const lines = esc(src).split('\n');
  let html = '', list = null;
  const inline = s => s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const close = () => { if (list) { html += '</' + list + '>'; list = null; } };
  lines.forEach(l => {
    const t = l.trim();
    let m;
    if (!t) { close(); return; }
    if ((m = /^#{1,4}\s+(.*)$/.exec(t))) { close(); html += '<h4>' + inline(m[1]) + '</h4>'; return; }
    if ((m = /^[-*•]\s+(.*)$/.exec(t))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += '<li>' + inline(m[1]) + '</li>'; return; }
    if ((m = /^\d+[.)]\s+(.*)$/.exec(t))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += '<li>' + inline(m[1]) + '</li>'; return; }
    close();
    html += '<p>' + inline(t) + '</p>';
  });
  close();
  return html;
};

/* ---------- videos: verified ids only; plays inside the page locally, opens YouTube inside claude.ai ---------- */
UI.video = function (id, opts) {
  const v = CM.VIDEOS[id];
  if (!v) return '';
  opts = opts || {};
  const url = 'https://www.youtube.com/watch?v=' + id;
  const thumb = '<img src="images/thumbs/' + id + '.jpg" alt="" loading="lazy">';
  const meta = '<div class="vmeta"><b>' + esc(v[0]) + '</b><span>' + esc(v[2]) + ' · ' + esc(v[1]) + '</span></div>';
  if (CM.IN_CLAUDE) {
    return '<a class="video' + (opts.small ? ' small' : '') + '" href="' + url + '" target="_blank" rel="noopener noreferrer"><div class="vthumb">' + thumb +
      '<span class="vplay">' + icon('external') + '</span></div>' + meta + '<span class="vnote">נפתח ביוטיוב</span></a>';
  }
  return '<div class="video' + (opts.small ? ' small' : '') + '"><button type="button" class="vthumb" data-yt="' + id + '" aria-label="נגן: ' + esc(v[0]) + '">' + thumb +
    '<span class="vplay">' + icon('play') + '</span></button>' + meta + '</div>';
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-yt]');
  if (!b) return;
  const id = b.dataset.yt;
  if (!CM.VIDEOS[id]) return;
  const f = document.createElement('iframe');
  f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
  f.title = CM.VIDEOS[id][0];
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  f.allowFullscreen = true;
  f.className = 'vframe';
  b.replaceWith(f);
});

/* ---------- technique drawings ---------- */
UI.figure = function (name) {
  const F = {
    shot: '<svg viewBox="0 0 240 200" role="img" aria-label="שלבי הזריקה: עמידה, הרמה ושחרור">' +
      '<g class="fg-line"><circle cx="60" cy="40" r="11"/><path d="M60 51v52M60 103l-14 44M60 103l14 44M46 147h-8M74 147h8M60 66l18-14 4-14"/><circle cx="84" cy="30" r="9" class="fg-ball"/></g>' +
      '<g class="fg-line"><circle cx="170" cy="30" r="11"/><path d="M170 41v52M170 93l-12 44M170 93l12 44M158 137l-4 10M182 137l4 10M170 56l14-20 6-24"/><circle cx="192" cy="10" r="0"/></g>' +
      '<path class="fg-arc" d="M196 14 C 215 -10, 232 10, 236 40"/>' +
      '<text x="60" y="180" class="fg-t">1. עמידה והרמה</text><text x="170" y="180" class="fg-t">2. שחרור ויד "בסל"</text></svg>',
    court: '<svg viewBox="0 0 240 180" role="img" aria-label="מגרש עם חמש נקודות זריקה בקשת">' +
      '<rect x="10" y="10" width="220" height="160" rx="6" class="fg-court"/><rect x="85" y="10" width="70" height="70" class="fg-court"/>' +
      '<path d="M30 10v40a90 90 0 0 0 180 0V10" class="fg-court"/><circle cx="120" cy="22" r="7" class="fg-hoop"/>' +
      [[38, 30], [62, 92], [120, 118], [178, 92], [202, 30]].map((p, i) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" class="fg-spot"/><text x="' + p[0] + '" y="' + (p[1] + 4) + '" class="fg-n">' + (i + 1) + '</text>').join('') + '</svg>',
    layup: '<svg viewBox="0 0 240 160" role="img" aria-label="לייאפ: צעד ימין, צעד שמאל וקפיצה">' +
      '<path d="M20 140h200" class="fg-court"/><rect x="200" y="20" width="6" height="40" class="fg-hoop-b"/><path d="M200 50h-18" class="fg-hoop"/>' +
      '<g class="fg-steps"><ellipse cx="60" cy="130" rx="11" ry="6"/><ellipse cx="110" cy="122" rx="11" ry="6"/><path d="M128 110c10-30 30-50 46-56" class="fg-arc"/></g>' +
      '<text x="60" y="155" class="fg-t">1. ימין</text><text x="112" y="155" class="fg-t">2. שמאל</text><text x="170" y="40" class="fg-t">3. למעלה</text></svg>'
  };
  return F[name] ? '<figure class="figure">' + F[name] + '</figure>' : '';
};

/* ---------- charts (drawn left to right, oldest first, like a timeline) ---------- */
UI.bars = function (data, opts) {
  opts = opts || {};
  const W = 600, H = opts.h || 200, P = {t: 24, r: 8, b: 30, l: 8};
  const max = Math.max(1, ...data.map(d => d.v));
  const n = data.length, bw = (W - P.l - P.r) / n;
  const bars = data.map((d, i) => {
    const h = (H - P.t - P.b) * d.v / max, x = P.l + i * bw + bw * 0.18, y = H - P.b - h, w = bw * 0.64;
    const lab = d.v ? (opts.fmt ? opts.fmt(d.v) : d.v) : '';
    return '<g><title>' + esc(d.tip || d.label + ': ' + lab) + '</title><rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(h, d.v ? 2 : 0).toFixed(1) + '" rx="4" class="' + (d.hi ? 'b-hi' : 'b') + '"/>' +
      (lab !== '' ? '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" class="c-val">' + esc(lab) + '</text>' : '') +
      '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 10) + '" class="c-lab">' + esc(d.label) + '</text></g>';
  }).join('');
  return '<div class="chart" dir="ltr"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria || 'תרשים עמודות') + '"><path d="M' + P.l + ' ' + (H - P.b) + 'H' + (W - P.r) + '" class="c-axis"/>' + bars + '</svg></div>';
};
UI.line = function (pts, opts) {
  opts = opts || {};
  if (!pts.length) return '';
  const W = 600, H = opts.h || 200, P = {t: 26, r: 24, b: 30, l: 24};
  const vs = pts.map(p => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
  const X = i => pts.length === 1 ? W / 2 : P.l + i * (W - P.l - P.r) / (pts.length - 1);
  const Y = v => P.t + (H - P.t - P.b) * (1 - (v - lo) / (hi - lo));
  const path = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join('');
  const every = Math.ceil(pts.length / 8);
  return '<div class="chart" dir="ltr"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria || 'תרשים') + '">' +
    '<path d="M' + P.l + ' ' + (H - P.b) + 'H' + (W - P.r) + '" class="c-axis"/>' +
    (pts.length > 1 ? '<path d="' + path + '" class="c-line"/>' : '') +
    pts.map((p, i) => '<g><title>' + esc(p.tip || p.label + ': ' + p.text) + '</title><circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="5" class="c-dot' + (p.hi ? ' hi' : '') + '"/>' +
      '<text x="' + X(i).toFixed(1) + '" y="' + (Y(p.v) - 10).toFixed(1) + '" class="c-val">' + esc(p.text) + '</text>' +
      (i % every === 0 || i === pts.length - 1 ? '<text x="' + X(i).toFixed(1) + '" y="' + (H - 10) + '" class="c-lab">' + esc(p.label) + '</text>' : '') + '</g>').join('') + '</svg></div>';
};
UI.spark = function (vals) {
  if (vals.length < 2) return '';
  const W = 80, H = 24, lo = Math.min(...vals), hi = Math.max(...vals) === lo ? lo + 1 : Math.max(...vals);
  const d = vals.map((v, i) => (i ? 'L' : 'M') + (i * W / (vals.length - 1)).toFixed(1) + ' ' + (H - 3 - (H - 6) * (v - lo) / (hi - lo)).toFixed(1)).join('');
  return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" dir="ltr" aria-hidden="true"><path d="' + d + '"/></svg>';
};

/* ---------- sounds (short beeps for the live timer; respects the setting) ---------- */
let actx = null;
UI.beep = function (kind) {
  if (!store.get('settings').sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const tones = kind === 'end' ? [660, 880] : kind === 'tick' ? [520] : [880];
    tones.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, actx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + i * 0.18 + 0.16);
      o.connect(g); g.connect(actx.destination);
      o.start(actx.currentTime + i * 0.18); o.stop(actx.currentTime + i * 0.18 + 0.18);
    });
  } catch (e) {}
};

/* ---------- forms ---------- */
UI.field = (label, inner, hint) => '<label class="field"><span class="f-lab">' + esc(label) + '</span>' + inner + (hint ? '<span class="f-hint">' + hint + '</span>' : '') + '</label>';
UI.seg = (name, options, value) => '<div class="seg" role="radiogroup">' + Object.keys(options).map(k =>
  '<label><input type="radio" name="' + name + '" value="' + esc(k) + '"' + (String(value) === k ? ' checked' : '') + '><span>' + esc(options[k]) + '</span></label>').join('') + '</div>';
UI.checks = (name, options, values, max) => '<div class="checks"' + (max ? ' data-max="' + max + '"' : '') + '>' + Object.keys(options).map(k =>
  '<label><input type="checkbox" name="' + name + '" value="' + esc(k) + '"' + (values.includes(k) ? ' checked' : '') + '><span>' + options[k] + '</span></label>').join('') + '</div>';
UI.readChecks = (root, name) => $$('input[name="' + name + '"]:checked', root).map(i => i.value);
UI.readRadio = (root, name) => { const i = $('input[name="' + name + '"]:checked', root); return i ? i.value : ''; };
// a checkbox group with data-max: keep at most that many ticked
document.addEventListener('change', e => {
  const box = e.target.closest('.checks[data-max]');
  if (!box || !e.target.checked) return;
  const max = Number(box.dataset.max);
  const on = $$('input:checked', box);
  if (on.length > max) { e.target.checked = false; CM.toast('אפשר לבחור עד ' + max, 'error'); }
});
})(window.CM = window.CM || {});
