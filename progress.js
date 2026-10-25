/* "Запази прогреса": install the app, tell when a new version is ready, and move progress
   between devices with a file or a text code. Opens #progress-dialog from #progress-open.

   Progress = the raw localStorage values of this app's keys (PG_KEYS), never the statistics
   choice (statistika-…). A file is { app, v: 1, saved, data: { key: raw string } }; a code is
   'VDL1.' + base64url of the same JSON in UTF-8. Both are made and read on the device only. */

const PG_APP = 'verbes-des-loisirs';
const PG_KEYS = /^(verbes-|cartes-|dvoiki-|diktovka-|govor-|dialozi|igri-)/;
const PG_HINT = 'verbes-ios-hint';            // the iPhone hint was closed
const PG_DONE = 'verbes-progres-zareden';     // written with an import, read once after the reload
const PG_LOCAL = new Set([PG_HINT, PG_DONE]); // about this device only: never moved
const PG_SOME = ['cartes-box', 'dvoiki-best', 'dialozi', 'verbes-test'];
const PG_CODE = 'VDL1.';
const PG_MAX = 1024 * 1024;

const pgDialog = $('progress-dialog');
const pgOpenBtn = $('progress-open');
const pgNoteBox = $('app-note');
const pgOutMsg = $('pg-out-msg');
const pgInMsg = $('pg-in-msg');
const pgCodeOut = $('pg-code-out');
const pgCodeIn = $('pg-code-in');
const pgFile = $('pg-file');
const pgConfirm = $('pg-confirm');

const pgUA = navigator.userAgent || '';
const pgIOS = /iPhone|iPad|iPod/.test(pgUA) || (/Macintosh/.test(pgUA) && navigator.maxTouchPoints > 1);
const pgIPad = pgIOS && !/iPhone|iPod/.test(pgUA);
const pgStandalone = () => !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

/* ---------- storage ---------- */
function pgStore() {
  try { const s = window.localStorage; s.getItem('x'); return s; } catch (e) { return null; }
}
const pgAllowed = k => typeof k === 'string' && PG_KEYS.test(k) && !/^statistika-/.test(k);
function pgKeys(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (pgAllowed(k) && !PG_LOCAL.has(k)) out.push(k);
  }
  return out.sort();
}
function pgSnapshot() {
  const s = pgStore();
  if (!s) return null;
  const data = {};
  pgKeys(s).forEach(k => { data[k] = s.getItem(k); });
  return { app: PG_APP, v: 1, saved: new Date().toISOString(), data };
}
const PG_NO_STORE = 'Този браузър не дава да се пази прогрес (например в режим „инкогнито“).';

/* ---------- base64url of UTF-8 ---------- */
function pgB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pgUnB64(s) {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Error('b64');
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/* ---------- words ---------- */
const pgPad = n => String(n).padStart(2, '0');
const pgDay = d => d.getFullYear() + '-' + pgPad(d.getMonth() + 1) + '-' + pgPad(d.getDate());
const pgDate = d => d.getDate() + '.' + pgPad(d.getMonth() + 1) + '.' + d.getFullYear();
const pgCount = (n, one, many) => n + '\u00a0' + (n === 1 ? one : many);

/* what a set of progress holds, in words: get(key) gives the raw value or null */
function pgDescribe(get, keys) {
  if (!keys.length) return 'нищо';
  const obj = k => {
    try { const v = JSON.parse(get(k)); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch (e) { return null; }
  };
  const known = typeof KNOWN_BOX === 'number' ? KNOWN_BOX : 3;
  const parts = [];
  const box = obj('cartes-box');
  if (box) parts.push(pgCount(Object.values(box).filter(x => x >= known).length, 'научена карта', 'научени карти'));
  const best = obj('dvoiki-best');
  if (best && Object.keys(best).length) parts.push(pgCount(Object.keys(best).length, 'рекорд в „Двойки“', 'рекорда в „Двойки“'));
  const dl = obj('dialozi');
  if (dl && Object.keys(dl).length) parts.push(pgCount(Object.keys(dl).length, 'диалог', 'диалога'));
  return parts.length ? parts.join(', ') + ' и настройките' : 'само настройки';
}

/* a message line; the same text again is still read out */
let pgSaid = 0;
function pgSay(line, kind, text) {
  const n = String(++pgSaid);
  line.dataset.said = n;
  line.className = 'pg-msg' + (kind ? ' verdict ' + kind : '');
  line.textContent = '';
  if (text) requestAnimationFrame(() => { if (line.dataset.said === n) line.textContent = text; });
}

/* ---------- save ---------- */
let pgUrl = null;
function pgSaveFile() {
  const snap = pgSnapshot();
  if (!snap) { pgSay(pgOutMsg, 'bad', PG_NO_STORE); return; }
  const name = 'verbes-progres-' + pgDay(new Date()) + '.json';
  if (pgUrl) URL.revokeObjectURL(pgUrl);
  const url = pgUrl = URL.createObjectURL(new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' }));
  const a = el('a');
  a.href = url;
  a.download = name;
  a.hidden = true;
  pgDialog.appendChild(a);          // inside the dialog: the page under it is inert
  a.click();
  a.remove();
  // a phone may ask "Изтегли?" first, so the file stays readable for a minute
  setTimeout(() => { URL.revokeObjectURL(url); if (pgUrl === url) pgUrl = null; }, 60000);
  pgCodeOut.hidden = true;
  pgSay(pgOutMsg, 'ok', 'Готово: ' + name + '. На другото устройство избери „Зареди от файл“.');
}

async function pgCopy() {
  const snap = pgSnapshot();
  if (!snap) { pgSay(pgOutMsg, 'bad', PG_NO_STORE); return; }
  const code = PG_CODE + pgB64(JSON.stringify(snap));
  pgCodeOut.hidden = true;
  try {
    await navigator.clipboard.writeText(code);
    pgSay(pgOutMsg, 'ok', 'Копирано. На другото устройство го постави в „Постави код“.');
  } catch (e) {
    // no clipboard here (or not allowed): show the code, selected, to copy by hand
    pgCodeOut.value = code;
    pgCodeOut.hidden = false;
    pgCodeOut.focus({ preventScroll: true });
    pgCodeOut.select();
    pgCodeOut.setSelectionRange(0, code.length);
    pgCodeOut.scrollIntoView({ block: 'nearest' });
    pgSay(pgOutMsg, 'near', 'Не успях да копирам сам. Кодът е в полето отдолу и е маркиран: копирай го.');
  }
}

/* ---------- load ---------- */
/* text of a file or a code -> { data, saved }; throws an Error with a message to show */
function pgRead(text, fromFile) {
  const fail = m => { throw new Error(m + ' Нищо не е сменено.'); };
  const NOT_OURS = fromFile ? 'Това не е файл с прогрес от това приложение.' : 'Това не е код от това приложение.';
  const BROKEN = fromFile ? 'Файлът е повреден или променен.' : 'Кодът е непълен или сгрешен. Копирай го пак целия.';
  const NEWER = (fromFile ? 'Файлът' : 'Кодът') + ' е от по-нова версия на приложението. Отвори приложението отново (с интернет) и опитай пак.';
  const BIG = fromFile ? 'Файлът е твърде голям за файл с прогрес.' : 'Кодът е твърде дълъг.';
  let s = String(text).replace(/^\uFEFF/, '').trim();
  if (!s.startsWith('{')) {
    const c = s.replace(/\s+/g, '');            // a pasted code may come with line breaks
    if (!c.startsWith(PG_CODE)) fail(/^VDL\d+\./.test(c) ? NEWER : NOT_OURS);
    if (c.length > PG_MAX * 4 / 3 + 8) fail(BIG);
    try { s = pgUnB64(c.slice(PG_CODE.length)); } catch (e) { fail(BROKEN); }
  }
  if (new TextEncoder().encode(s).length >= PG_MAX) fail(BIG);
  let o;
  try { o = JSON.parse(s); } catch (e) { fail(fromFile ? NOT_OURS : BROKEN); }
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.app !== PG_APP) fail(NOT_OURS);
  if (o.v !== 1) fail(typeof o.v === 'number' && o.v > 1 ? NEWER : BROKEN);
  const d = o.data;
  if (!d || typeof d !== 'object' || Array.isArray(d)) fail(BROKEN);
  const data = {};
  Object.keys(d).forEach(k => {
    const v = d[k];
    if (!pgAllowed(k) || typeof v !== 'string') fail(BROKEN);
    try { JSON.parse(v); } catch (e) { fail(BROKEN); }
    if (!PG_LOCAL.has(k)) data[k] = v;
  });
  if (!Object.keys(data).length) fail(fromFile ? 'Във файла няма прогрес.' : 'В кода няма прогрес.');
  const t = typeof o.saved === 'string' ? Date.parse(o.saved) : NaN;
  return { data, saved: isNaN(t) ? null : new Date(t) };
}

let pgPending = null;   // { data, saved } waiting for "Замени"
let pgFrom = null;      // the control the import started from
function pgTry(text, fromFile, from) {
  let got;
  try {
    got = pgRead(text, fromFile);
  } catch (e) {
    pgCancel(false);
    pgSay(pgInMsg, 'bad', e && e.message && / Нищо не е сменено\.$/.test(e.message) ? e.message : 'Не успях да прочета прогреса. Нищо не е сменено.');
    pgInMsg.scrollIntoView({ block: 'nearest' });
    return;
  }
  const s = pgStore();
  if (!s) { pgSay(pgInMsg, 'bad', PG_NO_STORE); return; }
  pgPending = got;
  pgFrom = from;
  pgSay(pgInMsg, '', '');
  const keys = Object.keys(got.data);
  $('pg-from').textContent = (fromFile ? 'Във файла' : 'В кода') + (got.saved ? ' (от ' + pgDate(got.saved) + ')' : '') + ': '
    + pgDescribe(k => (Object.prototype.hasOwnProperty.call(got.data, k) ? got.data[k] : null), keys) + '.';
  $('pg-now').textContent = 'Сега на това устройство: ' + pgDescribe(k => s.getItem(k), pgKeys(s)) + '.';
  pgConfirm.hidden = false;
  pgConfirm.focus({ preventScroll: true });
  pgConfirm.scrollIntoView({ block: 'nearest' });
}
function pgCancel(say) {
  const had = !pgConfirm.hidden && pgConfirm.contains(document.activeElement);
  pgPending = null;
  pgConfirm.hidden = true;
  if (say) pgSay(pgInMsg, '', 'Нищо не е сменено.');
  if (had && pgFrom) pgFrom.focus({ preventScroll: true });
}
/* "Замени": the progress on this device becomes the loaded one, then the app starts again */
function pgApply() {
  const got = pgPending;
  const s = pgStore();
  if (!got) return;
  if (!s) { pgSay(pgInMsg, 'bad', PG_NO_STORE); return; }
  const before = {};
  pgKeys(s).forEach(k => { before[k] = s.getItem(k); });
  try {
    Object.keys(before).forEach(k => s.removeItem(k));
    Object.keys(got.data).forEach(k => s.setItem(k, got.data[k]));
    s.setItem(PG_DONE, '1');
  } catch (e) {
    // no room: put back what was here
    try {
      pgKeys(s).forEach(k => s.removeItem(k));
      Object.keys(before).forEach(k => s.setItem(k, before[k]));
      s.removeItem(PG_DONE);
    } catch (e2) {}
    pgCancel(false);
    pgSay(pgInMsg, 'bad', 'Не успях да запиша прогреса на това устройство. Нищо не е сменено.');
    if (pgFrom) pgFrom.focus({ preventScroll: true });
    return;
  }
  location.reload();
}

/* ---------- install ---------- */
let pgPrompt = null;      // the browser's own install question, kept for "Инсталирай"
let pgInstalled = false;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  pgPrompt = e;
  if (pgDialog.open) pgRenderInstall();
});
window.addEventListener('appinstalled', () => {
  pgPrompt = null;
  pgInstalled = true;
  if (pgDialog.open) pgRenderInstall();
});
function pgRenderInstall() {
  const how = $('pg-install-how');
  const standalone = pgStandalone();
  $('pg-install-row').hidden = true;
  if (standalone || pgInstalled) {
    how.textContent = 'Приложението е инсталирано на това устройство.';
  } else if (pgPrompt) {
    how.textContent = 'Добави приложението на това устройство.';
    $('pg-install-row').hidden = false;
  } else if (pgIOS) {
    how.textContent = 'В Safari чукни „Сподели“ (квадратче със стрелка нагоре), после „Добави към началния екран“.';
  } else {
    how.textContent = 'В менюто на браузъра избери „Инсталирай“ или „Добави към началния екран“.';
  }
  // on iPhone/iPad the app on the home screen keeps its own data, apart from Safari
  const move = $('pg-ios-move');
  move.hidden = !pgIOS;
  move.textContent = standalone
    ? 'Прогресът от Safari не се вижда тук. В Safari отвори „Запази прогреса“, копирай кода и го постави отдолу.'
    : 'Приложението на началния екран не вижда прогреса от Safari. Затова първо копирай кода отдолу, а после го постави в приложението.';
}
$('pg-install').addEventListener('click', async () => {
  const p = pgPrompt;
  if (!p) return;
  pgPrompt = null;
  try {
    await p.prompt();
    const choice = await p.userChoice;
    if (choice && choice.outcome === 'accepted') pgInstalled = true;
  } catch (e) {}
  pgRenderInstall();
  if (pgDialog.open) $('pg-install-how').focus({ preventScroll: true });
});

/* ---------- the dialog ---------- */
let pgOpener = null;
function pgOpen(from) {
  if (pgDialog.open) return;
  pgOpener = from || pgOpenBtn;
  stopAll();
  pgRenderInstall();
  pgCancel(false);
  pgSay(pgOutMsg, '', '');
  pgSay(pgInMsg, '', '');
  pgCodeOut.hidden = true;
  pgCodeOut.value = '';
  pgDialog.showModal();
  pgDialog.scrollTop = 0;
}
pgOpenBtn.addEventListener('click', () => pgOpen(pgOpenBtn));
$('pg-close').addEventListener('click', () => pgDialog.close());
pgDialog.addEventListener('close', () => {
  pgPending = null;
  pgConfirm.hidden = true;
  const back = pgOpener && pgOpener.isConnected && !pgOpener.closest('[hidden]') ? pgOpener : pgOpenBtn;
  pgOpener = null;
  back.focus({ preventScroll: true });
});
// keys stay in the open dialog: the cards listen on document (Space flips, arrows grade)
pgDialog.addEventListener('keydown', e => e.stopPropagation());
document.addEventListener('keydown', e => {
  if (pgDialog.open && !pgDialog.contains(e.target)) e.stopPropagation();
}, true);
// Safari has no closedby yet: a tap on the backdrop closes the dialog there too
if (!('closedBy' in HTMLDialogElement.prototype)) {
  const outside = e => {
    const r = pgDialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  let downOutside = false;
  pgDialog.addEventListener('pointerdown', e => { downOutside = e.target === pgDialog && outside(e); });
  pgDialog.addEventListener('click', e => {
    if (downOutside && e.target === pgDialog && outside(e)) pgDialog.close();
    downOutside = false;
  });
}

$('pg-save').addEventListener('click', pgSaveFile);
$('pg-copy').addEventListener('click', pgCopy);
$('pg-file-btn').addEventListener('click', () => pgFile.click());
pgFile.addEventListener('change', async () => {
  const f = pgFile.files && pgFile.files[0];
  pgFile.value = '';
  if (!f) return;
  let text = null;
  if (f.size < PG_MAX) { try { text = await f.text(); } catch (e) {} }
  if (text === null) {
    pgCancel(false);
    pgSay(pgInMsg, 'bad', (f.size < PG_MAX ? 'Не успях да прочета файла.' : 'Файлът е твърде голям за файл с прогрес.') + ' Нищо не е сменено.');
    return;
  }
  pgTry(text, true, $('pg-file-btn'));
});
function pgLoadCode() {
  if (!pgCodeIn.value.trim()) {
    pgCancel(false);
    pgSay(pgInMsg, 'bad', 'Първо постави кода в полето.');
    pgCodeIn.focus({ preventScroll: true });
    return;
  }
  pgTry(pgCodeIn.value, false, pgCodeIn);
}
$('pg-code-load').addEventListener('click', pgLoadCode);
pgCodeIn.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); pgLoadCode(); }
});
$('pg-cancel').addEventListener('click', () => pgCancel(true));
$('pg-replace').addEventListener('click', pgApply);

/* ---------- notices under the header ---------- */
/* one at a time: a new version beats "loaded", which beats the iPhone hint */
const PG_RANK = { ios: 1, loaded: 2, update: 3 };
let pgNoteKind = null;
pgNoteBox.setAttribute('role', 'status');
function pgNote(kind, text, buttons) {
  if (pgNoteKind && PG_RANK[pgNoteKind] > PG_RANK[kind]) return;
  const had = pgNoteBox.contains(document.activeElement);
  pgNoteKind = kind;
  const row = el('div', 'app-note-actions');
  buttons.forEach(([label, onClick, primary]) => {
    const b = el('button', 'btn' + (primary ? ' primary' : ''), label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    row.appendChild(b);
  });
  pgNoteBox.hidden = false;
  pgNoteBox.replaceChildren(el('p', 'app-note-text', text), row);
  if (had) row.firstChild.focus({ preventScroll: true });
}
function pgNoteClose(kind) {
  if (pgNoteKind !== kind) return;
  const had = pgNoteBox.contains(document.activeElement);
  pgNoteKind = null;
  pgNoteBox.hidden = true;
  pgNoteBox.replaceChildren();
  if (had) pgOpenBtn.focus({ preventScroll: true });
}

// just loaded from a file or a code
(function pgLoaded() {
  const s = pgStore();
  if (!s || s.getItem(PG_DONE) === null) return;
  try { s.removeItem(PG_DONE); } catch (e) {}
  pgNote('loaded', 'Прогресът е зареден.', [['Затвори', () => pgNoteClose('loaded')]]);
})();

// a new version: only when a service worker already ran this page (not on the first install)
const pgHadSW = !!('serviceWorker' in navigator && navigator.serviceWorker.controller);
if (pgHadSW) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    pgNote('update', 'Има нова версия на приложението.', [['Обнови', () => location.reload(), true]]);
  });
  // an installed app can stay open for days: look for a new version when it comes back
  let pgChecked = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || Date.now() - pgChecked < 3600 * 1000) return;
    pgChecked = Date.now();
    navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
  });
}

// iPhone/iPad: Safari deletes the data of a site not opened for 7 days, an installed app keeps it
(function pgIosHint() {
  const s = pgStore();
  if (!pgIOS || pgStandalone() || load(PG_HINT, 0) || !s || !PG_SOME.some(k => s.getItem(k) !== null)) return;
  const consent = $('consent');
  let mo = null;
  const how = e => pgOpen(e.currentTarget);
  const close = () => { save(PG_HINT, 1); pgNoteClose('ios'); if (mo) mo.disconnect(); };
  // never at the same time as the statistics banner
  const update = () => {
    if (load(PG_HINT, 0)) return;
    if (consent && !consent.hidden) { pgNoteClose('ios'); return; }
    if (pgNoteKind !== 'ios') pgNote('ios', 'На ' + (pgIPad ? 'iPad' : 'iPhone') + ' добави приложението към началния екран, за да не се изтрие прогресът.', [['Как?', how, true], ['Затвори', close]]);
  };
  if (consent && 'MutationObserver' in window) {
    mo = new MutationObserver(update);
    mo.observe(consent, { attributes: true, attributeFilter: ['hidden'] });
  }
  update();
})();
