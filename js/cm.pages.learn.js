/* CourtMaster AI — the curriculum (levels and lessons), one lesson, the drill library, one drill, and "learn from the NBA". */
(function (CM) {
'use strict';
const {$, $$, esc, icon, store, UI, today} = CM;

const STAGE = ['שלב 1 · לומדים את התנועה', 'שלב 2 · שליטה', 'שלב 3 · בתנועה ובמהירות', 'שלב 4 · כמו במשחק'];
const STATE_MSG = {
  learned: 'מעולה. השיעור נספר כשיעור שלמדת, והתרגילים שלו יופיעו מדי פעם לחזרה.',
  practice: 'בסדר גמור. השיעור יחזור באימונים הקרובים עם התרגילים של שלבים 2–3.',
  hard: 'זה חלק מהלמידה. באימונים הקרובים נחזור לתרגילים הבסיסיים של השיעור, לאט ובשליטה.',
  ready: 'יופי. השיעור נספר כשיעור שלמדת, ואפשר לעבור לשיעור הבא.'
};

function favToggle(kind, id) {
  let on = false;
  store.update('favs', v => {
    const list = v[kind];
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else { list.push(id); on = true; }
    return v;
  });
  CM.toast(on ? 'נוסף למועדפים' : 'הוסר מהמועדפים');
}
const favBtn = (kind, id) => {
  const on = store.get('favs')[kind].includes(id);
  return '<button type="button" class="btn ghost sm' + (on ? ' fav-on' : '') + '" data-fav="' + kind + ':' + id + '" aria-pressed="' + on + '">' + icon('heart') + (on ? 'במועדפים' : 'למועדפים') + '</button>';
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fav]');
  if (!b) return;
  const p = b.dataset.fav.split(':');
  favToggle(p[0], p[1]);
});

/* ===================== the curriculum ===================== */
function lessonCard(l, open) {
  const st = CM.lstate(l.id);
  const fav = store.get('favs').lessons.includes(l.id);
  return '<a class="card lesson-card' + (open ? '' : ' locked') + '" href="#lesson.' + l.id + '">' +
    '<div class="dc-top"><span class="cat-ic">' + icon(open ? CM.AB[l.skill].icon : 'lock') + '</span>' + UI.lessonState(st.st) + (fav ? '<span class="fav-dot">' + icon('heart') + '</span>' : '') + '</div>' +
    '<h3>' + esc(l.title) + '</h3><div class="meta">' + UI.chip(CM.AB[l.skill].name, 'soft') + UI.chip(CM.fmtMinutes(l.min), 'soft', 'clock') +
    '<span class="drill-dots" aria-label="' + st.dr.filter(Boolean).length + ' מתוך 4 תרגילים">' + st.dr.map(x => '<i class="' + (x ? 'on' : '') + '"></i>').join('') + '</span></div></a>';
}
CM.page('lessons', {
  title: 'מסלול הלמידה',
  render(view, param, ctx) {
    const ol = CM.openLevel(), wl = CM.workLevel();
    const nl = CM.nextLesson();
    view.innerHTML = UI.head('מסלול הלמידה', '4 רמות, ' + CM.LESSONS.length + ' שיעורים. רמה חדשה נפתחת כשאתה שולט ב-70% מהשיעורים ברמה שלפניה, לפי מה שאתה מסמן בסוף כל שיעור ולא לפי הזמן.') +
      (nl ? '<a class="next-lesson big" href="#lesson.' + nl.id + '"><span class="cat-ic">' + icon(CM.AB[nl.skill].icon) + '</span><div><small>מומלץ עכשיו</small><b>' + esc(nl.title) + '</b><span class="muted">רמה ' + nl.level + ' · ' + esc(CM.AB[nl.skill].name) + ' · ' + CM.fmtMinutes(nl.min) + '</span></div>' + icon('next') + '</a>' : '') +
      CM.LEVELS.map(L => {
        const s = CM.levelStats(L.n), open = L.n <= ol;
        const list = CM.LESSONS.filter(l => l.level === L.n);
        return '<section class="level' + (open ? '' : ' locked') + (L.n === wl ? ' cur' : '') + '" id="level-' + L.n + '"><div class="level-head">' + UI.ring(s.pct, 56, s.pct + '% מרמה ' + L.n) +
          '<div><h2>רמה ' + L.n + ': ' + esc(L.name) + (L.n === wl ? UI.chip('הרמה שלך עכשיו', 'accent') : '') + (open ? '' : UI.chip('נעולה', 'soft', 'lock')) + '</h2>' +
          '<p class="muted">' + esc(L.lead) + '</p><small>' + s.mastered + ' מתוך ' + s.total + ' נלמדו' + (open ? '' : ' · תיפתח כשתגיע ל-70% ברמה ' + (L.n - 1) + ' (עכשיו ' + CM.levelStats(L.n - 1).pct + '%)') + '</small></div></div>' +
          '<div class="cards">' + list.map(l => lessonCard(l, open)).join('') + '</div></section>';
      }).join('');
    ['lessons', 'favs', 'profile'].forEach(k => ctx.watch(k, () => ctx.rerender()));
  }
});

/* ===================== one lesson ===================== */
function addLessonToNext(l) {
  const date = CM.nextSessionDate();
  if (!date) return CM.toast('אין אימון מתוכנן בשבועיים הקרובים', 'error');
  const w = CM.buildWorkout(date);
  if (w.items.some(i => i.lesson && i.lesson.id === l.id)) return CM.toast('השיעור כבר נמצא באימון של ' + CM.fmtDateLong(date));
  const st = CM.lstate(l.id).st;
  const idx = st === 'practice' ? [1, 2] : st === 'hard' ? [0, 1] : CM.MASTERED(st) ? [2, 3] : [0, 1];
  const items = w.items.map(CM.toSaved);
  const coolAt = w.items.findIndex(i => i.kind === 'cool');
  items.splice(coolAt >= 0 ? coolAt : items.length, 0, ...idx.map(i => ({l: l.id, i, min: 6})));
  // keep the session the same length: shorten or drop drills from the end of the main part
  let over = items.reduce((s, i) => s + i.min, 0) - w.min;
  for (let k = items.length - 1; k >= 0 && over > 0; k--) {
    const it = items[k];
    if (!it.d || ['w-dynamic', 'w-ball', 'w-cool'].includes(it.d)) continue;
    const cut = Math.min(over, it.min);
    if (cut >= it.min) { items.splice(k, 1); } else it.min -= cut;
    over -= cut;
  }
  CM.setDay(date, {items, title: w.title, goal: 'לתרגל את השיעור "' + l.title + '". ' + w.goal});
  CM.toast('נוסף לאימון של ' + CM.fmtDateLong(date));
}
CM.page('lesson', {
  nav: 'lessons',
  title: p => (CM.LESSON[p] || {}).title || 'שיעור',
  render(view, id, ctx) {
    const l = CM.LESSON[id];
    if (!l) { view.innerHTML = UI.empty('השיעור לא נמצא', '', '<a class="btn" href="#lessons">למסלול</a>'); return; }
    const open = CM.lessonOpen(l);
    const st = CM.lstate(l.id);
    const same = CM.LESSONS.filter(x => x.level === l.level);
    const i = same.indexOf(l);
    const prev = same[i - 1], next = same[i + 1];
    const v = l.demo && l.demo.v;
    view.innerHTML = '<nav class="crumbs"><a href="#lessons">מסלול הלמידה</a>' + icon('prev') + '<a href="#lessons">רמה ' + l.level + ': ' + esc(CM.LEVELS[l.level - 1].name) + '</a></nav>' +
      UI.head(l.title, '', favBtn('lessons', l.id)) +
      '<div class="lesson-meta">' + UI.chip(CM.AB[l.skill].name, 'accent', CM.AB[l.skill].icon) + UI.chip('רמה ' + l.level, '', 'star') + UI.chip(CM.fmtMinutes(l.min), '', 'clock') + UI.lessonState(st.st) + '</div>' +
      (open ? '' : '<p class="warn">' + icon('lock') + 'השיעור ברמה שעוד נעולה. אפשר לקרוא, ואפשר לסמן אותו כשתגיע ל-70% ברמה ' + (l.level - 1) + '.</p>') +
      '<div class="lesson-grid"><div class="lesson-main">' +
      '<section class="panel"><h2>' + icon('target') + 'מה לומדים</h2><p>' + esc(l.what) + '</p><h3>מתי משתמשים בזה</h3><p>' + esc(l.when) + '</p></section>' +
      '<section class="panel"><h2>' + icon('book') + 'הטכניקה, צעד אחר צעד</h2><ol class="steps-list">' + l.steps.map(s => '<li><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></li>').join('') + '</ol></section>' +
      '<section class="panel"><h2>' + icon('alert') + 'טעויות נפוצות ואיך מתקנים</h2><div class="fixes">' + l.mistakes.map(m => '<div class="fix"><p class="see">' + esc(m[0]) + '</p><p class="do">' + esc(m[1]) + '</p></div>').join('') + '</div></section>' +
      '<section class="panel"><h2>' + icon('play') + 'הדגמה</h2>' + (v ? UI.video(v) : '<p class="muted">אין עדיין סרטון מאומת לשיעור הזה, אז לא הוספנו קישור.</p>') + (l.demo && l.demo.fig ? UI.figure(l.demo.fig) : '') + '</section>' +
      '<section class="panel"><h2>' + icon('grid') + '4 תרגילים מדורגים</h2><p class="muted small">מתחילים מהשלב הראשון ועולים רק כשהתרגיל יוצא נקי.</p><ol class="ldrills">' +
        l.drills.map((d, k) => '<li class="ld' + (st.dr[k] ? ' did' : '') + '"><div class="ld-head"><small>' + STAGE[k] + '</small><label class="ld-check"><input type="checkbox" data-dr="' + k + '"' + (st.dr[k] ? ' checked' : '') + (open ? '' : ' disabled') + '><span>עשיתי</span></label></div>' +
          '<h3>' + esc(d.n) + '</h3><p>' + esc(d.how) + '</p><div class="meta">' + UI.chip(d.dose, 'soft', 'timer') + UI.stars(d.diff) + '</div>' +
          '<p class="ld-goal">' + icon('target') + esc(d.goal) + '</p><p class="ld-avoid">' + icon('x') + 'להיזהר: ' + esc(d.avoid) + '</p></li>').join('') + '</ol></section>' +
      '<section class="panel"><h2>' + icon('check') + 'בדיקה עצמית</h2><p>' + esc(l.test[0]) + '</p><p class="ok-line">' + icon('target') + 'עברת אם: ' + esc(l.test[1]) + '</p>' +
        (l.quiz && CM.TEST[l.quiz] ? '<a class="btn ghost" href="#test.' + l.quiz + '">' + icon('bulb') + 'למבחן: ' + esc(CM.TEST[l.quiz].name) + '</a>' : '') + '</section>' +
      '</div><aside class="lesson-side">' +
      '<section class="panel finish"><h2>איך הלך?</h2><p class="muted small">הבחירה שלך קובעת מה יופיע באימונים הבאים ומתי תיפתח הרמה הבאה.</p><div class="finish-btns">' +
        Object.keys(CM.LSTATES).map(k => '<button type="button" class="fbtn s-' + k + (st.st === k ? ' on' : '') + '" data-st="' + k + '"' + (open ? '' : ' disabled') + ' aria-pressed="' + (st.st === k) + '">' + icon({learned: 'check', practice: 'refresh', hard: 'alert', ready: 'up'}[k]) + CM.LSTATES[k] + '</button>').join('') +
      '</div><p class="finish-msg" data-msg>' + (st.st ? esc(STATE_MSG[st.st]) : '') + '</p></section>' +
      '<button type="button" class="btn primary wide" data-addnext' + (open ? '' : ' disabled') + '>' + icon('plus') + 'הוסף לאימון הקרוב</button>' +
      (l.lib && l.lib.length ? '<section class="panel"><h2>תרגילים מהספרייה</h2><ul class="mini-links">' + l.lib.map(id => CM.DRILL[id]).filter(Boolean).map(d => '<li><a href="#drill.' + d.id + '">' + icon(CM.CATS[d.cat].icon) + esc(d.name) + '</a></li>').join('') + '</ul></section>' : '') +
      '<nav class="pn">' + (prev ? '<a href="#lesson.' + prev.id + '">' + icon('next') + '<span><small>הקודם</small>' + esc(prev.title) + '</span></a>' : '<span></span>') +
        (next ? '<a href="#lesson.' + next.id + '"><span><small>הבא</small>' + esc(next.title) + '</span>' + icon('prev') + '</a>' : '') + '</nav>' +
      '</aside></div>';

    view.addEventListener('change', e => {
      const k = e.target.dataset.dr;
      if (k == null) return;
      CM.toggleLessonDrill(l.id, Number(k), e.target.checked);
      e.target.closest('.ld').classList.toggle('did', e.target.checked);
    });
    view.addEventListener('click', e => {
      const b = e.target.closest('[data-st]');
      if (b) {
        const unlocked = CM.setLessonState(l.id, b.dataset.st);
        if (unlocked) CM.toast('רמה ' + unlocked + ' נפתחה! ' + CM.LEVELS[unlocked - 1].name, 'win');
        else CM.toast('נשמר: ' + CM.LSTATES[b.dataset.st]);
        ctx.rerender();
        return;
      }
      if (e.target.closest('[data-addnext]')) addLessonToNext(l);
    });
    ['favs'].forEach(k => ctx.watch(k, () => ctx.rerender()));
  }
});

/* ===================== the drill library ===================== */
const F = {q: '', cat: '', lvl: '', mine: false, fav: false};
function filtered() {
  const eq = CM.equipSet('train');
  const favs = store.get('favs').drills;
  const q = F.q.trim();
  return CM.DRILLS.filter(d => (!F.cat || d.cat === F.cat) && (!F.lvl || d.lvl === Number(F.lvl)) &&
    (!F.mine || d.equip.every(e => eq.has(e))) && (!F.fav || favs.includes(d.id)) &&
    (!q || (d.name + ' ' + d.goal + ' ' + d.how).includes(q)));
}
CM.page('library', {
  title: 'ספריית תרגילים',
  render(view, param, ctx) {
    if (param && CM.CATS[param]) F.cat = param;
    view.innerHTML = UI.head('ספריית תרגילים', CM.DRILLS.length + ' תרגילים בכל התחומים. אפשר לסנן, לשמור במועדפים ולהוסיף לאימון.') +
      '<div class="filters"><label class="search">' + icon('search') + '<input type="search" data-q placeholder="חיפוש תרגיל" value="' + esc(F.q) + '" aria-label="חיפוש תרגיל"></label>' +
        '<div class="chips-row" role="group" aria-label="קטגוריה"><button type="button" class="fchip' + (F.cat ? '' : ' on') + '" data-cat="">הכל</button>' +
          Object.keys(CM.CATS).map(k => '<button type="button" class="fchip' + (F.cat === k ? ' on' : '') + '" data-cat="' + k + '">' + icon(CM.CATS[k].icon) + esc(CM.CATS[k].name) + '</button>').join('') + '</div>' +
        '<div class="filter-row"><select data-lvl aria-label="רמה"><option value="">כל הרמות</option><option value="1"' + (F.lvl === '1' ? ' selected' : '') + '>רמה 1 · בסיס</option><option value="2"' + (F.lvl === '2' ? ' selected' : '') + '>רמה 2 · מתפתח</option><option value="3"' + (F.lvl === '3' ? ' selected' : '') + '>רמה 3 · מתקדם</option></select>' +
          '<label class="toggle sm"><input type="checkbox" data-mine' + (F.mine ? ' checked' : '') + '><span>רק עם הציוד שלי</span></label>' +
          '<label class="toggle sm"><input type="checkbox" data-favs' + (F.fav ? ' checked' : '') + '><span>' + icon('heart') + 'מועדפים</span></label></div></div>' +
      '<p class="muted small" data-count></p><div class="cards" data-results></div>';
    const paint = () => {
      const list = filtered();
      $('[data-count]', view).textContent = list.length + ' תרגילים';
      $('[data-results]', view).innerHTML = list.length ? list.map(UI.drillCard).join('') : UI.empty('אין תרגילים שמתאימים לסינון', 'נסה להסיר חלק מהסינונים.');
    };
    view.addEventListener('input', e => { if (e.target.matches('[data-q]')) { F.q = e.target.value; paint(); } });
    view.addEventListener('change', e => {
      if (e.target.matches('[data-lvl]')) F.lvl = e.target.value;
      else if (e.target.matches('[data-mine]')) F.mine = e.target.checked;
      else if (e.target.matches('[data-favs]')) F.fav = e.target.checked;
      else return;
      paint();
    });
    view.addEventListener('click', e => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      F.cat = b.dataset.cat;
      $$('[data-cat]', view).forEach(x => x.classList.toggle('on', x === b));
      paint();
    });
    paint();
    ctx.watch('favs', paint);
  }
});

/* ===================== one drill ===================== */
CM.page('drill', {
  nav: 'library',
  title: p => (CM.DRILL[p] || {}).name || 'תרגיל',
  render(view, id, ctx) {
    const d = CM.DRILL[id];
    if (!d) { view.innerHTML = UI.empty('התרגיל לא נמצא', '', '<a class="btn" href="#library">לספרייה</a>'); return; }
    const lessons = CM.LESSONS.filter(l => (l.lib || []).includes(d.id));
    const next = CM.nextSessionDate();
    view.innerHTML = '<nav class="crumbs"><a href="#library">ספריית תרגילים</a>' + icon('prev') + '<a href="#library.' + d.cat + '">' + esc(CM.CATS[d.cat].name) + '</a></nav>' +
      UI.head(d.name, esc(d.goal), favBtn('drills', d.id)) +
      '<div class="lesson-meta">' + UI.chip(CM.CATS[d.cat].name, 'accent', CM.CATS[d.cat].icon) + UI.chip('רמה ' + d.lvl, '', 'star') +
        UI.chip(d.reps || CM.fmtMinutes(d.min), '', d.timed ? 'timer' : 'check') + (d.timed ? UI.chip('עם טיימר באימון', 'soft') : '') + UI.equip(d.equip) + '</div>' +
      '<div class="lesson-grid"><div class="lesson-main">' +
      '<section class="panel"><h2>' + icon('book') + 'איך עושים</h2><p>' + esc(d.how) + '</p>' +
        '<h3>דגשים</h3><ul class="ticks">' + d.cues.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' +
        '<h3>טעויות שכדאי להימנע מהן</h3><ul class="avoid">' + d.mistakes.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></section>' +
      (d.video ? '<section class="panel"><h2>' + icon('play') + 'הדגמה</h2>' + UI.video(d.video) + '</section>' : '') +
      '</div><aside class="lesson-side">' +
      '<section class="panel"><h2>להוסיף לאימון</h2>' + (next ? '<p class="muted small">האימון הקרוב: ' + esc(CM.fmtDateLong(next)) + '</p><button type="button" class="btn primary wide" data-add>' + icon('plus') + 'הוסף לאימון הקרוב</button>' : '<p class="muted">אין אימון מתוכנן בשבועיים הקרובים.</p>') +
        (d.test ? '<a class="btn ghost wide" href="#test.' + d.test + '">' + icon('bulb') + 'פתח את מבחן המצבים</a>' : '') + '</section>' +
      '<section class="panel"><h2>משפר את</h2><div class="meta">' + (d.skills || []).map(k => UI.chip(CM.AB[k].name, 'soft', CM.AB[k].icon)).join('') + '</div></section>' +
      (lessons.length ? '<section class="panel"><h2>מופיע בשיעורים</h2><ul class="mini-links">' + lessons.map(l => '<li><a href="#lesson.' + l.id + '">' + icon('book') + esc(l.title) + '</a></li>').join('') + '</ul></section>' : '') +
      '</aside></div>';
    const add = $('[data-add]', view);
    if (add) add.addEventListener('click', () => {
      const r = CM.addDrillTo(next, d.id);
      CM.toast({ok: 'נוסף לאימון של ' + CM.fmtDateLong(next), dup: 'התרגיל כבר באימון הזה', long: 'האימון יהיה ארוך מדי. הסר תרגיל אחר בתוכנית קודם', rest: 'ביום הזה אין אימון'}[r], r === 'ok' ? '' : 'error');
    });
    ctx.watch('favs', () => ctx.rerender());
  }
});

/* ===================== learning from the NBA ===================== */
CM.page('nba', {
  title: 'לומדים מה-NBA',
  render(view) {
    view.innerHTML = '<header class="photo-head" style="background-image:url(images/crowd.webp)"><div><h1>לומדים מה-NBA</h1><p class="lead">שחקנים מקצוענים לא רק מתאמנים, הם גם צופים. כך צופים במשחק כמו מאמן: בוחרים דבר אחד, מסתכלים עליו, ומתרגלים אותו.</p></div><small class="credit">צילום: Klara Kulikova / Unsplash</small></header>' +
      '<section class="panel how-watch"><h2>' + icon('eye') + 'צפייה פעילה, ב-4 צעדים</h2><ol class="steps-list">' +
        '<li><b>בוחרים עיקרון אחד</b><span>מהרשימה למטה. לא מנסים לראות הכל.</span></li>' +
        '<li><b>בוחרים שחקן אחד</b><span>רצוי בתפקיד שלך. עוקבים אחריו גם כשהכדור לא אצלו.</span></li>' +
        '<li><b>רושמים 3 דברים</b><span>מה הוא עשה, מתי, ומה קרה אחרי זה. אפשר בהערות של אימון.</span></li>' +
        '<li><b>מתרגלים</b><span>מוסיפים את התרגיל המתאים לאימון הקרוב.</span></li></ol>' +
        '<p class="muted small">צפייה היא חלק מאימון, לא במקום אימון ולא במקום שינה. רבע אחד מספיק.</p></section>' +
      '<div class="nba-list">' + CM.NBA.map(n => '<article class="panel nba" id="nba-' + n.id + '"><div class="nba-head"><span class="cat-ic">' + icon(n.icon) + '</span><h2>' + esc(n.t) + '</h2></div>' +
        '<p>' + esc(n.what) + '</p>' +
        '<div class="nba-cols"><div><h3>' + icon('eye') + 'על מה להסתכל</h3><ul class="ticks">' + n.watch.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div>' +
        '<div><h3>' + icon('bulb') + 'מה לומדים מזה</h3><p>' + esc(n.learn) + '</p><h3>' + icon('play') + 'איך מתרגלים</h3><div class="meta">' +
          n.practice.map(id => CM.DRILL[id]).filter(Boolean).map(d => '<a class="chip link-chip" href="#drill.' + d.id + '">' + icon(CM.CATS[d.cat].icon) + esc(d.name) + '</a>').join('') +
          (n.lesson && CM.LESSON[n.lesson] ? '<a class="chip link-chip accent" href="#lesson.' + n.lesson + '">' + icon('book') + esc(CM.LESSON[n.lesson].title) + '</a>' : '') + '</div></div></div>' +
        (n.v ? UI.video(n.v, {small: true}) : '') + '</article>').join('') + '</div>' +
      '<p class="muted small">הסרטונים מערוצי YouTube רשמיים (רובם Jr. NBA), ונבדקו שהם קיימים. אין בעמוד תמונות של שחקנים, בגלל זכויות יוצרים.</p>';
  }
});
})(window.CM = window.CM || {});
