/* CourtMaster AI — the weekly plan: the week at a glance, each day's workout, and changes per day or to the fixed week.
   Day changes are stored apart from progress, so nothing he already did is lost. */
(function (CM) {
'use strict';
const {$, $$, esc, icon, store, UI, today, DAY_NAMES} = CM;

const KIND = {warm: 'חימום', lesson: 'מהשיעור', main: 'תרגיל', cool: 'שחרור', custom: 'מהמאמן'};

function itemRow(it, i, n, editable) {
  const link = it.drill ? '#drill.' + it.drill.id : it.lesson ? '#lesson.' + it.lesson.id : '';
  const name = link ? '<a href="' + link + '">' + esc(it.name) + '</a>' : esc(it.name);
  const sub = it.lesson ? 'שיעור: ' + esc(it.lesson.title) + ' · ' + esc(it.dose) : it.drill ? esc(it.drill.goal) : esc((it.custom && it.custom.how) || '');
  return '<li class="wi k-' + it.kind + '"><span class="wi-n">' + (i + 1) + '</span><div class="wi-body"><small class="wi-kind">' + KIND[it.kind] + '</small><b>' + name + '</b><span class="muted">' + sub + '</span></div>' +
    '<span class="wi-min">' + it.min + ' דק׳</span>' +
    (editable ? '<div class="wi-tools">' +
      '<button type="button" class="icon-btn" data-up="' + i + '" aria-label="הזז למעלה"' + (i === 0 ? ' disabled' : '') + '>' + icon('up') + '</button>' +
      '<button type="button" class="icon-btn flip" data-down="' + i + '" aria-label="הזז למטה"' + (i === n - 1 ? ' disabled' : '') + '>' + icon('up') + '</button>' +
      (it.drill && it.kind === 'main' ? '<button type="button" class="icon-btn" data-swap="' + i + '" aria-label="החלף בתרגיל אחר">' + icon('refresh') + '</button>' : '') +
      '<button type="button" class="icon-btn" data-del="' + i + '" aria-label="הסר מהאימון">' + icon('trash') + '</button></div>' : '') + '</li>';
}

function dayEditor(date, c, w) {
  const p = store.get('profile');
  const goals = {};
  p.goals.forEach(k => { goals[k] = esc(CM.AB[k].name); });
  const mins = c.mode === 'home' ? [10, 15, 20, 25, 30] : [30, 45, 60, 75, 90];
  return '<form class="day-edit" data-dayform hidden><h3>שינוי היום הזה בלבד</h3>' +
    '<div class="row3">' + UI.field('סוג היום', '<select name="mode">' + Object.keys(CM.MODES).map(m => '<option value="' + m + '"' + (c.mode === m ? ' selected' : '') + '>' + CM.MODES[m].name + '</option>').join('') + '</select>') +
    UI.field('שעה', '<input type="time" name="start" value="' + esc(c.start || '16:30') + '">') +
    UI.field('משך', '<select name="min">' + (c.mode === 'rest' ? '<option value="0">—</option>' : mins.map(m => '<option value="' + m + '"' + (c.min === m ? ' selected' : '') + '>' + m + ' דק׳</option>').join('')) + '</select>') + '</div>' +
    UI.field('במה להתמקד (עד 2)', UI.checks('focus', goals, w.focus, 2), 'שינוי המיקוד בונה מחדש את התרגילים של היום.') +
    '<div class="btn-row"><button type="submit" class="btn primary">' + icon('check') + 'שמור את השינוי</button><button type="button" class="btn ghost" data-cancel>ביטול</button></div></form>';
}

function weekTemplateDialog() {
  const p = store.get('profile');
  CM.dialog({
    title: 'השבוע הקבוע שלך',
    html: '<p class="muted">זה הבסיס של כל שבוע. שינויים כאן לא מוחקים אימונים, שיעורים או מבחנים שכבר עשית.</p>' + CM.dayRows(p.days),
    onOpen: wrap => CM.wireDays($('.dlg-body', wrap)),
    actions: [{label: 'שמור', kind: 'primary', read: wrap => {
      const days = CM.readDays($('.dlg-body', wrap));
      const why = CM.checkTemplate(days);
      if (why) { CM.toast(why, 'error'); return false; }
      store.update('profile', v => { v.days = days; return v; });
      return true;
    }}, {label: 'ביטול', value: null}]
  }).then(ok => { if (ok) CM.toast('השבוע הקבוע עודכן'); });
}
CM.weekTemplateDialog = weekTemplateDialog;

CM.page('plan', {
  title: 'התוכנית השבועית',
  render(view, param, ctx) {
    const t = today();
    const sel = CM.isDate(param) ? param : t;
    const ws = CM.weekStartOf(sel);
    const dates = CM.weekDates(ws);
    const confs = dates.map(CM.dayConf);
    const load = CM.weekLoad(confs);
    const why = CM.checkWeek(confs);
    const c = CM.dayConf(sel);
    const w = CM.buildWorkout(sel);
    const done = CM.doneOn(sel);
    const editable = (w.mode === 'train' || w.mode === 'home') && sel >= t;
    const range = CM.fmtDate(dates[0]) + '–' + CM.fmtDate(dates[6]);

    view.innerHTML = UI.head('התוכנית השבועית', 'נבנתה מהימים, הזמנים, הציוד והמטרות שלך, ומשתנה לפי ההתקדמות.',
        '<button type="button" class="btn ghost" data-template>' + icon('sliders') + 'השבוע הקבוע</button>') +
      '<div class="week-nav"><a class="icon-btn" href="#plan.' + CM.addDays(ws, -7) + '" aria-label="השבוע הקודם">' + icon('prev') + '</a>' +
        '<b>' + (ws === CM.weekStartOf(t) ? 'השבוע · ' : '') + range + '</b>' +
        '<a class="icon-btn" href="#plan.' + CM.addDays(ws, 7) + '" aria-label="השבוע הבא">' + icon('next') + '</a>' +
        (ws !== CM.weekStartOf(t) ? '<a class="link" href="#plan">חזרה להיום</a>' : '') + '</div>' +
      '<p class="' + (why ? 'warn' : 'ok-line') + '">' + icon(why ? 'alert' : 'check') + (why ? esc(why) : CM.fmtMinutes(load.minutes) + ' השבוע · ' + load.practices + ' אימוני כדורסל · ' + load.rest + ' ימי מנוחה. בתוך ההמלצות לגילך.') + '</p>' +
      '<div class="week-grid">' + dates.map((d, i) => {
        const cc = confs[i], ww = CM.buildWorkout(d), did = CM.doneOn(d).length;
        return '<a class="wd m-' + cc.mode + (d === sel ? ' sel' : '') + (d === t ? ' today' : '') + (did ? ' did' : '') + '" href="#plan.' + d + '" aria-current="' + (d === sel ? 'date' : 'false') + '">' +
          '<div class="wd-top"><b>' + DAY_NAMES[CM.dow(d)] + '</b><small>' + CM.fmtDate(d) + '</small></div>' +
          '<div class="wd-mode">' + icon(did ? 'check' : CM.MODES[cc.mode].icon) + '<span>' + CM.MODES[cc.mode].short + '</span></div>' +
          (cc.mode === 'rest' ? '<small class="muted">יום חופשי</small>' : '<small>' + cc.start + ' · ' + (ww.total || cc.min) + ' דק׳</small>') +
          (ww.focus.length ? '<small class="wd-focus">' + ww.focus.map(k => esc(CM.AB[k].name)).join(' + ') + '</small>' : '') +
          (cc.override ? '<span class="dot" title="שונה ידנית"></span>' : '') + '</a>';
      }).join('') + '</div>' +
      '<section class="panel day-panel"><div class="panel-head"><div><h2>' + esc(CM.fmtDateLong(sel)) + '</h2>' +
        '<p class="muted">' + icon(CM.MODES[c.mode].icon) + CM.MODES[c.mode].name + (c.mode !== 'rest' ? ' · ' + c.start + ' · ' + CM.fmtMinutes(w.total || c.min) : '') + (c.override ? ' · שונה ידנית' : '') + (w.ai ? ' · נבנה עם המאמן' : '') + '</p></div>' +
        '<div class="head-actions">' + (sel >= t ? '<button type="button" class="btn ghost sm" data-edit>' + icon('edit') + 'שנה יום</button>' : '') +
        (c.override && sel >= t ? '<button type="button" class="btn ghost sm" data-reset>' + icon('refresh') + 'חזור לתוכנית</button>' : '') + '</div></div>' +
        dayEditor(sel, c, w) +
        (w.mode === 'rest' ? '<div class="rest-box">' + icon('moon', 'big') + '<div><h3>יום מנוחה</h3><ul><li>שינה של 9 שעות ומעלה.</li><li>מים וארוחות רגילות.</li><li>אפשר הליכה, אופניים או משחק כיפי עם חברים.</li><li>רוצה ללמוד? צפה במשחק עם הדף <a href="#nba">לומדים מה-NBA</a>.</li></ul></div></div>'
          : w.mode === 'team' ? '<div class="rest-box">' + icon('users', 'big') + '<div><h3>אימון קבוצה</h3><p>האימון של הקבוצה הוא האימון של היום. אין צורך להוסיף עליו עוד אימון.</p><ul><li>להגיע 10 דקות לפני ולהתחמם.</li><li>בקבוק מים.</li><li>אחרי האימון: מתיחות קלות ושינה טובה.</li></ul></div></div>'
          : '<div class="goal-line">' + icon('target') + '<div><b>' + esc(w.title) + '</b><span class="muted">' + esc(w.goal) + '</span></div></div>' +
            '<ol class="witems">' + w.items.map((it, i) => itemRow(it, i, w.items.length, editable)).join('') + '</ol>' +
            '<div class="btn-row">' + (done.length && sel === t ? '<span class="done-badge">' + icon('check') + 'הושלם היום</span>' : '') +
              (sel >= t ? '<a class="btn primary lg" href="#live' + (sel === t ? '' : '.' + sel) + '">' + icon('play') + (sel === t ? 'התחל אימון' : 'התחל את האימון הזה היום') + '</a>' : '') +
              (editable ? '<a class="btn ghost" href="#library">' + icon('plus') + 'הוסף מהספרייה</a>' : '') + '</div>') +
      '</section>';

    const form = $('[data-dayform]', view);
    const on = (sel2, fn) => { const el = $(sel2, view); if (el) el.addEventListener('click', fn); };
    on('[data-template]', weekTemplateDialog);
    on('[data-edit]', () => { form.hidden = !form.hidden; if (!form.hidden) form.querySelector('select').focus(); });
    on('[data-cancel]', () => { form.hidden = true; });
    on('[data-reset]', async () => {
      if (await CM.confirmBox('לחזור לתוכנית הקבועה?', 'השינויים ליום הזה יימחקו. אימונים שכבר עשית לא יימחקו.', 'חזור לתוכנית')) { CM.resetDay(sel); CM.toast('היום חזר לתוכנית הקבועה'); }
    });
    if (form) {
      form.addEventListener('change', e => {
        if (e.target.name !== 'mode') return;
        const mode = e.target.value, minSel = form.elements.min;
        minSel.innerHTML = mode === 'rest' ? '<option value="0">—</option>' : (mode === 'home' ? [10, 15, 20, 25, 30] : [30, 45, 60, 75, 90]).map(m => '<option value="' + m + '"' + (m === (mode === 'home' ? 20 : 60) ? ' selected' : '') + '>' + m + ' דק׳</option>').join('');
      });
      form.addEventListener('submit', e => {
        e.preventDefault();
        const mode = form.elements.mode.value;
        const patch = {mode, start: CM.TIME_RE.test(form.elements.start.value) ? form.elements.start.value : '16:30', min: Number(form.elements.min.value) || 0};
        const focus = UI.readChecks(form, 'focus');
        const problem = CM.checkDayChange(sel, patch);
        if (problem) { CM.toast(problem, 'error'); return; }
        // a new type, length or focus means a new set of drills
        const p = Object.assign({}, patch, {items: undefined, title: undefined, goal: undefined, ai: undefined});
        if (focus.length) p.focus = focus;
        store.update('plan', v => {
          const cur = Object.assign({}, v.days[sel] || {}, p);
          Object.keys(cur).forEach(k => { if (cur[k] === undefined) delete cur[k]; });
          if (!focus.length) delete cur.focus;
          v.days[sel] = cur;
          return v;
        });
        CM.toast('היום עודכן');
      });
    }
    view.addEventListener('click', e => {
      const b = e.target.closest('[data-up],[data-down],[data-swap],[data-del]');
      if (!b) return;
      const ds = b.dataset;
      if (ds.up != null) CM.moveItem(sel, Number(ds.up), -1);
      else if (ds.down != null) CM.moveItem(sel, Number(ds.down), 1);
      else if (ds.swap != null) { const d = CM.swapItem(sel, Number(ds.swap)); CM.toast(d ? 'הוחלף ב: ' + d.name : 'אין תרגיל חלופי מתאים', d ? '' : 'error'); }
      else if (ds.del != null) { if (!CM.removeItem(sel, Number(ds.del))) CM.toast('באימון צריך להישאר לפחות תרגיל אחד', 'error'); }
    });
    ['plan', 'profile', 'sessions', 'lessons'].forEach(k => ctx.watch(k, () => ctx.rerender()));
  }
});
})(window.CM = window.CM || {});
