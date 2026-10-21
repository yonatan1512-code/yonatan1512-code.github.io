/* CourtMaster AI — service worker. It only shows training reminders (web push) and opens the site when one is tapped.
   It does not cache the site, so an update is always picked up on the next visit. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {body: e.data ? e.data.text() : ''}; }
  e.waitUntil(self.registration.showNotification(d.title || 'CourtMaster AI', {
    body: d.body || '', icon: 'images/icon-192.png', badge: 'images/badge-96.png',
    dir: 'rtl', lang: 'he', tag: d.tag || 'courtmaster', data: {url: d.url || './'}
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    if (open) return open.focus().then(c => (c.navigate ? c.navigate(target) : c)).catch(() => open);
    return self.clients.openWindow(target);
  }));
});
