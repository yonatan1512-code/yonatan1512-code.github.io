/* CourtMaster AI — the account page: sign in, sync status, sign out, change password, delete the account, and what is stored. */
(function (CM) {
'use strict';
const {$, esc, icon, store, UI} = CM;
const sync = CM.sync;

const STATE = {
  ok: ['check', 'מסונכרן'],
  syncing: ['refresh', 'מסנכרן…'],
  offline: ['alert', 'אין חיבור לאינטרנט. הנתונים שמורים במכשיר ויסונכרנו כשהחיבור יחזור.'],
  error: ['alert', 'הסנכרון לא הצליח. הנתונים שמורים במכשיר, וננסה שוב אוטומטית.']
};
const timeOf = ms => { const d = new Date(ms); return CM.pad(d.getHours()) + ':' + CM.pad(d.getMinutes()); };

function privacy() {
  return '<section class="panel"><h2>' + icon('shield') + 'מה נשמר בחשבון</h2><ul class="ticks">' +
    '<li>האימייל שלך, הפרופיל, התוכנית, האימונים, המבחנים, המטרות, ההתקדמות בשיעורים, והשיחות עם המאמן אם בחרת לשמור אותן.</li>' +
    '<li>אם הפעלת התראות: כתובת ההתראות של המכשיר, אזור הזמן והתזכורות שבחרת. כיבוי ההתראות במכשיר מוחק אותם.</li>' +
    '<li>הנתונים נשמרים בשירות האחסון Supabase. דרך האתר רק אתה יכול לראות ולשנות אותם.</li>' +
    '<li>מנהל האתר יכול לראות את הנתונים בלוח הניהול של Supabase.</li>' +
    '<li>"מחק את החשבון שלי" מוחק את החשבון ואת כל הנתונים שבו מהשרת.</li></ul></section>';
}

/* ---------- phone notifications (this device) ---------- */
async function fillPush(old) {
  // a fresh element each time, so earlier handlers are gone
  const box = old.cloneNode(false);
  old.replaceWith(box);
  const push = CM.push;
  const head = '<h2>' + icon('bell') + 'התראות לטלפון</h2>';
  if (!push || !push.supported()) {
    box.innerHTML = head + (push && push.isIOS && !push.installed()
      ? '<p>באייפון ההתראות עובדות רק כשהאתר מותקן כמו אפליקציה:</p><ol class="steps-list compact">' +
        '<li><span>פותחים את האתר ב-<b>Safari</b>.</span></li><li><span>לוחצים על כפתור השיתוף (ריבוע עם חץ למעלה).</span></li>' +
        '<li><span>בוחרים <b>"הוסף למסך הבית"</b>.</span></li><li><span>פותחים את CourtMaster מהאייקון החדש, מתחברים שוב, וחוזרים לכאן.</span></li></ol>'
      : '<p class="muted">הדפדפן הזה לא תומך בהתראות. אפשר לנסות ב-Chrome או ב-Edge, ובאייפון דרך "הוסף למסך הבית".</p>');
    return;
  }
  if (push.permission() === 'denied') {
    box.innerHTML = head + '<p class="warn">' + icon('alert') + '<span>' + esc(push.errText({code: 'denied'})) + '</span></p>';
    return;
  }
  let st;
  try { st = await push.state(); } catch (e) { st = {on: false, prefs: {before: true, nudge: true, weekly: true}}; }
  box.innerHTML = head +
    '<p class="muted">' + (st.on ? 'ההתראות פועלות במכשיר הזה.' : 'קבל תזכורות לאימון גם כשהאתר סגור.') + ' אין התראות בין 21:00 ל-07:00.</p>' +
    Object.keys(push.KINDS).map(k => '<label class="toggle"><input type="checkbox" data-pref="' + k + '"' + (st.prefs[k] !== false ? ' checked' : '') + '><span>' + esc(push.KINDS[k]) + '</span></label>').join('') +
    '<div class="btn-row">' + (st.on
      ? '<button type="button" class="btn ghost" data-ptest>' + icon('send') + 'שלח התראת בדיקה</button><button type="button" class="btn ghost danger-text" data-poff>' + icon('x') + 'כבה במכשיר הזה</button>'
      : '<button type="button" class="btn primary" data-pon>' + icon('bell') + 'הפעל התראות במכשיר הזה</button>') + '</div>';
  const prefs = () => { const p = {}; Object.keys(push.KINDS).forEach(k => { p[k] = !!box.querySelector('[data-pref="' + k + '"]').checked; }); return p; };
  box.addEventListener('change', async e => {
    if (!e.target.dataset.pref || !st.on) return;
    try { await push.setPrefs(prefs()); CM.toast('נשמר'); } catch (ex) { CM.toast(push.errText(ex), 'error'); }
  });
  box.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    b.disabled = true;
    try {
      if (b.hasAttribute('data-pon')) { await push.enable(prefs()); CM.toast('ההתראות הופעלו במכשיר הזה', 'win'); }
      else if (b.hasAttribute('data-poff')) { await push.disable(); CM.toast('ההתראות כובו במכשיר הזה'); }
      else if (b.hasAttribute('data-ptest')) { const r = await push.test(); CM.toast(r.sent ? 'נשלחה התראת בדיקה. היא אמורה להגיע תוך כמה שניות' : 'לא נמצא מכשיר לשלוח אליו', r.sent ? 'win' : 'error'); }
    } catch (ex) { CM.toast(push.errText(ex), 'error'); }
    fillPush(box);
  });
}

CM.page('account', {
  title: 'חשבון וסנכרון',
  nav: 'profile',
  full: () => !store.get('profile').onboarded,
  render(view, param, ctx) {
    const onboarded = store.get('profile').onboarded;
    const back = onboarded ? '' : '<a class="link" href="#onboarding">' + icon('prev') + 'חזרה לשאלות ההיכרות</a>';
    if (!sync.available) {
      view.innerHTML = UI.head('חשבון וסנכרון') + '<p class="note">' + icon('info') +
        (CM.IN_CLAUDE ? 'בגרסה שב-claude.ai הנתונים כבר נשמרים בחשבון claude.ai הפרטי שלך, ואין צורך בחשבון נוסף.' : 'הסנכרון לא זמין כרגע. בדוק את החיבור לאינטרנט ורענן את הדף.') + '</p>' + back;
      return;
    }
    if (!sync.user) {
      view.innerHTML = '<div class="acc">' + back + UI.head('התחברות', 'מתחברים כדי שהאימונים יישמרו בחשבון ויופיעו בכל מחשב וטלפון.') +
        '<form class="panel acc-form" novalidate>' +
          UI.field('אימייל', '<input type="email" id="acc-email" name="email" autocomplete="username" required dir="ltr">') +
          UI.field('סיסמה', '<input type="password" id="acc-pass" name="password" autocomplete="current-password" required dir="ltr">') +
          '<p class="warn" data-err hidden></p>' +
          '<button type="submit" class="btn primary lg">' + icon('user') + 'התחבר</button>' +
          '<p class="muted small">ההרשמה לאתר סגורה. חשבון נפתח רק על ידי מנהל האתר. שכחת סיסמה? בקש ממנו לאפס אותה.</p>' +
          '<p class="muted small">בפעם הראשונה שמתחברים במכשיר, הנתונים שכבר נמצאים בו מצטרפים לחשבון. שום דבר לא נמחק.</p>' +
        '</form>' + privacy() + '</div>';
      const form = $('.acc-form', view);
      const err = $('[data-err]', view);
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const email = form.elements.email.value.trim(), password = form.elements.password.value;
        if (!email || !password) { err.hidden = false; err.textContent = 'צריך למלא אימייל וסיסמה.'; return; }
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true; err.hidden = true;
        try {
          await sync.signIn(email, password);
          CM.toast('התחברת. הנתונים מסונכרנים', 'win');
          location.hash = store.get('profile').onboarded ? '#dashboard' : '#onboarding';
        } catch (ex) {
          err.hidden = false; err.textContent = sync.errText(ex);
          btn.disabled = false;
        }
      });
      return;
    }
    const st = STATE[sync.state] || STATE.syncing;
    view.innerHTML = '<div class="acc">' + back + UI.head('חשבון וסנכרון', 'האימונים שלך נשמרים בחשבון ומופיעים בכל מכשיר שמתחברים בו.') +
      '<section class="panel"><div class="panel-head"><h2>' + icon('user') + '<span dir="ltr">' + esc(sync.user.email || '') + '</span></h2>' +
        '<button type="button" class="btn ghost sm" data-now>' + icon('refresh') + 'סנכרן עכשיו</button></div>' +
        '<p class="' + (sync.state === 'ok' ? 'ok-line' : sync.state === 'syncing' ? 'note' : 'warn') + '">' + icon(st[0]) + '<span>' + esc(st[1]) + (sync.state === 'ok' && sync.lastSync ? ' · ' + timeOf(sync.lastSync) : '') + '</span></p>' +
        '<div class="btn-row"><button type="button" class="btn ghost" data-out>' + icon('logout') + 'התנתק</button></div></section>' +
      '<section class="panel push-panel" data-push><h2>' + icon('bell') + 'התראות לטלפון</h2><p class="muted">בודק…</p></section>' +
      '<details class="panel"><summary class="sum-h">' + icon('lock') + 'שינוי סיסמה</summary>' +
        '<form class="acc-pass" novalidate>' + UI.field('סיסמה חדשה', '<input type="password" id="acc-new" name="p1" autocomplete="new-password" dir="ltr" minlength="8">') +
        UI.field('שוב את הסיסמה החדשה', '<input type="password" id="acc-new2" name="p2" autocomplete="new-password" dir="ltr">') +
        '<button type="submit" class="btn primary">' + icon('check') + 'שמור סיסמה</button></form></details>' +
      privacy() +
      '<section class="panel"><h2>' + icon('trash') + 'מחיקת החשבון</h2><p class="muted">מוחק את החשבון ואת כל הנתונים שבו מהשרת. העותק שבמכשיר הזה נשאר.</p>' +
        '<div class="btn-row"><button type="button" class="btn danger" data-del>' + icon('trash') + 'מחק את החשבון שלי</button></div></section></div>';

    view.addEventListener('click', async e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-now')) { await sync.run(); CM.toast(sync.state === 'ok' ? 'מסונכרן' : STATE[sync.state][1], sync.state === 'ok' ? '' : 'error'); }
      else if (b.hasAttribute('data-out')) {
        const v = await CM.dialog({
          title: 'להתנתק?',
          text: 'הנתונים שלך נשארים בחשבון. במכשיר הזה אפשר להשאיר עותק או למחוק אותו (למשל במחשב של מישהו אחר).',
          actions: [{label: 'התנתק והשאר במכשיר', value: 'keep'}, {label: 'התנתק ומחק מהמכשיר', value: 'wipe', kind: 'danger'}, {label: 'ביטול', value: null}]
        });
        if (!v) return;
        await sync.signOut(v === 'keep');
        CM.toast('התנתקת');
        location.hash = v === 'keep' ? '#account' : '#onboarding';
        if (v === 'keep') ctx.rerender();
      } else if (b.hasAttribute('data-del')) {
        const ok = await CM.confirmBox('למחוק את החשבון?', 'החשבון וכל הנתונים שבו יימחקו מהשרת, ואי אפשר לבטל את זה. העותק שבמכשיר הזה נשאר.', 'מחק את החשבון', true);
        if (!ok) return;
        try { await sync.deleteAccount(); CM.toast('החשבון נמחק'); ctx.rerender(); }
        catch (ex) { CM.toast(sync.errText(ex), 'error'); }
      }
    });
    const pf = $('.acc-pass', view);
    pf.addEventListener('submit', async e => {
      e.preventDefault();
      const p1 = pf.elements.p1.value, p2 = pf.elements.p2.value;
      if (p1.length < 8) return CM.toast('סיסמה של 8 תווים לפחות', 'error');
      if (p1 !== p2) return CM.toast('הסיסמאות לא זהות', 'error');
      try { await sync.changePassword(p1); pf.reset(); CM.toast('הסיסמה עודכנה'); }
      catch (ex) { CM.toast(sync.errText(ex), 'error'); }
    });
    fillPush($('[data-push]', view));
    ctx.onLeave(sync.onChange(() => { if (!view.contains(document.activeElement) || document.activeElement === view) ctx.rerender(); }));
  }
});
})(window.CM = window.CM || {});
