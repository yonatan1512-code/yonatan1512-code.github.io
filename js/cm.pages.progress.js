/* CourtMaster AI — progress (charts by week or month, editable workout and shooting records)
   and goals (personal goals, achievements and the star challenges). */
(function (CM) {
'use strict';
const {$, $$, esc, icon, store, UI, today} = CM;

let unit = 'week';
const openCourses = new Set();
const TABS = {summary: 'סיכום', sessions: 'אימונים', shots: 'קליעה', tests: 'מבחנים'};
const RPE = {1: 'קל מאוד', 2: 'קל', 3: 'בינוני', 4: 'קשה', 5: 'קשה מאוד'};
const pct = (m, a) => a ? Math.round(100 * m / a) : 0;

function sessionDialog(s) {
  const isNew = !s;
  s = s || {date: today(), title: '', min: 60, rpe: 3, note: '', pain: false};
  return CM.dialog({
    title: isNew ? 'הוספת אימון' : 'עריכת אימון',
    html: '<form class="dlg-form">' + UI.field('תאריך', '<input type="date" name="date" value="' + s.date + '" max="' + today() + '">') +
      UI.field('מה עשית', '<input name="title" maxlength="80" value="' + esc(s.title) + '" placeholder="למשל: קליעה במגרש, אימון קבוצה">') +
      '<div class="row2">' + UI.field('דקות', '<input type="number" name="min" min="5" max="180" value="' + s.min + '">') +
      UI.field('כמה קשה', '<select name="rpe">' + Object.keys(RPE).map(k => '<option value="' + k + '"' + (Number(k) === s.rpe ? ' selected' : '') + '>' + RPE[k] + '</option>').join('') + '</select>') + '</div>' +
      '<label class="toggle"><input type="checkbox" name="pain"' + (s.pain ? ' checked' : '') + '><span>היה כאב</span></label>' +
      UI.field('הערות', '<textarea name="note" rows="3" maxlength="600">' + esc(s.note) + '</textarea>') + '</form>',
    actions: [{label: 'שמור', read: w => {
      const f = $('form', w).elements;
      const min = Number(f.min.value);
      if (!CM.isDate(f.date.value) || f.date.value > today()) { CM.toast('תאריך לא תקין', 'error'); return false; }
      if (!Number.isFinite(min) || min < 5 || min > 180) { CM.toast('דקות: בין 5 ל-180', 'error'); return false; }
      const patch = {date: f.date.value, title: f.title.value.trim().slice(0, 80) || 'אימון', min: Math.round(min), rpe: Number(f.rpe.value), pain: f.pain.checked, note: f.note.value.trim().slice(0, 600)};
      store.update('sessions', list => {
        if (isNew) list.push(Object.assign({id: CM.uid(), planned: 0, focus: [], items: [], src: 'manual'}, patch));
        else list.forEach(x => { if (x.id === s.id) Object.assign(x, patch); });
        return list.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      });
      return true;
    }}, {label: 'ביטול', value: null}]
  });
}
function shotDialog(r) {
  return CM.dialog({
    title: 'עריכת רישום קליעה',
    html: '<form class="dlg-form">' + shotFields(r) + '</form>',
    actions: [{label: 'שמור', read: w => {
      const v = readShot($('form', w));
      if (!v) return false;
      store.update('records', list => list.map(x => x.id === r.id ? Object.assign(x, v) : x));
      return true;
    }}, {label: 'ביטול', value: null}]
  });
}
function shotFields(r) {
  r = r || {date: today(), spot: 'mid', made: '', att: '', note: ''};
  return '<div class="row2">' + UI.field('תאריך', '<input type="date" name="date" value="' + r.date + '" max="' + today() + '">') +
    UI.field('מאיפה', '<select name="spot">' + Object.keys(CM.SPOTS).map(k => '<option value="' + k + '"' + (r.spot === k ? ' selected' : '') + '>' + esc(CM.SPOTS[k]) + '</option>').join('') + '</select>') + '</div>' +
    '<div class="row2">' + UI.field('נכנסו', '<input type="number" inputmode="numeric" name="made" min="0" max="1000" value="' + r.made + '">') +
    UI.field('זריקות', '<input type="number" inputmode="numeric" name="att" min="1" max="1000" value="' + r.att + '">') + '</div>' +
    UI.field('הערה', '<input name="note" maxlength="300" value="' + esc(r.note) + '">');
}
function readShot(form) {
  const f = form.elements;
  const made = Number(f.made.value), att = Number(f.att.value);
  if (!Number.isInteger(att) || att < 1 || att > 1000) { CM.toast('מספר הזריקות: בין 1 ל-1000', 'error'); return null; }
  if (!Number.isInteger(made) || made < 0 || made > att) { CM.toast('מספר הקליעות: בין 0 למספר הזריקות', 'error'); return null; }
  if (!CM.isDate(f.date.value) || f.date.value > today()) { CM.toast('תאריך לא תקין', 'error'); return null; }
  return {date: f.date.value, spot: f.spot.value, made, att, note: f.note.value.trim().slice(0, 300)};
}

function summaryTab() {
  const data = CM.minutesBy(unit, unit === 'week' ? 8 : 6);
  const lab = k => unit === 'week' ? CM.fmtDate(k) : CM.MONTHS[Number(k.slice(5)) - 1].slice(0, 3);
  const S = store.get('sessions');
  const totalMin = S.reduce((s, x) => s + x.min, 0);
  const rated = S.filter(x => x.rpe);
  const sh = CM.shotTotals();
  const shotPts = data.filter(d => d.att).map(d => ({v: pct(d.made, d.att), text: pct(d.made, d.att) + '%', label: lab(d.k), tip: d.made + '/' + d.att}));
  return '<div class="seg-tabs" role="group" aria-label="תצוגה"><button type="button" class="' + (unit === 'week' ? 'on' : '') + '" data-unit="week">לפי שבוע</button><button type="button" class="' + (unit === 'month' ? 'on' : '') + '" data-unit="month">לפי חודש</button></div>' +
    '<div class="stats"><div><b>' + S.length + '</b><small>אימונים</small></div><div><b>' + CM.fmtMinutes(totalMin) + '</b><small>זמן אימון</small></div><div><b>' + CM.daysTrained() + '</b><small>ימי אימון</small></div>' +
      '<div><b>' + (rated.length ? (rated.reduce((s, x) => s + x.rpe, 0) / rated.length).toFixed(1) : '—') + '</b><small>קושי ממוצע (1–5)</small></div>' +
      '<div><b>' + (sh.att ? pct(sh.made, sh.att) + '%' : '—') + '</b><small>קליעה (' + sh.made + '/' + sh.att + ')</small></div></div>' +
    '<section class="panel"><h2>' + icon('clock') + 'דקות אימון ' + (unit === 'week' ? 'בשבוע' : 'בחודש') + '</h2>' +
      (S.length ? UI.bars(data.map((d, i) => ({v: d.min, label: lab(d.k), hi: i === data.length - 1, tip: lab(d.k) + ': ' + d.min + ' דקות, ' + d.n + ' אימונים'})), {aria: 'דקות אימון', fmt: v => v}) +
        (unit === 'week' ? '<p class="muted small">ההמלצה לגילך: עד 600 דקות (10 שעות) כדורסל מאורגן בשבוע.</p>' : '')
        : UI.empty('עוד אין אימונים', 'אחרי האימון הראשון במצב אימון חי, הגרף יתחיל להתמלא.', '<a class="btn primary" href="#live">' + icon('play') + 'התחל אימון</a>')) + '</section>' +
    '<section class="panel"><h2>' + icon('target') + 'אחוז קליעה ' + (unit === 'week' ? 'בשבוע' : 'בחודש') + '</h2>' +
      (shotPts.length ? UI.line(shotPts, {aria: 'אחוז קליעה'}) : '<p class="muted">עוד אין רישומי קליעה. אפשר לרשום בלשונית "קליעה".</p>') + '</section>';
}
function sessionsTab() {
  const S = store.get('sessions').slice().reverse();
  return '<div class="btn-row"><button type="button" class="btn primary" data-addses>' + icon('plus') + 'הוסף אימון ידנית</button></div>' +
    (S.length ? '<ul class="records">' + S.map(s => '<li><div><b>' + esc(s.title) + '</b><small>' + esc(CM.fmtDateLong(s.date)) + ' · ' + CM.fmtMinutes(s.min) + (s.rpe ? ' · ' + RPE[s.rpe] : '') + (s.src === 'live' ? ' · ' + s.items.filter(i => i.st === 'done').length + ' תרגילים' : ' · נרשם ידנית') + '</small>' +
      (s.pain ? '<span class="chip warn-chip">' + icon('alert') + 'דווח כאב</span>' : '') + (s.note ? '<p class="muted">' + esc(s.note) + '</p>' : '') + '</div>' +
      '<span class="row-tools"><button type="button" class="icon-btn" data-edses="' + s.id + '" aria-label="ערוך">' + icon('edit') + '</button><button type="button" class="icon-btn" data-delses="' + s.id + '" aria-label="מחק">' + icon('trash') + '</button></span></li>').join('') + '</ul>'
      : UI.empty('עוד אין אימונים', 'אימון שמסיימים במצב "אימון עכשיו" נשמר כאן אוטומטית.'));
}
function shotsTab() {
  const R = store.get('records').slice().sort((a, b) => a.date < b.date ? 1 : -1);
  const tot = CM.shotTotals();
  return '<section class="panel"><h2>' + icon('plus') + 'רישום קליעה</h2><form class="shot-form" novalidate>' + shotFields() + '<button type="submit" class="btn primary">' + icon('check') + 'שמור</button></form></section>' +
    '<div class="spots">' + Object.keys(CM.SPOTS).map(k => { const b = tot.by[k]; return '<div class="spot"><b>' + (b.att ? pct(b.made, b.att) + '%' : '—') + '</b><small>' + esc(CM.SPOTS[k]) + '</small><span class="muted">' + b.made + '/' + b.att + '</span></div>'; }).join('') + '</div>' +
    (R.length ? '<ul class="records">' + R.map(r => '<li><div><b>' + r.made + '/' + r.att + ' · ' + pct(r.made, r.att) + '%</b><small>' + esc(CM.SPOTS[r.spot]) + ' · ' + CM.fmtDate(r.date) + (r.note ? ' · ' + esc(r.note) : '') + '</small></div>' +
      '<span class="row-tools"><button type="button" class="icon-btn" data-edshot="' + r.id + '" aria-label="ערוך">' + icon('edit') + '</button><button type="button" class="icon-btn" data-delshot="' + r.id + '" aria-label="מחק">' + icon('trash') + '</button></span></li>').join('') + '</ul>'
      : UI.empty('עוד אין רישומים', 'רושמים אחרי כל סבב קליעה: כמה זריקות, כמה נכנסו ומאיפה.'));
}
function testsTab() {
  const any = CM.TESTS.filter(t => CM.testEntries(t.id).length);
  if (!any.length) return UI.empty('עוד לא נמדדת', 'המבחנים מראים כמה התקדמת מול עצמך.', '<a class="btn primary" href="#tests">' + icon('gauge') + 'למבחנים</a>');
  return '<div class="cards">' + any.map(t => {
    const s = CM.testSummary(t.id);
    return '<a class="card" href="#test.' + t.id + '"><div class="dc-top"><span class="cat-ic">' + icon(t.icon) + '</span><small class="muted">' + s.list.length + ' מדידות</small></div><h3>' + esc(t.name) + '</h3>' +
      UI.line(s.list.slice(-8).map(e => ({v: e.v, text: CM.fmtVal(t, e.v), label: CM.fmtDate(e.date)})), {h: 150, aria: t.name}) + '<small class="muted">לעריכה ולמחיקה של תוצאות ←</small></a>';
  }).join('') + '</div>';
}

CM.page('progress', {
  title: 'התקדמות',
  render(view, param, ctx) {
    const tab = TABS[param] ? param : 'summary';
    view.innerHTML = UI.head('התקדמות', 'כל מה שעשית, בגרפים וברשימות. כל רישום אפשר לערוך או למחוק.') +
      '<nav class="tabs" aria-label="לשוניות">' + Object.keys(TABS).map(k => '<a href="#progress' + (k === 'summary' ? '' : '.' + k) + '" class="' + (k === tab ? 'on' : '') + '"' + (k === tab ? ' aria-current="page"' : '') + '>' + TABS[k] + '</a>').join('') + '</nav>' +
      '<div class="tab-body">' + ({summary: summaryTab, sessions: sessionsTab, shots: shotsTab, tests: testsTab})[tab]() + '</div>';
    view.addEventListener('click', async e => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.unit) { unit = d.unit; ctx.rerender(); }
      else if (b.hasAttribute('data-addses')) { if (await sessionDialog()) CM.toast('האימון נוסף'); }
      else if (d.edses) { const s = store.get('sessions').find(x => x.id === d.edses); if (s && await sessionDialog(s)) CM.toast('האימון עודכן'); }
      else if (d.delses) { if (await CM.confirmBox('למחוק את האימון?', 'אי אפשר לבטל את המחיקה.', 'מחק', true)) { store.update('sessions', l => l.filter(x => x.id !== d.delses)); CM.toast('האימון נמחק'); } }
      else if (d.edshot) { const r = store.get('records').find(x => x.id === d.edshot); if (r && await shotDialog(r)) CM.toast('הרישום עודכן'); }
      else if (d.delshot) { if (await CM.confirmBox('למחוק את הרישום?', 'אי אפשר לבטל את המחיקה.', 'מחק', true)) { store.update('records', l => l.filter(x => x.id !== d.delshot)); CM.toast('הרישום נמחק'); } }
    });
    const sf = $('.shot-form', view);
    if (sf) sf.addEventListener('submit', e => {
      e.preventDefault();
      const v = readShot(sf);
      if (!v) return;
      store.update('records', l => { l.push(Object.assign({id: CM.uid()}, v)); return l; });
      CM.toast('נשמר: ' + v.made + '/' + v.att);
    });
    ['sessions', 'records', 'tests'].forEach(k => ctx.watch(k, () => ctx.rerender()));
  }
});

/* ===================== goals and achievements ===================== */
function goalDialog(g) {
  const isNew = !g;
  g = g || {type: 'test', test: 't-shoot', target: 12, title: '', by: ''};
  const testOpts = CM.TESTS.map(t => '<option value="' + t.id + '"' + (g.test === t.id ? ' selected' : '') + '>' + esc(t.name) + ' (' + esc(t.unit) + ')</option>').join('');
  return CM.dialog({
    title: isNew ? 'מטרה חדשה' : 'עריכת מטרה',
    html: '<form class="dlg-form">' + UI.field('סוג המטרה', '<select name="type">' + Object.keys(CM.GOAL_TYPES).map(k => '<option value="' + k + '"' + (g.type === k ? ' selected' : '') + '>' + CM.GOAL_TYPES[k] + '</option>').join('') + '</select>') +
      '<div data-for="test">' + UI.field('מבחן', '<select name="test">' + testOpts + '</select>', 'היעד מושווה לשיא שלך במבחן.') + '</div>' +
      '<div data-for="custom">' + UI.field('המטרה במילים שלך', '<input name="title" maxlength="80" value="' + esc(g.type === 'custom' ? g.title : '') + '" placeholder="למשל: 50 לייאפים ביד שמאל">') + '</div>' +
      '<div class="row2">' + UI.field('יעד (מספר)', '<input type="number" name="target" min="1" max="100000" step="0.01" value="' + g.target + '">') +
      UI.field('עד תאריך (לא חובה)', '<input type="date" name="by" value="' + (g.by || '') + '" min="' + today() + '">') + '</div>' +
      '<p class="muted small">מטרה טובה: אפשרית, ברורה ועם תאריך. לא צריך להבטיח לעצמך תוצאה, רק לעבוד בשבילה.</p></form>',
    onOpen: w => {
      const f = $('form', w);
      const sync = () => $$('[data-for]', f).forEach(el => { el.hidden = el.dataset.for !== f.elements.type.value; });
      f.addEventListener('change', sync); sync();
    },
    actions: [{label: 'שמור', read: w => {
      const f = $('form', w).elements;
      const type = f.type.value, target = Number(f.target.value);
      if (!Number.isFinite(target) || target <= 0) { CM.toast('יעד: מספר גדול מ-0', 'error'); return false; }
      let title;
      if (type === 'custom') { title = f.title.value.trim().slice(0, 80); if (!title) { CM.toast('כתוב מה המטרה', 'error'); return false; } }
      else if (type === 'test') { const t = CM.TEST[f.test.value]; title = t.name + ': ' + (t.better === 'down' ? 'עד ' : '') + target + ' ' + t.unit; }
      else title = {sessions: target + ' אימונים', lessons: target + ' שיעורים שנלמדו', shots: target + ' קליעות שנרשמו'}[type];
      const v = {type, title, target, test: type === 'test' ? f.test.value : undefined, by: CM.isDate(f.by.value) ? f.by.value : undefined};
      store.update('goals', list => {
        if (isNew) list.push(Object.assign({id: CM.uid(), created: today(), manual: 0}, v));
        else list.forEach(x => { if (x.id === g.id) { Object.assign(x, v); if (!v.by) delete x.by; if (!v.test) delete x.test; } });
        return list;
      });
      return true;
    }}, {label: 'ביטול', value: null}]
  });
}
CM.page('goals', {
  title: 'מטרות והישגים',
  render(view, param, ctx) {
    const G = store.get('goals');
    const ach = CM.achievements();
    view.innerHTML = UI.head('מטרות והישגים', 'מטרות שאתה בוחר, הישגים שנפתחים מעצמם, ואתגרים בהשראת שחקנים.') +
      '<section class="panel"><div class="panel-head"><h2>' + icon('flag') + 'המטרות שלי</h2><button type="button" class="btn primary sm" data-addgoal>' + icon('plus') + 'מטרה חדשה</button></div>' +
        (G.length ? '<ul class="goals">' + G.map(g => {
          const p = CM.goalProgress(g);
          const late = g.by && g.by < today() && !p.done;
          return '<li class="' + (p.done ? 'done' : '') + '"><div class="g-top"><b>' + (p.done ? icon('check') : '') + esc(g.title) + '</b><span class="row-tools">' +
            (g.type === 'custom' && !p.done ? '<button type="button" class="icon-btn" data-gplus="' + g.id + '" aria-label="הוסף 1">' + icon('plus') + '</button><button type="button" class="icon-btn" data-gminus="' + g.id + '" aria-label="הורד 1">' + icon('minus') + '</button>' : '') +
            '<button type="button" class="icon-btn" data-gedit="' + g.id + '" aria-label="ערוך">' + icon('edit') + '</button><button type="button" class="icon-btn" data-gdel="' + g.id + '" aria-label="מחק">' + icon('trash') + '</button></span></div>' +
            UI.bar(p.pct, p.done ? 'win' : '') + '<small class="muted">' + esc(p.label) + (g.by ? ' · עד ' + CM.fmtDate(g.by) : '') + (late ? ' · התאריך עבר, אפשר לעדכן אותו' : '') + '</small></li>';
        }).join('') + '</ul>' : UI.empty('עוד אין מטרות', 'למשל: 14 מתוך 20 במבחן הקליעה, או 12 אימונים החודש.')) + '</section>' +
      '<section class="panel"><h2>' + icon('medal') + 'הישגים (' + ach.filter(a => a.got).length + ' מתוך ' + ach.length + ')</h2><div class="badges">' +
        ach.map(a => '<div class="badge' + (a.got ? ' got' : '') + '">' + icon(a.got ? a.icon : 'lock') + '<b>' + esc(a.t) + '</b><small>' + esc(a.d) + '</small></div>').join('') + '</div></section>' +
      '<section class="challenges"><h2>' + icon('star') + 'אתגרי כוכבים</h2><p class="muted">משימות בהשראת שחקנים, מותאמות לגילך. כל משימה נפתחת אחרי הקודמת, ונספרת פעם אחת ביום.</p>' +
        CM.CHALLENGES.map(c => {
          const st = CM.course(c);
          return '<details class="panel course" data-course="' + c.id + '"' + (param === c.id || openCourses.has(c.id) ? ' open' : '') + '><summary><span class="cat-ic">' + icon(c.icon) + '</span><div><b>' + esc(c.player) + '</b><small>' + esc(c.skill) + ' · ' + st.doneCount + ' מתוך ' + c.missions.length + '</small></div>' + UI.ring(100 * st.doneCount / c.missions.length, 44) + '</summary>' +
            '<p>' + esc(c.story) + '</p>' + (st.finished ? '<p class="ok-line">' + icon('trophy') + 'סיימת את האתגר! התג שלך: ' + esc(c.badge) + '</p>' : '') +
            '<ol class="missions">' + st.ms.map(m => '<li class="' + (m.done ? 'done' : m.unlocked ? 'open' : 'locked') + '"><div><b>' + esc(m.m.t) + '</b><span>' + esc(m.m.d) + '</span><small>' + m.count + ' מתוך ' + m.m.n + ' פעמים</small></div>' +
              (m.done ? icon('check') : !m.unlocked ? icon('lock') : '<button type="button" class="btn ' + (m.today ? 'ghost' : 'primary') + ' sm" data-mission="' + m.key + '" data-on="' + (m.today ? '0' : '1') + '">' + (m.today ? 'בטל את היום' : 'עשיתי היום') + '</button>') + '</li>').join('') + '</ol></details>';
        }).join('') + '</section>';
    view.addEventListener('click', async e => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (b.hasAttribute('data-addgoal')) { if (await goalDialog()) CM.toast('המטרה נוספה'); }
      else if (d.gedit) { const g = store.get('goals').find(x => x.id === d.gedit); if (g && await goalDialog(g)) CM.toast('המטרה עודכנה'); }
      else if (d.gdel) { if (await CM.confirmBox('למחוק את המטרה?', 'אי אפשר לבטל את המחיקה.', 'מחק', true)) store.update('goals', l => l.filter(x => x.id !== d.gdel)); }
      else if (d.gplus || d.gminus) {
        const id = d.gplus || d.gminus;
        store.update('goals', l => l.map(x => { if (x.id === id) { x.manual = CM.clamp((x.manual || 0) + (d.gplus ? 1 : -1), 0, x.target); if (x.manual >= x.target) x.done = today(); } return x; }));
      } else if (d.mission) {
        const before = CM.CHALLENGES.find(c => d.mission.startsWith(c.id + '-'));
        const was = before && CM.course(before).finished;
        CM.markMission(d.mission, d.on === '1');
        if (before && !was && CM.course(before).finished) CM.toast('סיימת את האתגר של ' + before.player + '!', 'win');
        else if (d.on === '1') CM.toast('כל הכבוד! נספר להיום');
      }
    });
    // remember which challenges are open, so a redraw after marking a mission keeps them open
    view.addEventListener('toggle', e => {
      const d = e.target.closest && e.target.closest('[data-course]');
      if (d) { if (d.open) openCourses.add(d.dataset.course); else openCourses.delete(d.dataset.course); }
    }, true);
    ['goals', 'courses', 'tests', 'sessions', 'lessons', 'records'].forEach(k => ctx.watch(k, () => ctx.rerender()));
  }
});
})(window.CM = window.CM || {});
