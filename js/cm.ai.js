/* CourtMaster AI — the AI coach connection.
   Three honest states:
   - inside claude.ai: Claude answers through the viewer's own account (the "sample" capability, asks for consent first);
   - on the local server with an API key in an environment variable: the server calls Claude (the key never reaches the browser);
   - neither: the coach says it is not connected. There are no canned answers pretending to be AI. */
(function (CM) {
'use strict';
const {store, today, DAY_NAMES} = CM;

const ai = CM.ai = {provider: 'checking', sample: null, mem: [], ctl: null};

ai.detect = async function () {
  if (CM.IN_CLAUDE) {
    try { ai.sample = await window.claude.use('sample'); } catch (e) { ai.sample = null; }
    ai.provider = ai.sample ? 'claude' : 'none';
    return ai.provider;
  }
  // only the local server (server.js listens on this computer only) can have a key; the public website never does
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) { ai.provider = 'none'; return ai.provider; }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch('/api/health', {signal: ctl.signal, cache: 'no-store'});
    clearTimeout(t);
    const j = r.ok ? await r.json() : null;
    ai.provider = j && j.ai === true ? 'server' : j ? 'nokey' : 'none';
  } catch (e) { ai.provider = 'none'; }
  return ai.provider;
};

/* ---------- what the coach must always follow ---------- */
const RULES = `You are "המאמן שלי" (My Coach), the basketball coach inside the CourtMaster AI app. You are talking with a young player whose profile and progress are in the APP DATA below.

Language and tone:
- Always answer in Hebrew, in simple, clear words a 13-year-old understands. Warm, direct and encouraging, never childish.
- Keep answers short: a few short paragraphs or a list. Use **bold** for key words. No tables, no links.

Safety (the player is a minor; these rules always win):
- Follow the NBA / USA Basketball youth guidelines for ages 12–14: at most 10 hours of organized basketball a week, 2–4 practices of 60–90 minutes, at least one full rest day a week, and playing other sports is a good idea. Never build a plan above these limits, even if he asks for "as much as possible". Explain that smart training beats more training.
- Every workout starts with a warm-up and ends with a cool-down. Strength work is bodyweight only: no heavy weights, no max lifts, no extreme programs.
- No diets, weight loss, calorie counting, supplements or energy drinks. You may talk about regular balanced meals, water and sleep (about 9 hours or more).
- Pain is a stop sign: tell him to stop, rest and tell a parent; pain that stays, swelling or an injury needs a doctor or physiotherapist. Do not diagnose.
- If he sounds very sad, hopeless or unsafe, answer kindly, tell him to talk now to a parent or another adult he trusts, and mention ERAN, the Israeli emotional support line, at 1201.
- Never promise or predict NBA, professional or scholarship chances. Talk about effort, habits and the next step he can control.

Honesty:
- Do not invent statistics, studies, records, video links or facts about real players. If you are not sure, say so.
- Do not give links or web addresses. For videos, point him to the lessons, the drill library or the "לומדים מה-NBA" page in the app.
- Do not ask for personal details (address, school, phone, full name). If he shares them, do not repeat them.
- Only use the progress in APP DATA. If something was not measured yet, say it was not measured.
- Stay on basketball, fitness, recovery and balancing training with school. Politely steer other topics back.

Building a workout:
- When he asks for a workout (or a change to one), first explain in 2–4 short lines what the session focuses on and why the order makes sense.
- Then add exactly one fenced block in this format, with valid JSON and nothing else inside:
\`\`\`workout
{"title": "short Hebrew title", "goal": "one Hebrew sentence", "items": [{"drill": "w-dynamic", "min": 8}, {"drill": "d-cross", "min": 6}, {"name": "Hebrew name of a custom drill", "how": "short Hebrew instructions", "min": 5}, {"drill": "w-cool", "min": 6}]}
\`\`\`
- Prefer drills from the DRILL LIBRARY (use their exact id in "drill"). Use a custom item ("name" + "how") only when nothing in the library fits.
- Use only equipment he has. Minutes per item are 1–30. A court session totals 30–90 minutes, a home session 10–30 minutes, and it must fit the time he has that day.`;

/* ---------- what the coach knows about him (built fresh for every message) ---------- */
function context() {
  const p = store.get('profile');
  const ab = k => CM.AB[k].name;
  const t = today();
  const w = CM.buildWorkout(t);
  const lines = [];
  lines.push('APP DATA (today is ' + t + ', יום ' + DAY_NAMES[CM.dow(t)] + ')');
  lines.push('Player: ' + (p.name || 'no name given') + ', age ' + p.age + ', height ' + p.height + ' cm, level ' + CM.LEVEL_NAME[p.level] + ', experience ' + CM.YEARS[p.years] + (p.team ? ', plays in a team' : ', not in a team') + '.');
  lines.push('Goals: ' + p.goals.map(ab).join(', ') + '. Main priorities: ' + p.focus.map(ab).join(', ') + '. Long-term: ' + CM.LONG_GOALS[p.longGoal] + '.');
  lines.push('Trains at: ' + ({court: 'a public court', home: 'home', both: 'a court and home'})[p.place] + (p.alone ? ', usually alone' : ', with a partner') + (p.quiet ? ', must be quiet at home' : '') + '. Equipment: ' + (p.equip.map(e => CM.EQUIP[e]).join(', ') || 'none') + '.');
  lines.push('Weekly template: ' + p.days.map((d, i) => DAY_NAMES[i] + ' ' + CM.MODES[d.mode].short + (d.mode === 'rest' ? '' : ' ' + d.start + ' ' + d.min + 'min')).join('; ') + '.');
  lines.push('Today: ' + CM.MODES[w.mode].name + (w.items.length ? ' "' + w.title + '" ' + w.total + ' min: ' + w.items.map(i => i.name + ' ' + i.min).join(', ') : '') + (CM.doneOn(t).length ? ' (already done today)' : '') + '.');
  const L = store.get('lessons').s;
  lines.push('Curriculum: open up to level ' + CM.openLevel() + ', working on level ' + CM.workLevel() + '. ' + [1, 2, 3, 4].map(n => { const s = CM.levelStats(n); return 'level ' + n + ': ' + s.mastered + '/' + s.total + ' mastered'; }).join(', ') + '.');
  const marked = Object.keys(L).filter(id => L[id].st && !CM.MASTERED(L[id].st)).map(id => CM.LESSON[id].title + ' (' + CM.LSTATES[L[id].st] + ')');
  if (marked.length) lines.push('Lessons he marked as needing work: ' + marked.slice(0, 10).join(', ') + '.');
  const nl = CM.nextLesson();
  if (nl) lines.push('Recommended next lesson: ' + nl.title + ' (level ' + nl.level + ').');
  const res = CM.TESTS.map(tt => { const s = CM.testSummary(tt.id); if (!s.last) return null; return tt.name + ': ' + CM.fmtVal(tt, s.last.v) + ' ' + tt.unit + ' on ' + s.last.date + (s.prev ? ' (previous ' + CM.fmtVal(tt, s.prev.v) + ')' : ''); }).filter(Boolean);
  lines.push('Test results: ' + (res.length ? res.join('; ') : 'nothing measured yet') + '.');
  const S = store.get('sessions').slice(-6);
  lines.push('Recent sessions: ' + (S.length ? S.map(s => s.date + ' ' + s.title + ' ' + s.min + 'min' + (s.rpe ? ' difficulty ' + s.rpe + '/5' : '') + (s.pain ? ' REPORTED PAIN' : '') + (s.note ? ' note: "' + s.note.slice(0, 80) + '"' : '')).join('; ') : 'none yet') + '.');
  const sh = CM.shotTotals(CM.addDays(t, -28));
  if (sh.att) lines.push('Shooting last 4 weeks: ' + sh.made + '/' + sh.att + ' made.');
  lines.push('DRILL LIBRARY (id | name | category | level 1-3 | equipment | minutes):');
  CM.DRILLS.forEach(d => lines.push(d.id + ' | ' + d.name + ' | ' + CM.CATS[d.cat].name + ' | ' + d.lvl + ' | ' + (d.equip.join('+') || '-') + ' | ' + d.min));
  return lines.join('\n');
}
ai.context = context;

/* ---------- chat history (kept only when the privacy setting allows) ---------- */
ai.history = () => store.get('settings').saveChat ? store.get('coach').msgs : ai.mem;
ai.push = msg => {
  if (store.get('settings').saveChat) store.update('coach', v => { v.msgs.push(msg); return v; });
  else ai.mem.push(msg);
};
ai.clear = () => { ai.mem = []; store.set('coach', {msgs: []}); };

// the last messages that fit, always starting with a user message
function recent() {
  const all = ai.history();
  const out = [];
  let size = 0;
  for (let i = all.length - 1; i >= 0 && out.length < 24; i--) {
    const m = all[i];
    size += m.t.length;
    if (size > 30000 && out.length) break;
    out.unshift({role: m.r, content: m.t});
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/* ---------- errors, in words he can act on ---------- */
const ERR = {
  not_granted: 'לא אושר למאמן להשתמש ב-Claude בדף הזה. אפשר לאשר דרך תפריט ההרשאות של הדף ולנסות שוב.',
  sampling_disabled: 'המאמן לא זמין בחשבון הזה.',
  not_declared: 'המאמן לא זמין בגרסה הזאת של הדף.',
  capability_disabled: 'המאמן לא זמין בתצוגה הזאת.',
  capability_removed: 'המאמן לא זמין בתצוגה הזאת.',
  rate_limited: 'נשלחו יותר מדי שאלות או שהגעת למגבלת השימוש. נסה שוב בעוד כמה דקות.',
  session_expired: 'צריך להתחבר מחדש ל-claude.ai ואז לנסות שוב.',
  refused: 'המאמן לא יכול לענות על זה. נסה לשאול אחרת, על אימון, כושר או משחק.',
  empty_completion: 'לא התקבלה תשובה. נסה לשאול בקצרה ובפשטות.',
  prompt_too_large: 'השיחה ארוכה מדי. מחק את השיחה והתחל חדשה.',
  no_key: 'השרת המקומי פועל, אבל לא הוגדר בו מפתח API, ולכן המאמן לא מחובר.',
  auth: 'מפתח ה-API שהוגדר בשרת לא תקין. מבוגר צריך לבדוק אותו.',
  network: 'אין חיבור לשרת. ודא שהשרת המקומי פועל ונסה שוב.',
  upstream_error: 'יש תקלה זמנית בשירות. נסה שוב בעוד רגע.',
  none: 'המאמן עדיין לא מחובר.'
};
ai.errText = code => ERR[code] || ERR.upstream_error;
// codes after which asking again in this visit cannot work
ai.fatal = code => ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'no_key', 'auth', 'none'].includes(code);

/* ---------- ask ---------- */
ai.ask = async function (onText) {
  const turns = recent();
  if (!turns.length) throw {code: 'empty_completion'};
  const ctl = ai.ctl = new AbortController();
  const rules = RULES + '\n\n' + context();
  try {
    if (ai.provider === 'claude') {
      const r = await ai.sample([{role: 'user', content: rules}].concat(turns), {
        cache: false, signal: ctl.signal, onText: u => onText(u.text)
      });
      return {text: r.text, truncated: !!r.truncated};
    }
    if (ai.provider === 'server') return await askServer(rules, turns, ctl.signal, onText);
    throw {code: ai.provider === 'nokey' ? 'no_key' : 'none'};
  } catch (e) {
    if (e && e.name === 'AbortError') throw {code: 'cancelled'};
    throw {code: (e && e.code) || 'upstream_error', text: e && e.text};
  } finally { if (ai.ctl === ctl) ai.ctl = null; }
};
ai.stop = () => { if (ai.ctl) ai.ctl.abort(); };

async function askServer(system, messages, signal, onText) {
  let r;
  try {
    r = await fetch('/api/coach', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({system, messages}), signal});
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw {code: 'network'};
  }
  if (!r.ok || !r.body) {
    let j = null;
    try { j = await r.json(); } catch (e) {}
    throw {code: (j && j.error) || 'upstream_error'};
  }
  // the server streams one JSON object per line: {t} pieces of text, then {done} or {error}
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '', text = '', end = null;
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    buf += dec.decode(value, {stream: true});
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let m;
      try { m = JSON.parse(line); } catch (e) { continue; }
      if (typeof m.t === 'string') { text += m.t; onText(text); }
      else if (m.error) throw {code: m.error, text: m.error === 'refused' ? undefined : text};
      else if (m.done) end = m;
    }
  }
  if (!end) throw {code: 'upstream_error', text};
  if (!text.trim()) throw {code: 'empty_completion'};
  return {text, truncated: !!end.truncated};
}

/* ---------- a workout inside an answer ---------- */
const FENCE = /```workout\s*([\s\S]*?)```/;
ai.splitWorkout = function (text) {
  const m = FENCE.exec(text);
  if (!m) return {text, workout: null, partial: /```workout/.test(text)};
  let w = null;
  try { w = JSON.parse(m[1]); } catch (e) { w = null; }
  return {text: text.replace(FENCE, '').trim(), workout: w ? checkWorkout(w) : {error: 'פורמט האימון לא תקין, אפשר לבקש מהמאמן לכתוב אותו שוב.'}};
};
function checkWorkout(w) {
  if (!CM.isObj(w) || !Array.isArray(w.items)) return {error: 'פורמט האימון לא תקין.'};
  const items = [];
  w.items.slice(0, 20).forEach(it => {
    if (!CM.isObj(it)) return;
    const min = CM.int(it.min, 1, 30, 5);
    if (typeof it.drill === 'string' && CM.DRILL[it.drill]) items.push({d: it.drill, min});
    else if (typeof it.name === 'string' && it.name.trim()) items.push({c: {name: CM.str(it.name, 80), how: CM.str(it.how, 400), goal: ''}, min});
  });
  if (!items.length) return {error: 'באימון הזה אין תרגילים.'};
  const total = items.reduce((s, i) => s + i.min, 0);
  return {title: CM.str(w.title, 80) || 'אימון מהמאמן', goal: CM.str(w.goal, 200), items, total};
}
// saves it as the workout of a given day, inside the youth limits; returns '' or the reason it cannot
ai.applyWorkout = function (w, date) {
  const c = CM.dayConf(date);
  if (c.mode === 'rest' || c.mode === 'team') return 'ביום הזה מתוכננת ' + (c.mode === 'rest' ? 'מנוחה' : 'אימון קבוצה') + '. בחר יום אחר, או שנה קודם את סוג היום בתוכנית.';
  const cap = c.mode === 'home' ? CM.LIMITS.homeMax : CM.LIMITS.trainMax;
  if (w.total > cap) return 'האימון ארוך מדי ליום ' + (c.mode === 'home' ? 'בית (עד 30 דקות)' : 'מגרש (עד 90 דקות)') + '. בקש מהמאמן גרסה קצרה יותר.';
  const why = CM.checkDayChange(date, {min: Math.max(c.min, w.total)});
  if (why) return why;
  CM.setDay(date, {items: w.items, title: w.title, goal: w.goal, ai: true, min: Math.max(CM.LIMITS[c.mode === 'home' ? 'homeMin' : 'trainMin'], w.total)});
  return '';
};
})(window.CM = window.CM || {});
