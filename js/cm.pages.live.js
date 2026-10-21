/* CourtMaster AI — live training mode: one drill at a time with big buttons,
   and a summary with difficulty, pain check and notes at the end.
   Hands-free (the default): every drill runs on a timer, the coach reads the drills aloud, calls half time and
   the last 30 seconds, rests briefly and starts the next drill by itself, so the phone can stay on the bench.
   The workout in progress is saved, so a refresh or closed tab does not lose it. */
(function (CM) {
'use strict';
const {$, esc, icon, store, UI, today} = CM;

CM.liveRest = 15;   // seconds of rest between drills in hands-free mode
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
// what the coach says when a drill comes up: its name, the amount, and one cue
function intro(it) {
  const d = detail(it);
  const dose = d.dose ? d.dose.replace('×', 'כפול') : it.min + ' דקות';
  return it.n + '. ' + dose + '.' + (d.cues[0] ? ' ' + d.cues[0] + '.' : '');
}

function start(date) {
  const w = CM.buildWorkout(date);
  const auto = store.get('settings').auto;
  store.set('live', {
    date: today(), plannedFor: date, startedAt: Date.now(), title: w.title, planned: w.total, focus: w.focus, idx: 0, paused: false, ended: false,
    auto, rest: null, restMax: CM.liveRest,
    // hands-free: every drill gets a timer from its planned minutes
    items: w.items.map(it => ({n: it.name, ref: it.ref === 'c' ? 'c' : it.ref, min: it.min, st: '', sec: 0, left: it.timed || auto ? it.min * 60 : null, timed: !!it.timed, how: it.custom ? it.custom.how : ''}))
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
  const s = store.get('settings');
  view.innerHTML = UI.head(w.title, esc(w.goal) + (date !== t ? ' (האימון של ' + esc(CM.fmtDateLong(date)) + ')' : '')) +
    '<div class="pre"><div class="pre-meta">' + UI.chip(CM.fmtMinutes(w.total), '', 'clock') + UI.chip(w.items.length + ' תרגילים', '', 'grid') + UI.chip(CM.MODES[w.mode].name, '', CM.MODES[w.mode].icon) + '</div>' +
    '<ol class="pre-list">' + w.items.map(it => '<li><b>' + esc(it.name) + '</b><span>' + (it.timed ? it.min + ' דק׳ עם טיימר' : esc(it.dose || it.min + ' דק׳')) + '</span></li>').join('') + '</ol>' +
    '<section class="panel handsfree"><h2>' + icon('volume') + 'אימון בלי לגעת בטלפון</h2>' +
      '<label class="toggle"><input type="checkbox" data-set="voice"' + (s.voice ? ' checked' : '') + '><span>המאמן מקריא בקול: שם התרגיל, כמה לעשות, חצי זמן ועוד 30 שניות</span></label>' +
      '<label class="toggle"><input type="checkbox" data-set="auto"' + (s.auto ? ' checked' : '') + '><span>מעבר אוטומטי: כשהזמן נגמר יש ' + CM.liveRest + ' שניות מנוחה, והתרגיל הבא מתחיל לבד</span></label>' +
      '<label class="toggle"><input type="checkbox" data-set="sound"' + (s.sound ? ' checked' : '') + '><span>צפצופים בסוף כל תרגיל ובשניות האחרונות</span></label>' +
      '<p class="muted small" data-voicenote>' + (UI.canSpeak() ? 'שים את הטלפון על הספסל או נשען על הקיר, עם הווליום למעלה. המסך לא ייכבה.' : 'במכשיר הזה לא נמצא קול בעברית, אז יהיו רק צפצופים. אפשר להוסיף קול עברי בהגדרות הטלפון (המרת טקסט לדיבור).') + '</p></section>' +
    '<div class="safety">' + icon('shield') + '<div><b>לפני שמתחילים</b><ul><li>מתחילים בחימום, לא מדלגים עליו.</li><li>בקבוק מים בהישג יד.</li><li>כאב (לא סתם עייפות) = עוצרים ומספרים להורה.</li></ul></div></div>' +
    '<button type="button" class="btn primary xl" data-start>' + icon('play') + 'התחל אימון</button></div>';
  view.addEventListener('change', e => {
    const k = e.target.dataset.set;
    if (k) store.update('settings', v => { v[k] = e.target.checked; return v; });
  });
  $('[data-start]', view).addEventListener('click', () => {
    start(date);
    // the first words are spoken inside the tap, which also unlocks speech on phones
    UI.say('מתחילים. ' + intro(store.get('live').items[0]));
    UI.beep('go');
    CM.render();
  });
}

function running(view, ctx) {
  let L = store.get('live');
  let timer = null, lock = null, lastSave = Date.now();
  const save = () => { store.set('live', L); lastSave = Date.now(); };
  const cur = () => L.items[L.idx];
  const totalSec = () => L.items.reduce((s, x) => s + x.sec, 0);
  const ring = (label, value, max, sub) => '<div class="live-timer" data-timer><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" class="lt-bg"/><circle cx="60" cy="60" r="54" class="lt-fg" data-arc/></svg>' +
    '<b data-left aria-label="' + esc(label) + '">' + CM.fmtClock(value) + '</b><small>' + esc(sub) + '</small></div>';
  const controls = main => '<div class="live-btns">' + main +
    '<div class="live-row"><button type="button" class="btn ghost lg" data-skip>' + icon('skip') + 'דלג</button>' +
    '<button type="button" class="btn ghost lg" data-pause>' + icon(L.paused ? 'play' : 'pause') + (L.paused ? 'המשך' : 'השהה') + '</button>' +
    '<button type="button" class="btn ghost lg danger-text" data-end>' + icon('stop') + 'סיים אימון</button></div></div>';

  const draw = () => {
    const it = cur();
    const d = detail(it);
    const n = L.items.length;
    const next = L.items[L.idx + 1];
    const top = '<div class="live-top"><button type="button" class="icon-btn" data-exit aria-label="יציאה (האימון נשמר)">' + icon('x') + '</button><b class="live-title">' + esc(L.title) + '</b>' +
      (L.auto ? '<span class="hf-badge">' + icon('volume') + 'ידיים חופשיות</span>' : '') + '<span class="live-clock" data-total>' + CM.fmtClock(totalSec()) + '</span></div>' +
      '<div class="live-dots" aria-label="תרגיל ' + (L.idx + 1) + ' מתוך ' + n + '">' + L.items.map((x, i) => '<i class="' + (x.st === 'done' ? 'done' : x.st === 'skip' ? 'skip' : i === L.idx ? 'on' : '') + '"></i>').join('') + '</div>';
    const veil = L.paused ? '<div class="pause-veil"><div>' + icon('pause', 'big') + '<h2>מושהה</h2><button type="button" class="btn primary xl" data-pause>' + icon('play') + 'המשך</button></div></div>' : '';
    if (L.rest != null) {
      // a short rest, with the next drill already announced
      view.innerHTML = '<div class="live far' + (L.paused ? ' paused' : '') + '">' + top +
        '<section class="live-card rest-card"><small class="live-kind">מנוחה · שותים מים</small>' + ring('זמן מנוחה', L.rest, L.restMax, 'מנוחה') +
        '<p class="rest-next"><small>הבא · ' + (L.idx + 1) + ' מתוך ' + n + '</small><b>' + esc(it.n) + '</b><span>' + esc(d.dose || it.min + ' דק׳') + '</span></p></section>' +
        controls('<button type="button" class="btn primary xl" data-go>' + icon('play') + 'התחל עכשיו</button>') + veil + '</div>';
      paint();
      return;
    }
    view.innerHTML = '<div class="live' + (L.auto ? ' far' : '') + (L.paused ? ' paused' : '') + '">' + top +
      '<section class="live-card"><small class="live-kind">' + (L.idx + 1) + ' מתוך ' + n + ' · ' + esc(d.kind) + '</small><h1>' + esc(it.n) + '</h1>' +
        (it.left != null
          ? (L.auto && d.dose ? '<p class="far-dose">' + esc(d.dose) + '</p>' : '') + ring('זמן שנשאר', it.left, it.min * 60, it.min + ' דק׳')
          : '<div class="live-dose"><b>' + esc(d.dose || 'בקצב שלך') + '</b><small>על התרגיל: <span data-sec>' + CM.fmtClock(it.sec) + '</span></small></div>') +
        (d.how ? '<p class="live-how">' + esc(d.how) + '</p>' : '') +
        (d.cues.length || d.avoid.length ? '<details class="live-tips"><summary>' + icon('bulb') + 'דגשים וטעויות</summary>' +
          (d.cues.length ? '<ul class="ticks">' + d.cues.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '') +
          (d.avoid.length ? '<ul class="avoid">' + d.avoid.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '') + '</details>' : '') +
        (d.test ? '<a class="link" href="#test.' + d.test + '">' + icon('bulb') + 'למבחן המצבים</a>' : '') +
        (d.video && !L.auto ? UI.video(d.video, {small: true}) : '') +
      '</section>' +
      (next ? '<p class="live-next">הבא: <b>' + esc(next.n) + '</b></p>' : '<p class="live-next">זה התרגיל האחרון</p>') +
      controls('<button type="button" class="btn primary xl" data-done>' + icon('check') + 'סיימתי תרגיל</button>') + veil + '</div>';
    paint();
  };
  const paint = () => {
    const tot = $('[data-total]', view); if (tot) tot.textContent = CM.fmtClock(totalSec());
    const it = cur();
    if (!it) return;
    const sec = $('[data-sec]', view); if (sec) sec.textContent = CM.fmtClock(it.sec);
    const left = $('[data-left]', view);
    if (!left) return;
    const value = L.rest != null ? L.rest : it.left, max = L.rest != null ? L.restMax : it.min * 60;
    if (value == null) return;
    left.textContent = CM.fmtClock(value);
    const arc = $('[data-arc]', view), c = 2 * Math.PI * 54;
    arc.setAttribute('stroke-dasharray', (c * value / max).toFixed(1) + ' ' + c.toFixed(1));
    $('[data-timer]', view).classList.toggle('over', L.rest == null && value === 0);
  };
  const beginNext = () => { L.rest = null; UI.beep('go'); UI.say('מתחילים. ' + cur().n); save(); draw(); };
  // a drill is finished (by the timer, a tap, or a skip)
  const finish = st => {
    cur().st = st;
    if (L.idx >= L.items.length - 1) {
      L.ended = true; L.rest = null; save();
      UI.beep('end');
      UI.say('סיימת את האימון. כל הכבוד! עכשיו מתיחות, מים ומנוחה.');
      CM.render();
      return;
    }
    L.idx++;
    if (L.auto) {
      L.rest = L.restMax = CM.liveRest;
      UI.say('מנוחה. הבא: ' + intro(cur()));
    } else {
      UI.beep('go');
      UI.say(intro(cur()));
    }
    save();
    draw();
  };
  const tick = () => {
    if (L.paused || L.ended) return;
    if (L.rest != null) {
      L.rest = Math.max(0, L.rest - 1);
      if (L.rest > 0 && L.rest <= 3) UI.beep('tick');
      if (L.rest === 0) beginNext(); else paint();
      return;
    }
    const it = cur();
    if (!it) return;
    it.sec++;
    if (it.left != null && it.left > 0) {
      it.left--;
      const total = it.min * 60;
      if (total >= 120 && it.left === Math.floor(total / 2)) UI.say('חצי זמן');
      else if (total >= 90 && it.left === 30) UI.say('עוד 30 שניות');
      if (it.left > 0 && it.left <= 5) UI.beep('tick');
      if (it.left === 0) {
        UI.beep('end');
        if (L.auto) { finish('done'); return; }
        UI.say('הזמן נגמר');
        CM.toast('הזמן נגמר. לחץ "סיימתי תרגיל" כשאתה מוכן.');
      }
    }
    paint();
    if (Date.now() - lastSave > 15000) save();
  };

  view.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-done')) finish('done');
    else if (b.hasAttribute('data-go')) beginNext();
    else if (b.hasAttribute('data-skip')) { if (L.rest != null) { L.rest = null; finish('skip'); } else finish('skip'); }
    else if (b.hasAttribute('data-pause')) { L.paused = !L.paused; UI.say(L.paused ? 'עצרנו' : 'ממשיכים'); save(); draw(); }
    else if (b.hasAttribute('data-exit')) { save(); UI.hush(); location.hash = '#dashboard'; }
    else if (b.hasAttribute('data-end')) {
      const ok = await CM.confirmBox('לסיים את האימון עכשיו?', 'מה שעשית עד עכשיו יישמר בסיכום.', 'סיים ועבור לסיכום');
      if (ok) { L.ended = true; L.rest = null; save(); UI.hush(); CM.render(); }
    }
  });
  draw();
  timer = setInterval(tick, 1000);
  // keep the screen on; the browser drops the lock when the tab is hidden, so ask again when it comes back
  const keepAwake = () => { try { if (navigator.wakeLock && document.visibilityState === 'visible') navigator.wakeLock.request('screen').then(l => { lock = l; }, () => {}); } catch (e) {} };
  keepAwake();
  document.addEventListener('visibilitychange', keepAwake);
  ctx.onLeave(() => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', keepAwake);
    if (store.get('live') && !L.ended) store.set('live', L);
    try { if (lock) lock.release(); } catch (e) {}
  });
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
    store.update('live', v => { v.ended = false; v.rest = null; if (v.items[v.idx].st) { const j = v.items.findIndex(x => !x.st); if (j >= 0) v.idx = j; else { v.idx = v.items.length - 1; v.items[v.idx].st = ''; } } return v; });
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
