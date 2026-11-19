/* Many Views – online description study (A single emotion / B fixed top 3 / C agreement-adaptive).
   Anonymous: no name, e-mail or IP is collected by this page. Answers are sent to the researchers' Google Sheet
   (CONFIG.ENDPOINT) after each part and at the end. Own emotion picks are NOT saved.
   Balanced assignment: the sheet gives the next participant number (6 orders x 3 painting rotations = 18 combinations);
   if it cannot be reached, a random number is used. Closed while CONFIG.OPEN is false (preview: add ?preview=1). */
'use strict';
const C = window.CONFIG, S = window.STIMULI;
const main = document.getElementById('main');
const ORDERS = ['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA'];
const FEELINGS = ['happiness', 'surprise', 'anticipation', 'trust', 'humility', 'optimism', 'fear', 'sadness', 'love', 'disgust',
  'gratitude', 'pessimism', 'arrogance', 'disagreeableness', 'anger', 'agreeableness', 'regret', 'shame', 'shyness'];
const preview = /[?&]preview=1/.test(location.search);
let lang = 'en', T = UI.en;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(xs, r) { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const sets = [0, 1, 2].map((s) => ['leader', 'varied', 'few'].flatMap((cat) => S[cat].slice(2 * s, 2 * s + 2)));
function plan(p) {
  const order = ORDERS[(p - 1) % 6], rot = Math.floor((p - 1) / 6) % 3, r = rng(1000 + p);
  return { order, rot, blocks: order.split('').map((cond) => ({ cond, items: shuffle(sets[('ABC'.indexOf(cond) + rot) % 3], r) })) };
}

// ---- sending (Google Apps Script web app). no-cors: the reply cannot be read, so the full session is resent each time
// and the analysis keeps one copy of each row.
const sess = { rows: [] };
async function send() {
  if (!C.ENDPOINT) return true;
  try {
    await fetch(C.ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ session: { id: sess.id, participant: sess.p, order: sess.order, rotation: sess.rot, lang, started_at: sess.started,
        finished_at: sess.finished || '', assigned_by: sess.assignedBy }, rows: sess.rows }) });
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

// ---- helpers for screens
function screen(html, focusSel) { main.innerHTML = html; window.scrollTo(0, 0); const f = main.querySelector(focusSel || 'h1, .progress'); if (f) { f.tabIndex = -1; f.focus(); } }
function setLang(l) {
  lang = l; T = UI[l];
  document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'; document.title = T.title;
  document.getElementById('lang').value = l;
  try { localStorage.setItem('mv-study-lang', l); } catch (e) { /* ignore */ }
}
function scaleHtml(name, legend, n) {
  return `<fieldset class="scale"><legend>${esc(legend)}</legend><div class="row">` +
    Array.from({ length: n }, (_, k) => `<label><input type="radio" name="${name}" value="${k + 1}">${k + 1}</label>`).join('') +
    `</div><div class="ends"><span>1 = ${esc(T.dis)}</span><span>${n} = ${esc(T.agr)}</span></div></fieldset>`;
}
const glossary = () => `<details class="gloss"><summary>${esc(T.gH)}</summary><ul>${Object.entries(T.g).map(([f, d]) => `<li><b>${esc(emo(lang, f))}</b>: ${esc(d)}</li>`).join('')}</ul></details>`;
const val = (name) => { const x = main.querySelector(`input[name="${name}"]:checked`); return x ? x.value : null; };

// ---- flow
function welcome() {
  if ((!C.OPEN || !C.ENDPOINT) && !preview) { screen(`<div class="hero"><h1>${esc(T.title)}</h1><p>${esc(T.closed)}</p></div>`); return; }
  screen(`<div class="hero"><h1>${esc(T.title)}</h1><p>${esc(T.chooseLang)}</p></div>
    <div class="langs">${LANGS.map(([k, name]) => `<button type="button" data-l="${k}" lang="${k}">${esc(name)}</button>`).join('')}</div>`);
  main.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.l); consent(); }));
}
function consent() {
  screen(`<h1>${esc(T.infoH)}</h1><div class="card"><ul class="info">${T.info.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    ${C.CONTACT ? `<p class="muted">${esc(T.contact)}${esc(C.CONTACT)}</p>` : ''}</div>
    <div class="card"><label class="check"><input type="checkbox" id="c-age"> ${esc(T.age)}</label>
    <label class="check"><input type="checkbox" id="c-agree"> ${esc(T.agree)}</label></div>
    <button class="primary" id="go" disabled>${esc(T.start)}</button>`);
  const upd = () => { document.getElementById('go').disabled = !(document.getElementById('c-age').checked && document.getElementById('c-agree').checked); };
  main.onchange = (upd);
  document.getElementById('go').addEventListener('click', async () => {
    document.getElementById('go').disabled = true;
    const [p, by] = await nextNumber(); const pl = plan(p);
    Object.assign(sess, { id: `S${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, p, order: pl.order, rot: pl.rot, blocks: pl.blocks,
      started: new Date().toISOString(), assignedBy: by, preview });
    intro();
  });
}
function intro() {
  screen(`<h1>${esc(T.introH)}</h1><div class="card"><p>${esc(T.explain)}</p></div><div class="card"><ol>${T.intro.map((x) => `<li>${esc(x)}</li>`).join('')}</ol><p>${esc(T.introEnd)}</p></div>
    <button class="primary" id="go">${esc(T.startPractice)}</button>`);
  document.getElementById('go').addEventListener('click', () => trial({ practice: true, i: 0 }));
}
function trial(pos) {
  const practice = pos.practice, s = practice ? S.practice[pos.i] : sess.blocks[pos.b].items[pos.i], cond = practice ? 'B' : sess.blocks[pos.b].cond;
  const k = practice ? pos.i + 1 : pos.b * 6 + pos.i + 1, total = practice ? S.practice.length : 18;
  const prog = `<p class="progress"><span>${esc(practice ? T.practice(k, total) : T.painting(k, total))}</span><span class="bar"><span style="width:${(100 * k / total).toFixed(0)}%"></span></span></p>`;
  const head = prog + `<figure class="frame"><img src="images/${s.id}.jpg" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${s.id}.jpg'}" alt="${esc(s.title)}, ${esc(s.artist)}"></figure>
    <p class="caption" lang="en">${esc(s.title)} · ${esc(s.artist)}${s.year ? ' · ' + esc(s.year) : ''}</p>`;
  // step 1: look (optional emotion buttons, not saved)
  screen(head + `<p>${esc(T.feel)}</p><div class="chips">${[...FEELINGS].map((f) => emo(lang, f)).sort((a, b) => a.localeCompare(b, lang)).concat([emo(lang, 'none')])
    .map((e) => `<button type="button" class="chip" aria-pressed="false">${esc(e)}</button>`).join('')}</div>
    ${glossary()}<button class="primary" id="go">${esc(T.cont)}</button>`);
  main.querySelector('.chips').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
  document.getElementById('go').addEventListener('click', () => {
    // step 2: read
    const tRead = performance.now();
    screen(head + `<div class="card desc"><h2>${esc(T.descH)}</h2><p>${esc(describe(lang, s, cond))}</p></div>
      <div class="card desc model"><p>${esc(describe(lang, s, 'model'))}</p></div>${glossary()}<button class="primary" id="go">${esc(T.read)}</button>`, '.desc');
    document.getElementById('go').addEventListener('click', () => {
      // step 3: answer with the text hidden
      const readMs = Math.round(performance.now() - tRead), t0 = performance.now();
      const r = rng(7 + sess.p * 100 + (practice ? pos.i : 10 + k));
      const q2opts = shuffle([s.order[0][0], s.model[0]], r);
      screen(prog + `<fieldset><legend>${esc(T.q1)}</legend>${['leader', 'varied', 'few', 'dontknow'].map((v) => `<label><input type="radio" name="q1" value="${v}"> ${esc(T.q1o[v])}</label>`).join('')}</fieldset>
        <fieldset><legend>${esc(T.q2)}</legend>${q2opts.map((f) => `<label><input type="radio" name="q2" value="${f}"> ${esc(emo(lang, f))}</label>`).join('')}
        <label><input type="radio" name="q2" value="dontknow"> ${esc(T.dontknow)}</label></fieldset>
        <button class="primary" id="go" disabled>${esc(T.next)}</button>`, 'legend');
      main.onchange = (() => { document.getElementById('go').disabled = !(val('q1') && val('q2')); });
      document.getElementById('go').addEventListener('click', () => {
        if (!practice) {
          sess.rows.push({ type: 'trial', block: pos.b + 1, position: k, condition: cond, painting: s.id, category: s.rule,
            q1_answer: val('q1'), q1_correct: val('q1') === s.rule ? 1 : 0, q2_answer: val('q2'), q2_correct: val('q2') === s.order[0][0] ? 1 : 0,
            viewer_top: s.order[0][0], model_top: s.model[0], read_ms: readMs, answer_ms: Math.round(performance.now() - t0) });
        }
        if (practice) { feedback(s, val('q1'), val('q2'), () => { if (pos.i + 1 < S.practice.length) trial({ practice: true, i: pos.i + 1 }); else ready(); }); return; }
        if (pos.i + 1 < 6) trial({ b: pos.b, i: pos.i + 1 }); else rate(pos.b);
      });
    });
  });
}
// practice only: show the right answers with a short reason, so everyone understands the task before the study starts
function feedback(s, a1, a2, next) {
  const ok1 = a1 === s.rule, ok2 = a2 === s.order[0][0];
  screen(`<h1>${esc(T.fbH)}</h1>
    <div class="card fb ${ok1 ? 'ok' : 'no'}"><p><b>${esc(ok1 ? T.right : T.wrong)}</b> ${esc(T.fbQ1t(T.q1o[s.rule], T.fbQ1[s.rule]))}</p></div>
    <div class="card fb ${ok2 ? 'ok' : 'no'}"><p><b>${esc(ok2 ? T.right : T.wrong)}</b> ${esc(T.fbQ2t(emo(lang, s.order[0][0]), emo(lang, s.model[0])))}</p></div>
    <div class="card desc"><p class="muted">${esc(describe(lang, s, 'B'))}</p></div>
    <button class="primary" id="go">${esc(T.cont)}</button>`);
  document.getElementById('go').addEventListener('click', next);
}
function ready() {
  screen(`<h1>${esc(T.readyH)}</h1><div class="card"><p>${esc(T.ready)}</p></div><button class="primary" id="go">${esc(T.begin)}</button>`);
  document.getElementById('go').addEventListener('click', () => trial({ b: 0, i: 0 }));
}
function rate(b) {
  screen(`<h1>${esc(T.rateH)}</h1>${scaleHtml('r1', T.r1, 7)}${scaleHtml('r2', T.r2, 7)}<button class="primary" id="go" disabled>${esc(T.cont)}</button>`);
  main.onchange = (() => { document.getElementById('go').disabled = !(val('r1') && val('r2')); });
  document.getElementById('go').addEventListener('click', () => {
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
  main.onchange = (() => { document.getElementById('go').disabled = items.some((_, k) => !val(`s${k}`)); });
  document.getElementById('go').addEventListener('click', async () => {
    const v = items.map((_, k) => +val(`s${k}`)), att = v[5], sv = v.slice(0, 5).concat(v.slice(6));
    sv.forEach((x, k) => sess.rows.push({ type: 'sus', item: `sus${k + 1}`, value: x }));
    sess.rows.push({ type: 'sus', item: 'sus_score', value: 2.5 * sv.reduce((s, x, k) => s + (k % 2 === 0 ? x - 1 : 5 - x), 0) });
    sess.rows.push({ type: 'check', item: 'attention_pass', value: att === 2 ? 1 : 0 });
    sess.finished = new Date().toISOString();
    finish();
  });
}
async function finish() {
  screen(`<h1>${esc(T.endH)}</h1><p class="muted">${esc(T.sending)}</p>`);
  const ok = await send();
  if (!ok) {
    screen(`<h1>${esc(T.endH)}</h1><div class="card"><p>${esc(T.failed)}</p></div><button class="primary" id="go">${esc(T.retry)}</button>`);
    document.getElementById('go').addEventListener('click', finish); return;
  }
  screen(`<h1>${esc(T.endH)}</h1><div class="card"><p>${esc(T.end)}</p>${C.COMPLETION_CODE ? `<p>${esc(T.code)}</p><p class="code">${esc(C.COMPLETION_CODE)}</p>` : ''}</div>`);
}

// ---- start
const sel = document.getElementById('lang');
sel.innerHTML = LANGS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
sel.addEventListener('change', () => { setLang(sel.value); if (!sess.id) welcome(); else { /* language fixed once started */ sel.value = lang; } });
let saved = 'en'; try { saved = localStorage.getItem('mv-study-lang') || 'en'; } catch (e) { /* ignore */ }
const fromUrl = (location.search.match(/[?&]lang=([\w-]+)/) || [])[1];
setLang(UI[fromUrl] ? fromUrl : UI[saved] ? saved : 'en');
welcome();
