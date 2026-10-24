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

const MIC = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>';
const REC = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>';

const savedSp = load('govor-set', {}) || {};
const sp = {
  kind: SP_KINDS.some(k => k[0] === savedSp.kind) ? savedSp.kind : 'mix',
  count: SP_COUNTS.includes(savedSp.count) ? savedSp.count : 10,
  tenses: validSet(savedSp.tenses, TENSE_IDS, ['pr']),
  groups: validSet(savedSp.groups, GROUP_IDS, GROUP_IDS),
  qs: [], i: 0, score: 0, hard: [], retry: false, done: false, ui: null,
  rec: null, recorder: null, recUrl: null
};
const spRoot = $('speak');

function saveSpSettings() {
  save('govor-set', { kind: sp.kind, count: sp.count, tenses: [...sp.tenses], groups: [...sp.groups] });
}

/* ---------- items ---------- */
function spItems() {
  return mixedRound(sp,
    (inf, p, t) => ({ type: 'form', inf, p, tense: t, text: spoken(formText(forms(inf, t)[p])), bg: VERB[inf].bg }),
    row => ({ type: 'sent', inf: row[1], tense: row[0], text: spoken(row[2].replace('___', row[3])), bg: row[4] }));
}

/* ---------- comparing what was heard ---------- */
/* A rough "sounds like" key, so spellings that sound the same count:
   il joue / ils jouent, allé / allée, parlez / parler, est / et. */
function soundKey(w) {
  let s = strip(w).replace(/[^a-z']/g, '');
  s = s.replace(/ph/g, 'f').replace(/eau/g, 'o').replace(/au/g, 'o').replace(/[ae]i/g, 'e')
    .replace(/y/g, 'i').replace(/qu/g, 'k').replace(/c(?=[aou])/g, 'k')
    .replace(/(^|')h/g, '$1').replace(/(.)\1+/g, '$1');
  const cut = s.replace(/(ent|er|ez|es|e|s|t|x|d|z|p)+$/, '');
  return cut || s.slice(0, 1);
}
const spTokens = text => norm(text).replace(DK_PUNCT, ' ').split(' ').filter(Boolean);

/* which expected words were heard, in order (extra words are ignored) */
function spMatch(expected, heard) {
  const exp = expected.split(/\s+/).filter(Boolean).map(show => ({ show, key: norm(show).replace(DK_PUNCT, '') }));
  const ek = exp.filter(t => t.key);
  const a = ek.map(t => soundKey(t.key));
  const b = spTokens(heard).map(soundKey);
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
  const ok = ek.filter(t => t.st === 'ok').length;
  return { exp, ok, total: ek.length, heard };
}
function spBest(q, alternatives) {
  return alternatives
    .map(h => spMatch(q.text, h))
    .sort((x, y) => y.ok - x.ok)[0] || spMatch(q.text, '');
}

/* ---------- microphone ---------- */
const SP_ERRORS = {
  'not-allowed': 'Няма достъп до микрофона. Разреши микрофона за този сайт от настройките на браузъра.',
  'service-not-allowed': 'Разпознаването на говор е изключено. На iPhone включи „Диктовка“ (Настройки → Общи → Клавиатура) и отвори страницата в Safari.',
  'no-speech': 'Не чух нищо. Натисни „Кажи“ и говори ясно, близо до телефона.',
  'audio-capture': 'Не намирам микрофон.',
  'network': 'Разпознаването на говор има нужда от интернет.',
  'language-not-supported': 'Браузърът не разпознава френски.'
};

function spStopListening() {
  if (sp.rec) { try { sp.rec.stop(); } catch (e) {} }
}
function spListen(ui) {
  if (sp.rec) { spStopListening(); return; }
  stopAll();
  spStopRecording();
  const rec = new SpeechRec();
  rec.lang = 'fr-FR';
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  let alts = [];
  let error = null;
  const timer = setTimeout(() => { try { rec.stop(); } catch (e) {} }, SP_LISTEN_MS);
  rec.onresult = e => {
    const results = [...e.results];
    const joined = results.map(r => r[0].transcript).join(' ').trim();
    ui.heard.textContent = joined ? 'Чух: ' + joined : '';
    ui.heard.hidden = !joined;
    // all alternatives when there is one result, else the joined best guess
    alts = results.length === 1 ? [...results[0]].map(a => a.transcript) : [joined];
  };
  rec.onerror = e => { error = e.error; };
  rec.onend = () => {
    clearTimeout(timer);
    sp.rec = null;
    spSetListening(ui, false);
    if (alts.length) spJudge(ui, alts);
    else if (error !== 'aborted') spMessage(ui, SP_ERRORS[error] || (error ? 'Нещо се обърка с разпознаването. Опитай пак.' : SP_ERRORS['no-speech']));
  };
  sp.rec = rec;
  spSetListening(ui, true);
  ui.heard.hidden = true;
  ui.fb.hidden = true;
  try { rec.start(); } catch (e) { sp.rec = null; spSetListening(ui, false); spMessage(ui, 'Нещо се обърка с разпознаването. Опитай пак.'); }
}
function spSetListening(ui, on) {
  ui.mic.classList.toggle('listening', on);
  ui.mic.querySelector('.lbl').textContent = on ? 'Слушам… чукни за край' : 'Кажи';
  ui.mic.setAttribute('aria-pressed', String(on));
}
function spMessage(ui, text) {
  ui.fb.replaceChildren(el('p', 'verdict bad', text));
  ui.fb.hidden = false;
}

/* record yourself and play it back */
function spStopRecording() {
  if (sp.recorder && sp.recorder.state === 'recording') sp.recorder.stop();
}
async function spRecord(ui) {
  if (sp.recorder && sp.recorder.state === 'recording') { spStopRecording(); return; }
  stopAll();
  spStopListening();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    spMessage(ui, SP_ERRORS['not-allowed']);
    return;
  }
  if (sp.ui !== ui) { stream.getTracks().forEach(t => t.stop()); return; }
  const chunks = [];
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const timer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, SP_RECORD_MS);
  recorder.onstop = () => {
    clearTimeout(timer);
    stream.getTracks().forEach(t => t.stop());
    sp.recorder = null;
    ui.recBtn.classList.remove('listening');
    ui.recBtn.querySelector('.lbl').textContent = 'Запиши се';
    if (!chunks.length || sp.ui !== ui) return;
    if (sp.recUrl) URL.revokeObjectURL(sp.recUrl);
    sp.recUrl = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    ui.mine.hidden = false;
    if (!SpeechRec) ui.self.hidden = false;
    spPlayMine();
  };
  sp.recorder = recorder;
  recorder.start();
  ui.recBtn.classList.add('listening');
  ui.recBtn.querySelector('.lbl').textContent = 'Записвам… чукни за край';
}
function spPlayMine() {
  if (!sp.recUrl) return;
  stopAll();
  const audio = new Audio(sp.recUrl);
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
function spCleanup() {
  spStopListening();
  spStopRecording();
  if (sp.recUrl) { URL.revokeObjectURL(sp.recUrl); sp.recUrl = null; }
}
function spStart(qs) {
  stopAll();
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
  const playBtn = el('button', 'btn dk-btn');
  playBtn.type = 'button';
  playBtn.innerHTML = PLAY;
  playBtn.append(' Чуй');
  const slowBtn = el('button', 'btn dk-btn');
  slowBtn.type = 'button';
  slowBtn.innerHTML = PLAY;
  slowBtn.append(' Бавно');
  model.append(playBtn, slowBtn);
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

  const heard = el('p', 'fb-line sp-heard');
  heard.hidden = true;
  heard.setAttribute('aria-live', 'polite');
  card.appendChild(heard);

  const fb = el('div', 'feedback');
  fb.hidden = true;
  fb.setAttribute('aria-live', 'polite');
  card.appendChild(fb);

  // without speech recognition the learner judges by ear
  const self = el('div', 'actions sp-self');
  self.appendChild(el('p', 'set-note', SpeechRec ? '' : 'Този браузър не разпознава говор. Запиши се, сравни с примера и прецени сам.'));
  const selfOk = el('button', 'btn primary', 'Звучи добре');
  selfOk.type = 'button';
  const selfAgain = el('button', 'btn', 'Още ще пробвам');
  selfAgain.type = 'button';
  self.append(selfAgain, selfOk);
  self.hidden = !!SpeechRec || canRecord;
  if (!SpeechRec && !canRecord) self.firstChild.textContent = 'Този браузър не разпознава говор. Повтори след примера на глас и прецени сам.';

  const actions = el('div', 'actions');
  const skip = el('button', 'btn', 'Пропусни');
  skip.type = 'button';
  const next = el('button', 'btn primary', sp.i + 1 < sp.qs.length ? 'Напред' : 'Виж резултата');
  next.type = 'button';
  next.hidden = true;
  actions.append(skip, next);
  card.append(self, actions);

  const ui = { q, card, mic, recBtn, mine, heard, fb, self, skip, next, scoreEl, bar };
  sp.ui = ui;
  playBtn.addEventListener('click', () => speak(q.text, playBtn));
  slowBtn.addEventListener('click', () => speak(q.text, slowBtn, SP_SLOW));
  mic.addEventListener('click', () => spListen(ui));
  recBtn.addEventListener('click', () => spRecord(ui));
  mine.addEventListener('click', spPlayMine);
  selfOk.addEventListener('click', () => spSelf(ui, true));
  selfAgain.addEventListener('click', () => spSelf(ui, false));
  skip.addEventListener('click', () => spFinishItem(ui));
  next.addEventListener('click', () => spFinishItem(ui));

  spRoot.replaceChildren(card);
  if (focus) {
    (SpeechRec ? mic : playBtn).focus({ preventScroll: true });
    card.scrollIntoView({ block: 'nearest' });
  }
}

function spJudge(ui, alternatives) {
  if (sp.ui !== ui) return;
  const q = ui.q;
  const r = spBest(q, alternatives);
  if (!q.best || r.ok > q.best.ok) q.best = r;
  const all = r.ok === r.total && r.total > 0;
  const words = el('p', 'dk-answer sp-words');
  r.exp.forEach((t, k) => {
    if (k) words.append(' ');
    words.appendChild(el('span', t.st === 'bad' ? 'dk-bad' : null, t.show));
  });
  const verdict = all ? ['ok', 'Чудесно! Разбрах всичко.']
    : r.ok / r.total >= 0.6 ? ['near', 'Почти! Червените думи не ги разбрах. Чуй ги и опитай пак.']
    : ['bad', 'Не те разбрах добре. Чуй примера бавно и опитай пак.'];
  ui.fb.replaceChildren(el('p', 'verdict ' + verdict[0], verdict[1]), words);
  ui.fb.hidden = false;
  if (all && !q.ok) {
    q.ok = true;
    sp.score++;
    ui.scoreEl.textContent = 'Казани: ' + sp.score;
  }
  ui.next.hidden = false;
  ui.skip.hidden = true;
  (all ? ui.next : ui.mic).focus({ preventScroll: true });
}

function spSelf(ui, ok) {
  const q = ui.q;
  if (ok && !q.ok) {
    q.ok = true;
    sp.score++;
    ui.scoreEl.textContent = 'Казани: ' + sp.score;
  }
  if (ok) spFinishItem(ui);
  else (canRecord ? ui.recBtn : ui.card.querySelector('.dk-btn')).focus({ preventScroll: true });
}

function spFinishItem(ui) {
  if (sp.ui !== ui) return;
  spCleanup();
  stopAll();
  if (!ui.q.ok) sp.hard.push(ui.q);
  ui.bar.style.width = ((sp.i + 1) / sp.qs.length * 100) + '%';
  sp.i++;
  if (sp.i >= sp.qs.length) spResult();
  else spRenderQ(true);
}

function spResult() {
  sp.done = true;
  sp.ui = null;
  const n = sp.qs.length, s = sp.score;
  const pct = n ? s / n : 0;
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
    : pct >= 0.5 ? ['Pas mal.', 'Добре, слушай бавно и повтаряй.']
    : ['Courage !', 'Слушай примера бавно и повтаряй след него.'];
  msg.append(el('i', null, fr), document.createTextNode(' ' + bg));
  card.appendChild(msg);

  if (sp.hard.length) {
    const box = el('div', 'mistakes');
    box.appendChild(el('h3', null, 'За упражнение'));
    const ul = el('ul');
    sp.hard.forEach(q => {
      const li = el('li');
      li.appendChild(el('span', 'm-prompt', (q.type === 'form' ? 'Форма' : 'Изречение') + ' · ' + TENSE[q.tense].label));
      const b = sayButton(q.text, 'sbtn');
      li.appendChild(b);
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
  (SpeechRec ? sp.ui.mic : sp.ui.card.querySelector('.dk-btn')).focus({ preventScroll: true });
  sp.ui.card.scrollIntoView({ block: 'nearest' });
}

/* stop the microphone when leaving the tab */
VIEWS.filter(v => v !== 'speak').forEach(v => $('tab-' + v).addEventListener('click', spCleanup));

renderSpSettings();
spStart(null);
