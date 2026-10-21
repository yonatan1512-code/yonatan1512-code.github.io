/* CourtMaster AI — training reminders as phone notifications (web push), for signed-in users.
   Each device that allows notifications is saved in Supabase (table push_subscriptions, own rows only);
   the Supabase function cm-reminders checks every 5 minutes who should get a reminder now.
   Not available inside claude.ai (no service workers there). */
(function (CM) {
'use strict';
const push = CM.push = {};
const ON = !CM.IN_CLAUDE && 'serviceWorker' in navigator && window.isSecureContext;
const DEFAULT_PREFS = {before: true, nudge: true, weekly: true};
push.KINDS = {
  before: 'תזכורת 15 דקות לפני אימון',
  nudge: 'תזכורת עדינה אם האימון של היום עוד לא נעשה',
  weekly: 'סיכום שבועי במוצאי שבת'
};
push.supported = () => ON && 'PushManager' in window && 'Notification' in window && !!(CM.SUPABASE && CM.SUPABASE.vapid);
push.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
push.installed = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
push.permission = () => ('Notification' in window ? Notification.permission : 'unsupported');

let reg = null;
push.register = async function () {
  if (!ON) return null;
  try { reg = await navigator.serviceWorker.register('sw.js'); } catch (e) { reg = null; }
  return reg;
};
const worker = async () => reg || (await push.register()) || navigator.serviceWorker.ready;
const subscription = async () => (await worker()).pushManager.getSubscription();
const db = () => CM.sync.client();
function keyBytes(b64) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s + '='.repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

// this device: {on, prefs}
push.state = async function () {
  if (!push.supported() || !CM.sync.user || push.permission() !== 'granted') return {on: false, prefs: DEFAULT_PREFS};
  const sub = await subscription().catch(() => null);
  if (!sub) return {on: false, prefs: DEFAULT_PREFS};
  const {data} = await db().from('push_subscriptions').select('prefs').eq('endpoint', sub.endpoint).maybeSingle();
  return {on: !!data, prefs: Object.assign({}, DEFAULT_PREFS, data && data.prefs)};
};

// asks for permission (call it from a tap), subscribes this device and saves it to the account
push.enable = async function (prefs) {
  if (!push.supported()) throw {code: 'unsupported'};
  if (!CM.sync.user) throw {code: 'signed_out'};
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw {code: perm === 'denied' ? 'denied' : 'dismissed'};
  const w = await worker();
  let sub = await w.pushManager.getSubscription();
  if (!sub) sub = await w.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: keyBytes(CM.SUPABASE.vapid)});
  const j = sub.toJSON();
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Asia/Jerusalem';
  const {error} = await db().from('push_subscriptions').upsert({
    user_id: CM.sync.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
    prefs: Object.assign({}, DEFAULT_PREFS, prefs), tz
  }, {onConflict: 'endpoint'});
  if (error) throw error;
};
push.setPrefs = async function (prefs) {
  const sub = await subscription();
  if (!sub) return;
  const {error} = await db().from('push_subscriptions').update({prefs}).eq('endpoint', sub.endpoint);
  if (error) throw error;
};
push.disable = async function () {
  const sub = await subscription().catch(() => null);
  if (!sub) return;
  if (CM.sync.user) await db().from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  try { await sub.unsubscribe(); } catch (e) {}
};
// before signing out: this device should stop getting this account's reminders
push.forgetDevice = async function () { if (push.supported()) { try { await push.disable(); } catch (e) {} } };
push.test = async function () {
  const {data, error} = await db().functions.invoke('cm-reminders', {body: {test: true}});
  if (error) throw error;
  return data || {};
};
push.errText = function (e) {
  const M = {
    unsupported: 'הדפדפן הזה לא תומך בהתראות.',
    signed_out: 'כדי לקבל התראות צריך להתחבר לחשבון.',
    denied: 'ההתראות חסומות בדפדפן. אפשר לאשר אותן בהגדרות האתר (סמל המנעול שליד הכתובת), ואז לנסות שוב.',
    dismissed: 'לא אושרו התראות. אפשר לנסות שוב.'
  };
  if (e && M[e.code]) return M[e.code];
  if (e && e.name === 'FunctionsHttpError') return 'השרת עוד לא מוכן לשלוח התראות. מנהל האתר צריך להשלים את ההגדרה ב-Supabase.';
  if (e && (e.name === 'FunctionsFetchError' || e.name === 'FunctionsRelayError')) return 'אין חיבור לשרת ההתראות. נסה שוב בעוד רגע.';
  return CM.sync.errText(e);
};
})(window.CM = window.CM || {});
