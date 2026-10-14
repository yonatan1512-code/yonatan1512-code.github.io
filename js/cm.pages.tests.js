/* CourtMaster AI — tests: the list, and one test (explanation, equipment, steps, timer or quiz,
   entering a result, comparison with earlier results, history you can edit, and what to practice next). */
(function (CM) {
'use strict';
const {$, $$, esc, icon, store, UI, today} = CM;

function resultLine(t) {
  const s = CM.testSummary(t.id);
  if (!s.last) return '<span class="nm">טרם נמדד</span>';
  const tr = s.trend === 'up' ? '<span class="tr up">' + icon('up') + 'השתפר</span>' : s.trend === 'down' ? '<span class="tr down">ירד</span>' : '';
  return '<span class="val">' + CM.fmtVal(t, s.last.v) + ' <small>' + esc(t.unit) + '</small></span>' + tr + '<small class="muted">' + CM.fmtDate(s.last.date) + '</small>';
}
CM.page('tests', {
  title: 'מבחנים ומדידות',
  render(view, param, ctx) {
    const due = CM.TESTS.filter(t => { const s = CM.testSummary(t.id); return !s.last || CM.daysBetween(s.last.date, today()) >= 28; });
    view.innerHTML = UI.head('מבחנים ומדידות', 'מודדים כל 3–4 שבועות, באותם תנאים. כל תוצאה מושווית רק לתוצאות הקודמות שלך, בלי נורמות ובלי דירוגים.') +
      (due.length ? '<p class="note">' + icon('calcheck') + '<span>מומלץ למדוד: ' + due.slice(0, 5).map(t => '<a href="#test.' + t.id + '">' + esc(t.name) + '</a>').join(' · ') + (due.length > 5 ? ' ועוד ' + (due.length - 5) : '') + '</span></p>' : '') +
      Object.keys(CM.TEST_GROUPS).map(g => '<section class="tgroup"><h2>' + esc(CM.TEST_GROUPS[g]) + '</h2><div class="cards">' +
        CM.TESTS.filter(t => t.group === g).map(t => '<a class="card test-card" href="#test.' + t.id + '"><div class="dc-top"><span class="cat-ic">' + icon(t.icon) + '</span>' + (t.ab ? UI.chip(CM.AB[t.ab].name, 'soft') : UI.chip('כושר', 'soft')) + '</div>' +
          '<h3>' + esc(t.name) + '</h3><p class="muted">' + esc(t.what) + '</p><div class="tc-res">' + resultLine(t) + '</div></a>').join('') + '</div></section>').join('');
    ctx.watch('tests', () => ctx.rerender());
  }
});

/* ---------- the quiz runner (decision-making and rules) ---------- */
function runQuiz(box, t, onDone) {
  const pool = CM.QUIZ[t.quiz].slice();
  const rnd = CM.seeded(String(Date.now()));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
  const qs = pool.slice(0, 10);
  let i = 0, score = 0, answered = false;
  const draw = () => {
    const q = qs[i];
    box.innerHTML = '<div class="quiz"><div class="quiz-top"><b>שאלה ' + (i + 1) + ' מתוך ' + qs.length + '</b><span>' + score + ' נכונות</span></div>' + UI.bar(100 * i / qs.length) +
      '<h3>' + esc(q.q) + '</h3><div class="quiz-opts">' + q.o.map((o, k) => '<button type="button" class="qopt" data-k="' + k + '">' + esc(o) + '</button>').join('') + '</div><div class="quiz-why" data-why></div></div>';
    answered = false;
  };
  box.addEventListener('click', e => {
    const b = e.target.closest('.qopt');
    if (b && !answered) {
      answered = true;
      const q = qs[i], k = Number(b.dataset.k), ok = k === q.a;
      if (ok) score++;
      $$('.qopt', box).forEach((x, n) => { x.disabled = true; x.classList.toggle('right', n === q.a); x.classList.toggle('wrong', n === k && !ok); });
      $('[data-why]', box).innerHTML = '<p class="' + (ok ? 'ok-line' : 'warn') + '">' + icon(ok ? 'check' : 'x') + (ok ? 'נכון! ' : 'לא בדיוק. ') + esc(q.why) + '</p>' +
        '<button type="button" class="btn primary" data-nextq>' + (i === qs.length - 1 ? 'לתוצאה' : 'לשאלה הבאה') + icon('next') + '</button>';
      $('[data-nextq]', box).focus();
      return;
    }
    if (e.target.closest('[data-nextq]')) {
      i++;
      if (i < qs.length) draw(); else onDone(score);
    }
  });
  draw();
}

/* ---------- a countdown for timed tests ---------- */
function wireTimer(box, seconds) {
  let tm = null, left = seconds;
  const paint = () => { $('[data-tleft]', box).textContent = left; };
  box.addEventListener('click', e => {
    if (!e.target.closest('[data-tgo]')) return;
    if (tm) { clearInterval(tm); tm = null; left = seconds; paint(); e.target.closest('[data-tgo]').innerHTML = icon('play') + 'הפעל טיימר'; return; }
    let pre = 3;
    const btn = e.target.closest('[data-tgo]');
    btn.innerHTML = icon('stop') + 'עצור';
    $('[data-tleft]', box).textContent = 'מוכן… ' + pre;
    UI.beep('tick');
    tm = setInterval(() => {
      if (pre > 1) { pre--; $('[data-tleft]', box).textContent = 'מוכן… ' + pre; UI.beep('tick'); return; }
      if (pre === 1) { pre = 0; UI.beep('go'); paint(); return; }
      left--;
      paint();
      if (left <= 0) { clearInterval(tm); tm = null; UI.beep('end'); $('[data-tleft]', box).textContent = 'סוף! רשום את התוצאה'; btn.innerHTML = icon('refresh') + 'שוב'; left = seconds; }
    }, 1000);
  });
  return () => { if (tm) clearInterval(tm); };
}

function compareHtml(t, res) {
  const s = CM.testSummary(t.id);
  const last = s.last, prev = s.prev;
  let head;
  if (!prev) head = '<p class="ok-line">' + icon('flag') + 'זו המדידה הראשונה שלך: נקודת ההתחלה. מדוד שוב בעוד 3–4 שבועות ותראה כמה התקדמת.</p>';
  else if (s.trend === 'up') head = '<p class="ok-line">' + icon('up') + 'שיפור! מ-' + CM.fmtVal(t, prev.v) + ' ל-' + CM.fmtVal(t, last.v) + ' ' + esc(t.unit) + (res && res.pb ? '. זה גם השיא האישי שלך.' : '.') + '</p>';
  else if (s.trend === 'same') head = '<p class="note">' + icon('info') + 'אותה תוצאה כמו בפעם הקודמת (' + CM.fmtVal(t, prev.v) + '). התקדמות לא תמיד ישרה. ממשיכים לתרגל.</p>';
  else head = '<p class="note">' + icon('info') + 'הפעם ' + CM.fmtVal(t, last.v) + ', ובפעם הקודמת ' + CM.fmtVal(t, prev.v) + '. עייפות, מזג אוויר ומגרש אחר משפיעים. ממשיכים לתרגל ומודדים שוב.</p>';
  const nx = t.next;
  return head + '<h3>מה לתרגל עכשיו</h3><div class="meta">' +
    (nx.lesson && CM.LESSON[nx.lesson] ? '<a class="chip link-chip accent" href="#lesson.' + nx.lesson + '">' + icon('book') + esc(CM.LESSON[nx.lesson].title) + '</a>' : '') +
    nx.drills.map(id => CM.DRILL[id]).filter(Boolean).map(d => '<a class="chip link-chip" href="#drill.' + d.id + '">' + icon(CM.CATS[d.cat].icon) + esc(d.name) + '</a>').join('') + '</div>' +
    (s.trend === 'down' && t.ab ? '<p class="muted small">התוכנית תיתן ל' + esc(CM.AB[t.ab].name) + ' קצת יותר מקום באימונים הקרובים.</p>' : '');
}

function editEntry(t, e) {
  const fieldsHtml = t.fields.length
    ? t.fields.map(f => UI.field(f.label, '<input type="number" inputmode="decimal" name="' + f.k + '" min="' + f.min + '" max="' + f.max + '" step="' + (f.step || 1) + '" value="' + (f.k === 'v' ? e.v : (e.f[f.k] != null ? e.f[f.k] : '')) + '">')).join('')
    : UI.field('תשובות נכונות (מתוך 10)', '<input type="number" name="v" min="0" max="10" value="' + e.v + '">');
  return CM.dialog({
    title: 'עריכת תוצאה',
    html: '<form class="dlg-form">' + UI.field('תאריך', '<input type="date" name="date" value="' + e.date + '" max="' + today() + '">') + fieldsHtml + UI.field('הערה', '<input name="note" maxlength="300" value="' + esc(e.note) + '">') + '</form>',
    actions: [{label: 'שמור', read: w => {
      const form = $('form', w);
      const r = readFields(t, form);
      if (!r) return false;
      const date = CM.isDate(form.elements.date.value) && form.elements.date.value <= today() ? form.elements.date.value : e.date;
      store.update('tests', list => list.map(x => x.id === e.id ? Object.assign(x, {date, v: r.v, f: r.f, note: form.elements.note.value.trim().slice(0, 300)}) : x));
      return true;
    }}, {label: 'ביטול', value: null}]
  });
}
function readFields(t, form) {
  if (!t.fields.length) {
    const v = Number(form.elements.v.value);
    if (!Number.isFinite(v) || v < 0 || v > 10) { CM.toast('ציון בין 0 ל-10', 'error'); return null; }
    return {v: Math.round(v), f: {}};
  }
  const f = {};
  for (const fd of t.fields) {
    const raw = form.elements[fd.k].value;
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < fd.min || n > fd.max) { CM.toast(fd.label + ': מספר בין ' + fd.min + ' ל-' + fd.max, 'error'); form.elements[fd.k].focus(); return null; }
    f[fd.k] = n;
  }
  const v = t.calc ? t.calc(f) : f.v;
  delete f.v;
  return {v, f};
}

CM.page('test', {
  nav: 'tests',
  title: p => (CM.TEST[p] || {}).name || 'מבחן',
  render(view, id, ctx) {
    const t = CM.TEST[id];
    if (!t) { view.innerHTML = UI.empty('המבחן לא נמצא', '', '<a class="btn" href="#tests">למבחנים</a>'); return; }
    const s = CM.testSummary(t.id);
    const hist = s.list.slice().reverse();
    view.innerHTML = '<nav class="crumbs"><a href="#tests">מבחנים ומדידות</a>' + icon('prev') + '<span>' + esc(CM.TEST_GROUPS[t.group]) + '</span></nav>' +
      UI.head(t.name, esc(t.what)) +
      '<div class="lesson-grid"><div class="lesson-main">' +
      '<section class="panel"><h2>' + icon('info') + 'מה צריך</h2><div class="meta">' + UI.equip(t.equip) + '</div>' +
        '<h3>איך עושים</h3><ol class="steps-list compact">' + t.how.map(h => '<li><span>' + esc(h) + '</span></li>').join('') + '</ol>' +
        '<h3>איך מודדים</h3><p>' + esc(t.measure) + '</p>' +
        (t.group === 'fitness' || t.group === 'basket' ? '<p class="muted small">' + icon('shield') + 'מתחממים לפני. מבחן הוא לא תחרות: אם משהו כואב, עוצרים.</p>' : '') + '</section>' +
      (t.timer ? '<section class="panel timer-box" data-timerbox><h2>' + icon('timer') + 'טיימר ' + t.timer + ' שניות</h2><div class="big-count" data-tleft>' + t.timer + '</div><button type="button" class="btn primary lg" data-tgo>' + icon('play') + 'הפעל טיימר</button></section>' : '') +
      '<section class="panel" data-entry><h2>' + icon('edit') + (t.quiz ? 'המבחן' : 'רישום תוצאה') + '</h2>' +
        (t.quiz ? '<div data-quiz><p>10 שאלות. אחרי כל תשובה תראה הסבר.</p><button type="button" class="btn primary lg" data-startquiz>' + icon('play') + 'התחל מבחן</button></div>'
          : '<form class="result-form" novalidate><div class="row3">' + t.fields.map(f => UI.field(f.label, '<input type="number" inputmode="decimal" name="' + f.k + '" min="' + f.min + '" max="' + f.max + '" step="' + (f.step || 1) + '" required>')).join('') +
            UI.field('תאריך', '<input type="date" name="date" value="' + today() + '" max="' + today() + '">') + '</div>' +
            UI.field('הערה (לא חובה)', '<input name="note" maxlength="300" placeholder="איפה מדדת? איך הרגשת?">') +
            '<button type="submit" class="btn primary">' + icon('check') + 'שמור תוצאה</button></form>') +
        '<div data-compare>' + (s.last ? compareHtml(t) : '') + '</div></section>' +
      '</div><aside class="lesson-side">' +
      '<section class="panel"><h2>' + icon('chart') + 'התוצאות שלך</h2>' +
        (s.list.length ? UI.line(s.list.slice(-12).map(e => ({v: e.v, text: CM.fmtVal(t, e.v), label: CM.fmtDate(e.date), hi: e === s.best})), {aria: 'תוצאות ' + t.name + ' לאורך זמן', h: 220}) +
          '<p class="muted small">' + (t.better === 'down' ? 'כאן מספר נמוך יותר הוא טוב יותר.' : 'כאן מספר גבוה יותר הוא טוב יותר.') + (s.best ? ' השיא שלך: ' + CM.fmtVal(t, s.best.v) + ' ' + esc(t.unit) + '.' : '') + '</p>' +
          '<ul class="hist">' + hist.map(e => '<li><span><b>' + CM.fmtVal(t, e.v) + '</b> ' + esc(t.unit) + (e.f.losses != null ? ' · ' + e.f.losses + ' איבודים' : '') + (e.f.r != null ? ' · ימין ' + e.f.r + ', שמאל ' + e.f.l : '') + '</span><small>' + CM.fmtDate(e.date) + (e.note ? ' · ' + esc(e.note) : '') + '</small>' +
            '<span class="row-tools"><button type="button" class="icon-btn" data-edit="' + e.id + '" aria-label="ערוך">' + icon('edit') + '</button><button type="button" class="icon-btn" data-del="' + e.id + '" aria-label="מחק">' + icon('trash') + '</button></span></li>').join('') + '</ul>'
          : '<p class="muted">טרם נמדד. אחרי המדידה הראשונה תראה כאן את ההתקדמות.</p>') + '</section>' +
      '</aside></div>';

    if (t.timer) ctx.onLeave(wireTimer($('[data-timerbox]', view), t.timer));
    const cmp = $('[data-compare]', view);
    const after = res => {
      cmp.innerHTML = compareHtml(t, res);
      if (res.pb) CM.toast('שיא אישי חדש!', 'win'); else if (res.first) CM.toast('המדידה הראשונה נשמרה', 'win'); else CM.toast('התוצאה נשמרה');
    };
    const form = $('.result-form', view);
    if (form) form.addEventListener('submit', e => {
      e.preventDefault();
      const r = readFields(t, form);
      if (!r) return;
      const date = CM.isDate(form.elements.date.value) && form.elements.date.value <= today() ? form.elements.date.value : today();
      const res = CM.saveTest(t.id, r.v, r.f, form.elements.note.value.trim().slice(0, 300), date);
      ctx.rerender();
      const c2 = $('[data-compare]');
      if (c2) c2.innerHTML = compareHtml(t, res);
      if (res.pb) CM.toast('שיא אישי חדש!', 'win'); else if (res.first) CM.toast('המדידה הראשונה נשמרה', 'win'); else CM.toast('התוצאה נשמרה');
    });
    const sq = $('[data-startquiz]', view);
    if (sq) sq.addEventListener('click', () => {
      const box = $('[data-quiz]', view);
      runQuiz(box, t, score => {
        const res = CM.saveTest(t.id, score, {}, '', today());
        box.innerHTML = '<div class="quiz-end">' + UI.ring(score * 10, 96, score + ' מתוך 10') + '<h3>' + score + ' מתוך 10</h3><button type="button" class="btn ghost" data-again>' + icon('refresh') + 'עוד סבב</button></div>';
        after(res);
        $('[data-again]', box).addEventListener('click', () => ctx.rerender());
      });
    });
    view.addEventListener('click', async e => {
      const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
      if (ed) { const en = store.get('tests').find(x => x.id === ed.dataset.edit); if (en && await editEntry(t, en)) { CM.toast('התוצאה עודכנה'); ctx.rerender(); } }
      if (del && await CM.confirmBox('למחוק את התוצאה?', 'אי אפשר לבטל את המחיקה.', 'מחק', true)) {
        store.update('tests', list => list.filter(x => x.id !== del.dataset.del));
        CM.toast('התוצאה נמחקה');
        ctx.rerender();
      }
    });
  }
});
})(window.CM = window.CM || {});
