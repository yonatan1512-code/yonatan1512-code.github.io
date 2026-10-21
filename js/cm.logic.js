/* CourtMaster AI — saved data (keys and validation), the profile, the adaptive curriculum,
   abilities from tests, statistics, goals, achievements, star challenges and migration from the old site. */
(function (CM) {
'use strict';
const {store, defineKey, DATE_RE, TIME_RE, today, addDays, weekStartOf, isObj, clamp, uid, clone} = CM;

const ABK = CM.ABILITIES.map(a => a.k);
const AB = {}; CM.ABILITIES.forEach(a => { AB[a.k] = a; });
const TEST = {}; CM.TESTS.forEach(t => { TEST[t.id] = t; });
const LESSON = {}; CM.LESSONS.forEach((l, i) => { l.order = i; LESSON[l.id] = l; });
const DRILL = {}; CM.DRILLS.forEach(d => { DRILL[d.id] = d; });
const LEVEL_OF = {beginner: 1, intermediate: 2, advanced: 3};
const LEVEL_NAME = {beginner: 'מתחיל', intermediate: 'בינוני', advanced: 'מתקדם'};
const YEARS = {'0': 'פחות משנה', '1': 'בערך שנה', '2': 'שנתיים-שלוש', '4': '4 שנים ומעלה'};
const LONG_GOALS = {
  fun: 'ליהנות ולהשתפר משבוע לשבוע',
  team: 'להתקבל לקבוצה ולשחק בה',
  compete: 'להגיע לרמה גבוהה ולשחק תחרותי בעתיד'
};
const MODES = {
  train: {name: 'אימון במגרש', short: 'מגרש', icon: 'ball'},
  home: {name: 'אימון קצר בבית', short: 'בית', icon: 'home'},
  team: {name: 'אימון קבוצה', short: 'קבוצה', icon: 'users'},
  rest: {name: 'מנוחה', short: 'מנוחה', icon: 'moon'}
};
const ALL_EQUIP = Object.keys(CM.EQUIP);
// shooting spots kept from the old site, so its saved shooting sessions keep working
const SPOTS = {
  form: 'טכניקה קרוב לסל (1–2 מ׳)', world: 'סביב העולם (3 מ׳)', mid: 'טווח בינוני (4 מ׳)', ft: 'זריקות עונשין', three: 'שלשות'
};

/* ---------- small validators ---------- */
const num = (v, a, b, def) => { const n = Number(v); return Number.isFinite(n) ? clamp(n, a, b) : def; };
const int = (v, a, b, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? clamp(n, a, b) : def; };
const str = (v, max, def) => typeof v === 'string' ? v.trim().slice(0, max) : (def || '');
const isDate = v => typeof v === 'string' && DATE_RE.test(v);
const arr = v => Array.isArray(v) ? v : [];
const idOk = v => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);

/* ---------- profile ---------- */
// A sample week inside the youth guidelines: 4 court sessions, one short home session and 2 full rest days.
const DEF_DAYS = [
  {mode: 'train', start: '16:30', min: 75},
  {mode: 'home', start: '17:00', min: 20},
  {mode: 'train', start: '16:30', min: 75},
  {mode: 'train', start: '16:30', min: 60},
  {mode: 'rest', start: '', min: 0},
  {mode: 'train', start: '10:00', min: 90},
  {mode: 'rest', start: '', min: 0}
];
function defaultProfile() {
  return {
    onboarded: false, name: '', age: 13, height: 164, level: 'intermediate', years: '1', team: false,
    goals: ABK.slice(), focus: ['shoot', 'handle'], longGoal: 'compete',
    days: clone(DEF_DAYS), place: 'court', equip: ['ball', 'hoop', 'wall'], alone: true, quiet: true, created: ''
  };
}
function normDay(d, i) {
  const def = DEF_DAYS[i];
  if (!isObj(d) || !MODES[d.mode]) return clone(def);
  const mode = d.mode;
  const start = typeof d.start === 'string' && TIME_RE.test(d.start) ? d.start : (mode === 'rest' ? '' : def.start || '16:30');
  let min = int(d.min, 0, 120, 60);
  if (mode === 'rest') min = 0;
  else if (mode === 'home') min = clamp(min || 20, CM.LIMITS.homeMin, CM.LIMITS.homeMax);
  else min = clamp(min || 60, CM.LIMITS.trainMin, CM.LIMITS.trainMax);
  return {mode, start, min};
}
function normProfile(v) {
  const p = defaultProfile();
  if (!isObj(v)) return p;
  p.onboarded = v.onboarded === true;
  p.name = str(v.name, 30);
  p.age = int(v.age, 8, 19, 13);
  p.height = int(v.height, 110, 230, 164);
  if (LEVEL_OF[v.level]) p.level = v.level;
  if (YEARS[v.years]) p.years = v.years;
  p.team = v.team === true;
  if (Array.isArray(v.goals)) p.goals = ABK.filter(k => v.goals.includes(k));
  if (Array.isArray(v.focus)) p.focus = v.focus.filter(k => p.goals.includes(k)).slice(0, 3);
  if (!p.focus.length && p.goals.length) p.focus = p.goals.slice(0, 2);
  if (LONG_GOALS[v.longGoal]) p.longGoal = v.longGoal;
  if (Array.isArray(v.days) && v.days.length === 7) p.days = v.days.map(normDay);
  if (['court', 'home', 'both'].includes(v.place)) p.place = v.place;
  if (Array.isArray(v.equip)) p.equip = ALL_EQUIP.filter(k => v.equip.includes(k));
  p.alone = v.alone !== false;
  p.quiet = v.quiet !== false;
  p.created = isDate(v.created) ? v.created : '';
  return p;
}

/* ---------- every saved key ---------- */
CM.LIMITS = {weekMin: 600, trainMin: 30, trainMax: 90, homeMin: 10, homeMax: 30, maxPractices: 4, minRest: 1};
defineKey('profile', defaultProfile, normProfile);

function normItem(it) {
  if (!isObj(it)) return null;
  const min = int(it.min, 1, 30, 5);
  if (idOk(it.d) && DRILL[it.d]) return {d: it.d, min};
  if (idOk(it.l) && LESSON[it.l] && Number.isInteger(it.i) && it.i >= 0 && it.i < 4) return {l: it.l, i: it.i, min};
  if (isObj(it.c) && str(it.c.name, 80)) return {c: {name: str(it.c.name, 80), how: str(it.c.how, 400), goal: str(it.c.goal, 160)}, min};
  return null;
}
defineKey('plan', () => ({days: {}}), v => {
  const out = {days: {}};
  const oldest = addDays(today(), -60);
  if (isObj(v) && isObj(v.days)) Object.keys(v.days).forEach(date => {
    const o = v.days[date];
    if (!isDate(date) || date < oldest || !isObj(o)) return;
    const r = {};
    if (MODES[o.mode]) r.mode = o.mode;
    if (typeof o.start === 'string' && TIME_RE.test(o.start)) r.start = o.start;
    if (o.min != null) r.min = int(o.min, 0, 120, 60);
    if (Array.isArray(o.focus)) { const f = o.focus.filter(k => AB[k]).slice(0, 2); if (f.length) r.focus = f; }
    if (Array.isArray(o.items)) { const it = o.items.map(normItem).filter(Boolean).slice(0, 20); if (it.length) r.items = it; }
    if (o.title) r.title = str(o.title, 80);
    if (o.goal) r.goal = str(o.goal, 200);
    if (o.ai === true) r.ai = true;
    if (Object.keys(r).length) out.days[date] = r;
  });
  return out;
});

const LSTATES = {learned: 'למדתי', practice: 'צריך לתרגל', hard: 'היה קשה', ready: 'מוכן לאתגר הבא'};
defineKey('lessons', () => ({s: {}}), v => {
  const out = {s: {}};
  if (isObj(v) && isObj(v.s)) Object.keys(v.s).forEach(id => {
    const o = v.s[id];
    if (!LESSON[id] || !isObj(o)) return;
    const r = {dr: [0, 1, 2, 3].map(i => !!(Array.isArray(o.dr) && o.dr[i]))};
    if (LSTATES[o.st]) r.st = o.st;
    if (isDate(o.d)) r.d = o.d;
    if (o.chk === true) r.chk = true;
    if (o.seen === true) r.seen = true;
    out.s[id] = r;
  });
  return out;
});

defineKey('sessions', () => [], v => arr(v).filter(s => isObj(s) && idOk(s.id) && isDate(s.date)).map(s => ({
  id: s.id, date: s.date, min: int(s.min, 0, 300, 0), planned: int(s.planned, 0, 300, 0),
  title: str(s.title, 80, 'אימון'), focus: arr(s.focus).filter(k => AB[k]).slice(0, 2),
  items: arr(s.items).filter(isObj).slice(0, 30).map(it => ({n: str(it.n, 80), st: it.st === 'done' ? 'done' : 'skip', sec: int(it.sec, 0, 7200, 0), ref: str(it.ref, 60)})),
  rpe: int(s.rpe, 0, 5, 0), pain: s.pain === true, note: str(s.note, 600), src: s.src === 'manual' ? 'manual' : 'live'
})).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).slice(-400)
  // a saved copy must stay small: older sessions keep their totals but not the drill-by-drill list
  .map((s, i, all) => i < all.length - 100 ? Object.assign(s, {items: []}) : s));

defineKey('records', () => [], v => arr(v).filter(r => isObj(r) && idOk(r.id) && isDate(r.date) && SPOTS[r.spot]).map(r => {
  const att = int(r.att, 1, 1000, 1);
  return {id: r.id, date: r.date, spot: r.spot, att, made: int(r.made, 0, att, 0), note: str(r.note, 300)};
}).slice(-1000));

defineKey('tests', () => [], v => arr(v).filter(e => isObj(e) && idOk(e.id) && TEST[e.test] && isDate(e.date) && Number.isFinite(Number(e.v))).map(e => {
  const f = {};
  if (isObj(e.f)) Object.keys(e.f).forEach(k => { if (/^\w{1,12}$/.test(k) && Number.isFinite(Number(e.f[k]))) f[k] = Number(e.f[k]); });
  return {id: e.id, test: e.test, date: e.date, v: Number(e.v), f, note: str(e.note, 300)};
}).slice(-1000));

const GOAL_TYPES = {test: 'תוצאה במבחן', sessions: 'מספר אימונים', lessons: 'שיעורים שנלמדו', shots: 'קליעות שנרשמו', custom: 'מטרה חופשית'};
defineKey('goals', () => [], v => arr(v).filter(g => isObj(g) && idOk(g.id) && GOAL_TYPES[g.type] && str(g.title, 80)).map(g => {
  const r = {id: g.id, type: g.type, title: str(g.title, 80), target: num(g.target, 0, 100000, 1), created: isDate(g.created) ? g.created : today()};
  if (g.type === 'test') { if (!TEST[g.test]) return null; r.test = g.test; }
  if (isDate(g.by)) r.by = g.by;
  if (isDate(g.done)) r.done = g.done;
  if (g.type === 'custom') r.manual = num(g.manual, 0, 100000, 0);
  return r;
}).filter(Boolean).slice(0, 60));

defineKey('favs', () => ({drills: [], lessons: []}), v => ({
  drills: isObj(v) ? Array.from(new Set(arr(v.drills).filter(id => DRILL[id]))) : [],
  lessons: isObj(v) ? Array.from(new Set(arr(v.lessons).filter(id => LESSON[id]))) : []
}));

defineKey('coach', () => ({msgs: []}), v => {
  const all = isObj(v) ? arr(v.msgs).filter(m => isObj(m) && (m.r === 'user' || m.r === 'assistant') && typeof m.t === 'string' && m.t)
    .map(m => ({r: m.r, t: m.t.slice(0, 8000), at: str(m.at, 30), cut: m.cut === true})) : [];
  // keep the newest messages, about 60,000 characters in all (a saved document has a size limit)
  const msgs = [];
  let size = 0;
  for (let i = all.length - 1; i >= 0 && msgs.length < 60; i--) { size += all[i].t.length; if (size > 60000) break; msgs.unshift(all[i]); }
  return {msgs};
});

// voice: the live trainer speaks; auto: it moves to the next drill by itself (hands-free training)
defineKey('settings', () => ({saveChat: true, sound: true, voice: true, auto: true}), v => ({
  saveChat: !(isObj(v) && v.saveChat === false), sound: !(isObj(v) && v.sound === false),
  voice: !(isObj(v) && v.voice === false), auto: !(isObj(v) && v.auto === false)
}));

const MISSION_N = {};
CM.CHALLENGES.forEach(c => c.missions.forEach((m, i) => { MISSION_N[c.id + '-' + (i + 1)] = m.n; }));
function normCourses(v) {
  const done = {};
  if (isObj(v) && isObj(v.done)) Object.keys(v.done).forEach(k => {
    if (!MISSION_N[k] || !Array.isArray(v.done[k])) return;
    const dates = Array.from(new Set(v.done[k].filter(isDate))).sort().slice(-MISSION_N[k]);
    if (dates.length) done[k] = dates;
  });
  return {done};
}
defineKey('courses', () => ({done: {}}), normCourses);

// a workout in progress, so a refresh or a closed tab does not lose it
defineKey('live', () => null, v => {
  if (!isObj(v) || !isDate(v.date) || !Array.isArray(v.items) || !v.items.length) return null;
  return {
    date: v.date, startedAt: num(v.startedAt, 0, 1e14, Date.now()), title: str(v.title, 80, 'אימון'), planned: int(v.planned, 0, 300, 0),
    focus: arr(v.focus).filter(k => AB[k]).slice(0, 2), idx: int(v.idx, 0, 40, 0),
    items: v.items.filter(isObj).slice(0, 30).map(it => ({
      n: str(it.n, 80), ref: str(it.ref, 60), min: int(it.min, 1, 60, 5), st: ['done', 'skip'].includes(it.st) ? it.st : '',
      sec: int(it.sec, 0, 7200, 0), left: it.left == null ? null : int(it.left, 0, 3600, 0),
      timed: it.timed === true, how: str(it.how, 400)
    })),
    paused: v.paused === true, ended: v.ended === true, plannedFor: isDate(v.plannedFor) ? v.plannedFor : v.date,
    auto: v.auto === true, rest: v.rest == null ? null : int(v.rest, 0, 120, 0), restMax: int(v.restMax, 1, 120, 15)
  };
});
defineKey('meta', () => ({migrated: false}), v => ({migrated: isObj(v) && v.migrated === true}));

/* ---------- curriculum: open levels and the next lesson come from results, never from the calendar ---------- */
const MASTERED = st => st === 'learned' || st === 'ready';
function lstate(id) { return store.get('lessons').s[id] || {dr: [false, false, false, false]}; }
function levelStats(n) {
  const list = CM.LESSONS.filter(l => l.level === n);
  const S = store.get('lessons').s;
  const mastered = list.filter(l => S[l.id] && MASTERED(S[l.id].st)).length;
  const started = list.filter(l => S[l.id] && (S[l.id].st || S[l.id].dr.some(Boolean))).length;
  return {total: list.length, mastered, started, pct: list.length ? Math.round(100 * mastered / list.length) : 0};
}
const startLevel = () => LEVEL_OF[store.get('profile').level] || 1;
function openLevel() {
  let u = startLevel();
  for (let n = 1; n < 4; n++) if (n <= u && levelStats(n).pct >= 70) u = Math.max(u, n + 1);
  return u;
}
// the level he is working on: the lowest open level below 70%, never below where he started
function workLevel() {
  const u = openLevel();
  for (let n = startLevel(); n <= u; n++) if (levelStats(n).pct < 70) return n;
  return u;
}
const lessonOpen = l => l.level <= openLevel();
function curriculumPct() {
  const S = store.get('lessons').s;
  return Math.round(100 * CM.LESSONS.filter(l => S[l.id] && MASTERED(S[l.id].st)).length / CM.LESSONS.length);
}
// what to learn next: unfinished practice first, then new lessons at the working level, weighted by his goals and weak spots
function nextLesson(skill) {
  const prof = store.get('profile');
  const S = store.get('lessons').s;
  const wl = workLevel();
  const weak = weakAbilities();
  const pick = list => {
    let best = null, bs = -1e9;
    list.forEach(l => {
      const st = S[l.id] && S[l.id].st;
      if (MASTERED(st)) return;
      let s = st === 'practice' ? 30 : st === 'hard' ? 26 : 18;
      s += l.level === wl ? 15 : l.level < wl ? 4 : -6 * (l.level - wl);
      if (prof.focus.includes(l.skill)) s += 12; else if (prof.goals.includes(l.skill)) s += 6;
      if (weak.includes(l.skill)) s += 8;
      s -= l.order * 0.01;
      if (s > bs) { bs = s; best = l; }
    });
    return best;
  };
  const open = CM.LESSONS.filter(lessonOpen);
  return (skill && pick(open.filter(l => l.skill === skill))) || pick(open) || null;
}
function setLessonState(id, st) {
  const before = openLevel();
  store.update('lessons', v => {
    const cur = v.s[id] || {dr: [false, false, false, false]};
    cur.st = st; cur.d = today();
    v.s[id] = cur;
    return v;
  });
  const after = openLevel();
  return after > before ? after : 0;
}
function toggleLessonDrill(id, i, on) {
  store.update('lessons', v => {
    const cur = v.s[id] || {dr: [false, false, false, false]};
    cur.dr[i] = on == null ? !cur.dr[i] : !!on;
    v.s[id] = cur;
    return v;
  });
}

/* ---------- tests and abilities (raw results only: no invented norms or ratings) ---------- */
function testEntries(testId) {
  return store.get('tests').filter(e => e.test === testId).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}
const isBetter = (t, a, b) => t.better === 'down' ? a < b : a > b;
function fmtVal(t, v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return (t.dec ? Number(v).toFixed(t.dec) : String(Math.round(v)));
}
function testSummary(testId) {
  const t = TEST[testId], list = testEntries(testId);
  if (!list.length) return {t, list, last: null};
  const last = list[list.length - 1], prev = list.length > 1 ? list[list.length - 2] : null;
  const best = list.reduce((b, e) => !b || isBetter(t, e.v, b.v) ? e : b, null);
  const delta = prev ? last.v - prev.v : null;
  const trend = prev ? (last.v === prev.v ? 'same' : isBetter(t, last.v, prev.v) ? 'up' : 'down') : null;
  return {t, list, last, prev, best, delta, trend, isBest: list.length > 1 && best === last};
}
function ability(k) {
  const a = AB[k];
  const sums = a.tests.map(testSummary).filter(s => s.last);
  if (!sums.length) return {a, measured: false};
  sums.sort((x, y) => x.last.date < y.last.date ? 1 : -1);
  return Object.assign({a, measured: true}, sums[0], {others: sums.slice(1)});
}
function weakAbilities() { return ABK.filter(k => { const s = ability(k); return s.measured && s.trend === 'down'; }); }
function saveTest(testId, v, f, note, date) {
  const t = TEST[testId];
  const before = testSummary(testId);
  const e = {id: uid(), test: testId, date: date || today(), v, f: f || {}, note: note || ''};
  store.update('tests', list => { list.push(e); return list; });
  const pb = before.best && isBetter(t, v, before.best.v);
  return {entry: e, pb, first: !before.last};
}

/* ---------- statistics ---------- */
const sessions = () => store.get('sessions');
const daysTrained = () => new Set(sessions().map(s => s.date)).size;
function minutesBy(unit, count) {
  // unit 'week' -> keys are week starts, 'month' -> YYYY-MM; newest last
  const keys = [];
  const t = today();
  if (unit === 'week') { const ws = weekStartOf(t); for (let i = count - 1; i >= 0; i--) keys.push(addDays(ws, -7 * i)); }
  else { const d = CM.parseYmd(t); for (let i = count - 1; i >= 0; i--) { const m = new Date(d.getFullYear(), d.getMonth() - i, 15); keys.push(m.getFullYear() + '-' + CM.pad(m.getMonth() + 1)); } }
  const map = {}; keys.forEach(k => { map[k] = {min: 0, n: 0, made: 0, att: 0}; });
  const keyOf = date => unit === 'week' ? weekStartOf(date) : date.slice(0, 7);
  sessions().forEach(s => { const m = map[keyOf(s.date)]; if (m) { m.min += s.min; m.n++; } });
  store.get('records').forEach(r => { const m = map[keyOf(r.date)]; if (m) { m.made += r.made; m.att += r.att; } });
  return keys.map(k => Object.assign({k}, map[k]));
}
function shotTotals(since) {
  const out = {made: 0, att: 0, by: {}};
  Object.keys(SPOTS).forEach(k => { out.by[k] = {made: 0, att: 0}; });
  store.get('records').forEach(r => {
    if (since && r.date < since) return;
    out.made += r.made; out.att += r.att; out.by[r.spot].made += r.made; out.by[r.spot].att += r.att;
  });
  return out;
}

/* ---------- personal goals ---------- */
function goalProgress(g) {
  let cur = 0, label = '', measured = true;
  const target = g.target;
  if (g.type === 'test') {
    const t = TEST[g.test], s = testSummary(g.test);
    if (!s.last) { measured = false; label = 'טרם נמדד'; }
    else {
      cur = s.best.v;
      const pct = t.better === 'down' ? (cur <= target ? 100 : Math.round(100 * target / cur)) : Math.round(100 * cur / (target || 1));
      return {cur, target, pct: clamp(pct, 0, 100), label: 'שיא: ' + fmtVal(t, cur) + ' ' + t.unit + ' · יעד: ' + fmtVal(t, target), measured, done: pct >= 100};
    }
  } else if (g.type === 'sessions') { cur = sessions().filter(s => s.date >= g.created).length; label = cur + ' מתוך ' + target + ' אימונים'; }
  else if (g.type === 'lessons') { const S = store.get('lessons').s; cur = Object.keys(S).filter(id => MASTERED(S[id].st)).length; label = cur + ' מתוך ' + target + ' שיעורים'; }
  else if (g.type === 'shots') { cur = shotTotals(g.created).made; label = cur + ' מתוך ' + target + ' קליעות'; }
  else { cur = g.manual || 0; label = cur + ' מתוך ' + target; }
  const pct = clamp(Math.round(100 * cur / (target || 1)), 0, 100);
  return {cur, target, pct: measured ? pct : 0, label, measured, done: measured && pct >= 100};
}

/* ---------- star challenges ---------- */
function course(c) {
  const done = store.get('courses').done;
  let open = true;
  const ms = c.missions.map((m, i) => {
    const key = c.id + '-' + (i + 1);
    const dates = done[key] || [];
    const r = {m, i, key, count: Math.min(dates.length, m.n), today: dates.includes(today()), unlocked: open, done: dates.length >= m.n};
    if (!r.done) open = false;
    return r;
  });
  return {c, ms, doneCount: ms.filter(x => x.done).length, finished: ms.every(x => x.done)};
}
function markMission(key, on) {
  store.update('courses', v => {
    const list = v.done[key] || [];
    const t = today();
    v.done[key] = on ? Array.from(new Set(list.concat(t))).sort() : list.filter(d => d !== t);
    if (!v.done[key].length) delete v.done[key];
    return v;
  });
}

/* ---------- achievements (worked out from saved data) ---------- */
function achievements() {
  const S = sessions(), T = store.get('tests'), L = store.get('lessons').s;
  const lv = n => levelStats(n).pct >= 70;
  const pb = CM.TESTS.some(t => { const s = testSummary(t.id); return s.list.length > 1 && s.list.some((e, i) => i > 0 && s.list.slice(0, i).every(p => isBetter(t, e.v, p.v))); });
  const fullWeek = (() => {
    const ws = weekStartOf(today());
    for (let w = 1; w <= 12; w++) {
      const start = addDays(ws, -7 * w);
      const planned = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(start, i)).filter(d => { const c = CM.dayConf(d); return c.mode === 'train' || c.mode === 'home'; });
      if (planned.length && planned.every(d => S.some(s => s.date === d))) return true;
    }
    return false;
  })();
  const has = {
    w1: S.some(s => s.src === 'live'), w5: S.length >= 5, w20: S.length >= 20, week: fullWeek, t1: T.length > 0, pb,
    l1: Object.keys(L).some(id => MASTERED(L[id].st)), lv1: lv(1), lv2: lv(2), lv3: lv(3), lv4: lv(4),
    goal: store.get('goals').some(g => g.done || goalProgress(g).done),
    star: CM.CHALLENGES.some(c => course(c).finished)
  };
  return CM.ACHIEVEMENTS.map(a => Object.assign({got: !!has[a.id]}, a));
}

/* ---------- one-time import of the previous site's data (shooting log, fitness tests, star missions) ---------- */
const OLD = 'sal-achrei-sal:';
function readOldLocal(k) { try { const v = localStorage.getItem(OLD + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function readOldCloud(k) {
  return new Promise(resolve => {
    if (store.mode !== 'cloud') return resolve(null);
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); };
    setTimeout(() => finish(null), 5000);
    try {
      store.db.doc('data/users/' + store.uid + '/' + k).get()
        .then(snap => finish(snap && snap.exists ? snap.data() : null), () => finish(null));
    } catch (e) { finish(null); }
  });
}
async function migrateOld() {
  if (store.get('meta').migrated) return 0;
  const get = async k => (await readOldCloud(k)) || readOldLocal(k);
  const [shots, tests, courses] = await Promise.all([get('shots'), get('tests'), get('courses')]);
  if (store.get('meta').migrated) return 0;
  let n = 0;
  if (shots && Array.isArray(shots.sessions)) {
    const have = new Set(store.get('records').map(r => r.id));
    const add = shots.sessions.filter(s => isObj(s) && idOk(s.id) && !have.has(s.id) && SPOTS[s.type] && isDate(s.date) && s.att > 0)
      .map(s => ({id: s.id, date: s.date, spot: s.type, made: s.made, att: s.att, note: ''}));
    if (add.length) { store.update('records', list => list.concat(add)); n += add.length; }
  }
  if (tests && Array.isArray(tests.entries)) {
    const have = new Set(store.get('tests').map(e => e.id));
    const add = tests.entries.filter(e => isObj(e) && idOk(e.id) && !have.has(e.id) && TEST['t-' + e.test] && isDate(e.date) && Number.isFinite(e.value))
      .map(e => ({id: e.id, test: 't-' + e.test, date: e.date, v: e.value, f: {}, note: ''}));
    if (add.length) { store.update('tests', list => list.concat(add)); n += add.length; }
  }
  if (courses && isObj(courses.done)) {
    const old = normCourses(courses);
    if (Object.keys(old.done).length) {
      store.update('courses', v => { Object.keys(old.done).forEach(k => { v.done[k] = Array.from(new Set((v.done[k] || []).concat(old.done[k]))).sort().slice(-MISSION_N[k]); }); return v; });
      n += Object.keys(old.done).length;
    }
  }
  store.set('meta', {migrated: true});
  return n;
}

Object.assign(CM, {
  ABK, AB, TEST, LESSON, DRILL, LEVEL_OF, LEVEL_NAME, YEARS, LONG_GOALS, MODES, SPOTS, LSTATES, GOAL_TYPES, DEF_DAYS,
  defaultProfile, normProfile, num, int, str, isDate,
  MASTERED, lstate, levelStats, startLevel, openLevel, workLevel, lessonOpen, curriculumPct, nextLesson, setLessonState, toggleLessonDrill,
  testEntries, testSummary, isBetter, fmtVal, ability, weakAbilities, saveTest,
  daysTrained, minutesBy, shotTotals, goalProgress, course, markMission, achievements, migrateOld
});
})(window.CM = window.CM || {});
