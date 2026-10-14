/* CourtMaster AI — accounts and sync between devices (Supabase).
   One row per user (table user_data) holds {v: 1, keys: {<key>: {t, v}}}: every saved key with the time it last changed.
   Syncing compares the times key by key: the newer copy wins, on this device and in the account.
   The first time a device joins an account, the two are combined and nothing is dropped.
   Not used inside claude.ai, where the page has its own private storage. */
(function (CM) {
'use strict';
const {store, KEYS} = CM;

const sync = CM.sync = {available: false, user: null, state: 'off', lastSync: 0};
const SKIP = new Set(['meta']);
const T_KEY = 'cm:_t';            // when each key last changed on this device
const UID_KEY = 'cm:_sync_uid';   // the account this device is synced with right now
const LAST_KEY = 'cm:_last_uid';  // the account that signed out here and left its data on the device

let client = null, times = {}, applying = false, running = false, again = false, timer = null, lastRun = 0;
const listeners = [];
const raw = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
function loadTimes() { try { const t = JSON.parse(raw.get(T_KEY) || '{}'); return t && typeof t === 'object' ? t : {}; } catch (e) { return {}; } }
const saveTimes = () => raw.set(T_KEY, JSON.stringify(times));
const notify = () => { listeners.forEach(fn => { try { fn(sync); } catch (e) {} }); if (CM.shell) CM.shell.saveState(); };
sync.onChange = fn => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; };
const setState = s => { sync.state = s; notify(); };

// a local change: remember when, and upload it shortly
function touched(k) {
  if (applying || SKIP.has(k)) return;
  times[k] = Date.now();
  saveTimes();
  if (sync.user) schedule();
}
function schedule(ms) { if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = null; sync.run(); }, ms || 1500); }

function apply(k, value) {
  let v;
  try { v = KEYS[k].norm(value); } catch (e) { return false; }
  if (v == null && k !== 'live') v = KEYS[k].def();
  if (JSON.stringify(v) === JSON.stringify(store.get(k))) return false;
  store.set(k, v);
  return true;
}
const hasData = () => store.get('profile').onboarded || store.get('sessions').length || store.get('tests').length || store.get('records').length;

/* ---------- the sync itself: download, combine key by key, upload what changed ---------- */
sync.run = async function () {
  if (!sync.user || !client) return;
  if (running) { again = true; return; }
  running = true;
  setState('syncing');
  const uid = sync.user.id;
  try {
    const res = await client.from('user_data').select('data').eq('user_id', uid).maybeSingle();
    if (res.error) throw res.error;
    const remote = res.data && res.data.data && res.data.data.keys && typeof res.data.data.keys === 'object' ? res.data.data.keys : {};
    const joining = raw.get(UID_KEY) !== uid;
    const other = raw.get(LAST_KEY);
    const now = Date.now();
    applying = true;
    try {
      if (joining && other && other !== uid && hasData()) {
        // this device still holds another person's data: show only this account's data
        Object.keys(KEYS).forEach(k => { if (!SKIP.has(k)) apply(k, remote[k] ? remote[k].v : KEYS[k].def()); });
        times = {};
        Object.keys(remote).forEach(k => { if (remote[k] && typeof remote[k].t === 'number') times[k] = remote[k].t; });
      } else if (joining) {
        // first time on this device: combine both copies, never drop anything
        const plain = {};
        Object.keys(remote).forEach(k => { if (remote[k]) plain[k] = remote[k].v; });
        if (plain.profile && plain.profile.onboarded) apply('profile', plain.profile);
        if (plain.settings) apply('settings', plain.settings);
        CM.mergeData(plain);
        Object.keys(KEYS).forEach(k => { if (!SKIP.has(k)) times[k] = now; });
      } else {
        Object.keys(remote).forEach(k => {
          const r = remote[k];
          if (!KEYS[k] || SKIP.has(k) || !r || typeof r.t !== 'number') return;
          if (r.t > (times[k] || 0)) { apply(k, r.v); times[k] = r.t; }
        });
      }
    } finally { applying = false; }
    saveTimes();
    raw.set(UID_KEY, uid);
    raw.del(LAST_KEY);
    // upload when this device has something newer than the account (or the account is empty)
    const keys = {};
    let changed = false;
    Object.keys(KEYS).forEach(k => {
      if (SKIP.has(k)) return;
      const t = times[k] || 0;
      keys[k] = {t, v: store.get(k)};
      if (!remote[k] || t > (remote[k].t || 0)) changed = true;
    });
    if (changed) {
      const up = await client.from('user_data').upsert({user_id: uid, data: {v: 1, keys}, updated_at: new Date().toISOString()});
      if (up.error) throw up.error;
    }
    sync.lastSync = Date.now();
    lastRun = Date.now();
    setState('ok');
  } catch (e) {
    console.warn('sync failed', e && (e.message || e));
    setState(navigator.onLine === false ? 'offline' : 'error');
    schedule(30000);
  } finally {
    running = false;
    if (again) { again = false; schedule(300); }
  }
};

/* ---------- start, sign in, sign out ---------- */
sync.init = async function () {
  const cfg = CM.SUPABASE;
  if (CM.IN_CLAUDE || !cfg || !window.supabase || typeof window.supabase.createClient !== 'function') return;
  sync.available = true;
  times = loadTimes();
  Object.keys(KEYS).forEach(k => store.on(k, () => touched(k)));
  client = window.supabase.createClient(cfg.url, cfg.key, {
    auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'cm-auth'}
  });
  let session = null;
  try { session = (await client.auth.getSession()).data.session; } catch (e) { session = null; }
  sync.user = session ? session.user : null;
  setState(sync.user ? 'syncing' : 'signedout');
  client.auth.onAuthStateChange((event, s) => {
    // keep this callback short: it must not wait for other Supabase calls
    sync.user = s ? s.user : null;
    if (!sync.user) setState('signedout');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && sync.user && Date.now() - lastRun > 20000) sync.run();
  });
  window.addEventListener('online', () => { if (sync.user && sync.state !== 'ok') sync.run(); });
  if (sync.user) sync.run();
};

const AUTH_ERR = {
  invalid_credentials: 'האימייל או הסיסמה לא נכונים.',
  email_not_confirmed: 'החשבון עוד לא אושר. מנהל האתר צריך לאשר אותו ב-Supabase.',
  over_request_rate_limit: 'יותר מדי ניסיונות. חכה כמה דקות ונסה שוב.',
  user_banned: 'החשבון הזה חסום.',
  weak_password: 'הסיסמה חלשה מדי. בחר סיסמה של 8 תווים לפחות, עם אותיות ומספרים.',
  same_password: 'זו אותה סיסמה כמו עכשיו.'
};
sync.errText = e => {
  if (!e) return 'משהו השתבש. נסה שוב.';
  if (AUTH_ERR[e.code]) return AUTH_ERR[e.code];
  if (e.status === 0 || navigator.onLine === false || /fetch/i.test(e.message || '')) return 'אין חיבור לאינטרנט. נסה שוב כשיש חיבור.';
  return 'הפעולה לא הצליחה. נסה שוב בעוד רגע.';
};

sync.signIn = async function (email, password) {
  const {data, error} = await client.auth.signInWithPassword({email, password});
  if (error) throw error;
  sync.user = data.user;
  await sync.run();
};
// keepLocal: leave this device's copy of the data (it stays in the account either way)
sync.signOut = async function (keepLocal) {
  const uid = sync.user && sync.user.id;
  if (timer) { clearTimeout(timer); timer = null; }
  if (uid && sync.state !== 'ok') { try { await sync.run(); } catch (e) {} }
  try { await client.auth.signOut(); } catch (e) {}
  sync.user = null;
  raw.del(UID_KEY);
  if (keepLocal && uid) raw.set(LAST_KEY, uid);
  if (!keepLocal) {
    applying = true;
    try { await store.wipe(); store.set('meta', {migrated: true}); } finally { applying = false; }
    times = {}; saveTimes(); raw.del(LAST_KEY);
  }
  setState('signedout');
};
sync.changePassword = async function (password) {
  const {error} = await client.auth.updateUser({password});
  if (error) throw error;
};
// removes the account and its saved copy from the server; this device keeps its own copy
sync.deleteAccount = async function () {
  const {error} = await client.rpc('delete_my_account');
  if (error) throw error;
  await sync.signOut(true);
};
// "delete all data" on this device: disconnect first, so the account's copy is not emptied too
sync.beforeWipe = async function () {
  if (sync.user) await sync.signOut(true);
  raw.del(LAST_KEY);
  times = {}; saveTimes();
};
})(window.CM = window.CM || {});
