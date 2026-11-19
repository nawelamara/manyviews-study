/* Google Apps Script for the Many Views online study. Paste into a Google Sheet: Extensions → Apps Script.
   Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone → copy the URL into config.js (ENDPOINT).
   It gives out balanced participant numbers (doGet ?action=next) and appends answers (doPost) to the sheet "answers".
   Nothing identifying is stored: no names, e-mails or IP addresses (Apps Script does not pass them on). */
const COLS = ['received_at', 'session_id', 'participant', 'order', 'rotation', 'lang', 'assigned_by', 'started_at', 'finished_at',
  'type', 'block', 'position', 'condition', 'painting', 'category', 'q1_answer', 'q1_correct', 'q2_answer', 'q2_correct',
  'viewer_top', 'model_top', 'read_ms', 'answer_ms', 'item', 'value'];

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); if (header) sh.appendRow(header); }
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
    const sh = sheet_('answers', COLS);
    // keep one copy: rows already stored for this session are skipped (the page resends the whole session)
    const seen = PropertiesService.getScriptProperties();
    const key = 'n_' + s.id, have = Number(seen.getProperty(key) || '0');
    const now = new Date().toISOString();
    const add = rows.slice(have).map((r) => COLS.map((c) => c === 'received_at' ? now : c === 'session_id' ? s.id :
      ['participant', 'order', 'rotation', 'lang', 'assigned_by', 'started_at', 'finished_at'].indexOf(c) >= 0 ? (s[c] === undefined ? '' : s[c]) :
      (r[c] === undefined ? '' : r[c])));
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, COLS.length).setValues(add);
    seen.setProperty(key, String(rows.length));
    return ContentService.createTextOutput('ok');
  } finally { lock.releaseLock(); }
}
