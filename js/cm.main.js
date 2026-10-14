/* CourtMaster AI — start-up: storage, the private claude.ai copy (when available), the shell, the router,
   the AI check and the one-time import from the previous site. */
(function (CM) {
'use strict';
const {store} = CM;
const wait = ms => new Promise(r => setTimeout(r, ms));

async function boot() {
  // the claude.ai copy is wrapped in a page shell without these, so set them here
  document.documentElement.lang = 'he';
  document.documentElement.dir = 'rtl';
  CM.mountIcons();
  store.init();
  CM.shell.mount();
  document.getElementById('view').innerHTML = '<div class="empty" style="border:0">' + CM.icon('ball', 'big') + '<p>טוען…</p></div>';

  // inside claude.ai: wait briefly for the saved copy, so a returning player does not see the welcome screen first
  if (CM.IN_CLAUDE) {
    let arrived = false;
    const off = store.on('profile', () => { arrived = true; });
    await Promise.race([CM.connectCloud(), wait(4000)]);
    for (let i = 0; i < 15 && !arrived && store.mode === 'cloud'; i++) await wait(100);
    off();
  }
  // on this computer: bring back anything this browser lost from the backup file, then keep the file up to date
  let restored = [];
  try { restored = await CM.backup.start(); } catch (e) { console.error(e); }
  CM.shell.saveState();

  // the saved profile can arrive from the account after the welcome screen opened
  store.on('profile', p => {
    const h = CM.parseHash();
    if (p.onboarded && h.name === 'onboarding' && !h.param && !CM.finishingOnboarding) location.replace('#dashboard');
  });
  window.addEventListener('hashchange', () => CM.render());
  CM.render();
  if (restored.length) CM.toast('הנתונים שלך שוחזרו מקובץ הגיבוי במחשב', 'win');

  CM.ai.detect().then(() => { if (CM.parseHash().name === 'coach') CM.render({keep: true}); });
  try {
    const n = await CM.migrateOld();
    if (n) CM.toast('הנתונים מהאתר הקודם (קליעות, מבחנים ואתגרים) הועברו לכאן', 'win');
  } catch (e) { console.error(e); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.CM = window.CM || {});
