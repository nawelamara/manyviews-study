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


// ---- screen helpers: one thing per screen, a thin progress bar on top, a Back button in the header, the main button
// fixed at the bottom on phones, Enter = main button, number keys = options.
const TOTAL = 73;                       // all screens: 3 start + 2x4 practice + 1 + 18x4 trials + 3x3 part ends (+ attention check) + end
let keyHandler = null, lastIdx = 0;
function screen(html, { focus, idx, back } = {}) {
  const dir = idx !== undefined && idx < lastIdx ? 'back' : 'fwd';
  if (idx !== undefined) lastIdx = idx;
  main.className = ''; main.innerHTML = html; void main.offsetWidth; main.className = 'in ' + dir;
  $('bar').style.width = `${Math.min(100, (100 * (idx || 0)) / TOTAL).toFixed(1)}%`;
  const tb = $('topback'); tb.hidden = !back; tb.onclick = back || null;
  window.scrollTo(0, 0); keyHandler = null;
  const f = main.querySelector(focus || 'h1, .q, .progress'); if (f) { f.tabIndex = -1; f.focus({ preventScroll: true }); }
}
document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || document.querySelector('.lightbox')) return;
  if (keyHandler && keyHandler(e)) return;
  if (e.key === 'Enter' && !(e.target.closest && e.target.closest('button, a, select, summary, input'))) {
    const g = $('go'); if (g && !g.disabled) { e.preventDefault(); g.click(); }
  }
});
function setLang(l) {
  lang = l; T = UI[l];
  document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'; document.title = T.title;
  $('lang').value = l; $('topback-t').textContent = T.back;
  try { localStorage.setItem('mv-study-lang', l); } catch (e) { /* ignore */ }
}
const actions = (label, { disabled, extra = '' } = {}) => `<div class="actions">${extra}<button class="primary" id="go"${disabled ? ' disabled' : ''}>
  <span>${esc(label)}</span><span class="arr" aria-hidden="true">→</span></button><span class="enter" aria-hidden="true">Enter ↵</span></div>`;
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
function scaleQ({ idx, head = '', q, n, chosen, onPick, onBack }) {
  screen(head + `<h2 class="q">${esc(q)}</h2><div class="scale" role="radiogroup" aria-label="${esc(q)}"><div class="nums">` +
    Array.from({ length: n }, (_, k) => `<button type="button" class="num" role="radio" aria-checked="${chosen === k + 1}" data-v="${k + 1}">${k + 1}</button>`).join('') +
    `</div><div class="ends"><span>${esc(T.dis)}</span><span>${esc(T.agr)}</span></div></div>`, { focus: '.q', idx, back: onBack });
  let done = false;
  const pick = (b) => {
    if (done) return; done = true;
    main.querySelectorAll('.num').forEach((t) => t.setAttribute('aria-checked', String(t === b)));
    setTimeout(() => onPick(+b.dataset.v), 380);
  };
  main.querySelectorAll('.num').forEach((b) => b.addEventListener('click', () => pick(b)));
  keyHandler = (e) => { const v = parseInt(e.key, 10), bs = main.querySelectorAll('.num');
    if (v >= 1 && v <= n) { pick(bs[v - 1]); return true; } return false; };
}

// ---- flow
function welcome() {
  if ((!C.OPEN || !C.ENDPOINT) && !preview) { screen(`<div class="hero"><h1>${esc(T.title)}</h1><p>${esc(T.closed)}</p></div>`, { idx: 0 }); return; }
  const pics = [S.leader[0], S.varied[2], S.few[3], S.leader[3], S.varied[0]];
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
    }
    intro();
  });
}
function intro() {
  screen(`<h1>${esc(T.introH)}</h1><p class="lead">${esc(T.explain)}</p>
    <ol class="steps">${T.steps.map(([ic, h, t], i) => `<li class="step"><span class="ic" aria-hidden="true">${ic}</span><div><b><span class="n">${i + 1}</span> ${esc(h)}</b><p>${esc(t)}</p></div></li>`).join('')}</ol>
    <p class="center muted">${esc(T.introEnd)}</p>` + actions(T.startPractice), { idx: 2, back: consent });
  $('go').addEventListener('click', () => trial({ practice: true, i: 0 }));
}
function trial(pos) {
  const practice = !!pos.practice, s = practice ? S.practice[pos.i] : sess.blocks[pos.b].items[pos.i], cond = practice ? 'B' : sess.blocks[pos.b].cond;
  const k = practice ? pos.i + 1 : pos.b * 6 + pos.i + 1, total = practice ? S.practice.length : 18;
  const base = practice ? 3 + pos.i * 3 : 10 + pos.b * 21 + pos.i * 3;
  const head = progress(k, total, practice);
  // 1. look at the painting and read the description (one screen)
  let readMs = 0, t0 = 0;
  const read = () => {
    const tRead = performance.now();
    screen(head + picture(s, true) + `<div class="card desc"><span class="tag">📝 ${esc(T.descH)}</span><p>${esc(describe(lang, s, cond))}</p></div>
      <div class="card desc model"><span class="tag">🤖 AI</span><p>${esc(describe(lang, s, 'model'))}</p></div>${glossary()}` + actions(T.read),
    { focus: '.desc', idx: base });
    $('go').addEventListener('click', () => { readMs += Math.round(performance.now() - tRead); t0 = performance.now(); ask1(); });
  };
  // 2. two questions, one per screen (the description is hidden now)
  let a1 = null, a2 = null;
  const r = rng(7 + sess.p * 100 + (practice ? pos.i : 10 + k));
  const q2opts = shuffle([s.order[0][0], s.model[0]], r);
  const ask1 = () => choice({ idx: base + 1, head, q: T.q1, chosen: a1, options: ['leader', 'varied', 'few', 'dontknow'].map((v) => [v, T.q1o[v]]),
    onPick: (v) => { a1 = v; ask2(); } });
  const ask2 = () => choice({ idx: base + 2, head, q: T.q2, chosen: a2, options: q2opts.map((f) => [f, emo(lang, f)]).concat([['dontknow', T.dontknow]]),
    onBack: ask1, onPick: (v) => { a2 = v; done(); } });
  const done = () => {
    if (practice) { feedback(s, a1, a2, base + 2, () => { a1 = a2 = null; read(); }, () => (pos.i + 1 < S.practice.length ? trial({ practice: true, i: pos.i + 1 }) : ready()), ask2); return; }
    sess.rows.push({ type: 'trial', block: pos.b + 1, position: k, condition: cond, painting: s.id, category: s.rule,
      q1_answer: a1, q1_correct: a1 === s.rule ? 1 : 0, q2_answer: a2, q2_correct: a2 === s.order[0][0] ? 1 : 0,
      viewer_top: s.order[0][0], model_top: s.model[0], read_ms: readMs, answer_ms: Math.round(performance.now() - t0) });
    if (pos.i + 1 < 6) trial({ b: pos.b, i: pos.i + 1 }); else rate(pos.b);
  };
  read();
}
// practice only: show the right answers, and let people read the description again and retry
function feedback(s, a1, a2, idx, retry, next, back) {
  const ok1 = a1 === s.rule, ok2 = a2 === s.order[0][0], ok = ok1 && ok2;
  screen(`<div class="fbhead ${ok ? 'ok' : 'no'}"><span class="big pop" aria-hidden="true">${ok ? '🎉' : '🤔'}</span><h1>${esc(ok ? T.good : T.hmm)}</h1></div>
    <div class="card fb ${ok1 ? 'ok' : 'no'}"><span class="mark" aria-hidden="true">${ok1 ? '✓' : '✗'}</span><p>${esc(T.fbQ1t(T.q1o[s.rule], T.fbQ1[s.rule]))}</p></div>
    <div class="card fb ${ok2 ? 'ok' : 'no'}"><span class="mark" aria-hidden="true">${ok2 ? '✓' : '✗'}</span><p>${esc(T.fbQ2t(emo(lang, s.order[0][0]), emo(lang, s.model[0])))}</p></div>` +
    actions(T.cont, { extra: ok ? '' : `<button type="button" class="secondary" id="again">↺ ${esc(T.tryAgain)}</button>` }), { idx, back });
  if (!ok) $('again').addEventListener('click', retry);
  $('go').addEventListener('click', next);
}
function ready() {
  screen(`<div class="celebrate"><span class="big pop" aria-hidden="true">🎨</span><h1>${esc(T.readyH)}</h1><p>${esc(T.ready)}</p>
    <div class="parts">${[0, 1, 2].map(() => '<span></span>').join('')}</div></div>` + actions(T.begin), { idx: 9 });
  $('go').addEventListener('click', () => trial({ b: 0, i: 0 }));
}
function rate(b) {
  const base = 10 + b * 21 + 18, cond = sess.blocks[b].cond;
  let v1 = null, v2 = null;
  const head = `<p class="kicker">${esc(T.rateIntro)}</p>`;
  const cheer = () => {
    screen(`<div class="celebrate"><span class="big pop" aria-hidden="true">${['🌱', '🌿', '🌳'][b]}</span><h1>${esc(T.blockDone(b + 1))}</h1>
      <div class="parts">${[0, 1, 2].map((i) => `<span class="${i <= b ? 'on' : ''}"></span>`).join('')}</div>${T.cheer ? `<p>${esc(T.cheer[b])}</p>` : ''}</div>` +
      actions(T.cont), { idx: base });
    $('go').addEventListener('click', q1);
  };
  const q1 = () => scaleQ({ idx: base + 1, head, q: T.r1, n: 7, chosen: v1, onBack: cheer, onPick: (v) => { v1 = v; q2(); } });
  let v3 = null;
  const done = () => {
    sess.rows.push({ type: 'rating', block: b + 1, condition: cond, item: 'room_for_own_response', value: v1 },
      { type: 'rating', block: b + 1, condition: cond, item: 'hard_to_understand', value: v2 });
    if (b === 1) sess.rows.push({ type: 'check', block: 2, item: 'attention_pass', value: v3 === 2 ? 1 : 0 });
    if (b < 2) { send(); trial({ b: b + 1, i: 0 }); } else { sess.finished = new Date().toISOString(); finish(); }
  };
  const q2 = () => scaleQ({ idx: base + 2, head, q: T.r2, n: 7, chosen: v2, onBack: q1, onPick: (v) => { v2 = v; if (b === 1) q3(); else done(); } });
  // attention check: a third question after part 2 only ("please choose 2")
  const q3 = () => scaleQ({ idx: base + 2, head, q: T.attention, n: 7, chosen: v3, onBack: q2, onPick: (v) => { v3 = v; done(); } });
  cheer();
}
async function finish() {
  screen(`<div class="celebrate"><span class="big spin" aria-hidden="true">⏳</span><p>${esc(T.sending)}</p></div>`, { idx: 72 });
  const ok = await send();
  if (!ok) {
    screen(`<div class="card"><p>${esc(T.failed)}</p></div>` + actions(T.retry), { idx: 72 });
    $('go').addEventListener('click', finish); return;
  }
  const shareUrl = location.origin + location.pathname;
  screen(`<div class="confetti" aria-hidden="true">${Array.from({ length: 60 }, (_, i) => `<i style="--x:${(Math.random() * 100).toFixed(1)};--d:${(Math.random() * 1.2).toFixed(2)}s;--t:${(2.2 + Math.random() * 1.6).toFixed(2)}s;--r:${Math.round(Math.random() * 360)}deg;--c:${i % 4}"></i>`).join('')}</div>
    <div class="celebrate"><span class="big pop" aria-hidden="true">🖼️</span><h1>${esc(T.endH)}</h1><p>${esc(T.end)}</p></div>
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
sel.addEventListener('change', () => { if (!sess.id) { setLang(sel.value); welcome(); } else sel.value = lang; });
let saved = 'en'; try { saved = localStorage.getItem('mv-study-lang') || 'en'; } catch (e) { /* ignore */ }
const fromUrl = (location.search.match(/[?&]lang=([\w-]+)/) || [])[1];
setLang(UI[fromUrl] ? fromUrl : UI[saved] ? saved : 'en');
welcome();
