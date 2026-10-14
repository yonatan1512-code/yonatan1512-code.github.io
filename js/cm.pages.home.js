/* CourtMaster AI — onboarding (6 steps) and the dashboard. */
(function (CM) {
'use strict';
const {$, $$, esc, icon, store, UI, today, DAY_NAMES} = CM;

/* ===================== onboarding ===================== */
const STEPS = ['פרטים בסיסיים', 'ניסיון ורמה', 'מטרות', 'ימים וזמנים', 'ציוד וסביבה', 'יצירת התוכנית'];
let draft = null, step = 0;
const abOpts = () => { const o = {}; CM.ABILITIES.forEach(a => { o[a.k] = icon(a.icon) + esc(a.name); }); return o; };
const minOpts = mode => mode === 'home' ? [10, 15, 20, 25, 30] : [30, 45, 60, 75, 90];

function dayRows(days) {
  return '<div class="days">' + days.map((d, i) => '<div class="day-row" data-day="' + i + '"><b>' + DAY_NAMES[i] + '</b>' +
    '<select data-k="mode" aria-label="סוג היום ' + DAY_NAMES[i] + '">' + Object.keys(CM.MODES).map(m => '<option value="' + m + '"' + (d.mode === m ? ' selected' : '') + '>' + CM.MODES[m].name + '</option>').join('') + '</select>' +
    '<input type="time" data-k="start" value="' + esc(d.start || '16:30') + '" aria-label="שעת התחלה"' + (d.mode === 'rest' ? ' disabled' : '') + '>' +
    '<select data-k="min" aria-label="משך"' + (d.mode === 'rest' ? ' disabled' : '') + '>' + (d.mode === 'rest' ? '<option value="0">—</option>' : minOpts(d.mode).map(m => '<option value="' + m + '"' + (d.min === m ? ' selected' : '') + '>' + m + ' דק׳</option>').join('')) + '</select></div>').join('') + '</div>' +
    '<div class="load" data-load></div>';
}
function readDays(root) {
  return $$('.day-row', root).map(r => {
    const mode = $('[data-k="mode"]', r).value;
    const start = $('[data-k="start"]', r).value;
    let min = Number($('[data-k="min"]', r).value) || 0;
    if (mode === 'rest') min = 0;
    else if (!minOpts(mode).includes(min)) min = mode === 'home' ? 20 : 60;
    return {mode, start: CM.TIME_RE.test(start) ? start : '16:30', min};
  });
}
function loadBox(days) {
  const w = CM.weekLoad(days);
  const why = CM.checkTemplate(days);
  return '<p class="' + (why ? 'warn' : 'ok-line') + '">' + icon(why ? 'alert' : 'check') + (why ? esc(why) : 'סה״כ ' + CM.fmtMinutes(w.minutes) + ' בשבוע, ' + w.practices + ' אימוני כדורסל ו-' + w.rest + ' ימי מנוחה. בתוך ההמלצות לגילך.') + '</p>';
}
// wires a weekly-days editor: changing a day's type refreshes its time options and the weekly check
CM.wireDays = function (root) {
  const refresh = () => { const box = $('[data-load]', root); if (box) box.innerHTML = loadBox(readDays(root)); };
  root.addEventListener('change', e => {
    const r = e.target.closest('.day-row');
    if (!r) return;
    if (e.target.dataset.k === 'mode') {
      const mode = e.target.value;
      const min = $('[data-k="min"]', r), start = $('[data-k="start"]', r);
      min.disabled = start.disabled = mode === 'rest';
      min.innerHTML = mode === 'rest' ? '<option value="0">—</option>' : minOpts(mode).map(m => '<option value="' + m + '"' + (m === (mode === 'home' ? 20 : 60) ? ' selected' : '') + '>' + m + ' דק׳</option>').join('');
    }
    refresh();
  });
  refresh();
};
CM.dayRows = dayRows;
CM.readDays = readDays;

function stepHtml() {
  const d = draft;
  switch (step) {
    case 0: return '<h2>נעים להכיר</h2><p class="lead">כמה פרטים כדי שהתוכנית תתאים לך. אנחנו לא מבקשים כתובת, בית ספר או טלפון.</p>' +
      (CM.sync && CM.sync.available ? '<p class="note">' + icon('user') + '<span>כבר יש לך חשבון? <a href="#account">התחבר</a>, והאימונים שלך יחזרו.</span></p>' : '') +
      UI.field('איך לקרוא לך?', '<input name="name" maxlength="30" autocomplete="nickname" value="' + esc(d.name) + '" placeholder="שם פרטי או כינוי">', 'לא חובה.') +
      '<div class="row2">' + UI.field('גיל', '<input name="age" type="number" inputmode="numeric" min="8" max="19" value="' + d.age + '">') +
      UI.field('גובה (ס״מ)', '<input name="height" type="number" inputmode="numeric" min="110" max="230" value="' + d.height + '">') + '</div>';
    case 1: return '<h2>ניסיון ורמה</h2><p class="lead">אין תשובה נכונה. הרמה קובעת מאיפה מתחילים במסלול, והמסלול יתקדם לפי התוצאות שלך.</p>' +
      UI.field('הרמה שלך היום', UI.seg('level', {beginner: 'מתחיל', intermediate: 'בינוני', advanced: 'מתקדם'}, d.level), 'בינוני: משחק כבר זמן מה, יודע לכדרר ולזרוק, ורוצה לשפר הכל.') +
      UI.field('כמה זמן אתה משחק', UI.seg('years', CM.YEARS, d.years)) +
      UI.field('משחק בקבוצה מאורגנת?', UI.seg('team', {no: 'לא', yes: 'כן'}, d.team ? 'yes' : 'no'));
    case 2: return '<h2>המטרות שלך</h2><p class="lead">במה תרצה להשתפר? אפשר לבחור הכל.</p>' +
      UI.field('תחומים לשיפור', UI.checks('goals', abOpts(), d.goals)) +
      UI.field('העדיפויות הראשונות (עד 3)', UI.checks('focus', abOpts(), d.focus, 3), 'העדיפויות יופיעו בתוכנית הכי הרבה.') +
      UI.field('המטרה לטווח ארוך', UI.seg('longGoal', CM.LONG_GOALS, d.longGoal));
    case 3: return '<h2>ימים וזמנים</h2><p class="lead">מילאנו שבוע לדוגמה שעומד בהמלצות לגילך. שנה כל יום לפי הלו״ז שלך: מתי יש בית ספר, מתי אפשר להגיע למגרש ומתי יש אימון קבוצה.</p>' +
      dayRows(d.days) +
      '<p class="note">' + icon('info') + 'לפי ההמלצות של ה-NBA ושל USA Basketball לגילאי 12–14: עד 10 שעות כדורסל מאורגן בשבוע, 2–4 אימונים של 60–90 דקות, ולפחות יום מנוחה מלא אחד.</p>';
    case 4: return '<h2>ציוד וסביבה</h2><p class="lead">התרגילים ייבחרו לפי מה שיש לך.</p>' +
      UI.field('איפה אתה מתאמן בדרך כלל', UI.seg('place', {court: 'מגרש ציבורי', home: 'בבית', both: 'גם וגם'}, d.place)) +
      UI.field('ציוד שיש לך', UI.checks('equip', {ball: 'כדור', ball2: 'כדור שני', hoop: 'סל (במגרש או בבית)', wall: 'קיר למסירות', cones: 'קונוסים או סימונים', rope: 'חבל קפיצה'}, d.equip)) +
      UI.field('עם מי', UI.seg('alone', {yes: 'לבד', no: 'יש לי חבר לאימונים'}, d.alone ? 'yes' : 'no')) +
      '<label class="toggle"><input type="checkbox" name="quiet"' + (d.quiet ? ' checked' : '') + '><span>בבית צריך להתאמן בשקט (בלי כדרורים רועשים)</span></label>';
    case 5: {
      const prev = store.data.profile;
      store.data.profile = Object.assign({}, d, {onboarded: true});
      let html;
      try {
        const ws = CM.weekStartOf(today());
        html = '<h2>התוכנית שלך מוכנה</h2><p class="lead">כך נראה השבוע. התוכנית תשתנה לפי מה שתלמד ולפי תוצאות המבחנים, לא רק לפי הזמן.</p>' +
          '<div class="week-mini">' + CM.weekDates(ws).map(date => {
            const w = CM.buildWorkout(date);
            return '<div class="wm m-' + w.mode + '"><b>' + DAY_NAMES[CM.dow(date)] + '</b>' + icon(CM.MODES[w.mode].icon) + '<span>' + esc(w.mode === 'rest' || w.mode === 'team' ? CM.MODES[w.mode].short : w.title) + '</span>' + (w.total ? '<small>' + w.total + ' דק׳</small>' : '') + '</div>';
          }).join('') + '</div>' +
          '<p class="note">' + icon('info') + 'הנתונים נשמרים ' + (store.mode === 'cloud' ? 'בחשבון claude.ai הפרטי שלך.' : 'בדפדפן הזה בלבד. אם תמחק את נתוני הדפדפן, הם יימחקו.') + ' אפשר לשנות הכל בכל רגע בעמוד הפרופיל.</p>';
      } finally { store.data.profile = prev; }
      return html;
    }
  }
  return '';
}
function readStep(root) {
  const d = draft;
  const val = n => { const el = $('[name="' + n + '"]', root); return el ? el.value : ''; };
  if (step === 0) {
    d.name = val('name').trim().slice(0, 30);
    d.age = CM.int(val('age'), 8, 19, 13);
    d.height = CM.int(val('height'), 110, 230, 164);
  } else if (step === 1) {
    d.level = UI.readRadio(root, 'level') || d.level;
    d.years = UI.readRadio(root, 'years') || d.years;
    d.team = UI.readRadio(root, 'team') === 'yes';
  } else if (step === 2) {
    const g = UI.readChecks(root, 'goals');
    if (!g.length) { CM.toast('בחר לפחות תחום אחד', 'error'); return false; }
    d.goals = g;
    d.focus = UI.readChecks(root, 'focus').filter(k => g.includes(k)).slice(0, 3);
    if (!d.focus.length) d.focus = g.slice(0, 2);
    d.longGoal = UI.readRadio(root, 'longGoal') || d.longGoal;
  } else if (step === 3) {
    const days = readDays(root);
    const why = CM.checkTemplate(days);
    if (why) { CM.toast(why, 'error'); return false; }
    d.days = days;
  } else if (step === 4) {
    d.place = UI.readRadio(root, 'place') || d.place;
    d.equip = UI.readChecks(root, 'equip');
    d.alone = UI.readRadio(root, 'alone') !== 'no';
    d.quiet = !!$('[name="quiet"]:checked', root);
  }
  return true;
}
CM.page('onboarding', {
  title: 'ברוך הבא', full: true,
  render(view, param) {
    const prof = store.get('profile');
    if (!draft || param === 'restart') { draft = CM.clone(prof); step = 0; }
    if (param === 'done') {
      view.innerHTML = '<div class="onb onb-done"><div class="onb-card">' + icon('flag', 'big') + '<h1>המסע שלך מתחיל כאן</h1>' +
        '<p class="lead">' + (prof.name ? esc(prof.name) + ', ' : '') + 'התוכנית מוכנה. כל אימון, כל שיעור וכל מבחן יקדמו אותך צעד אחד. בלי קיצורי דרך, ובלי לוותר על מנוחה.</p>' +
        '<a class="btn primary lg" href="#dashboard">' + icon('home') + 'ללוח הבקרה</a></div></div>';
      return;
    }
    view.innerHTML = '<div class="onb"><div class="onb-card"><div class="onb-top">' + '<span class="brand">' + '<b>CourtMaster</b> AI</span>' +
      '<span class="muted">שלב ' + (step + 1) + ' מתוך 6 · ' + STEPS[step] + '</span></div>' +
      '<div class="steps" aria-hidden="true">' + STEPS.map((s, i) => '<i class="' + (i < step ? 'done' : i === step ? 'on' : '') + '"></i>').join('') + '</div>' +
      '<form class="onb-body" novalidate>' + stepHtml() + '</form>' +
      '<div class="onb-foot">' + (step ? '<button type="button" class="btn ghost" data-back>' + icon('prev') + 'הקודם</button>' : '<span></span>') +
      '<button type="button" class="btn primary" data-next>' + (step === 5 ? 'צור את התוכנית שלי' : 'הבא') + icon('next') + '</button></div></div></div>';
    const form = $('.onb-body', view);
    if (step === 3) CM.wireDays(form);
    form.addEventListener('submit', e => e.preventDefault());
    $('[data-next]', view).addEventListener('click', () => {
      if (!readStep(form)) return;
      if (step < 5) { step++; CM.render(); return; }
      const p = Object.assign({}, draft, {onboarded: true, created: prof.created || today()});
      CM.finishingOnboarding = true;
      store.set('profile', CM.normProfile(p));
      CM.finishingOnboarding = false;
      draft = null;
      location.hash = '#onboarding.done';
    });
    const back = $('[data-back]', view);
    if (back) back.addEventListener('click', () => { readStep(form); step--; CM.render(); });
  }
});

/* ===================== dashboard ===================== */
const hm = s => { const p = s.split(':').map(Number); return p[0] * 60 + p[1]; };
function nowHint(date) {
  const live = store.get('live');
  if (live) return {ic: 'play', t: 'יש לך אימון באמצע. אפשר להמשיך מאיפה שעצרת.'};
  const c = CM.dayConf(date);
  if (CM.doneOn(date).length) return {ic: 'check', t: 'האימון של היום הושלם. עכשיו: מים, אוכל טוב ושינה.'};
  const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
  if (c.mode === 'rest') return {ic: 'moon', t: 'היום יום מנוחה. הגוף מתחזק כשהוא נח. אפשר הליכה קלה או צפייה במשחק.'};
  if (c.mode === 'team') return {ic: 'users', t: 'היום אימון קבוצה ב-' + c.start + '. מגיעים מחוממים ועם בקבוק מים.'};
  if (mins >= 21 * 60) return {ic: 'moon', t: 'כבר מאוחר. עדיף לישון טוב ולהתאמן מחר.'};
  const s = hm(c.start);
  if (mins < s) { const left = s - mins; return {ic: 'clock', t: 'האימון מתוכנן ל-' + c.start + ' (בעוד ' + CM.fmtMinutes(left) + ').'}; }
  if (mins < s + 150) return {ic: 'bolt', t: 'זה הזמן לאימון של היום.'};
  return {ic: 'clock', t: 'עוד לא התאמנת היום. גם אימון קצר נחשב, או שאפשר להעביר אותו בתוכנית.'};
}
CM.nowHint = nowHint;

function todayCard(t) {
  const w = CM.buildWorkout(t);
  const done = CM.doneOn(t);
  const live = store.get('live');
  const chips = w.focus.map(k => UI.chip(CM.AB[k].name, 'on-dark', CM.AB[k].icon)).join('');
  let body, actions;
  if (w.mode === 'rest' || w.mode === 'team') {
    const nx = CM.nextSessionDate(CM.addDays(t, 1));
    body = '<h2>' + (w.mode === 'rest' ? 'היום: מנוחה' : 'היום: אימון קבוצה') + '</h2><p>' + esc(w.goal) + '</p>' +
      (nx ? '<p class="muted-on-dark">האימון הבא: ' + esc(CM.fmtDateLong(nx)) + ' · ' + esc(CM.buildWorkout(nx).title) + '</p>' : '');
    actions = '<a class="btn on-dark" href="#plan">' + icon('cal') + 'הצג תוכנית</a>';
  } else {
    body = '<span class="eyebrow">האימון שלך להיום' + (w.ai ? ' · נבנה עם המאמן' : '') + '</span><h2>' + esc(w.title) + '</h2>' +
      '<p>' + esc(w.goal) + '</p><div class="tc-meta">' + UI.chip(CM.fmtMinutes(w.total), 'on-dark', 'clock') + UI.chip(w.items.length + ' תרגילים', 'on-dark', 'grid') +
      UI.chip(CM.MODES[w.mode].name, 'on-dark', CM.MODES[w.mode].icon) + (w.start ? UI.chip(w.start, 'on-dark', 'timer') : '') + chips + '</div>';
    actions = done.length && !live
      ? '<span class="done-badge">' + icon('check') + 'הושלם היום</span><a class="btn on-dark" href="#plan">' + icon('cal') + 'הצג תוכנית</a>'
      : '<a class="btn primary lg" href="#live">' + icon('play') + (live ? 'המשך אימון' : 'התחל אימון') + '</a><a class="btn on-dark" href="#plan">' + icon('cal') + 'הצג תוכנית</a>';
  }
  return '<section class="today-card m-' + w.mode + '" aria-label="האימון של היום"><div class="tc-body">' + body + '<div class="tc-actions">' + actions + '</div></div></section>';
}
function journey() {
  const ol = CM.openLevel(), wl = CM.workLevel();
  const nl = CM.nextLesson();
  return '<section class="panel"><div class="panel-head"><h2>' + icon('flag') + 'המסע שלך</h2><a class="link" href="#lessons">כל המסלול</a></div>' +
    '<ol class="journey">' + CM.LEVELS.map(L => {
      const s = CM.levelStats(L.n), open = L.n <= ol;
      return '<li class="jl' + (L.n === wl ? ' cur' : '') + (open ? '' : ' locked') + '"><span class="jn">' + (s.pct >= 70 ? icon('check') : open ? L.n : icon('lock')) + '</span>' +
        '<div><b>רמה ' + L.n + ': ' + esc(L.name) + '</b>' + UI.bar(s.pct) + '<small>' + s.mastered + ' מתוך ' + s.total + ' שיעורים' + (open ? '' : ' · נפתח ב-70% מהרמה הקודמת') + '</small></div></li>';
    }).join('') + '</ol>' +
    (nl ? '<a class="next-lesson" href="#lesson.' + nl.id + '"><span class="cat-ic">' + icon(CM.AB[nl.skill].icon) + '</span><div><small>השיעור הבא שלך</small><b>' + esc(nl.title) + '</b><span class="muted">רמה ' + nl.level + ' · ' + CM.fmtMinutes(nl.min) + '</span></div>' + UI.lessonState(CM.lstate(nl.id).st) + icon('next') + '</a>' : '') +
    '</section>';
}
function abilities() {
  return '<section class="panel"><div class="panel-head"><h2>' + icon('gauge') + 'היכולות שלי</h2><a class="link" href="#tests">מבחנים</a></div>' +
    '<p class="muted small">התוצאות הן שלך בלבד, בלי השוואה לנורמות. מה שחשוב הוא השיפור מול עצמך.</p>' +
    '<div class="abil">' + CM.ABILITIES.map(a => {
      const s = CM.ability(a.k);
      if (!s.measured) return '<a class="ab" href="#test.' + a.tests[0] + '">' + icon(a.icon) + '<b>' + esc(a.name) + '</b><span class="nm">טרם נמדד</span><small>למבחן ←</small></a>';
      const tr = s.trend === 'up' ? '<span class="tr up">' + icon('up') + 'השתפר</span>' : s.trend === 'down' ? '<span class="tr down">ירד מהפעם הקודמת</span>' : s.trend === 'same' ? '<span class="tr">ללא שינוי</span>' : '<span class="tr">מדידה ראשונה</span>';
      return '<a class="ab measured" href="#test.' + s.t.id + '">' + icon(a.icon) + '<b>' + esc(a.name) + '</b><span class="val">' + CM.fmtVal(s.t, s.last.v) + ' <small>' + esc(s.t.unit) + '</small></span>' + tr + '<small>' + esc(s.t.name) + ' · ' + CM.fmtDate(s.last.date) + '</small>' + UI.spark(s.list.map(e => s.t.better === 'down' ? -e.v : e.v)) + '</a>';
    }).join('') + '</div></section>';
}
function weekStrip(t) {
  const ws = CM.weekStartOf(t);
  let planned = 0, done = 0;
  const cells = CM.weekDates(ws).map(date => {
    const c = CM.dayConf(date);
    const ses = CM.doneOn(date);
    if (c.mode === 'train' || c.mode === 'home') planned += c.min;
    done += ses.reduce((s, x) => s + x.min, 0);
    return '<a class="ws' + (date === t ? ' today' : '') + (ses.length ? ' did' : '') + ' m-' + c.mode + '" href="#plan.' + date + '"><small>' + CM.DAY_SHORT[CM.dow(date)] + '</small>' + icon(ses.length ? 'check' : CM.MODES[c.mode].icon) + '<span>' + CM.fmtDate(date) + '</span></a>';
  }).join('');
  return '<section class="panel"><div class="panel-head"><h2>' + icon('cal') + 'השבוע שלי</h2><span class="muted">' + done + ' מתוך ' + planned + ' דקות</span></div><div class="week-strip">' + cells + '</div>' + UI.bar(planned ? 100 * done / planned : 0) + '</section>';
}
CM.page('dashboard', {
  title: 'לוח הבקרה',
  render(view, param, ctx) {
    const p = store.get('profile'), t = today();
    const hint = nowHint(t);
    const ach = CM.achievements().filter(a => a.got).length;
    view.innerHTML =
      '<header class="hello"><div><p class="muted">' + esc(CM.fmtDateLong(t)) + '</p><h1>' + CM.greeting() + (p.name ? ', ' + esc(p.name) : '') + '</h1>' +
        '<div class="hello-meta">' + UI.chip('רמה: ' + CM.LEVEL_NAME[p.level], 'accent', 'star') + UI.chip(CM.daysTrained() + ' ימי אימון', '', 'flame') + UI.chip(ach + ' הישגים', '', 'trophy') + '</div></div>' +
        '<div class="hello-ring">' + UI.ring(CM.curriculumPct(), 84, 'התקדמות במסלול') + '<small>התקדמות במסלול</small></div></header>' +
      '<p class="now">' + icon(hint.ic) + esc(hint.t) + '</p>' +
      todayCard(t) +
      '<div class="grid2">' + journey() + weekStrip(t) + '</div>' +
      abilities() +
      '<section class="quick">' +
        '<a class="card q" href="#coach">' + icon('chat') + '<b>המאמן שלי</b><span class="muted">שאל שאלה או בקש אימון מותאם</span></a>' +
        '<a class="card q" href="#tests">' + icon('gauge') + '<b>למדוד את עצמי</b><span class="muted">מבחן קצר, ואז השוואה לפעם הקודמת</span></a>' +
        '<a class="card q" href="#goals">' + icon('trophy') + '<b>אתגרי כוכבים</b><span class="muted">קרי, לוקה, קובי, יאניס ודני</span></a>' +
        '<a class="card q" href="#nba">' + icon('eye') + '<b>לומדים מה-NBA</b><span class="muted">על מה להסתכל כשצופים במשחק</span></a>' +
      '</section>';
    ['sessions', 'plan', 'lessons', 'tests', 'profile', 'live'].forEach(k => ctx.watch(k, () => ctx.rerender()));
  }
});
})(window.CM = window.CM || {});
