/* Google Apps Script for the Many Views online study. Paste into the Google Sheet: Extensions → Apps Script.
   Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy (the URL in config.js stays the same).
   doGet ?action=next gives balanced participant numbers; doPost stores answers in THREE sheets (made automatically):
     sessions  – one row per participant (updated as they go; completed = TRUE at the end)
     trials    – one row per painting, every answer in its own column (q1_error = the main outcome, precomputed)
     responses – everything else, one row each: practice, demographics, attention check, end choices, comment, language switch
   The old sheet "answers" (earlier versions) is not touched; rename it e.g. "pilot_mixed_versions".
   Nothing identifying is stored: no names, e-mails or IP addresses (Apps Script does not pass them on). */
const SESSION_COLS = ['session_id', 'participant', 'order', 'rotation', 'lang', 'assigned_by', 'preview', 'app_version',
  'started_at', 'finished_at', 'completed', 'n_trials', 'last_update'];
const TRIAL_COLS = ['received_at', 'session_id', 'participant', 'block', 'position', 'condition', 'painting_id', 'category',
  'q1_estimate', 'q1_truth', 'q1_error', 'q1_close', 'q2_asked_feeling', 'q2_asked_source', 'q2_answer', 'q2_correct',
  'viewer_top', 'model_top', 'read_ms', 'answer_ms'];
const RESP_COLS = ['received_at', 'session_id', 'participant', 'section', 'block', 'item', 'value', 'position'];

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  return sh;
}

function doGet(e) {
  const out = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  if (!e || !e.parameter || e.parameter.action !== 'next') return out({ ok: true });
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const p = Number(props.getProperty('next') || '1');
    props.setProperty('next', String(p + 1));
    return out({ p: p });
  } finally { lock.releaseLock(); }
}

function doPost(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const data = JSON.parse(e.postData.contents);
    const s = data.session || {}, rows = data.rows || [];
    if (!s.id || rows.length > 200) return ContentService.createTextOutput('bad');
    const now = new Date().toISOString();
    const val = (o, c) => (o[c] === undefined || o[c] === null ? '' : o[c]);
    // the page resends the whole session each time: rows already stored for this session are skipped
    const props = PropertiesService.getScriptProperties();
    const key = 'v2_' + s.id, have = Number(props.getProperty(key) || '0');
    const fresh = rows.slice(have);
    const trials = fresh.filter((r) => r.type === 'trial').map((r) => TRIAL_COLS.map((c) =>
      c === 'received_at' ? now : c === 'session_id' ? s.id : c === 'participant' ? val(s, 'participant') : c === 'painting_id' ? val(r, 'painting') : val(r, c)));
    const resp = fresh.filter((r) => r.type !== 'trial').map((r) => RESP_COLS.map((c) =>
      c === 'received_at' ? now : c === 'session_id' ? s.id : c === 'participant' ? val(s, 'participant') : c === 'section' ? val(r, 'type') : val(r, c)));
    if (trials.length) { const sh = sheet_('trials', TRIAL_COLS); sh.getRange(sh.getLastRow() + 1, 1, trials.length, TRIAL_COLS.length).setValues(trials); }
    if (resp.length) { const sh = sheet_('responses', RESP_COLS); sh.getRange(sh.getLastRow() + 1, 1, resp.length, RESP_COLS.length).setValues(resp); }
    props.setProperty(key, String(rows.length));
    // sessions: one row per participant, updated in place
    const by = String(val(s, 'assigned_by'));
    const row = { session_id: s.id, participant: val(s, 'participant'), order: val(s, 'order'), rotation: val(s, 'rotation'), lang: val(s, 'lang'),
      assigned_by: by, preview: /preview$/.test(by), app_version: val(s, 'app_version'), started_at: val(s, 'started_at'),
      finished_at: val(s, 'finished_at'), completed: !!s.finished_at, n_trials: rows.filter((r) => r.type === 'trial').length, last_update: now };
    const sh = sheet_('sessions', SESSION_COLS);
    const hit = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).createTextFinder(s.id).matchEntireCell(true).findNext();
    const line = SESSION_COLS.map((c) => row[c]);
    if (hit) sh.getRange(hit.getRow(), 1, 1, SESSION_COLS.length).setValues([line]); else sh.appendRow(line);
    return ContentService.createTextOutput('ok');
  } finally { lock.releaseLock(); }
}
