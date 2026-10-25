/* Pronunciation: the learner says a verb form or a sentence out loud.
   The browser's speech recognition (Chrome, Edge, Safari) checks which words it understood;
   "Запиши се" records the learner's voice to compare with the model.
   Uses helpers and data from app.js, data.js and dictation.js. */

const SP_KINDS = [['mix', 'Смесено'], ['form', 'Форми'], ['sent', 'Изречения']];
const SP_COUNTS = [10, 20];
const SP_SLOW = 0.6;
const SP_LISTEN_MS = 10000;
const SP_RECORD_MS = 8000;
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
// errors after which speech recognition will not work here, so the learner judges by ear
const SP_BROKEN = ['network', 'service-not-allowed', 'language-not-supported', 'not-allowed', 'audio-capture'];

const MIC = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>';
const REC = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>';

const savedSp = load('govor-set', {}) || {};
const sp = {
  kind: SP_KINDS.some(k => k[0] === savedSp.kind) ? savedSp.kind : 'mix',
  count: SP_COUNTS.includes(savedSp.count) ? savedSp.count : 10,
  tenses: validSet(savedSp.tenses, TENSE_IDS, ['pr']),
  groups: validSet(savedSp.groups, GROUP_IDS, GROUP_IDS),
  qs: [], i: 0, score: 0, hard: [], retry: false, done: false, ui: null,
  rec: null, recorder: null, recUrl: null, audio: null, srBroken: false
};
const spRoot = $('speak');
const spSelfMode = () => !SpeechRec || sp.srBroken;

function saveSpSettings() {
  save('govor-set', { kind: sp.kind, count: sp.count, tenses: [...sp.tenses], groups: [...sp.groups] });
}

/* ---------- items ---------- */
function spItems() {
  return mixedRound(sp,
    (inf, p, t) => ({ type: 'form', inf, p, tense: t, text: spoken(formText(forms(inf, t)[p])), bg: inf + ' · ' + VERB[inf].bg }),
    row => ({ type: 'sent', inf: row[1], tense: row[0], text: spoken(row[2].replace('___', row[3])), bg: row[4] }));
}

/* ---------- comparing what was heard ---------- */
/* A rough "sounds like" key, so spellings that sound the same count
   (il joue = ils jouent, parlez = parler = parlé, allé = allées, est = et),
   while forms that sound different stay apart (il finit ≠ ils finissent, vous parle ≠ vous parlez). */
// names the recogniser spells its own way
const SP_ALIAS = { stéphane: 'stefan', stephane: 'stefan', stéfane: 'stefan' };
const SP_SHORT = { les: 'lé', des: 'dé', mes: 'mé', tes: 'té', ses: 'sé', ces: 'sé', et: 'ɛ', est: 'ɛ', es: 'ɛ', cet: 'setə' };
function soundKey(w) {
  const all = norm(w).replace(/[^a-zà-ÿœ']/g, '');
  const word = all.replace(/^.*'/, '');            // j'ai → ai, s'appelle → appelle
  const head = all.slice(0, all.length - word.length);
  if (SP_SHORT[word]) return head + SP_SHORT[word];
  // a heard final é: parlé = parler = parlez = allées, but joue ≠ joué
  const eEnd = /(?:é|ée|ées|és|er|ez)$/.test(word);
  let s = eEnd ? word.replace(/(?:é|ée|ées|és|er|ez)$/, '') : word;
  s = s.replace(/[èê]/g, 'ɛ').replace(/ç/g, 's').replace(/œ/g, 'e').normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/ph/g, 'f').replace(/eau/g, 'o').replace(/au/g, 'o').replace(/[ae]i/g, 'ɛ')
    .replace(/y/g, 'i').replace(/qu/g, 'k').replace(/c(?=[aou])/g, 'k').replace(/c(?=[eiɛ])/g, 's')
    .replace(/^h/, '').replace(/(.)\1+/g, '$1');
  if (eEnd) return head + s + 'é';
  if (/^[^aeiouɛ]*ent$/.test(s)) s = s.slice(0, -1);                 // sent = sens, vent = vend
  else if (/[vt]ients?$/.test(s)) s = s.replace(/ts?$/, '');           // vient, tient
  else if (/[^aeiouɛ](?:e|es|ent)$/.test(s)) s = s.replace(/(?:e|es|ent)$/, 'ə'); // partent: the t is heard
  else if (/[aeiouɛ](?:e|es|ent)$/.test(s)) s = s.replace(/(?:e|es|ent)$/, '');   // jouent = joue, croient = croit
  else s = s.replace(/[stxdzp]{1,2}$/, '');                            // part, prends, peux
  return head + (s || word.slice(0, 1));
}

/* which expected words were heard, in order (extra words are ignored);
   digits and spaced hyphen words are read like in the dictation (10h = dix heures, week end) */
function spMatch(expected, heard) {
  const exp = expected.split(/\s+/).filter(Boolean).map(show => ({ show, key: norm(show).replace(DK_PUNCT, '') }));
  const ek = exp.filter(t => t.key);
  const words = dkMergeSpaced(ek.map(t => t.key), dkWords(heard).words);
  const wk = words.map(w => SP_ALIAS[w.key] || w.key);
  // apostrophes are not heard, so "j ai" = "j'ai"
  const a = spLiaison(ek.map(t => t.key), ek.map(t => soundKey(dkSepless(t.key))));
  const b = spLiaison(wk, wk.map(w => soundKey(dkSepless(w))));
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  let i = 0, j = 0;
  ek.forEach(t => { t.st = 'bad'; });
  while (i < n && j < m) {
    if (a[i] === b[j]) { ek[i].st = 'ok'; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return { exp, ok: ek.filter(t => t.st === 'ok').length, total: ek.length, heard, extra: Math.max(0, m - ek.filter(t => t.st === 'ok').length) };
}
/* one verdict for a heard attempt, shared with the dialogues' role play:
   ok = every word heard (saying both forms, "il finit ils finissent", is not enough) */
function spGrade(r) {
  const tooMuch = r.extra > Math.max(1, Math.floor(r.total / 2));
  const all = r.ok === r.total && r.total > 0 && !tooMuch;
  const level = all ? 'ok' : tooMuch && r.ok === r.total ? 'extra' : r.total && r.ok / r.total >= 0.6 ? 'near' : 'bad';
  return { all, level };
}
const SP_VERDICTS = {
  ok: ['ok', 'Чудесно! Разбрах всичко.'],
  extra: ['near', 'Чух и други думи. Кажи само текста.'],
  near: ['near', 'Почти! Не разбрах думите в червено. Чуй примера и опитай пак.'],
  bad: ['bad', 'Не те разбрах добре. Чуй примера бавно и опитай пак.']
};
// ils aiment (/ilzɛm/) ≠ il aime: before a vowel or a mute h the liaison z is heard
const spLiaison = (ws, keys) => keys.map((key, k) =>
  /^(ils|elles)$/.test(ws[k]) && /^[aeiouyhàâéèêëîïôûœ]/.test(ws[k + 1] || '') ? key + 'z' : key);

/* ---------- microphone ---------- */
const SP_ERRORS = {
  'not-allowed': 'Няма достъп до микрофона. В Chrome чукни иконата вляво от адреса → Разрешения → Микрофон → Разреши. На iPhone: Настройки → Safari → Микрофон.',
  'service-not-allowed': 'Разпознаването на говор е изключено. На Android използвай Chrome и провери, че приложението Google е включено. На iPhone включи „Диктовка“ (Настройки → Общи → Клавиатура) и използвай Safari.',
  'no-speech': 'Не чух нищо. Натисни „Кажи“ и говори ясно, близо до телефона.',
  'audio-capture': 'Не намирам микрофон. Провери дали друго приложение не го използва.',
  'network': 'Разпознаването на говор има нужда от интернет. Провери връзката и опитай пак.',
  'language-not-supported': 'Браузърът не разпознава френски. Опитай в Chrome.',
  'busy': 'Микрофонът се използва от друго приложение.',
  'other': 'Нещо се обърка. Опитай пак.'
};
const SP_MEDIA_ERRORS = { NotAllowedError: 'not-allowed', SecurityError: 'not-allowed', NotFoundError: 'audio-capture', OverconstrainedError: 'audio-capture', NotReadableError: 'busy' };

function spMessage(ui, key) {
  ui.fb.replaceChildren(el('p', 'verdict bad', SP_ERRORS[key] || SP_ERRORS.other));
  ui.fb.hidden = false;
  ui.actions.scrollIntoView({ block: 'nearest' });
}
function spSetListening(ui, on, checking) {
  if (!ui) return;
  ui.mic.classList.toggle('listening', on && !checking);
  ui.mic.querySelector('.lbl').textContent = checking ? 'Проверявам…' : on ? 'Говори сега…' : 'Кажи';
  ui.mic.setAttribute('aria-pressed', String(on));
}
function spSetRecording(ui, on, waiting) {
  if (!ui) return;
  ui.recBtn.classList.toggle('listening', on);
  ui.recBtn.querySelector('.lbl').textContent = waiting ? 'Разреши микрофона…' : on ? 'Записвам… Спри' : 'Запиши се';
  if (waiting) ui.recBtn.setAttribute('aria-busy', 'true');
  else ui.recBtn.removeAttribute('aria-busy');
}

/* cancel listening: nothing is judged and no message is shown */
function spAbortListening() {
  const rec = sp.rec;
  if (!rec) return;
  rec.cancelled = true;
  sp.rec = null;
  try { rec.abort(); } catch (e) {}
  spSetListening(sp.ui, false);
  if (sp.ui) sp.ui.heard.hidden = true;
}
function spStopRecording(noPlay) {
  const r = sp.recorder;
  if (r && r.pending) {            // the mic is not open yet: cancel the request
    sp.recorder = null;
    spSetRecording(sp.ui, false);
    return;
  }
  if (r && r.state === 'recording') {
    r.noPlay = noPlay;
    r.stop();
  }
}
function spStopMine() {
  if (sp.audio) { sp.audio.pause(); sp.audio = null; }
}
/* silence before any sound plays or the mic opens, so nothing plays into the mic */
function spQuiet() {
  stopAll();
  spStopMine();
  spAbortListening();
  spStopRecording(true);
}

function spListen(ui) {
  if (sp.rec) { spSetListening(ui, true, true); try { sp.rec.stop(); } catch (e) {} return; }   // second tap: stop and judge
  spQuiet();
  const rec = new SpeechRec();
  rec.lang = 'fr-FR';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  let finalText = '', interimText = '', error = null;
  const timer = setTimeout(() => { try { rec.stop(); } catch (e) {} }, SP_LISTEN_MS);
  rec.onresult = e => {
    if (rec.cancelled) return;
    const results = [...e.results];
    const text = results.map(r => r[0].transcript).join(' ').trim();
    ui.heard.textContent = text ? 'Чух: ' + text : '';
    ui.heard.hidden = !text;
    if (results.every(r => r.isFinal)) finalText = text;
    else interimText = text;
  };
  rec.onerror = e => { error = e.error; };
  rec.onend = () => {
    clearTimeout(timer);
    if (sp.rec === rec) sp.rec = null;
    if (rec.cancelled || sp.ui !== ui) return;
    spSetListening(ui, false);
    if (finalText) spJudge(ui, finalText);
    else if (error && error !== 'aborted') {
      ui.heard.hidden = true;
      spMessage(ui, error);
      if (SP_BROKEN.includes(error)) { sp.srBroken = true; spShowSelf(ui, error); }
    } else if (interimText) spJudge(ui, interimText);
    else spMessage(ui, 'no-speech');
  };
  sp.rec = rec;
  spSetListening(ui, true);
  ui.heard.hidden = true;
  ui.fb.hidden = true;
  try { rec.start(); } catch (e) { sp.rec = null; spSetListening(ui, false); spMessage(ui, 'other'); }
}

/* record yourself and play it back */
async function spRecord(ui) {
  if (sp.recorder && sp.recorder.pending) return;
  if (sp.recorder && sp.recorder.state === 'recording') { spStopRecording(false); return; }
  spQuiet();
  const token = { pending: true };
  sp.recorder = token;
  spSetRecording(ui, false, true);
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    if (sp.recorder !== token) return;
    sp.recorder = null;
    spSetRecording(ui, false);
    const key = SP_MEDIA_ERRORS[e && e.name] || 'other';
    spMessage(ui, key);
    if (!SpeechRec) spShowSelf(ui, key);
    return;
  }
  const stopTracks = () => stream.getTracks().forEach(t => t.stop());
  // cancelled while the permission prompt was open (Кажи, Чуй, another item or tab)
  if (sp.recorder !== token || sp.ui !== ui || currentView !== 'speak') {
    stopTracks();
    if (sp.recorder === token) { sp.recorder = null; spSetRecording(ui, false); }
    return;
  }
  let recorder;
  try {
    recorder = new MediaRecorder(stream);
  } catch (e) {
    stopTracks();
    sp.recorder = null;
    spMessage(ui, 'other');
    return;
  }
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const timer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, SP_RECORD_MS);
  recorder.onstop = () => {
    clearTimeout(timer);
    stopTracks();
    if (sp.recorder === recorder) sp.recorder = null;
    spSetRecording(ui, false);
    if (recorder.noPlay || !chunks.length || sp.ui !== ui || currentView !== 'speak') return;
    if (sp.recUrl) URL.revokeObjectURL(sp.recUrl);
    sp.recUrl = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    ui.mine.hidden = false;
    spPlayMine(false);
  };
  sp.recorder = recorder;
  try {
    recorder.start();
  } catch (e) {
    clearTimeout(timer);
    stopTracks();
    sp.recorder = null;
    spMessage(ui, 'other');
    return;
  }
  spSetRecording(ui, true);
}
function spPlayMine(toggle) {
  if (!sp.recUrl) return;
  const wasPlaying = toggle && sp.audio && !sp.audio.paused;
  spQuiet();                // nothing plays into an open mic
  if (wasPlaying) return;   // second tap stops it
  const audio = new Audio(sp.recUrl);
  audio.onended = () => { if (sp.audio === audio) sp.audio = null; };
  sp.audio = audio;
  audio.play().catch(() => {});
}

/* ---------- settings ---------- */
function renderSpSettings() {
  $('s-kind').replaceChildren(...SP_KINDS.map(([id, label]) => toggleBtn(label, sp.kind === id, () => { sp.kind = id; spSettingsChanged(); })));
  $('s-tenses').replaceChildren(...setToggles(TENSE_ITEMS, sp.tenses, spSettingsChanged));
  $('s-groups').replaceChildren(...setToggles(GROUP_ITEMS, sp.groups, spSettingsChanged));
  $('s-count').replaceChildren(...SP_COUNTS.map(n => toggleBtn(String(n), sp.count === n, () => { sp.count = n; spSettingsChanged(); })));
  spSum();
}
function spSum() {
  if (sp.retry) {
    $('s-sum').textContent = 'Трудните · ' + questionsWord(sp.qs.length);
    return;
  }
  const n = sp.kind === 'sent' ? Math.min(sp.count, sentPoolOf(sp).length) : sp.count;
  const parts = [SP_KINDS.find(k => k[0] === sp.kind)[1], questionsWord(n), tensesLabel(sp.tenses)];
  const gl = groupsLabel(sp.groups);
  if (gl) parts.push(gl);
  $('s-sum').textContent = parts.join(' · ');
}
function spSettingsChanged() {
  saveSpSettings();
  renderSpSettings();
  spStart(null);
}

/* ---------- round ---------- */
function spRelease() {
  spStopMine();
  spAbortListening();
  spStopRecording(true);
  if (sp.recUrl) { URL.revokeObjectURL(sp.recUrl); sp.recUrl = null; }
  if (sp.ui) sp.ui.mine.hidden = true;
}
function spCleanup() {
  stopAll();
  spRelease();
}
function spStart(qs) {
  spCleanup();
  sp.retry = !!qs;
  sp.qs = qs || spItems();
  sp.i = 0;
  sp.score = 0;
  sp.hard = [];
  sp.done = false;
  spSum();
  spRenderQ(false);
}

function spModeButton(label, rate, q) {
  const b = el('button', 'btn dk-btn');
  b.type = 'button';
  b.innerHTML = PLAY;
  b.append(' ' + label);
  b.addEventListener('click', () => { spQuiet(); speak(q.text, b, rate); });
  return b;
}

function spRenderQ(focus) {
  const q = sp.qs[sp.i];
  q.best = null;
  q.ok = false;
  const card = el('div', 'qcard');

  const top = el('div', 'qtop');
  const scoreEl = el('span', null, 'Казани: ' + sp.score);
  top.append(el('span', null, 'Въпрос ' + (sp.i + 1) + ' от ' + sp.qs.length), scoreEl);
  const prog = el('div', 'progress');
  const bar = el('i');
  bar.style.width = (sp.i / sp.qs.length * 100) + '%';
  prog.appendChild(bar);
  card.append(top, prog);

  card.appendChild(el('p', 'eyebrow kind', 'Кажи на глас · ' + TENSE[q.tense].label));
  const say = el('p', 'big-text sp-text', q.text);
  say.lang = 'fr';
  card.append(say, el('p', 'bgline', q.bg));

  // listen to the model
  const model = el('div', 'dk-play');
  const playBtn = spModeButton('Чуй', DK_NORMAL, q);
  model.append(playBtn, spModeButton('Бавно', SP_SLOW, q));
  card.appendChild(model);

  // say it / record it
  const tools = el('div', 'sp-tools');
  const mic = el('button', 'btn primary sp-mic');
  mic.type = 'button';
  mic.innerHTML = MIC;
  mic.appendChild(el('span', 'lbl', 'Кажи'));
  mic.setAttribute('aria-pressed', 'false');
  const recBtn = el('button', 'btn sp-rec');
  recBtn.type = 'button';
  recBtn.innerHTML = REC;
  recBtn.appendChild(el('span', 'lbl', 'Запиши се'));
  const mine = el('button', 'btn dk-btn');
  mine.type = 'button';
  mine.innerHTML = PLAY;
  mine.append(' Чуй себе си');
  mine.hidden = true;
  if (SpeechRec) tools.appendChild(mic);
  if (canRecord) tools.append(recBtn, mine);
  card.appendChild(tools);

  // when speech recognition is missing or broken, the learner judges by ear
  const note = el('p', 'set-note sp-note');
  note.hidden = true;
  card.appendChild(note);

  const heard = el('p', 'fb-line sp-heard');
  heard.hidden = true;
  heard.setAttribute('aria-live', 'polite');
  card.appendChild(heard);

  const fb = el('div', 'feedback');
  fb.hidden = true;
  fb.setAttribute('aria-live', 'polite');
  card.appendChild(fb);

  const actions = el('div', 'actions');
  const skip = el('button', 'btn', 'Пропусни');
  skip.type = 'button';
  const selfOk = el('button', 'btn primary', 'Звучи добре');
  selfOk.type = 'button';
  selfOk.hidden = true;
  const next = el('button', 'btn primary', sp.i + 1 < sp.qs.length ? 'Напред' : 'Виж резултата');
  next.type = 'button';
  next.hidden = true;
  actions.append(skip, selfOk, next);
  card.appendChild(actions);

  const ui = { q, card, mic, recBtn, mine, note, heard, fb, actions, skip, selfOk, next, scoreEl, bar, playBtn, shownAt: performance.now() };
  sp.ui = ui;
  mic.addEventListener('click', () => spListen(ui));
  recBtn.addEventListener('click', () => spRecord(ui));
  mine.addEventListener('click', () => spPlayMine(true));
  selfOk.addEventListener('click', () => spSelfOk(ui));
  skip.addEventListener('click', () => spFinishItem(ui));
  next.addEventListener('click', () => spFinishItem(ui));
  if (spSelfMode()) spShowSelf(ui);

  spRoot.replaceChildren(card);
  if (focus) spFocusCurrent();
}

function spShowSelf(ui, error) {
  const noMic = !canRecord || ['not-allowed', 'audio-capture', 'busy'].includes(error);
  ui.note.textContent = (SpeechRec ? 'Разпознаването на говор не работи в момента. ' : 'Този браузър не разпознава говор. ')
    + (noMic ? 'Чуй примера, повтори го на глас и прецени сам.' : 'Чуй примера, запиши се и сравни сам.');
  ui.note.hidden = false;
  ui.selfOk.hidden = false;
  ui.shownAt = performance.now();
  ui.actions.scrollIntoView({ block: 'nearest' });
}

function spJudge(ui, heardText) {
  if (sp.ui !== ui) return;
  const q = ui.q;
  const r = spMatch(q.text, heardText);
  if (!q.best || r.ok > q.best.ok) q.best = r;
  sp.srBroken = false;
  ui.note.hidden = true;
  const g = spGrade(r);
  const all = g.all;
  const words = el('p', 'dk-answer sp-words');
  r.exp.forEach((t, k) => {
    if (k) words.append(' ');
    words.appendChild(el('span', t.st === 'bad' ? 'dk-bad' : null, t.show));
  });
  const verdict = SP_VERDICTS[g.level];
  ui.fb.replaceChildren(el('p', 'verdict ' + verdict[0], verdict[1]), words);
  ui.fb.hidden = false;
  if (all && !q.ok) {
    q.ok = true;
    sp.score++;
    ui.scoreEl.textContent = 'Казани: ' + sp.score;
  }
  ui.next.hidden = false;
  ui.skip.hidden = true;
  ui.selfOk.hidden = true;
  (all ? ui.next : ui.mic).focus({ preventScroll: true });
  ui.actions.scrollIntoView({ block: 'nearest' });
}

function spSelfOk(ui) {
  if (performance.now() - ui.shownAt < 400) return;
  const q = ui.q;
  if (!q.ok) {
    q.ok = true;
    sp.score++;
    ui.scoreEl.textContent = 'Казани: ' + sp.score;
  }
  spFinishItem(ui);
}

function spFinishItem(ui) {
  if (sp.ui !== ui) return;
  spCleanup();
  if (!ui.q.ok) sp.hard.push(ui.q);
  sp.i++;
  if (sp.i >= sp.qs.length) spResult();
  else spRenderQ(true);
}

function spResult() {
  sp.done = true;
  sp.ui = null;
  const n = sp.qs.length, s = sp.score;
  const pct = n ? s / n : 0;
  track('speaking_complete', { items: n, score_pct: Math.round(pct * 100), recognition: !!SpeechRec && !sp.srBroken });
  const card = el('div', 'qcard');
  card.appendChild(el('p', 'eyebrow kind', 'Résultat'));
  const head = el('div', 'result-head');
  const score = el('p', 'score', String(s));
  score.appendChild(el('small', null, ' / ' + n + ' казани'));
  head.append(score, el('p', 'grade', 'Note : ' + Math.round(pct * 20) + '/20'));
  card.appendChild(head);

  const msg = el('p', 'result-msg');
  const [fr, bg] = pct >= 0.9 ? ['Excellent !', 'Произношението ти е много ясно.']
    : pct >= 0.7 ? ['Très bien !', 'Много добре.']
    : pct >= 0.5 ? ['Pas mal.', 'Добре. Слушай примера с „Бавно“ и повтаряй.']
    : ['Courage !', 'Слушай примера с „Бавно“ и повтаряй след него.'];
  msg.append(el('i', null, fr), document.createTextNode(' ' + bg));
  card.appendChild(msg);

  if (sp.hard.length) {
    const box = el('div', 'mistakes');
    box.appendChild(el('h3', null, 'За упражнение'));
    const ul = el('ul');
    sp.hard.forEach(q => {
      const li = el('li');
      li.appendChild(el('span', 'm-prompt', (q.type === 'form' ? 'Форма' : 'Изречение') + ' · ' + TENSE[q.tense].label));
      li.appendChild(sayButton(q.text, 'sbtn'));
      if (q.best) {
        // the best attempt, with the words that were not understood in red
        const p = el('p', 'fb-line');
        p.appendChild(el('span', null, 'Най-добър опит:'));
        const w = el('span');
        q.best.exp.forEach((t, k) => {
          if (k) w.append(' ');
          w.appendChild(el('span', t.st === 'bad' ? 'dk-bad' : null, t.show));
          if (t.st === 'bad') w.appendChild(el('span', 'sr-only', ' (неразбрано)'));
        });
        p.appendChild(w);
        li.appendChild(p);
      }
      ul.appendChild(li);
    });
    box.appendChild(ul);
    card.appendChild(box);
  }

  const actions = el('div', 'actions');
  if (sp.hard.length) {
    const retry = el('button', 'btn', 'Пак трудните');
    retry.type = 'button';
    const again = sp.hard.slice();
    retry.addEventListener('click', () => { spStart(shuffle(again.slice())); spFocusCurrent(); });
    actions.appendChild(retry);
  }
  const fresh = el('button', 'btn primary', 'Нов кръг');
  fresh.type = 'button';
  fresh.addEventListener('click', () => { spStart(null); spFocusCurrent(); });
  actions.appendChild(fresh);
  card.appendChild(actions);

  spRoot.replaceChildren(card);
  spSum();
  if (sp.hard.length) {
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
  } else {
    fresh.focus({ preventScroll: true });
  }
  card.scrollIntoView({ block: 'nearest' });
}
function spFocusCurrent() {
  if (!sp.ui) return;
  (SpeechRec ? sp.ui.mic : sp.ui.playBtn).focus({ preventScroll: true });
  sp.ui.card.scrollIntoView({ block: 'nearest' });
}

/* stop the microphone and any playback when leaving the tab */
VIEWS.filter(v => v !== 'speak').forEach(v => $('tab-' + v).addEventListener('click', spRelease));
document.addEventListener('visibilitychange', () => { if (document.hidden) spRelease(); });

renderSpSettings();
spStart(null);
