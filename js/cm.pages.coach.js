/* CourtMaster AI — "My Coach" (the AI chat) and the profile and settings page. */
(function (CM) {
'use strict';
const {$, $$, esc, icon, store, UI, today} = CM;
const ai = CM.ai;
const ARTIFACT_URL = 'https://claude.ai/artifact/SURQQuswMgL6jZDXAfdtZs';

/* ===================== the coach ===================== */
const PROMPTS = [
  'בנה לי אימון להיום לפי התוכנית שלי',
  'אימון בית שקט של 20 דקות',
  'איך משפרים את הזריקה שלי?',
  'תסביר לי מה התוצאות שלי במבחנים אומרות',
  'מה לעשות כשהיד החלשה לא מצליחה?',
  'איך מתכוננים למשחק?'
];
function statusChip() {
  const p = ai.provider;
  if (p === 'claude') return UI.chip('מחובר דרך החשבון שלך ב-claude.ai', 'accent', 'check');
  if (p === 'server') return UI.chip('מחובר דרך השרת המקומי', 'accent', 'check');
  if (p === 'checking') return UI.chip('בודק חיבור…', '', 'clock');
  return UI.chip('לא מחובר', 'warn-chip', 'alert');
}
// the copy served by server.js on his own computer, as opposed to the public website
const ON_THIS_PC = ['localhost', '127.0.0.1'].includes(location.hostname);
function notConnected() {
  if (!ON_THIS_PC && !CM.IN_CLAUDE) {
    return '<section class="panel offline">' + icon('info', 'big') + '<div><h2>המאמן לא זמין באתר הזה</h2>' +
      '<p>באתר הזה המאמן לא מחובר לבינה מלאכותית, ולכן הוא לא עונה. אין כאן תשובות מוכנות שמתחזות למאמן.</p>' +
      '<p class="muted">כל השאר עובד: התוכנית, האימונים, השיעורים, המבחנים וההתקדמות. הנתונים נשמרים רק בדפדפן שלך.</p></div></section>';
  }
  const local = ON_THIS_PC;
  return '<section class="panel offline">' + icon('info', 'big') + '<div><h2>המאמן עדיין לא מחובר</h2>' +
    '<p>' + esc(ai.errText(ai.provider === 'nokey' ? 'no_key' : 'none')) + ' הוא לא עונה עד שיחובר, ואין כאן תשובות מוכנות שמתחזות למאמן.</p>' +
    '<h3>איך מחברים</h3><ul>' +
      '<li><b>בגרסה שב-claude.ai</b> המאמן עובד דרך החשבון שלך ב-Claude, בלי מפתח ובלי הגדרות. <a href="' + ARTIFACT_URL + '" target="_blank" rel="noopener noreferrer">לפתוח את הגרסה שב-claude.ai</a></li>' +
      (local ? '<li><b>בשרת המקומי</b> מבוגר יכול להגדיר מפתח API של Anthropic במשתנה הסביבה <code>ANTHROPIC_API_KEY</code> ולהפעיל את השרת מחדש. המפתח נשאר בשרת ולא מגיע לדפדפן. חשבון API מיועד למבוגרים, אז זה תפקיד של הורה.</li>' : '') +
    '</ul><p class="muted">בינתיים כל השאר עובד: התוכנית, האימונים, השיעורים, המבחנים וההתקדמות.</p>' +
    '<button type="button" class="btn ghost" data-recheck>' + icon('refresh') + 'בדוק חיבור שוב</button></div></section>';
}
function bubble(m, i) {
  if (m.r === 'user') return '<div class="msg me"><div class="bub">' + esc(m.t).replace(/\n/g, '<br>') + '</div></div>';
  const sp = ai.splitWorkout(m.t);
  return '<div class="msg bot">' + '<span class="bot-ic">' + icon('whistle') + '</span><div class="bub">' + UI.md(sp.text) +
    (m.cut ? '<p class="muted small">' + icon('alert') + 'התשובה נקטעה.</p>' : '') + (sp.workout ? workoutCard(sp.workout, i) : '') + '</div></div>';
}
function workoutCard(w, i) {
  if (w.error) return '<p class="warn">' + icon('alert') + esc(w.error) + '</p>';
  const dates = [];
  for (let k = 0; k < 8; k++) { const d = CM.addDays(today(), k); const c = CM.dayConf(d); if (c.mode === 'train' || c.mode === 'home') dates.push(d); }
  return '<div class="wcard"><div class="wcard-head">' + icon('cal') + '<div><b>' + esc(w.title) + '</b><small>' + esc(w.goal) + '</small></div><span class="chip">' + w.total + ' דק׳</span></div>' +
    '<ol>' + w.items.map(it => '<li><span>' + esc(it.d ? CM.DRILL[it.d].name : it.c.name) + '</span><small>' + it.min + ' דק׳</small></li>').join('') + '</ol>' +
    (dates.length ? '<div class="wcard-foot"><select data-wdate="' + i + '" aria-label="לאיזה יום">' + dates.map(d => '<option value="' + d + '">' + (d === today() ? 'היום' : esc(CM.fmtDateLong(d))) + ' · ' + CM.MODES[CM.dayConf(d).mode].short + '</option>').join('') + '</select>' +
      '<button type="button" class="btn primary sm" data-wsave="' + i + '">' + icon('check') + 'שמור בתוכנית</button></div>' : '<p class="muted small">אין ימי אימון בשבוע הקרוב שאפשר לשמור אליהם.</p>') + '</div>';
}

CM.page('coach', {
  title: 'המאמן שלי',
  render(view, param, ctx) {
    const save = store.get('settings').saveChat;
    const connected = ai.provider === 'claude' || ai.provider === 'server';
    const H = ai.history();
    view.innerHTML = UI.head('המאמן שלי', 'שואלים בעברית, והמאמן עונה לפי הפרופיל, התוכנית וההתקדמות שלך. הוא יכול גם לבנות אימון ולשמור אותו בתוכנית.',
        statusChip() + (H.length ? '<button type="button" class="btn ghost sm" data-clear>' + icon('trash') + 'מחק שיחה</button>' : '')) +
      (!connected && ai.provider !== 'checking' ? notConnected() : '') +
      '<section class="chat' + (connected ? '' : ' off') + '"><div class="chat-log" data-log aria-live="polite">' +
        (H.length ? H.map(bubble).join('') : '<div class="chat-hello">' + icon('whistle', 'big') + '<p>היי! אני המאמן שלך. אפשר לשאול על טכניקה, לבקש אימון מותאם, או לשאול מה לעשות עם התוצאות שלך.</p></div>') + '</div>' +
        (connected ? '<div class="prompts">' + PROMPTS.map(p => '<button type="button" class="pchip" data-p="' + esc(p) + '">' + esc(p) + '</button>').join('') + '</div>' : '') +
        '<form class="chat-in" novalidate><textarea name="q" rows="2" maxlength="2000" placeholder="' + (connected ? 'כתוב שאלה למאמן…' : 'המאמן לא מחובר') + '" aria-label="שאלה למאמן"' + (connected ? '' : ' disabled') + '></textarea>' +
          '<button type="submit" class="btn primary" data-send' + (connected ? '' : ' disabled') + ' aria-label="שלח">' + icon('send') + '</button>' +
          '<button type="button" class="btn ghost" data-stop hidden>' + icon('stop') + 'עצור</button></form>' +
        '<p class="muted small chat-note">' + icon('shield') + (save ? 'השיחה נשמרת ' + (store.mode === 'cloud' ? 'בחשבון claude.ai הפרטי שלך' : 'בדפדפן הזה') : 'השיחה לא נשמרת ותימחק כשתסגור את הדף') + '. אפשר לשנות ב<a href="#profile">הגדרות</a>. ' +
          (ai.provider === 'claude' ? 'בפעם הראשונה claude.ai יבקש אישור להשתמש בחשבון שלך. ' : '') + 'המאמן הוא בינה מלאכותית ויכול לטעות. בכאב או פציעה פונים להורה ולרופא.</p>' +
      '</section>';

    const log = $('[data-log]', view);
    const form = $('.chat-in', view);
    const ta = form.elements.q;
    const scroll = () => { log.scrollTop = log.scrollHeight; };
    scroll();
    let busy = false;

    const send = async text => {
      text = text.trim();
      if (!text || busy) return;
      busy = true;
      ai.push({r: 'user', t: text, at: new Date().toISOString()});
      const hello = $('.chat-hello', log); if (hello) hello.remove();
      log.insertAdjacentHTML('beforeend', bubble({r: 'user', t: text}) + '<div class="msg bot live-msg"><span class="bot-ic">' + icon('whistle') + '</span><div class="bub"><p class="thinking"><span></span><span></span><span></span> המאמן חושב…</p></div></div>');
      scroll();
      ta.value = '';
      $('[data-send]', view).disabled = true;
      $('[data-stop]', view).hidden = false;
      const out = $('.live-msg .bub', log);
      let shown = '';
      try {
        const r = await ai.ask(t => {
          shown = t;
          const cutAt = t.indexOf('```workout');
          out.innerHTML = UI.md(cutAt >= 0 ? t.slice(0, cutAt) : t) + (cutAt >= 0 ? '<p class="thinking"><span></span><span></span><span></span> בונה אימון…</p>' : '');
          scroll();
        });
        ai.push({r: 'assistant', t: r.text, at: new Date().toISOString(), cut: r.truncated});
        const msgs = ai.history();
        $('.live-msg', log).outerHTML = bubble(Object.assign({}, msgs[msgs.length - 1], {cut: r.truncated}), msgs.length - 1);
      } catch (e) {
        const code = e && e.code;
        const lm = $('.live-msg', log);
        if (code === 'cancelled') {
          if (shown.trim()) { ai.push({r: 'assistant', t: shown, at: new Date().toISOString()}); const msgs = ai.history(); lm.outerHTML = bubble(Object.assign({}, msgs[msgs.length - 1], {cut: true}), msgs.length - 1); }
          else lm.remove();
        } else {
          const keep = code !== 'refused' && e.text && e.text.trim();
          if (keep) ai.push({r: 'assistant', t: e.text, at: new Date().toISOString()});
          lm.outerHTML = (keep ? bubble({r: 'assistant', t: e.text, cut: true}, -1) : '') + '<div class="msg sys"><p class="warn">' + icon('alert') + esc(ai.errText(code)) + '</p></div>';
          if (ai.fatal(code)) { ta.disabled = true; ta.placeholder = 'המאמן לא זמין כרגע'; }
        }
      } finally {
        busy = false;
        const sb = $('[data-send]', view); if (sb) sb.disabled = ta.disabled;
        const st = $('[data-stop]', view); if (st) st.hidden = true;
        scroll();
      }
    };
    form.addEventListener('submit', e => { e.preventDefault(); send(ta.value); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(ta.value); } });
    view.addEventListener('click', async e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.p) send(b.dataset.p);
      else if (b.hasAttribute('data-stop')) ai.stop();
      else if (b.hasAttribute('data-recheck')) { ai.provider = 'checking'; ctx.rerender(); await ai.detect(); ctx.rerender(); }
      else if (b.hasAttribute('data-clear')) { if (await CM.confirmBox('למחוק את השיחה?', 'כל ההודעות יימחקו.', 'מחק', true)) { ai.clear(); ctx.rerender(); } }
      else if (b.dataset.wsave != null) {
        const i = Number(b.dataset.wsave);
        const m = ai.history()[i];
        const sel = $('[data-wdate="' + i + '"]', view);
        if (!m || !sel) return;
        const w = ai.splitWorkout(m.t).workout;
        const why = ai.applyWorkout(w, sel.value);
        if (why) CM.toast(why, 'error');
        else CM.toast('נשמר בתוכנית של ' + (sel.value === today() ? 'היום' : CM.fmtDateLong(sel.value)), 'win');
      }
    });
    ctx.onLeave(() => { if (busy) ai.stop(); });
  }
});

/* ===================== profile and settings ===================== */
async function exportData() {
  const data = {app: 'CourtMaster AI', exported: new Date().toISOString()};
  ['profile', 'plan', 'lessons', 'sessions', 'records', 'tests', 'goals', 'favs', 'courses', 'settings'].forEach(k => { data[k] = store.get(k); });
  const text = JSON.stringify(data, null, 2);
  const name = 'courtmaster-' + today() + '.json';
  if (CM.IN_CLAUDE) {
    let dl = null;
    try { dl = await window.claude.use('downloads'); } catch (e) {}
    if (!dl) return CM.toast('הורדת קבצים לא זמינה בתצוגה הזאת', 'error');
    try { await dl.save({filename: name, data: text}); CM.toast('הקובץ נשמר'); }
    catch (e) { if (!e || e.code !== 'declined') CM.toast('לא הצלחנו לשמור את הקובץ', 'error'); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

CM.page('profile', {
  title: 'פרופיל והגדרות',
  render(view, param, ctx) {
    const p = store.get('profile'), s = store.get('settings');
    const ab = {}; CM.ABILITIES.forEach(a => { ab[a.k] = esc(a.name); });
    const w = CM.weekLoad(p.days.map(d => d));
    view.innerHTML = UI.head('פרופיל והגדרות', 'שינויים כאן משנים את התוכנית מהיום והלאה. אימונים, שיעורים ומבחנים שכבר עשית נשארים.') +
      '<form class="panel prof-form" novalidate><h2>' + icon('user') + 'הפרופיל שלי</h2>' +
        '<div class="row3">' + UI.field('שם או כינוי', '<input name="name" maxlength="30" value="' + esc(p.name) + '">') +
        UI.field('גיל', '<input type="number" name="age" min="8" max="19" value="' + p.age + '">') + UI.field('גובה (ס״מ)', '<input type="number" name="height" min="110" max="230" value="' + p.height + '">') + '</div>' +
        UI.field('רמה', UI.seg('level', {beginner: 'מתחיל', intermediate: 'בינוני', advanced: 'מתקדם'}, p.level), 'הרמה קובעת מאיפה המסלול מתחיל. רמות נפתחות לפי מה שלמדת.') +
        UI.field('ניסיון', UI.seg('years', CM.YEARS, p.years)) +
        UI.field('משחק בקבוצה', UI.seg('team', {no: 'לא', yes: 'כן'}, p.team ? 'yes' : 'no')) +
        UI.field('תחומים לשיפור', UI.checks('goals', ab, p.goals)) +
        UI.field('עדיפויות ראשונות (עד 3)', UI.checks('focus', ab, p.focus, 3)) +
        UI.field('מטרה לטווח ארוך', UI.seg('longGoal', CM.LONG_GOALS, p.longGoal)) +
        UI.field('איפה מתאמנים', UI.seg('place', {court: 'מגרש ציבורי', home: 'בבית', both: 'גם וגם'}, p.place)) +
        UI.field('ציוד', UI.checks('equip', {ball: 'כדור', ball2: 'כדור שני', hoop: 'סל', wall: 'קיר', cones: 'קונוסים', rope: 'חבל קפיצה'}, p.equip)) +
        UI.field('עם מי', UI.seg('alone', {yes: 'לבד', no: 'עם חבר'}, p.alone ? 'yes' : 'no')) +
        '<label class="toggle"><input type="checkbox" name="quiet"' + (p.quiet ? ' checked' : '') + '><span>בבית צריך להתאמן בשקט</span></label>' +
        '<div class="btn-row"><button type="submit" class="btn primary">' + icon('check') + 'שמור פרופיל</button></div></form>' +
      '<section class="panel"><div class="panel-head"><h2>' + icon('cal') + 'השבוע הקבוע</h2><button type="button" class="btn ghost sm" data-template>' + icon('edit') + 'עריכה</button></div>' +
        '<ul class="week-list">' + p.days.map((d, i) => '<li><b>' + CM.DAY_NAMES[i] + '</b><span>' + icon(CM.MODES[d.mode].icon) + CM.MODES[d.mode].name + (d.mode === 'rest' ? '' : ' · ' + d.start + ' · ' + d.min + ' דק׳') + '</span></li>').join('') + '</ul>' +
        '<p class="muted small">' + CM.fmtMinutes(w.minutes) + ' בשבוע · ' + w.practices + ' אימוני כדורסל · ' + w.rest + ' ימי מנוחה</p></section>' +
      '<section class="panel"><h2>' + icon('shield') + 'פרטיות ונתונים</h2>' +
        '<p class="note">' + icon(store.mode === 'cloud' || CM.backup.on ? 'check' : 'info') + (store.mode === 'cloud' ? 'הנתונים נשמרים בחשבון claude.ai הפרטי שלך, ורק אתה רואה אותם. עותק נשמר גם בדפדפן הזה.'
          : CM.backup.on ? '<span>הנתונים נשמרים בדפדפן הזה, ועותק גיבוי נשמר אוטומטית בקובץ במחשב (בתיקיית האתר, בתיקייה <code>data</code>), כולל עותק לכל יום בשבועיים האחרונים. אם הדפדפן יאבד את הנתונים, הם יחזרו מהקובץ.</span>'
          : 'הנתונים נשמרים בדפדפן הזה בלבד, לא בענן. מחיקת נתוני הדפדפן תמחק אותם, ובמכשיר אחר הם לא יופיעו. כדאי להוריד עותק מדי פעם.') + '</p>' +
        '<p class="muted small">אנחנו שומרים רק את מה שנחוץ לאימון: שם או כינוי, גיל, גובה, התוכנית וההתקדמות. לא כתובת, לא בית ספר ולא טלפון.</p>' +
        '<label class="toggle"><input type="checkbox" data-set="saveChat"' + (s.saveChat ? ' checked' : '') + '><span>לשמור את השיחות עם המאמן</span></label>' +
        '<label class="toggle"><input type="checkbox" data-set="sound"' + (s.sound ? ' checked' : '') + '><span>צלילים בטיימר</span></label>' +
        '<div class="btn-row"><button type="button" class="btn ghost" data-export>' + icon('download') + 'הורד עותק של הנתונים</button>' +
          '<label class="btn ghost">' + icon('up') + 'הוסף נתונים מקובץ<input type="file" accept=".json,application/json" data-import hidden></label>' +
          '<a class="btn ghost" href="#onboarding.restart">' + icon('refresh') + 'לעבור שוב על שאלות ההיכרות</a>' +
          '<button type="button" class="btn danger" data-wipe>' + icon('trash') + 'מחק את כל הנתונים</button></div></section>' +
      '<section class="panel about"><h2>' + icon('info') + 'בטיחות ומקורות</h2>' +
        '<ul><li>התוכנית שומרת על ההמלצות של ה-NBA ושל USA Basketball לגילאי 12–14: עד 10 שעות כדורסל מאורגן בשבוע, 2–4 אימונים של 60–90 דקות, ולפחות יום מנוחה מלא. <a href="https://youthguidelines.nba.com/" target="_blank" rel="noopener noreferrer">ההמלצות באתר ה-NBA</a></li>' +
        '<li>חימום לפני כל אימון, כוח רק עם משקל הגוף, ובלי דיאטות או תוספים.</li>' +
        '<li>כאב הוא סימן לעצור ולספר להורה. כאב שנמשך, נפיחות או פציעה: לרופא.</li>' +
        '<li>האפליקציה לא מחליפה מאמן, רופא או הורה, ולא מבטיחה עתיד מקצועי. היא עוזרת להתאמן חכם.</li></ul>' +
        '<p class="muted small">צילומים מ-Unsplash: Klara Kulikova, Markus Spiske, Felix yu ו-LOGAN WEAVER. סרטונים מ-YouTube: Jr. NBA, Atlanta Hawks, BreakthroughBBall ו-GVO Kids.</p>' +
        (ON_THIS_PC ? '<p class="muted small"><a href="legacy/index.html">האתר הקודם ("סל אחרי סל"), עם מדריך התזונה והשינה</a></p>' : '') + '</section>';

    const form = $('.prof-form', view);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const goals = UI.readChecks(form, 'goals');
      if (!goals.length) { CM.toast('בחר לפחות תחום אחד לשיפור', 'error'); return; }
      const f = form.elements;
      store.update('profile', v => CM.normProfile(Object.assign(v, {
        name: f.name.value.trim().slice(0, 30), age: Number(f.age.value), height: Number(f.height.value),
        level: UI.readRadio(form, 'level'), years: UI.readRadio(form, 'years'), team: UI.readRadio(form, 'team') === 'yes',
        goals, focus: UI.readChecks(form, 'focus'), longGoal: UI.readRadio(form, 'longGoal'), place: UI.readRadio(form, 'place'),
        equip: UI.readChecks(form, 'equip'), alone: UI.readRadio(form, 'alone') !== 'no', quiet: f.quiet.checked
      })));
      CM.toast('הפרופיל נשמר. התוכנית עודכנה מהיום והלאה');
    });
    view.addEventListener('change', async e => {
      if (e.target.matches('[data-import]')) {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return CM.toast('הקובץ גדול מדי', 'error');
        let j = null;
        try { j = JSON.parse(await file.text()); } catch (err) { j = null; }
        if (!j || typeof j !== 'object') return CM.toast('זה לא קובץ גיבוי של CourtMaster', 'error');
        // a backup file keeps the keys under "data"; a downloaded copy keeps them at the top
        const added = CM.mergeData(j.data && typeof j.data === 'object' ? j.data : j);
        CM.toast(added.length ? 'הנתונים מהקובץ נוספו. שום דבר לא נמחק' : 'לא נמצאו בקובץ נתונים חדשים', added.length ? 'win' : '');
        return;
      }
      const k = e.target.dataset.set;
      if (!k) return;
      const on = e.target.checked;
      store.update('settings', v => { v[k] = on; return v; });
      if (k === 'saveChat' && !on && store.get('coach').msgs.length) {
        if (await CM.confirmBox('למחוק גם את השיחות שכבר נשמרו?', 'מעכשיו שיחות חדשות לא יישמרו. אפשר למחוק גם את מה שנשמר עד עכשיו.', 'מחק שיחות', true)) { ai.clear(); CM.toast('השיחות נמחקו'); }
      }
    });
    view.addEventListener('click', async e => {
      if (e.target.closest('[data-template]')) CM.weekTemplateDialog();
      else if (e.target.closest('[data-export]')) exportData();
      else if (e.target.closest('[data-wipe]')) {
        const ok = await CM.confirmBox('למחוק את כל הנתונים?', 'הפרופיל, התוכנית, האימונים, המבחנים, המטרות והשיחות יימחקו' + (store.mode === 'cloud' ? ' מהדפדפן ומהחשבון שלך' : CM.backup.on ? ' מהדפדפן ומקובץ הגיבוי. עותק של המצב לפני המחיקה יישאר בתיקייה data במחשב' : ' מהדפדפן הזה') + '. אי אפשר לבטל את זה.', 'מחק הכל', true);
        if (!ok) return;
        ai.mem = [];
        await store.wipe();
        store.set('meta', {migrated: true});
        CM.toast('כל הנתונים נמחקו');
        location.hash = '#onboarding';
      }
    });
    ctx.watch('profile', () => ctx.rerender());
  }
});
})(window.CM = window.CM || {});
