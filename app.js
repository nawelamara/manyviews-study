/* Many Views – online description study (A single emotion / B fixed top 3 / C agreement-adaptive).
   Friendly design: one question per screen, big tap targets (keys 1-4 work too), practice with "read it again".
   Anonymous: no name, e-mail or IP is collected by this page. Answers go to the researchers' Google Sheet
   (CONFIG.ENDPOINT) after each part and at the end. Own emotion picks are NOT saved.
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
const sets = [0, 1, 2].map((s) => ['leader', 'varied', 'few'].flatMap((cat) => S[cat].slice(2 * s, 2 * s + 2)));
function plan(p) {
  const order = ORDERS[(p - 1) % 6], rot = Math.floor((p - 1) / 6) % 3, r = rng(1000 + p);
  return { order, rot, blocks: order.split('').map((cond) => ({ cond, items: shuffle(sets[('ABC'.indexOf(cond) + rot) % 3], r) })) };
}

// ---- sending (Google Apps Script web app); no-cors, so the whole session is resent each time and the sheet keeps one copy
const sess = { rows: [] };
async function send() {
  if (!C.ENDPOINT) return true;
  try {
    await fetch(C.ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ session: { id: sess.id, participant: sess.p, order: sess.order, rotation: sess.rot, lang, started_at: sess.started,
        finished_at: sess.finished || '', assigned_by: sess.assignedBy + (preview ? '-preview' : '') }, rows: sess.rows }) });
    return true;
  } catch (e) { return false; }
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

// ---- screen helpers
let keyHandler = null;
function screen(html, focusSel) {
  main.classList.remove('in'); main.innerHTML = html; void main.offsetWidth; main.classList.add('in');
  window.scrollTo(0, 0); keyHandler = null;
  const f = main.querySelector(focusSel || 'h1, .q, .progress'); if (f) { f.tabIndex = -1; f.focus({ preventScroll: true }); }
}
document.addEventListener('keydown', (e) => { if (keyHandler && !e.altKey && !e.ctrlKey && !e.metaKey) keyHandler(e); });
function setLang(l) {
  lang = l; T = UI[l];
  document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'; document.title = T.title;
  $('lang').value = l;
  try { localStorage.setItem('mv-study-lang', l); } catch (e) { /* ignore */ }
}
const glossary = () => `<details class="gloss"><summary>${esc(T.gH)}</summary><ul>${Object.entries(T.g).map(([f, d]) => `<li><b>${esc(emo(lang, f))}</b>: ${esc(d)}</li>`).join('')}</ul></details>`;
const progress = (k, total, practice) => `<div class="progress" aria-live="polite"><span>${esc(practice ? T.practice(k, total) : T.painting(k, total))}</span>
  <span class="bar"><span style="width:${(100 * k / total).toFixed(0)}%"></span></span></div>`;
const picture = (s, small) => `<figure class="frame${small ? ' small' : ''}"><img src="images/${s.id}.jpg" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${s.id}.jpg'}" alt="${esc(s.title)}, ${esc(s.artist)}"></figure>
  ${small ? '' : `<p class="caption" lang="en">${esc(s.title)} · ${esc(s.artist)}${s.year ? ' · ' + esc(s.year) : ''}</p>`}`;

// a question with big option tiles; picking one moves on after a short moment (keys 1-n pick, Backspace = back)
function choice({ head, q, options, onPick, onBack, chosen }) {
  screen(head + `<h2 class="q">${esc(q)}</h2><div class="tiles" role="radiogroup">` +
    options.map(([v, label], i) => `<button type="button" class="tile" role="radio" aria-checked="${v === chosen}" data-v="${esc(v)}">
      <span class="key">${i + 1}</span><span>${esc(label)}</span></button>`).join('') + '</div>' +
    (onBack ? `<button type="button" class="ghost" id="back">← ${esc(T.back)}</button>` : ''), '.q');
  let done = false;
  const pick = (b) => {
    if (done) return; done = true;
    main.querySelectorAll('.tile').forEach((t) => t.setAttribute('aria-checked', String(t === b)));
    setTimeout(() => onPick(b.dataset.v), 320);
  };
  main.querySelectorAll('.tile').forEach((b) => b.addEventListener('click', () => pick(b)));
  if (onBack) $('back').addEventListener('click', onBack);
  keyHandler = (e) => { const n = parseInt(e.key, 10); const tiles = main.querySelectorAll('.tile');
    if (n >= 1 && n <= tiles.length) pick(tiles[n - 1]); else if (e.key === 'Backspace' && onBack) onBack(); };
}
// a 1..n scale as a row of round buttons
function scaleHtml(name, legend, n) {
  return `<fieldset class="scale"><legend>${esc(legend)}</legend><div class="dots">` +
    Array.from({ length: n }, (_, k) => `<label><input type="radio" name="${name}" value="${k + 1}"><span>${k + 1}</span></label>`).join('') +
    `</div><div class="ends"><span>${esc(T.dis)}</span><span>${esc(T.agr)}</span></div></fieldset>`;
}
const val = (name) => { const x = main.querySelector(`input[name="${name}"]:checked`); return x ? x.value : null; };

// ---- flow
function welcome() {
  if ((!C.OPEN || !C.ENDPOINT) && !preview) { screen(`<div class="hero"><h1>${esc(T.title)}</h1><p>${esc(T.closed)}</p></div>`); return; }
  const pics = [S.leader[0], S.varied[2], S.few[3], S.leader[3]];
  screen(`<div class="hero"><div class="collage">${pics.map((s) => `<img src="images/${s.id}.jpg" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${s.id}.jpg'}" alt="">`).join('')}</div>
    <h1>${esc(T.title)}</h1><p>${esc(T.welcomeSub)}</p></div>
    <p class="center muted">${esc(T.chooseLang)}</p>
    <div class="langs">${LANGS.map(([k, name]) => `<button type="button" class="pill" data-l="${k}" lang="${k}">${esc(name)}</button>`).join('')}</div>`);
  main.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.l); consent(); }));
}
function consent() {
  screen(`<h1>${esc(T.infoH)}</h1><div class="card"><ul class="info">${T.info.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    ${C.CONTACT ? `<p class="muted">${esc(T.contact)}${esc(C.CONTACT)}</p>` : ''}</div>
    <label class="toggle"><input type="checkbox" id="c-age"><span>${esc(T.age)}</span></label>
    <label class="toggle"><input type="checkbox" id="c-agree"><span>${esc(T.agree)}</span></label>
    <button class="primary" id="go" disabled>${esc(T.start)}</button>`);
  main.onchange = () => { $('go').disabled = !($('c-age').checked && $('c-agree').checked); };
  $('go').addEventListener('click', async () => {
    $('go').disabled = true;
    const [p, by] = await nextNumber(); const pl = plan(p);
    Object.assign(sess, { id: `S${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, p, order: pl.order, rot: pl.rot, blocks: pl.blocks,
      started: new Date().toISOString(), assignedBy: by });
    intro();
  });
}
function intro() {
  screen(`<h1>${esc(T.introH)}</h1><p class="lead">${esc(T.explain)}</p>
    <div class="steps">${T.steps.map(([ic, h, t]) => `<div class="step"><span class="ic" aria-hidden="true">${ic}</span><div><b>${esc(h)}</b><p>${esc(t)}</p></div></div>`).join('')}</div>
    <p class="center muted">${esc(T.introEnd)}</p><button class="primary" id="go">${esc(T.startPractice)}</button>`);
  $('go').addEventListener('click', () => trial({ practice: true, i: 0 }));
}
function trial(pos) {
  const practice = !!pos.practice, s = practice ? S.practice[pos.i] : sess.blocks[pos.b].items[pos.i], cond = practice ? 'B' : sess.blocks[pos.b].cond;
  const k = practice ? pos.i + 1 : pos.b * 6 + pos.i + 1, total = practice ? S.practice.length : 18;
  const head = progress(k, total, practice);
  // 1. look (optional feelings, not saved)
  const look = () => {
    screen(head + picture(s) + `<p class="prompt">${esc(T.feel)}</p><div class="chips">${FEELINGS.map((f) => emo(lang, f)).sort((a, b) => a.localeCompare(b, lang)).concat([emo(lang, 'none')])
      .map((e) => `<button type="button" class="chip" aria-pressed="false">${esc(e)}</button>`).join('')}</div>${glossary()}
      <button class="primary" id="go">${esc(T.cont)}</button>`);
    main.querySelector('.chips').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
    $('go').addEventListener('click', read);
  };
  // 2. read
  let readMs = 0, t0 = 0;
  const read = () => {
    const tRead = performance.now();
    screen(head + picture(s, true) + `<div class="card desc"><span class="tag">📝 ${esc(T.descH)}</span><p>${esc(describe(lang, s, cond))}</p></div>
      <div class="card desc model"><span class="tag">🤖 AI</span><p>${esc(describe(lang, s, 'model'))}</p></div>${glossary()}
      <button class="primary" id="go">${esc(T.read)}</button>`, '.desc');
    $('go').addEventListener('click', () => { readMs += Math.round(performance.now() - tRead); t0 = performance.now(); ask1(); });
  };
  // 3. two questions, one per screen (the description is hidden now)
  let a1 = null, a2 = null;
  const r = rng(7 + sess.p * 100 + (practice ? pos.i : 10 + k));
  const q2opts = shuffle([s.order[0][0], s.model[0]], r);
  const ask1 = () => choice({ head, q: T.q1, chosen: a1, options: ['leader', 'varied', 'few', 'dontknow'].map((v) => [v, T.q1o[v]]),
    onPick: (v) => { a1 = v; ask2(); } });
  const ask2 = () => choice({ head, q: T.q2, chosen: a2, options: q2opts.map((f) => [f, emo(lang, f)]).concat([['dontknow', T.dontknow]]),
    onBack: ask1, onPick: (v) => { a2 = v; done(); } });
  const done = () => {
    if (practice) { feedback(s, a1, a2, () => { a1 = a2 = null; read(); }, () => (pos.i + 1 < S.practice.length ? trial({ practice: true, i: pos.i + 1 }) : ready())); return; }
    sess.rows.push({ type: 'trial', block: pos.b + 1, position: k, condition: cond, painting: s.id, category: s.rule,
      q1_answer: a1, q1_correct: a1 === s.rule ? 1 : 0, q2_answer: a2, q2_correct: a2 === s.order[0][0] ? 1 : 0,
      viewer_top: s.order[0][0], model_top: s.model[0], read_ms: readMs, answer_ms: Math.round(performance.now() - t0) });
    if (pos.i + 1 < 6) trial({ b: pos.b, i: pos.i + 1 }); else rate(pos.b);
  };
  look();
}
// practice only: show the right answers, and let people read the description again and retry
function feedback(s, a1, a2, retry, next) {
  const ok1 = a1 === s.rule, ok2 = a2 === s.order[0][0], ok = ok1 && ok2;
  screen(`<div class="fbhead ${ok ? 'ok' : 'no'}"><span class="big" aria-hidden="true">${ok ? '🎉' : '🤔'}</span><h1>${esc(ok ? T.good : T.hmm)}</h1></div>
    <div class="card fb ${ok1 ? 'ok' : 'no'}"><p>${ok1 ? '✓' : '✗'} ${esc(T.fbQ1t(T.q1o[s.rule], T.fbQ1[s.rule]))}</p></div>
    <div class="card fb ${ok2 ? 'ok' : 'no'}"><p>${ok2 ? '✓' : '✗'} ${esc(T.fbQ2t(emo(lang, s.order[0][0]), emo(lang, s.model[0])))}</p></div>
    <div class="row">${ok ? '' : `<button type="button" class="secondary" id="again">↺ ${esc(T.tryAgain)}</button>`}<button class="primary" id="go">${esc(T.cont)}</button></div>`);
  if (!ok) $('again').addEventListener('click', retry);
  $('go').addEventListener('click', next);
}
function ready() {
  screen(`<div class="celebrate"><span class="big" aria-hidden="true">🎨</span><h1>${esc(T.readyH)}</h1><p>${esc(T.ready)}</p></div><button class="primary" id="go">${esc(T.begin)}</button>`);
  $('go').addEventListener('click', () => trial({ b: 0, i: 0 }));
}
function rate(b) {
  screen(`<div class="celebrate"><span class="big" aria-hidden="true">${['🌱', '🌿', '🌳'][b]}</span><h1>${esc(T.blockDone(b + 1))}</h1>
    <div class="parts">${[0, 1, 2].map((i) => `<span class="${i <= b ? 'on' : ''}"></span>`).join('')}</div></div>
    <p class="muted center">${esc(T.rateIntro)}</p>${scaleHtml('r1', T.r1, 7)}${scaleHtml('r2', T.r2, 7)}<button class="primary" id="go" disabled>${esc(T.cont)}</button>`);
  main.onchange = () => { $('go').disabled = !(val('r1') && val('r2')); };
  $('go').addEventListener('click', () => {
    const cond = sess.blocks[b].cond;
    sess.rows.push({ type: 'rating', block: b + 1, condition: cond, item: 'room_for_own_response', value: +val('r1') },
      { type: 'rating', block: b + 1, condition: cond, item: 'hard_to_understand', value: +val('r2') });
    send();
    if (b < 2) trial({ b: b + 1, i: 0 }); else sus();
  });
}
function sus() {
  const items = T.sus.slice(0, 5).concat([T.attention], T.sus.slice(5));      // attention check after item 5
  screen(`<h1>${esc(T.susH)}</h1><p class="muted">${esc(T.susIntro)}</p>` + items.map((t, k) => scaleHtml(`s${k}`, t, 5)).join('') +
    `<button class="primary" id="go" disabled>${esc(T.finish)}</button>`);
  main.onchange = () => { $('go').disabled = items.some((_, k) => !val(`s${k}`)); };
  $('go').addEventListener('click', () => {
    const v = items.map((_, k) => +val(`s${k}`)), att = v[5], sv = v.slice(0, 5).concat(v.slice(6));
    sv.forEach((x, k) => sess.rows.push({ type: 'sus', item: `sus${k + 1}`, value: x }));
    sess.rows.push({ type: 'sus', item: 'sus_score', value: 2.5 * sv.reduce((s, x, k) => s + (k % 2 === 0 ? x - 1 : 5 - x), 0) });
    sess.rows.push({ type: 'check', item: 'attention_pass', value: att === 2 ? 1 : 0 });
    sess.finished = new Date().toISOString();
    finish();
  });
}
async function finish() {
  screen(`<div class="celebrate"><span class="big spin" aria-hidden="true">⏳</span><p>${esc(T.sending)}</p></div>`);
  const ok = await send();
  if (!ok) {
    screen(`<div class="card"><p>${esc(T.failed)}</p></div><button class="primary" id="go">${esc(T.retry)}</button>`);
    $('go').addEventListener('click', finish); return;
  }
  screen(`<div class="confetti" aria-hidden="true">${Array.from({ length: 36 }, (_, i) => `<i style="--x:${(i * 37) % 100};--d:${(i % 7) * 0.15}s;--c:${i % 4}"></i>`).join('')}</div>
    <div class="celebrate"><span class="big" aria-hidden="true">🖼️</span><h1>${esc(T.endH)}</h1><p>${esc(T.end)}</p></div>
    ${C.COMPLETION_CODE ? `<div class="card center"><p>${esc(T.code)}</p><p class="code">${esc(C.COMPLETION_CODE)}</p></div>` : ''}`);
}

// ---- start
const sel = $('lang');
sel.innerHTML = LANGS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
sel.addEventListener('change', () => { if (!sess.id) { setLang(sel.value); welcome(); } else sel.value = lang; });
let saved = 'en'; try { saved = localStorage.getItem('mv-study-lang') || 'en'; } catch (e) { /* ignore */ }
const fromUrl = (location.search.match(/[?&]lang=([\w-]+)/) || [])[1];
setLang(UI[fromUrl] ? fromUrl : UI[saved] ? saved : 'en');
welcome();
