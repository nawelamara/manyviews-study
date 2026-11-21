/* Many Views – online description study (A single emotion / B fixed top 3 / C agreement-adaptive).
   Friendly design: one question per screen, big tap targets (keys 1-4 work too), practice with "read it again".
   Anonymous: no name, e-mail or IP is collected by this page. Answers go to the researchers' Google Sheet
   (CONFIG.ENDPOINT) after every painting and at the end; progress is kept in the browser, so a refresh can continue.
   Balanced assignment: the sheet gives the next participant number (6 orders x 3 painting rotations = 18 combinations);
   if it cannot be reached, a random number is used. Closed unless CONFIG.OPEN and CONFIG.ENDPOINT are set (test: ?preview=1).
   In the 18 study paintings the description cannot be reopened once the questions start (that is what is measured);
   in the practice it can ("Read it again"). */
'use strict';
const C = window.CONFIG, S = window.STIMULI;
const main = document.getElementById('main');
const ORDERS = ['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA'];
const FEELINGS = ['happiness', 'surprise', 'anticipation', 'trust', 'humility', 'optimism', 'fear', 'sadness', 'love', 'disgust',
  'gratitude', 'pessimism', 'arrogance', 'disagreeableness', 'anger', 'agreeableness', 'regret', 'shame', 'shyness'];
const preview = /[?&]preview=1/.test(location.search);
let lang = 'en', T = UI.en;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (id) => document.getElementById(id);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(xs, r) { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Each participant gets 9 paintings of each type drawn at random from the pool (11 leader, 12 varied),
// 3 of each type per condition, so paintings can be treated as a random sample (not a fixed set). Condition order
// is counterbalanced over 6 orders.
function plan(p) {
  const order = ORDERS[(p - 1) % 6], r = rng(1000 + p), pick = {};
  ['leader', 'varied'].forEach((cat) => { pick[cat] = shuffle(S[cat], r).slice(0, 9); });
  return { order, rot: 0, blocks: order.split('').map((cond, ci) => ({ cond, items: shuffle(['leader', 'varied'].flatMap((cat) => pick[cat].slice(3 * ci, 3 * ci + 3)), r) })) };
}

// Practice description: B for participants 1-6, C for 7-12, B for 13-18, ... so the practice (with feedback) does not train
// only one of the two descriptions being compared. Every block of 6 numbers has all 6 condition orders, so this is balanced.
const practiceCond = () => (Math.floor((sess.p - 1) / 6) % 2 ? 'C' : 'B');

// ---- sending (Google Apps Script web app); no-cors, so the whole session is resent each time and the sheet keeps one copy
const sess = { rows: [] };
// sends go one after another (never overlapping), so the sheet always receives them in order
let queue = Promise.resolve(true);
function send() { queue = queue.then(sendNow, sendNow); return queue; }
async function sendNow() {
  if (!C.ENDPOINT) return true;
  try {
    await fetch(C.ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ session: { id: sess.id, participant: sess.p, order: sess.order, rotation: sess.rot, lang, started_at: sess.started,
        finished_at: sess.finished || '', assigned_by: sess.assignedBy + (preview ? '-preview' : '') }, rows: sess.rows }) });
    return true;
  } catch (e) { return false; }
}
// ---- progress kept in this browser, so a refresh or a closed tab does not lose anything: the participant can continue
// where they stopped (same participant number, same paintings). Answers are also sent after every painting.
const KEY = 'mv-study-progress' + (preview ? '-preview' : ''), DONE = 'mv-study-done' + (preview ? '-preview' : '');
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: nothing kept */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } } };
function save(next) { sess.next = next; store.set(KEY, JSON.stringify({ sess, lang, t: Date.now() })); }
function loadSaved() {
  try { const o = JSON.parse(store.get(KEY) || 'null'); if (o && o.sess && o.sess.id && Date.now() - o.t < 3 * 864e5) return o; } catch (e) { /* ignore */ }
  return null;
}
function resume(o) {
  Object.assign(sess, o.sess); setLang(o.lang);
  const n = sess.next || { kind: 'intro' };
  if (sess.finished) finish();
  else if (n.kind === 'trial') trial({ b: n.b, i: n.i });
  else if (n.kind === 'rate') rate(n.b);
  else if (n.kind === 'numeracy') { sess.rows = sess.rows.filter((r) => r.type !== 'numeracy'); numeracy(); }
  else if (n.kind === 'pref') prefs();
  else if (n.kind === 'comment') comment();
  else if (n.kind === 'ready') ready();
  else intro();
}
async function nextNumber() {
  if (!C.ENDPOINT || preview) return [1 + Math.floor(Math.random() * 54), 'random'];
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(C.ENDPOINT + '?action=next', { signal: ctl.signal }); const j = await r.json();
    if (Number.isInteger(j.p) && j.p > 0) return [j.p, 'sheet'];
  } catch (e) { /* fall back */ }
  return [1 + Math.floor(Math.random() * 54), 'random'];
}


// ---- screen helpers: one thing per screen, a thin progress bar on top, a Back button in the header, the main button
// fixed at the bottom on phones, Enter = main button, number keys = options.
const TOTAL = 107;  // screen numbers for the progress bar; the last screen (thank you + results) is 107 = 100%
// Main question (as in Budescu, Broomell & Por 2009, who asked for a number rather than a category): "If 10 new people
// looked at this painting, how many would pick <the emotion most viewers chose>?" The true value is 10 x count / viewers.
const truth10 = (s) => (10 * s.order[0][1]) / s.n;
const close = (a, s) => Math.abs(a - truth10(s)) <= 1;   // "close" = within 1 of the true value (results screen, feedback)
let keyHandler = null, lastIdx = 0;
function screen(html, { focus, idx, back } = {}) {
  const dir = idx !== undefined && idx < lastIdx ? 'back' : 'fwd';
  if (idx !== undefined) lastIdx = idx;
  main.onchange = null;   // a handler set by one screen (the consent page) must not run on later screens
  main.className = ''; main.innerHTML = html; void main.offsetWidth; main.className = 'in ' + dir;
  $('bar').style.width = `${Math.min(100, (100 * (idx || 0)) / TOTAL).toFixed(1)}%`;
  const tb = $('topback'); tb.hidden = !back; tb.onclick = back || null;
  window.scrollTo(0, 0); keyHandler = null;
  const f = main.querySelector(focus || 'h1, .q, .progress'); if (f) { f.tabIndex = -1; f.focus({ preventScroll: true }); }
}
document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || document.querySelector('.lightbox')) return;
  if (keyHandler && keyHandler(e)) return;
  if (e.key === 'Enter' && !(e.target.closest && e.target.closest('button, a, select, summary, input, textarea'))) {
    const g = $('go'); if (g && !g.disabled) { e.preventDefault(); g.click(); }
  }
});
function setLang(l) {
  lang = l; T = UI[l];
  document.documentElement.lang = l; document.documentElement.dir = l === 'ar' || l === 'ur' ? 'rtl' : 'ltr'; document.title = T.title;
  $('lang').value = l; $('topback-t').textContent = T.back;
  try { localStorage.setItem('mv-study-lang', l); } catch (e) { /* ignore */ }
}
const actions = (label, { disabled, extra = '' } = {}) => `<div class="actions">${extra}<button class="primary" id="go"${disabled ? ' disabled' : ''}>
  <span>${esc(label)}</span><span class="arr" aria-hidden="true">→</span></button><span class="enter" aria-hidden="true">Enter ↵</span></div>`;
// meanings of the less common emotion words that appear on this screen
const meanings = (s, cond) => {
  const shown = (cond === 'A' ? s.order.slice(0, 1) : s.order.slice(0, 3)).map(([f]) => f).concat(s.model.slice(0, 3));
  const hard = Object.keys(T.g).filter((f) => shown.includes(f));
  return hard.length ? `<p class="meanings"><b>${esc(T.meanH)}</b> ${hard.map((f) => `${esc(emo(lang, f))} = ${esc(T.g[f])}`).join(' · ')}</p>` : '';
};
const glossary = () => `<details class="gloss"><summary>${esc(T.gH)}</summary><ul>${Object.entries(T.g).map(([f, d]) => `<li><b>${esc(emo(lang, f))}</b>: ${esc(d)}</li>`).join('')}</ul></details>`;
const progress = (k, total, practice) => `<div class="progress" aria-live="polite"><span class="badge${practice ? ' prac' : ''}">${esc(practice ? T.practice(k, total) : T.painting(k, total))}</span>
  <span class="dotsrow" aria-hidden="true">${Array.from({ length: total > 6 ? 6 : total }, (_, i) => {
    const kk = total > 6 ? ((k - 1) % 6) + 1 : k; return `<i class="${i + 1 < kk ? 'done' : i + 1 === kk ? 'now' : ''}"></i>`; }).join('')}</span></div>`;
const imgTag = (s, extra = '') => `<img src="images/${s.id}.jpg" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${s.id}.jpg'}" ${extra}>`;
const picture = (s, small) => `<figure class="frame${small ? ' small' : ''}">${imgTag(s, `alt="${esc(s.title)}, ${esc(s.artist)}" onclick="zoomPic(this)"`)}
  <button type="button" class="zoomhint" onclick="zoomPic(this.previousElementSibling)" aria-label="${esc(T.zoom)}">⤢</button></figure>
  ${small ? '' : `<p class="caption" lang="en"><b>${esc(s.title)}</b> · ${esc(s.artist)}${s.year ? ' · ' + esc(s.year) : ''}</p>`}`;

// tap a painting to see it full screen; tap again, ✕ or Esc to close
window.zoomPic = (img) => {
  const box = document.createElement('div'); box.className = 'lightbox'; box.setAttribute('role', 'dialog');
  box.innerHTML = `<img src="${img.src}" alt="${esc(img.alt)}"><button type="button" aria-label="Close">✕</button>`;
  const close = () => { box.remove(); document.removeEventListener('keydown', onEsc, true); };
  const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
  box.onclick = close; document.addEventListener('keydown', onEsc, true);
  document.body.appendChild(box); box.querySelector('button').focus();
};

// a question with big option tiles; picking one moves on after a short moment (keys 1-n pick)
function choice({ idx, head = '', q, options, onPick, onBack, chosen }) {
  screen(head + `<h2 class="q">${esc(q)}</h2><div class="tiles" role="radiogroup">` +
    options.map(([v, label], i) => `<button type="button" class="tile" role="radio" aria-checked="${v === chosen}" data-v="${esc(v)}">
      <span class="key">${i + 1}</span><span class="lbl">${esc(label)}</span><span class="tick" aria-hidden="true">✓</span></button>`).join('') + '</div>',
  { focus: '.q', idx, back: onBack });
  let done = false;
  const pick = (b) => {
    if (done) return; done = true;
    main.querySelectorAll('.tile').forEach((t) => t.setAttribute('aria-checked', String(t === b)));
    setTimeout(() => onPick(b.dataset.v), 380);
  };
  main.querySelectorAll('.tile').forEach((b) => b.addEventListener('click', () => pick(b)));
  keyHandler = (e) => { const n = parseInt(e.key, 10), tiles = main.querySelectorAll('.tile');
    if (n >= 1 && n <= tiles.length) { pick(tiles[n - 1]); return true; } return false; };
}
// an agree/disagree question with 1..n round buttons, one per screen (auto-advance)
function scaleQ({ idx, head = '', q, n, chosen, onPick, onBack, lo, hi, from = 1 }) {
  screen(head + `<h2 class="q">${esc(q)}</h2><div class="scale${n > 7 ? ' wide' : ''}" role="radiogroup" aria-label="${esc(q)}"><div class="nums">` +
    Array.from({ length: n }, (_, k) => `<button type="button" class="num" role="radio" aria-checked="${chosen === k + from}" data-v="${k + from}">${k + from}</button>`).join('') +
    `</div><div class="ends"><span>${esc(lo || T.dis)}</span><span>${esc(hi || T.agr)}</span></div></div>`, { focus: '.q', idx, back: onBack });
  let done = false;
  const pick = (b) => {
    if (done) return; done = true;
    main.querySelectorAll('.num').forEach((t) => t.setAttribute('aria-checked', String(t === b)));
    setTimeout(() => onPick(+b.dataset.v), 380);
  };
  main.querySelectorAll('.num').forEach((b) => b.addEventListener('click', () => pick(b)));
  keyHandler = (e) => { const v = parseInt(e.key, 10), bs = main.querySelectorAll('.num');
    if (v >= from && v - from < n) { pick(bs[v - from]); return true; } return false; };
}

// ---- flow
function welcome() {
  if ((!C.OPEN || !C.ENDPOINT) && !preview) { screen(`<div class="hero"><h1>${esc(T.title)}</h1><p>${esc(T.closed)}</p></div>`, { idx: 0 }); return; }
  const old = loadSaved();
  if (old && !sess.id) {
    if (UI[old.lang]) setLang(old.lang);
    const k = old.sess.rows.filter((r) => r.type === 'trial').length;
    screen(`<div class="celebrate"><span class="big pop" aria-hidden="true">👋</span><h1>${esc(T.resumeH)}</h1><p>${esc(T.resumeP(k))}</p></div>` +
      actions(T.resumeGo, { extra: `<button type="button" class="secondary" id="restart">${esc(T.restart)}</button>` }), { idx: 0 });
    $('go').addEventListener('click', () => resume(old));
    $('restart').addEventListener('click', () => { store.del(KEY); welcome(); });
    return;
  }
  if (store.get(DONE) && !sess.id) {
    screen(`<div class="celebrate"><span class="big pop" aria-hidden="true">🖼️</span><h1>${esc(T.endH)}</h1><p>${esc(T.doneBefore)}</p></div>`, { idx: TOTAL });
    return;
  }
  const pics = [S.leader[0], S.varied[2], S.leader[5], S.leader[3], S.varied[0]];
  screen(`<div class="hero"><div class="collage" aria-hidden="true">${pics.map((s) => imgTag(s, 'alt=""')).join('')}</div>
    <span class="eyebrow">Many Views · ${esc(T.studyWord)}</span>
    <h1>${esc(T.title)}</h1><p class="sub">${esc(T.sub || T.welcomeSub)}</p>
    <div class="chipsrow">${(T.pills || []).map((p, i) => `<span class="info-chip">${['⏱', '🔒', '🎨'][i] || ''} ${esc(p)}</span>`).join('')}</div></div>
    <div class="langcard"><p class="label">${esc(T.chooseLang)}</p>
    <div class="langs">${LANGS.map(([k, name]) => `<button type="button" class="pill${k === lang ? ' on' : ''}" data-l="${k}" lang="${k}"><span>${esc(name)}</span><span class="arr" aria-hidden="true">→</span></button>`).join('')}</div></div>`,
  { idx: 0 });
  main.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.l); consent(); }));
}
function consent() {
  screen(`<h1>${esc(T.infoH)}</h1><div class="card"><ul class="info">${T.info.map((x, i) => `<li><span aria-hidden="true">${['🏛', '🖼', '💬', '🚪', '🔒', '🔞'][i] || '•'}</span><span>${esc(x)}</span></li>`).join('')}</ul>
    ${C.CONTACT ? `<p class="muted contact">✉️ ${esc(T.contact)}<a href="mailto:${esc(C.CONTACT)}">${esc(C.CONTACT)}</a></p>` : ''}</div>
    <label class="toggle"><input type="checkbox" id="c-age"><span class="sw" aria-hidden="true"></span><span>${esc(T.age)}</span></label>
    <label class="toggle"><input type="checkbox" id="c-agree"><span class="sw" aria-hidden="true"></span><span>${esc(T.agree)}</span></label>` +
    actions(T.start, { disabled: true }), { idx: 1, back: welcome });
  main.onchange = () => { $('go').disabled = !($('c-age').checked && $('c-agree').checked); };
  $('go').addEventListener('click', async () => {
    $('go').disabled = true;
    if (!sess.id) {               // the participant number is taken once, even if people go back to this page
      const [p, by] = await nextNumber(); const pl = plan(p);
      Object.assign(sess, { id: `S${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, p, order: pl.order, rot: pl.rot, blocks: pl.blocks,
        started: new Date().toISOString(), assignedBy: by });
      sess.rows.push({ type: 'practice', item: 'condition', value: practiceCond() });
    }
    save({ kind: 'intro' });
    intro();
  });
}
function intro() {
  screen(`<h1>${esc(T.introH)}</h1><p class="lead">${esc(T.explain)}</p>
    <ol class="steps">${T.steps.map(([ic, h, t], i) => `<li class="step"><span class="ic" aria-hidden="true">${ic}</span><div><b><span class="n">${i + 1}</span> ${esc(h)}</b><p>${esc(t)}</p></div></li>`).join('')}</ol>
    <p class="center muted">${esc(T.introEnd)}</p>` + actions(T.startPractice), { idx: 2, back: consent });
  $('go').addEventListener('click', examples);
}
function examples() {
  screen(`<h1>${esc(T.exH)}</h1><p class="lead">${esc(T.exIntro)}</p>
    <div class="exlist">${[['sadness', 9, 11], ['disgust', 4, 11]].map(([f, c, n], i) => { const [a, b] = T.exCard(emo(lang, f), c, n, Math.round((10 * c) / n));
      return `<div class="card ex"><span class="key">${i + 1}</span><div><b>${esc(a)}</b><p>${esc(b)}</p></div></div>`; }).join('')}</div>
    <p class="muted center">🤖 ${esc(T.exNote)}</p>` + actions(T.exGo), { idx: 3, back: intro });
  $('go').addEventListener('click', () => trial({ practice: true, i: 0 }));
}
function trial(pos) {
  const practice = !!pos.practice, s = practice ? S.practice[pos.i] : sess.blocks[pos.b].items[pos.i], cond = practice ? practiceCond() : sess.blocks[pos.b].cond;
  const k = practice ? pos.i + 1 : pos.b * 6 + pos.i + 1, total = practice ? S.practice.length : 18;
  const base = practice ? 4 + pos.i * 4 : 13 + pos.b * 29 + pos.i * 4;
  const head = progress(k, total, practice) + (!practice && k === 10 ? `<p class="halfway pop">${esc(T.halfway)}</p>` : '');
  // 1. look at the painting and read the description (one screen)
  let readMs = 0, t0 = 0;
  const read = () => {
    redraw = () => trial(pos);
    const tRead = performance.now();
    screen(head + picture(s, true) + `<div class="card desc"><span class="tag">👥 ${esc(T.descH)}</span><p>${esc(describe(lang, s, cond))}</p></div>
      <div class="card desc model"><span class="tag">🤖 ${esc(T.aiH)}</span><p>${esc(describe(lang, s, 'model'))}</p></div>${meanings(s, cond)}` + actions(T.read),
    { focus: '.desc', idx: base, back: practice && pos.i > 0 ? () => trial({ practice: true, i: pos.i - 1 }) : practice ? examples : null });
    $('go').addEventListener('click', () => { readMs += Math.round(performance.now() - tRead); t0 = performance.now(); ask1(); });
  };
  // 2. questions, one per screen (the description is hidden now): Q1 how many of 10 new people would pick the top emotion,
  //    how sure, Q2 where a feeling came from
  let a1 = null, c1 = null, a2 = null;
  const r = rng(7 + sess.p * 100 + (practice ? pos.i : 10 + k));
  const asked = r() < 0.5 ? 'people' : 'ai', askedF = asked === 'people' ? s.order[0][0] : s.model[0];   // half the time each
  const q2opts = shuffle(['people', 'ai'], r);
  const ask1 = () => scaleQ({ idx: base + 1, head, q: T.estQ(emo(lang, s.order[0][0])), n: 11, from: 0, chosen: a1, lo: T.estLo, hi: T.estHi,
    onBack: read, onPick: (v) => { a1 = v; conf(); } });
  const conf = () => scaleQ({ idx: base + 2, head, q: T.confQ, n: 7, chosen: c1, lo: T.confLo, hi: T.confHi, onBack: ask1, onPick: (v) => { c1 = v; ask2(); } });
  const ask2 = () => choice({ idx: base + 3, head, q: T.q2f(emo(lang, askedF)), chosen: a2, options: q2opts.map((v) => [v, T.q2o[v]]).concat([['dontknow', T.dontknow]]),
    onBack: conf, onPick: (v) => { a2 = v; done(); } });
  const done = () => {
    if (practice) { feedback(s, a1, a2, asked, askedF, base + 3, () => { a1 = c1 = a2 = null; read(); }, () => (pos.i + 1 < S.practice.length ? trial({ practice: true, i: pos.i + 1 }) : ready()), ask2); return; }
    sess.rows.push({ type: 'trial', block: pos.b + 1, position: k, condition: cond, painting: s.id, category: s.rule,
      q1_answer: a1, q1_correct: close(a1, s) ? 1 : 0, q2_answer: a2, q2_correct: a2 === asked ? 1 : 0,
      viewer_top: s.order[0][0], model_top: s.model[0], read_ms: readMs, answer_ms: Math.round(performance.now() - t0),
      item: `${asked}:${askedF}`, value: c1 });           // item = the feeling asked about in Q2 and its true source; value = confidence in Q1 (1-7)
    const next = pos.i + 1 < 6 ? { kind: 'trial', b: pos.b, i: pos.i + 1 } : { kind: 'rate', b: pos.b };
    save(next); send();
    if (next.kind === 'trial') trial({ b: next.b, i: next.i }); else rate(pos.b);
  };
  read();
}
// practice only: show the right answers, and let people read the description again and retry
function feedback(s, a1, a2, asked, askedF, idx, retry, next, back) {
  const ok1 = close(a1, s), ok2 = a2 === asked, ok = ok1 && ok2;
  screen(`<div class="fbhead ${ok ? 'ok' : 'no'}"><span class="big pop" aria-hidden="true">${ok ? '🎉' : '🤔'}</span><h1>${esc(ok ? T.good : T.hmm)}</h1></div>
    <div class="card fb ${ok1 ? 'ok' : 'no'}"><span class="mark" aria-hidden="true">${ok1 ? '✓' : '✗'}</span><p>${esc(T.fbEst(emo(lang, s.order[0][0]), s.order[0][1], s.n, Math.round(truth10(s))))}</p></div>
    <div class="card fb ${ok2 ? 'ok' : 'no'}"><span class="mark" aria-hidden="true">${ok2 ? '✓' : '✗'}</span><p>${esc(asked === 'people' ? T.fbQ2p(emo(lang, askedF)) : T.fbQ2a(emo(lang, askedF)))}</p></div>` +
    actions(T.cont, { extra: ok ? '' : `<button type="button" class="secondary" id="again">↺ ${esc(T.tryAgain)}</button>` }), { idx, back });
  if (!ok) $('again').addEventListener('click', retry);
  $('go').addEventListener('click', next);
}
function ready() {
  save({ kind: 'ready' });
  screen(`<div class="celebrate"><span class="big pop" aria-hidden="true">🎨</span><h1>${esc(T.readyH)}</h1><p>${esc(T.ready)}</p>
    <div class="parts">${[0, 1, 2].map(() => '<span></span>').join('')}</div></div>` + actions(T.begin), { idx: 12, back: () => trial({ practice: true, i: S.practice.length - 1 }) });
  $('go').addEventListener('click', () => trial({ b: 0, i: 0 }));
}
function rate(b) {
  const base = 13 + b * 29 + 24, cond = sess.blocks[b].cond;
  let v1 = null, v2 = null, v4 = null;
  const head = `<p class="kicker">${esc(T.rateIntro)}</p>`;
  const cheer = () => {
    screen(`<div class="celebrate"><span class="big pop" aria-hidden="true">${['🌱', '🌿', '🌳'][b]}</span><h1>${esc(T.blockDone(b + 1))}</h1>
      <div class="parts">${[0, 1, 2].map((i) => `<span class="${i <= b ? 'on' : ''}"></span>`).join('')}</div>${T.cheer ? `<p>${esc(T.cheer[b])}</p>` : ''}<p class="timeleft">⏱ ${esc(T.timeLeft((2 - b) * 6 + 1))}</p></div>` +
      actions(T.cont), { idx: base });
    $('go').addEventListener('click', q1);
  };
  const q1 = () => scaleQ({ idx: base + 1, head, q: T.r1, n: 7, chosen: v1, onBack: cheer, onPick: (v) => { v1 = v; q2(); } });
  let v3 = null;
  const done = () => {
    sess.rows.push({ type: 'rating', block: b + 1, condition: cond, item: 'room_for_own_response', value: v1 },
      { type: 'rating', block: b + 1, condition: cond, item: 'hard_to_understand', value: v2 },
      { type: 'rating', block: b + 1, condition: cond, item: 'trust', value: v4 });
    if (b < 2) sess.rows.push({ type: 'check', block: b + 1, item: 'attention_pass', value: v3 === (b === 0 ? 2 : 5) ? 1 : 0 });
    if (b < 2) { save({ kind: 'trial', b: b + 1, i: 0 }); send(); trial({ b: b + 1, i: 0 }); }
    else { save({ kind: 'numeracy' }); send(); numeracy(); }
  };
  const q2 = () => scaleQ({ idx: base + 2, head, q: T.r2, n: 7, chosen: v2, onBack: q1, onPick: (v) => { v2 = v; q4(); } });
  const q4 = () => scaleQ({ idx: base + 3, head, q: T.r3, n: 7, chosen: v4, onBack: q2, onPick: (v) => { v4 = v; if (b < 2) q3(); else done(); } });
  // attention check: a third question after parts 1 and 2 ("please choose 2", then "please choose 5")
  const q3 = () => scaleQ({ idx: base + 4, head, q: b === 0 ? T.attention : T.attention2, n: 7, chosen: v3, onBack: q4, onPick: (v) => { v3 = v; done(); } });
  cheer();
}
// three short number questions (Schwartz, Woloshin, Black & Welch 1997), because description B relies on reading numbers
function numeracy() {
  const items = [['n1', 500], ['n2', 10], ['n3', 0.1]];   // texts: T.numQ[0..2]
  const ask = (i) => {
    const [id, right] = items[i];
    screen(`<p class="kicker">${esc(T.numH)}</p>${i === 0 ? `<p class="muted">${esc(T.numIntro)}</p>` : ''}<h2 class="q">${esc(T.numQ[i])}</h2>
      <input id="num" class="numin" type="text" inputmode="decimal" autocomplete="off" placeholder="${esc(T.numPh)}">` + actions(T.cont, { disabled: true }),
    { idx: 100 + i, focus: '.q', back: i > 0 ? () => { const j = sess.rows.map((r) => r.type).lastIndexOf('numeracy'); if (j >= 0) sess.rows.splice(j, 1); ask(i - 1); } : null });
    const box = $('num');
    box.addEventListener('input', () => { $('go').disabled = !box.value.trim(); });
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && box.value.trim()) $('go').click(); });
    $('go').addEventListener('click', () => {
      const raw = box.value.trim().slice(0, 30), v = Number(raw.replace(/[%\s]/g, '').replace(',', '.'));
      sess.rows.push({ type: 'numeracy', item: id, q1_answer: raw, value: Math.abs(v - right) < 1e-9 ? 1 : 0 });
      if (i + 1 < items.length) ask(i + 1); else { save({ kind: 'pref' }); prefs(); }
    });
  };
  ask(0);
}
function prefs(prev = {}) {
  const s = S.varied[0], r = rng(99 + sess.p), opts = shuffle(['A', 'B', 'C'], r);
  let p1 = prev.p1 || null, p2 = prev.p2 || null;
  const head = `<h1>${esc(T.prefH)}</h1><p class="kicker">${esc(T.prefIntro)}</p>`;
  const opt = () => opts.map((c) => [c, describe(lang, s, c)]);
  const q1 = () => choice({ idx: 103, head, q: T.prefQ1, chosen: p1, options: opt(), onPick: (v) => { p1 = v; q2(); } });
  const q2 = () => choice({ idx: 104, head, q: T.prefQ2, chosen: p2, options: opt(), onBack: q1, onPick: (v) => {
    p2 = v;
    sess.rows.push({ type: 'pref', painting: s.id, item: 'museum', value: p1, position: opts.indexOf(p1) + 1 },
      { type: 'pref', painting: s.id, item: 'trust', value: p2, position: opts.indexOf(p2) + 1 });
    save({ kind: 'comment' }); comment({ p1, p2 });
  } });
  if (prev.p2) q2(); else q1();
}
// optional comment at the very end (helps to find unclear parts); kept to 500 characters
function comment(prev = {}) {
  const old = sess.rows.filter((r) => r.type === 'pref');
  const back = () => {   // undo the two preference answers (not sent yet) and show the last question again
    for (let i = sess.rows.length - 1; i >= 0; i--) if (sess.rows[i].type === 'pref') sess.rows.splice(i, 1);
    save({ kind: 'pref' });
    prefs({ p1: prev.p1 || (old[0] && old[0].value), p2: prev.p2 || (old[1] && old[1].value) });
  };
  screen(`<h2 class="q">${esc(T.commentQ)}</h2><textarea id="cmt" class="cmt" rows="4" maxlength="500" placeholder="${esc(T.commentPh)}"></textarea>` + actions(T.finish), { idx: 105, focus: '.q', back });
  $('go').addEventListener('click', () => {
    const v = $('cmt').value.trim().slice(0, 500);
    if (v) sess.rows.push({ type: 'comment', item: 'confusing', value: v });
    sess.finished = new Date().toISOString(); save({ kind: 'end' }); finish();
  });
}
// the participant's own results (shown only after all answers are saved, so they cannot change any answer)
function results() {   // per kind of description, no single total; the reason the first row is low sits right under it
  const tr = sess.rows.filter((r) => r.type === 'trial');
  if (!tr.length) return '';
  const by = {};
  ['A', 'B', 'C'].forEach((c) => { const x = tr.filter((r) => r.condition === c); by[c] = [x.filter((r) => r.q1_correct).length, x.length]; });   // q1_correct = estimate within 1 of the true value
  return `<div class="card results"><h2>${esc(T.resH)}</h2>
    ${['A', 'B', 'C'].map((c) => `<div class="rbar"><span class="rname">${esc(T.rowNames[c])}</span><span class="rtrack"><i style="width:${by[c][1] ? (100 * by[c][0]) / by[c][1] : 0}%"></i></span><span class="rnum">${esc(T.resOf(by[c][0], by[c][1]))}</span></div>`).join('')}
    <p class="resnote">${esc(T.resNote)}</p></div>
    <div class="card"><h2>${esc(T.debriefH)}</h2><p>${esc(T.debrief)}</p></div>`;
}
async function finish() {
  screen(`<div class="celebrate"><span class="big spin" aria-hidden="true">⏳</span><p>${esc(T.sending)}</p></div>`, { idx: 106 });
  const ok = await send();
  if (!ok) {
    screen(`<div class="card"><p>${esc(T.failed)}</p></div>` + actions(T.retry), { idx: 106 });
    $('go').addEventListener('click', finish); return;
  }
  store.del(KEY); store.set(DONE, '1');
  const shareUrl = location.origin + location.pathname;
  screen(`<div class="confetti" aria-hidden="true">${Array.from({ length: 60 }, (_, i) => `<i style="--x:${(Math.random() * 100).toFixed(1)};--d:${(Math.random() * 1.2).toFixed(2)}s;--t:${(2.2 + Math.random() * 1.6).toFixed(2)}s;--r:${Math.round(Math.random() * 360)}deg;--c:${i % 4}"></i>`).join('')}</div>
    <div class="celebrate"><span class="big pop" aria-hidden="true">🖼️</span><h1>${esc(T.endH)}</h1><p>${esc(T.end)}</p></div>${results()}
    ${C.COMPLETION_CODE ? `<div class="card center"><p>${esc(T.code)}</p><p class="code">${esc(C.COMPLETION_CODE)}</p></div>` : ''}
    ${T.share ? `<button type="button" class="secondary wide" id="share">🔗 ${esc(T.share)}</button>` : ''}`, { idx: TOTAL });
  const sh = $('share');
  if (sh) sh.addEventListener('click', async () => {
    try { if (navigator.share) { await navigator.share({ title: T.title, text: T.shareText, url: shareUrl }); return; }
      await navigator.clipboard.writeText(`${T.shareText} ${shareUrl}`); sh.textContent = `✓ ${T.copied}`; } catch (e) { /* cancelled */ }
  });
}

// ---- start
const sel = $('lang');
sel.innerHTML = LANGS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
// the language can be changed on any page: the current screen is drawn again in the new language
// (inside a painting, the painting starts again from its description; answers already given are kept)
let redraw = null;
const track = (fn) => function (...args) { redraw = () => fn(...args); return fn(...args); };
welcome = track(welcome); consent = track(consent); intro = track(intro); examples = track(examples); trial = track(trial);
feedback = track(feedback); ready = track(ready); rate = track(rate); prefs = track(prefs); numeracy = track(numeracy); comment = track(comment); finish = track(finish);
sel.addEventListener('change', () => {
  const before = lang;
  setLang(sel.value);
  if (sess.id && before !== lang) { sess.rows.push({ type: 'lang', item: before, value: lang }); save(sess.next); }
  (redraw || welcome)();
});
let saved = 'en'; try { saved = localStorage.getItem('mv-study-lang') || 'en'; } catch (e) { /* ignore */ }
const fromUrl = (location.search.match(/[?&]lang=([\w-]+)/) || [])[1];
setLang(UI[fromUrl] ? fromUrl : UI[saved] ? saved : 'en');
welcome();
