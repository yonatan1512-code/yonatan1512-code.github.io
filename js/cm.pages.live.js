/* CourtMaster AI — live training mode: one drill at a time with big buttons,
   a timer only where the drill is timed, and a summary with difficulty, pain check and notes at the end.
   The workout in progress is saved, so a refresh or closed tab does not lose it. */
(function (CM) {
'use strict';
const {$, esc, icon, store, UI, today} = CM;

const KIND_NAME = {d: 'תרגיל', l: 'מהשיעור', c: 'מהמאמן'};
function detail(it) {
  const p = it.ref.split(':');
  if (p[0] === 'd' && CM.DRILL[p[1]]) {
    const d = CM.DRILL[p[1]];
    return {kind: d.cat === 'warm' ? 'חימום ושחרור' : CM.CATS[d.cat].name, how: d.how, cues: d.cues, avoid: d.mistakes, goal: d.goal, video: d.video, dose: d.reps || '', link: '#drill.' + d.id, test: d.test};
  }
  if (p[0] === 'l' && CM.LESSON[p[1]]) {
    const l = CM.LESSON[p[1]], x = l.drills[Number(p[2])];
    if (x) return {kind: 'שיעור: ' + l.title, how: x.how, cues: [], avoid: [x.avoid], goal: x.goal, video: l.demo && l.demo.v, dose: x.dose, link: '#lesson.' + l.id};
  }
  return {kind: KIND_NAME.c, how: it.how, cues: [], avoid: [], goal: '', video: null, dose: '', link: ''};
}

function start(date) {
  const w = CM.buildWorkout(date);
  store.set('live', {
    date: today(), plannedFor: date, startedAt: Date.now(), title: w.title, planned: w.total, focus: w.focus, idx: 0, paused: false, ended: false,
    items: w.items.map(it => ({n: it.name, ref: it.ref === 'c' ? 'c' : it.ref, min: it.min, st: '', sec: 0, left: it.timed ? it.min * 60 : null, timed: !!it.timed, how: it.custom ? it.custom.how : ''}))
  });
}

/* ---------- screens ---------- */
function preStart(view, date) {
  const t = today();
  const w = CM.buildWorkout(date);
  if (w.mode === 'rest' || w.mode === 'team') {
    view.innerHTML = UI.head('אימון עכשיו') + '<div class="rest-box big">' + icon(w.mode === 'rest' ? 'moon' : 'users', 'big') + '<div><h2>' + (w.mode === 'rest' ? 'היום יום מנוחה' : 'היום יש אימון קבוצה') + '</h2>' +
      '<p>' + (w.mode === 'rest' ? 'מנוחה היא חלק מהאימון: השרירים והגידים מתחזקים כשהם נחים. ההמלצה לגילך היא לפחות יום מנוחה מלא בשבוע.' : 'האימון של הקבוצה הוא האימון של היום, בלי להוסיף עליו.') + '</p>' +
      '<div class="btn-row"><a class="btn primary" href="#plan">' + icon('cal') + 'לתוכנית השבועית</a><a class="btn ghost" href="#nba">' + icon('eye') + 'ללמוד מצפייה</a></div></div></div>';
    return;
  }
  if (CM.doneOn(t).length && date === t) {
    view.innerHTML = UI.head('אימון עכשיו') + '<div class="rest-box big">' + icon('check', 'big') + '<div><h2>האימון של היום הושלם</h2><p>כל הכבוד. עוד אימון היום לא יקדם אותך יותר, מנוחה כן. אם שמרת אימון בטעות, אפשר למחוק אותו בעמוד ההתקדמות.</p>' +
      '<div class="btn-row"><a class="btn primary" href="#progress">' + icon('chart') + 'להתקדמות</a><a class="btn ghost" href="#plan">' + icon('cal') + 'לתוכנית</a></div></div></div>';
    return;
  }
  view.innerHTML = UI.head(w.title, esc(w.goal) + (date !== t ? ' (האימון של ' + esc(CM.fmtDateLong(date)) + ')' : '')) +
    '<div class="pre"><div class="pre-meta">' + UI.chip(CM.fmtMinutes(w.total), '', 'clock') + UI.chip(w.items.length + ' תרגילים', '', 'grid') + UI.chip(CM.MODES[w.mode].name, '', CM.MODES[w.mode].icon) + '</div>' +
    '<ol class="pre-list">' + w.items.map(it => '<li><b>' + esc(it.name) + '</b><span>' + (it.timed ? it.min + ' דק׳ עם טיימר' : esc(it.dose || it.min + ' דק׳')) + '</span></li>').join('') + '</ol>' +
    '<div class="safety">' + icon('shield') + '<div><b>לפני שמתחילים</b><ul><li>מתחילים בחימום, לא מדלגים עליו.</li><li>בקבוק מים בהישג יד.</li><li>כאב (לא סתם עייפות) = עוצרים ומספרים להורה.</li></ul></div></div>' +
    '<button type="button" class="btn primary xl" data-start>' + icon('play') + 'התחל אימון</button></div>';
  $('[data-start]', view).addEventListener('click', () => { start(date); CM.render(); });
}

function running(view, ctx) {
  let L = store.get('live');
  let timer = null, lock = null, lastSave = Date.now();
  const save = () => { store.set('live', L); lastSave = Date.now(); };
  const cur = () => L.items[L.idx];

  const draw = () => {
    const it = cur();
    const d = detail(it);
    const n = L.items.length;
    const next = L.items[L.idx + 1];
    view.innerHTML = '<div class="live' + (L.paused ? ' paused' : '') + '">' +
      '<div class="live-top"><button type="button" class="icon-btn" data-exit aria-label="יציאה (האימון נשמר)">' + icon('x') + '</button><b class="live-title">' + esc(L.title) + '</b><span class="live-clock" data-total>' + CM.fmtClock(totalSec()) + '</span></div>' +
      '<div class="live-dots" aria-label="תרגיל ' + (L.idx + 1) + ' מתוך ' + n + '">' + L.items.map((x, i) => '<i class="' + (x.st === 'done' ? 'done' : x.st === 'skip' ? 'skip' : i === L.idx ? 'on' : '') + '"></i>').join('') + '</div>' +
      '<section class="live-card"><small class="live-kind">' + (L.idx + 1) + ' מתוך ' + n + ' · ' + esc(d.kind) + '</small><h1>' + esc(it.n) + '</h1>' +
        (it.timed && it.left != null
          ? '<div class="live-timer" data-timer><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" class="lt-bg"/><circle cx="60" cy="60" r="54" class="lt-fg" data-arc/></svg><b data-left>' + CM.fmtClock(it.left) + '</b><small>' + it.min + ' דק׳</small></div>'
          : '<div class="live-dose"><b>' + esc(d.dose || 'בקצב שלך') + '</b><small>על התרגיל: <span data-sec>' + CM.fmtClock(it.sec) + '</span></small></div>') +
        (d.how ? '<p class="live-how">' + esc(d.how) + '</p>' : '') +
        (d.cues.length || d.avoid.length ? '<details class="live-tips"><summary>' + icon('bulb') + 'דגשים וטעויות</summary>' +
          (d.cues.length ? '<ul class="ticks">' + d.cues.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '') +
          (d.avoid.length ? '<ul class="avoid">' + d.avoid.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '') + '</details>' : '') +
        (d.test ? '<a class="link" href="#test.' + d.test + '">' + icon('bulb') + 'למבחן המצבים</a>' : '') +
        (d.video ? UI.video(d.video, {small: true}) : '') +
      '</section>' +
      (next ? '<p class="live-next">הבא: <b>' + esc(next.n) + '</b></p>' : '<p class="live-next">זה התרגיל האחרון</p>') +
      '<div class="live-btns"><button type="button" class="btn primary xl" data-done>' + icon('check') + 'סיימתי תרגיל</button>' +
        '<div class="live-row"><button type="button" class="btn ghost lg" data-skip>' + icon('skip') + 'דלג</button>' +
        '<button type="button" class="btn ghost lg" data-pause>' + icon(L.paused ? 'play' : 'pause') + (L.paused ? 'המשך' : 'השהה') + '</button>' +
        '<button type="button" class="btn ghost lg danger-text" data-end>' + icon('stop') + 'סיים אימון</button></div></div>' +
      (L.paused ? '<div class="pause-veil"><div>' + icon('pause', 'big') + '<h2>מושהה</h2><button type="button" class="btn primary xl" data-pause>' + icon('play') + 'המשך</button></div></div>' : '') +
      '</div>';
    paintTimer();
  };
  const totalSec = () => L.items.reduce((s, x) => s + x.sec, 0);
  const paintTimer = () => {
    const it = cur();
    if (!it) return;
    const tot = $('[data-total]', view); if (tot) tot.textContent = CM.fmtClock(totalSec());
    const sec = $('[data-sec]', view); if (sec) sec.textContent = CM.fmtClock(it.sec);
    const left = $('[data-left]', view);
    if (left && it.left != null) {
      left.textContent = CM.fmtClock(it.left);
      const arc = $('[data-arc]', view), c = 2 * Math.PI * 54;
      arc.setAttribute('stroke-dasharray', (c * it.left / (it.min * 60)).toFixed(1) + ' ' + c.toFixed(1));
      $('[data-timer]', view).classList.toggle('over', it.left === 0);
    }
  };
  const tick = () => {
    if (L.paused || L.ended) return;
    const it = cur();
    if (!it) return;
    it.sec++;
    if (it.left != null && it.left > 0) {
      it.left--;
      if (it.left > 0 && it.left <= 3) UI.beep('tick');
      if (it.left === 0) { UI.beep('end'); CM.toast('הזמן נגמר. לחץ "סיימתי תרגיל" כשאתה מוכן.'); }
    }
    paintTimer();
    if (Date.now() - lastSave > 15000) save();
  };
  const advance = st => {
    cur().st = st;
    if (L.idx >= L.items.length - 1) { L.ended = true; save(); CM.render(); return; }
    L.idx++;
    UI.beep('go');
    save();
    draw();
  };

  view.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-done')) advance('done');
    else if (b.hasAttribute('data-skip')) advance('skip');
    else if (b.hasAttribute('data-pause')) { L.paused = !L.paused; save(); draw(); }
    else if (b.hasAttribute('data-exit')) { save(); location.hash = '#dashboard'; }
    else if (b.hasAttribute('data-end')) {
      const ok = await CM.confirmBox('לסיים את האימון עכשיו?', 'מה שעשית עד עכשיו יישמר בסיכום.', 'סיים ועבור לסיכום');
      if (ok) { L.ended = true; save(); CM.render(); }
    }
  });
  draw();
  timer = setInterval(tick, 1000);
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { lock = l; }, () => {}); } catch (e) {}
  ctx.onLeave(() => { clearInterval(timer); if (store.get('live') && !L.ended) store.set('live', L); try { if (lock) lock.release(); } catch (e) {} });
}

function summary(view) {
  const L = store.get('live');
  const done = L.items.filter(x => x.st === 'done'), skipped = L.items.filter(x => x.st === 'skip');
  const sec = L.items.reduce((s, x) => s + x.sec, 0);
  view.innerHTML = UI.head('סיכום האימון', esc(L.title)) +
    '<div class="sum-stats"><div><b>' + CM.fmtClock(sec) + '</b><small>זמן אימון</small></div><div><b>' + done.length + '</b><small>תרגילים הושלמו</small></div><div><b>' + skipped.length + '</b><small>דילגת</small></div></div>' +
    '<ul class="sum-list">' + L.items.map(x => '<li class="' + (x.st || 'none') + '">' + icon(x.st === 'done' ? 'check' : x.st === 'skip' ? 'skip' : 'minus') + '<span>' + esc(x.n) + '</span><small>' + (x.sec ? CM.fmtClock(x.sec) : '') + '</small></li>').join('') + '</ul>' +
    '<form class="panel sum-form" novalidate>' +
      UI.field('כמה קשה היה?', UI.seg('rpe', {1: 'קל מאוד', 2: 'קל', 3: 'בינוני', 4: 'קשה', 5: 'קשה מאוד'}, '3')) +
      '<label class="toggle"><input type="checkbox" name="pain"><span>הרגשתי כאב (לא סתם עייפות)</span></label>' +
      '<div class="warn-box" data-painmsg hidden>' + icon('alert') + '<p><b>כאב הוא סימן לעצור.</b> ספר להורה עוד היום. אם הכאב נמשך יותר מיום-יומיים, יש נפיחות או שקשה לזוז, צריך לבדוק אצל רופא או פיזיותרפיסט. עד אז, בלי אימון שמכאיב.</p></div>' +
      UI.field('הערות לעצמך', '<textarea name="note" rows="3" maxlength="600" placeholder="מה הלך טוב? מה היה קשה? על מה לעבוד בפעם הבאה?"></textarea>') +
      '<div class="btn-row"><button type="submit" class="btn primary lg">' + icon('check') + 'שמור את האימון</button><button type="button" class="btn ghost" data-resume>' + icon('prev') + 'חזרה לאימון</button><button type="button" class="btn ghost danger-text" data-discard>' + icon('trash') + 'מחק בלי לשמור</button></div>' +
    '</form>';
  const form = $('form', view);
  form.addEventListener('change', e => { if (e.target.name === 'pain') $('[data-painmsg]', view).hidden = !e.target.checked; });
  $('[data-resume]', view).addEventListener('click', () => {
    store.update('live', v => { v.ended = false; if (v.items[v.idx].st) { const j = v.items.findIndex(x => !x.st); if (j >= 0) v.idx = j; else { v.idx = v.items.length - 1; v.items[v.idx].st = ''; } } return v; });
    CM.render();
  });
  $('[data-discard]', view).addEventListener('click', async () => {
    if (await CM.confirmBox('למחוק את האימון?', 'האימון לא יישמר בהתקדמות.', 'מחק', true)) { store.set('live', null); location.hash = '#dashboard'; }
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const pain = form.elements.pain.checked;
    const s = {
      id: CM.uid(), date: L.date, min: Math.round(sec / 60), planned: L.planned, title: L.title, focus: L.focus,
      items: L.items.filter(x => x.st).map(x => ({n: x.n, st: x.st, sec: x.sec, ref: x.ref})),
      rpe: Number(UI.readRadio(form, 'rpe')) || 0, pain, note: form.elements.note.value.trim().slice(0, 600), src: 'live'
    };
    store.update('sessions', list => { list.push(s); return list; });
    const lessons = new Set();
    done.forEach(x => { const p = x.ref.split(':'); if (p[0] === 'l' && CM.LESSON[p[1]]) { CM.toggleLessonDrill(p[1], Number(p[2]), true); lessons.add(p[1]); } });
    store.set('live', null);
    const first = !store.get('sessions').some(x => x.id !== s.id && x.src === 'live');
    view.innerHTML = '<div class="rest-box big">' + icon('trophy', 'big') + '<div><h2>' + (first ? 'האימון הראשון שלך נשמר!' : 'האימון נשמר') + '</h2>' +
      '<p>' + done.length + ' תרגילים ב-' + CM.fmtMinutes(Math.max(1, s.min)) + '. ' + (pain ? 'ספר להורה על הכאב, ותנוח עד שהוא עובר.' : 'עכשיו: מים, ארוחה טובה ושינה.') + '</p>' +
      (lessons.size ? '<p>תרגלת חלק מ' + Array.from(lessons).map(id => '<a href="#lesson.' + id + '">' + esc(CM.LESSON[id].title) + '</a>').join(', ') + '. כשתרגיש מוכן, סמן בשיעור איך הלך.</p>' : '') +
      '<div class="btn-row"><a class="btn primary" href="#dashboard">' + icon('home') + 'ללוח הבקרה</a><a class="btn ghost" href="#progress">' + icon('chart') + 'להתקדמות</a></div></div></div>';
    if (first) CM.toast('הישג חדש: אימון ראשון', 'win');
  });
}

CM.page('live', {
  title: 'אימון עכשיו',
  full: () => { const L = store.get('live'); return !!(L && !L.ended); },
  render(view, param, ctx) {
    const L = store.get('live');
    if (L && L.ended) return summary(view);
    if (L) return running(view, ctx);
    preStart(view, CM.isDate(param) && param >= today() ? param : today());
  }
});
})(window.CM = window.CM || {});
