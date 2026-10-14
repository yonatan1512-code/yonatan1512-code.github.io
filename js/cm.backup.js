/* CourtMaster AI — keeping the player's data safe.
   - mergeData(): adds data from a backup or an exported file without deleting anything already here.
   - On the local server, every change is also saved to a file on the computer (data/backup.json),
     and if this browser lost its data, it comes back from that file. */
(function (CM) {
'use strict';
const {store, KEYS} = CM;

const isDefault = (k, v) => JSON.stringify(v) === JSON.stringify(KEYS[k].def());
const byId = (cur, inc) => { const have = new Set(cur.map(x => x.id)); return inc.filter(x => !have.has(x.id)); };

// adds what is missing; returns the names of the keys that changed
CM.mergeData = function (data) {
  const changed = [];
  if (!data || typeof data !== 'object') return changed;
  Object.keys(KEYS).forEach(k => {
    if (!(k in data) || k === 'meta') return;
    let inc;
    try { inc = KEYS[k].norm(data[k]); } catch (e) { return; }
    if (inc == null || isDefault(k, inc)) return;
    const cur = store.get(k);
    let next = null;
    if (isDefault(k, cur)) next = inc;
    else if (['sessions', 'tests', 'records', 'goals'].includes(k)) { const add = byId(cur, inc); if (add.length) next = KEYS[k].norm(cur.concat(add)); }
    else if (k === 'profile') { if (!cur.onboarded && inc.onboarded) next = inc; }
    else if (k === 'lessons') {
      const add = Object.keys(inc.s).filter(id => !cur.s[id]);
      if (add.length) { next = CM.clone(cur); add.forEach(id => { next.s[id] = inc.s[id]; }); }
    } else if (k === 'courses') {
      const out = CM.clone(cur);
      let more = false;
      Object.keys(inc.done).forEach(m => { const u = Array.from(new Set((out.done[m] || []).concat(inc.done[m]))).sort(); if (u.length !== (out.done[m] || []).length) { out.done[m] = u; more = true; } });
      if (more) next = KEYS[k].norm(out);
    } else if (k === 'plan') {
      const add = Object.keys(inc.days).filter(d => !cur.days[d]);
      if (add.length) { next = CM.clone(cur); add.forEach(d => { next.days[d] = inc.days[d]; }); }
    } else if (k === 'favs') {
      const u = {drills: Array.from(new Set(cur.drills.concat(inc.drills))), lessons: Array.from(new Set(cur.lessons.concat(inc.lessons)))};
      if (u.drills.length !== cur.drills.length || u.lessons.length !== cur.lessons.length) next = u;
    }
    // settings, the chat and a workout in progress: what is already here wins
    if (next) { store.set(k, next); changed.push(k); }
  });
  return changed;
};

CM.snapshot = function () {
  const data = {};
  Object.keys(KEYS).forEach(k => { data[k] = store.get(k); });
  return data;
};

/* ---------- the backup file on this computer (local server only) ---------- */
const backup = CM.backup = {on: false, lastError: false};
let timer = null;
async function save() {
  timer = null;
  try {
    const r = await fetch('/api/backup', {
      method: 'PUT', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({app: 'CourtMaster AI', saved: new Date().toISOString(), data: CM.snapshot()})
    });
    if (!r.ok) throw new Error(r.status);
    if (backup.lastError) { backup.lastError = false; CM.shell.saveState(); }
  } catch (e) {
    if (!backup.lastError) { backup.lastError = true; CM.shell.saveState(); }
  }
}
const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(save, 1200); };

// called once at start-up, before the first page is drawn; returns the keys restored from the file
backup.start = async function () {
  if (CM.IN_CLAUDE || !['localhost', '127.0.0.1'].includes(location.hostname)) return [];
  let file = null, reachable = false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch('/api/backup', {cache: 'no-store', signal: ctl.signal});
    clearTimeout(t);
    reachable = r.ok || r.status === 404;
    if (r.ok) file = await r.json();
  } catch (e) { reachable = false; }
  if (!reachable) return [];
  const restored = file && file.data ? CM.mergeData(file.data) : [];
  backup.on = true;
  Object.keys(KEYS).forEach(k => store.on(k, schedule));
  save();
  return restored;
};
})(window.CM = window.CM || {});
