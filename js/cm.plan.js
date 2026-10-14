/* CourtMaster AI — the weekly plan and the workout for each day.
   Built from the profile (days, time, equipment, goals) and from progress (current lessons, weak test results).
   Changes for a single day are stored apart from the template, so editing never touches saved progress.
   Every plan stays inside the NBA / USA Basketball youth guidelines for ages 12–14. */
(function (CM) {
'use strict';
const {store, today, addDays, weekStartOf, dow, daysBetween, seeded, clamp, AB, DRILL, LESSON, LIMITS, MODES} = CM;

// which library categories train each ability
const CAT_FOR = {
  handle: ['dribble'], shoot: ['shoot'], finish: ['finish'], defense: ['defense'], footwork: ['footwork'],
  speed: ['speed'], decisions: ['pass', 'iq'], iq: ['iq', 'pass']
};
// drills that make little noise indoors (for "train quietly" at home)
const QUIET = new Set(['s-lying', 'fw-triple', 'fw-pivot', 'fw-jab', 'df-stance', 'df-slides', 'sp-balance', 'sp-strength', 'iq-film', 'iq-scenarios', 'iq-visual', 'iq-vcut', 'w-dynamic', 'w-cool']);
// screen or quiz work: good at home, not on the court
const OFFCOURT = new Set(['iq-film', 'iq-scenarios']);
const HOME_SKILLS = ['handle', 'footwork', 'speed', 'decisions', 'iq', 'shoot', 'defense'];

function equipSet(mode) {
  const p = store.get('profile');
  const s = new Set(p.equip);
  s.add('screen');
  if (!p.alone) s.add('partner');
  if (mode === 'home') { s.delete('hoop'); s.delete('partner'); }
  return s;
}
function maxDrillLevel() {
  const base = CM.LEVEL_OF[store.get('profile').level] || 1;
  return Math.max(base, CM.openLevel() >= 3 ? 3 : CM.openLevel() >= 2 ? 2 : 1);
}
function drillFits(d, mode, eq) {
  if (d.cat === 'warm') return false;
  if (!d.equip.every(e => eq.has(e))) return false;
  if (d.lvl > maxDrillLevel()) return false;
  if (mode === 'train' && OFFCOURT.has(d.id)) return false;
  if (mode === 'home' && store.get('profile').quiet && !QUIET.has(d.id)) return false;
  return true;
}

/* ---------- the week ---------- */
function dayConf(date) {
  const p = store.get('profile');
  const base = p.days[dow(date)];
  const o = store.get('plan').days[date] || {};
  const c = {date, mode: o.mode || base.mode, start: o.start || base.start, min: o.min != null ? o.min : base.min, override: !!store.get('plan').days[date]};
  if (c.mode === 'rest') c.min = 0;
  if (c.mode === 'home') c.min = clamp(c.min || 20, LIMITS.homeMin, LIMITS.homeMax);
  if (c.mode === 'train' || c.mode === 'team') c.min = clamp(c.min || 60, LIMITS.trainMin, LIMITS.trainMax);
  if (!c.start && c.mode !== 'rest') c.start = '16:30';
  c.focusOverride = o.focus || null;
  c.items = o.items || null;
  c.title = o.title || '';
  c.goal = o.goal || '';
  c.ai = !!o.ai;
  return c;
}
const weekDates = ws => [0, 1, 2, 3, 4, 5, 6].map(i => addDays(ws, i));

// goals in order: main priorities, then abilities whose last test went down, then untested, then the rest
function priorities() {
  const p = store.get('profile');
  const goals = p.goals.length ? p.goals : CM.ABK.slice();
  const focus = p.focus.filter(k => goals.includes(k));
  const weak = CM.weakAbilities();
  const rest = goals.filter(k => !focus.includes(k)).sort((a, b) => {
    const sc = k => weak.includes(k) ? 0 : !CM.ability(k).measured ? 1 : 2;
    return sc(a) - sc(b);
  });
  if (!focus.length) return rest;
  // the main priorities come up every other session
  const cycle = [];
  rest.forEach((k, i) => { cycle.push(focus[i % focus.length]); cycle.push(k); });
  return cycle.length ? cycle : focus;
}
function weekFocus(ws) {
  const out = {};
  const cyc = priorities();
  if (!cyc.length) return out;
  const homeCyc = cyc.filter(k => HOME_SKILLS.includes(k));
  const wk = Math.floor(daysBetween('2026-01-04', ws) / 7);
  let ci = 0, hi = 0;
  const confs = weekDates(ws).map(dayConf);
  const courtDays = confs.filter(c => c.mode === 'train').length || 1;
  const homeDays = confs.filter(c => c.mode === 'home').length || 1;
  confs.forEach(c => {
    if (c.mode === 'train') {
      const i = (wk * courtDays + ci++) * 2;
      const a = cyc[i % cyc.length];
      let b = cyc[(i + 1) % cyc.length];
      if (b === a) b = cyc.find(k => k !== a) || a;
      out[c.date] = a === b ? [a] : [a, b];
    } else if (c.mode === 'home' && homeCyc.length) {
      const a = homeCyc[(wk * homeDays + hi++) % homeCyc.length];
      out[c.date] = [a];
    }
  });
  return out;
}
function focusOf(date) {
  const c = dayConf(date);
  if (c.focusOverride) return c.focusOverride;
  return weekFocus(weekStartOf(date))[date] || [];
}

/* ---------- limits ---------- */
function weekLoad(confs) {
  const practices = confs.filter(c => c.mode === 'train' || c.mode === 'team').length;
  const rest = confs.filter(c => c.mode === 'rest').length;
  const minutes = confs.reduce((s, c) => s + (c.mode === 'rest' ? 0 : c.min), 0);
  return {practices, rest, minutes};
}
// returns an explanation when a change would break the youth guidelines, otherwise ''
function checkWeek(confs) {
  const w = weekLoad(confs);
  if (w.rest < LIMITS.minRest) return 'צריך לפחות יום מנוחה מלא אחד בשבוע. הגוף מתחזק בזמן המנוחה, לא רק באימון.';
  if (w.practices > LIMITS.maxPractices) return 'עד 4 אימוני כדורסל (מגרש או קבוצה) בשבוע בגיל שלך. את שאר הימים אפשר להפוך לאימון קצר בבית או למנוחה.';
  if (w.minutes > LIMITS.weekMin) return 'עד 10 שעות כדורסל מאורגן בשבוע בגיל שלך. קצר אימון אחר לפני שמוסיפים.';
  return '';
}
function checkDayChange(date, patch) {
  const ws = weekStartOf(date);
  const confs = weekDates(ws).map(d => {
    const c = dayConf(d);
    if (d !== date) return c;
    const n = Object.assign({}, c, patch);
    if (n.mode === 'rest') n.min = 0;
    return n;
  });
  return checkWeek(confs);
}
function checkTemplate(days) { return checkWeek(days.map((d, i) => Object.assign({date: String(i)}, d))); }
function setDay(date, patch) {
  store.update('plan', v => { v.days[date] = Object.assign({}, v.days[date] || {}, patch); return v; });
}
function resetDay(date) { store.update('plan', v => { delete v.days[date]; return v; }); }

/* ---------- the workout ---------- */
function itemFromDrill(d, min, kind) {
  return {ref: 'd:' + d.id, kind, name: d.name, min, timed: !!d.timed, dose: d.reps || '', drill: d};
}
function itemFromLesson(l, i, min) {
  const x = l.drills[i];
  return {ref: 'l:' + l.id + ':' + i, kind: 'lesson', name: x.n, min, timed: false, dose: x.dose, lesson: l, idx: i, ld: x};
}
function itemFromSaved(it) {
  if (it.d) return itemFromDrill(DRILL[it.d], it.min, 'main');
  if (it.l) return itemFromLesson(LESSON[it.l], it.i, it.min);
  return {ref: 'c', kind: 'custom', name: it.c.name, min: it.min, timed: true, dose: '', custom: it.c};
}
const toSaved = it => it.drill ? {d: it.drill.id, min: it.min} : it.lesson ? {l: it.lesson.id, i: it.idx, min: it.min} : {c: it.custom, min: it.min};

// which two lesson drills fit where he is with that lesson
function lessonDrillIdx(l) {
  const st = CM.lstate(l.id);
  if (st.st === 'practice') return [1, 2];
  if (st.st === 'hard') return [0, 1];
  const firstOpen = st.dr.findIndex(x => !x);
  if (firstOpen >= 0 && firstOpen < 3) return [firstOpen, firstOpen + 1];
  return [2, 3];
}

function buildWorkout(date) {
  const c = dayConf(date);
  const focus = focusOf(date);
  const w = {date, mode: c.mode, start: c.start, min: c.min, focus, items: [], lesson: null, custom: false, title: '', goal: '', ai: c.ai};
  const names = focus.map(k => AB[k].name);
  if (c.mode === 'rest' || c.mode === 'team') {
    w.title = MODES[c.mode].name;
    w.goal = c.mode === 'rest' ? 'לתת לגוף להתאושש: שינה, מים ואוכל טוב.' : 'אימון עם הקבוצה. מגיעים מחוממים ושותים מים.';
    w.total = c.mode === 'team' ? c.min : 0;
    return w;
  }
  if (c.items) {
    w.items = c.items.map(itemFromSaved);
    w.custom = true;
    w.title = c.title || 'אימון מותאם';
    w.goal = c.goal || (names.length ? 'לשפר ' + names.join(' ו') : '');
    w.lesson = (w.items.find(i => i.lesson) || {}).lesson || null;
    w.total = w.items.reduce((s, i) => s + i.min, 0);
    return w;
  }
  const rnd = seeded(date + focus.join(','));
  const eq = equipSet(c.mode);
  const used = new Set();
  const take = (d, min, kind) => { used.add(d.id); w.items.push(itemFromDrill(d, min, kind)); return min; };
  let left = c.min;
  const pool = (k, preferIds) => {
    const cats = CAT_FOR[k] || [];
    const list = CM.DRILLS.filter(d => cats.includes(d.cat) && !used.has(d.id) && drillFits(d, c.mode, eq));
    const pref = list.filter(d => (preferIds || []).includes(d.id));
    const others = list.filter(d => !pref.includes(d)).map(d => [rnd(), d]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    return pref.concat(others);
  };

  if (c.mode === 'home') {
    const warm = Math.min(8, Math.max(4, Math.round(c.min * 0.25)));
    left -= take(DRILL['w-dynamic'], warm, 'warm');
    const lessonFor = focus[0] ? CM.nextLesson(focus[0]) : null;
    const main = focus.length ? pool(focus[0], lessonFor ? lessonFor.lib : []) : [];
    const backup = ['footwork', 'speed', 'decisions'].flatMap(k => pool(k, []));
    const cool = c.min > 20 ? 4 : 0;
    for (const d of main.concat(backup)) {
      if (left - cool < 3) break;
      if (used.has(d.id)) continue;
      left -= take(d, Math.min(d.min, left - cool), 'main');
    }
    if (cool) take(DRILL['w-cool'], cool, 'cool');
    w.lesson = lessonFor;
    w.title = names.length ? 'בית: ' + names[0] : 'אימון קצר בבית';
    w.goal = 'אימון שקט וקצר בלי סל: ' + (names[0] || 'רגליים, כוח וחשיבה') + '.';
  } else {
    left -= take(DRILL['w-dynamic'], 8, 'warm');
    if (eq.has('ball')) left -= take(DRILL['w-ball'], 5, 'warm');
    const cool = c.min >= 45 ? 6 : 4;
    left -= cool;
    const prof = store.get('profile');
    // a short form-shooting routine on every court day when shooting is one of his goals
    if (prof.goals.includes('shoot') && focus[0] !== 'shoot' && eq.has('hoop') && left >= 40) left -= take(DRILL['s-form'], 6, 'main');
    const lesson = focus[0] ? CM.nextLesson(focus[0]) : CM.nextLesson();
    if (lesson && left >= 20) {
      lessonDrillIdx(lesson).forEach(i => { w.items.push(itemFromLesson(lesson, i, 6)); left -= 6; });
      w.lesson = lesson;
    }
    // few drills, done properly: 2–4 for the main focus and 1–2 for the second one
    const nA = left >= 50 ? 4 : left >= 30 ? 3 : 2;
    const nB = focus[1] ? (left >= 40 ? 2 : 1) : 0;
    const fill = (list, n) => {
      for (const d of list) { if (n <= 0 || left < 4) break; const m = Math.min(Math.max(d.min, 5), left); left -= take(d, m, 'main'); n--; }
    };
    if (focus[0]) fill(pool(focus[0], lesson ? lesson.lib : []), nA);
    if (focus[1]) fill(pool(focus[1], []), nB);
    // the time still free goes to the main drills, timed ones first, up to 15 minutes each
    const main = w.items.filter(i => i.kind === 'main').sort((x, y) => (y.timed ? 1 : 0) - (x.timed ? 1 : 0));
    for (let k = 0; left > 0 && main.length && k < 200; k++) {
      const it = main[k % main.length];
      if (it.min < 15) { it.min++; left--; } else if (main.every(t => t.min >= 15)) break;
    }
    w.items.push(itemFromDrill(DRILL['w-cool'], cool, 'cool'));
    w.title = names.length ? names.join(' + ') : 'אימון מגרש';
    w.goal = lesson ? 'להתקדם בשיעור "' + lesson.title + '" ולשפר ' + names.join(' ו') + '.' : 'לשפר ' + names.join(' ו') + '.';
  }
  w.total = w.items.reduce((s, i) => s + i.min, 0);
  return w;
}

// replace one drill of a day's workout with another from the same category
function swapItem(date, idx) {
  const w = buildWorkout(date);
  const it = w.items[idx];
  if (!it || !it.drill) return false;
  const eq = equipSet(w.mode);
  const usedIds = new Set(w.items.filter(i => i.drill).map(i => i.drill.id));
  const options = CM.DRILLS.filter(d => d.cat === it.drill.cat && !usedIds.has(d.id) && (d.cat === 'warm' || drillFits(d, w.mode, eq)));
  if (!options.length) return false;
  const d = options[Math.floor(Math.random() * options.length)];
  const items = w.items.map(toSaved);
  items[idx] = {d: d.id, min: it.min};
  setDay(date, {items, title: w.title, goal: w.goal});
  return d;
}
function removeItem(date, idx) {
  const w = buildWorkout(date);
  const items = w.items.map(toSaved).filter((x, i) => i !== idx);
  if (!items.length) return false;
  setDay(date, {items, title: w.title, goal: w.goal});
  return true;
}
function addDrillTo(date, drillId) {
  const c = dayConf(date);
  if (c.mode === 'rest' || c.mode === 'team') return 'rest';
  const w = buildWorkout(date);
  if (w.items.some(i => i.drill && i.drill.id === drillId)) return 'dup';
  const d = DRILL[drillId];
  const items = w.items.map(toSaved);
  const coolAt = w.items.findIndex(i => i.kind === 'cool');
  const at = coolAt >= 0 ? coolAt : items.length;
  items.splice(at, 0, {d: d.id, min: d.min});
  const total = items.reduce((s, i) => s + i.min, 0);
  const cap = c.mode === 'home' ? LIMITS.homeMax : LIMITS.trainMax;
  if (total > cap) return 'long';
  setDay(date, {items, title: w.title, goal: w.goal, min: Math.max(c.min, total)});
  return 'ok';
}
function moveItem(date, idx, dir) {
  const w = buildWorkout(date);
  const items = w.items.map(toSaved);
  const j = idx + dir;
  if (j < 0 || j >= items.length) return;
  const t = items[idx]; items[idx] = items[j]; items[j] = t;
  setDay(date, {items, title: w.title, goal: w.goal});
}

// next day with a planned session (today included unless already done)
function nextSessionDate(from) {
  const start = from || today();
  for (let i = 0; i < 14; i++) {
    const d = addDays(start, i);
    const c = dayConf(d);
    if ((c.mode === 'train' || c.mode === 'home') && !(i === 0 && store.get('sessions').some(s => s.date === d))) return d;
  }
  return null;
}
const doneOn = date => store.get('sessions').filter(s => s.date === date);

Object.assign(CM, {
  CAT_FOR, QUIET, equipSet, maxDrillLevel, drillFits, dayConf, weekDates, priorities, weekFocus, focusOf,
  weekLoad, checkWeek, checkDayChange, checkTemplate, setDay, resetDay,
  buildWorkout, swapItem, removeItem, addDrillTo, moveItem, toSaved, itemFromSaved, nextSessionDate, doneOn
});
})(window.CM = window.CM || {});
