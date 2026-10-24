/* Dictation: the app says a verb form or a whole sentence, the learner writes it.
   Uses helpers and data from app.js and data.js. */

const DK_KINDS = [['mix', 'Смесено'], ['form', 'Форми'], ['sent', 'Изречения']];
const DK_COUNTS = [10, 20];
const DK_KEYS = ['é', 'è', 'ê', 'à', 'â', 'ç', 'î', 'û'];
const DK_NORMAL = 0.92;
const DK_SLOW = 0.6;
// il/ils forms often sound the same (il joue, ils jouent), so say which one is meant
const DK_PERSON = { 2: 'един човек (той)', 5: 'няколко души (те)' };
const DK_PUNCT = /[.,!?;:«»"“”…]/g;
// words that sound the same and the translation does not decide
const DK_SAME = { amies: 'amis', professeure: 'professeur', weekend: 'week-end' };
// numbers written with digits count as the word
const DK_NUM = { 2: 'deux', 3: 'trois', 6: 'six', 8: 'huit', 9: 'neuf', 10: 'dix', 20: 'vingt' };

const savedDk = load('diktovka-set', {}) || {};
const dk = {
  kind: DK_KINDS.some(k => k[0] === savedDk.kind) ? savedDk.kind : 'mix',
  count: DK_COUNTS.includes(savedDk.count) ? savedDk.count : 10,
  tenses: validSet(savedDk.tenses, TENSE_IDS, ['pr']),
  groups: validSet(savedDk.groups, GROUP_IDS, GROUP_IDS),
  qs: [], i: 0, score: 0, wrong: [], checked: false, retry: false, done: false, ui: null
};
const dkRoot = $('dict');

function saveDkSettings() {
  save('diktovka-set', { kind: dk.kind, count: dk.count, tenses: [...dk.tenses], groups: [...dk.groups] });
}

/* ---------- questions ---------- */
/* sentences for cfg = { tenses, groups } */
function sentPoolOf(cfg) {
  return SENT.filter(r => cfg.tenses.has(r[0]) && cfg.groups.has(VERB[r[1]].g));
}
/* a round of forms and sentences for cfg = { kind: mix | form | sent, count, tenses, groups } */
function mixedRound(cfg, formQ, sentQ) {
  const formPool = [];
  Object.keys(VERB).forEach(inf => {
    if (!cfg.groups.has(VERB[inf].g)) return;
    cfg.tenses.forEach(t => { for (let p = 0; p < 6; p++) formPool.push([inf, p, t]); });
  });
  const sentPool = sentPoolOf(cfg);
  shuffle(formPool);
  shuffle(sentPool);
  let nS = cfg.kind === 'form' ? 0 : cfg.kind === 'sent' ? cfg.count : Math.round(cfg.count / 2);
  nS = Math.min(nS, sentPool.length);
  const nF = cfg.kind === 'sent' ? 0 : cfg.count - nS;

  // one form per verb before any verb repeats
  const picked = [];
  const used = new Set();
  for (const f of formPool) {
    if (picked.length >= nF) break;
    if (used.has(f[0])) continue;
    used.add(f[0]);
    picked.push(f);
  }
  for (const f of formPool) {
    if (picked.length >= nF) break;
    if (!picked.includes(f)) picked.push(f);
  }
  return shuffle(sentPool.slice(0, nS).map(sentQ).concat(picked.map(([inf, p, t]) => formQ(inf, p, t))));
}
function dkSentPool() {
  return sentPoolOf(dk);
}
function dkBuild() {
  return mixedRound(dk,
    (inf, p, tense) => ({ type: 'form', inf, p, tense, text: formText(forms(inf, tense)[p]) }),
    ([tense, inf, s, a, bg]) => ({ type: 'sent', inf, tense, text: s.replace('___', a), bg }));
}

/* ---------- comparing what was written ---------- */
const dkSepless = w => w.replace(/['-]/g, '');
const dkSame = w => DK_SAME[w] || w;
// times written with digits: 8h, 8 h, 8h00, 8:00, but not "8 heures" (the h form is shown back)
const DK_TIME = /(\d+)\s*(?:h(?:\s*00)?(?![a-zà-ÿ])|:\s*00)(?!\d)/g;
// like norm(), but a space next to an apostrophe is kept: "j' ai" is joined later only
// when it makes an expected word, so "je 'appelle" stays two words
const dkNorm = t => t.normalize('NFC').toLowerCase().replace(/[’‘`´ʼ＇]/g, "'")
  .replace(/[\u2010-\u2013\u2212]/g, '-').replace(/\s+/g, ' ').replace(/ ' /g, "' ").trim();

/* Typed (or heard) text as words. raw: what was written, for showing it back;
   words: what is compared, with digits as number words (10 → dix, 8h → huit heures). */
function dkWords(text) {
  const raw = dkNorm(text).replace(DK_TIME, '$1h').replace(DK_PUNCT, ' ').split(' ').filter(w => w && !/^['-]+$/.test(w));
  const words = [];
  raw.forEach((r, ri) => {
    const t = r.match(/^(\d+)h$/);
    if (t) words.push({ key: DK_NUM[+t[1]] || t[1], raw: [ri] }, { key: 'heures', raw: [ri] });
    else if (/^\d+$/.test(r)) words.push({ key: DK_NUM[+r] || r, raw: [ri] });
    else words.push({ key: r, raw: [ri] });
  });
  return { raw, words };
}
/* "week end", "qu est ce", "j ai", "j ecoute": several written words that
   together are one expected word with a hyphen or apostrophe (accents ignored) */
function dkMergeSpaced(expKeys, words) {
  const targets = new Set(expKeys.filter(k => /['-]/.test(k)).map(k => strip(dkSepless(k))));
  if (!targets.size) return words;
  const out = [];
  for (let s = 0; s < words.length; s++) {
    let merged = null;
    for (let len = Math.min(4, words.length - s); len >= 2 && !merged; len--) {
      const part = words.slice(s, s + len);
      if (targets.has(part.map(w => strip(dkSepless(w.key))).join(''))) {
        const key = part.map(w => w.key).join('');
        // only a space next to a kept apostrophe ("j' ai") is not a slip; a missing hyphen or apostrophe is
        merged = { key, raw: [...new Set(part.flatMap(w => w.raw))], merged: !expKeys.includes(key), len };
      }
    }
    if (merged) { out.push(merged); s += merged.len - 1; }
    else out.push(words[s]);
  }
  return out;
}

/* Word by word, ignoring capitals and punctuation, as a word-level edit distance:
   each expected word is ok, near (only an accent, hyphen or apostrophe that does not
   change the word) or bad. A misspelled, missing or extra word is one mistake. */
function dkCompare(expected, given) {
  const exp = expected.split(/\s+/).filter(Boolean).map(show => ({ show, key: norm(show).replace(DK_PUNCT, '') }));
  const ek = exp.filter(t => t.key);
  const typed = dkWords(given);
  const words = dkMergeSpaced(ek.map(t => t.key), typed.words);
  const n = ek.length, m = words.length;
  // 0 = same, 1 = near, 2 = another word
  const kind = (e, w) => {
    const a = dkSame(e), b = dkSame(w.key);
    if (a === b) return w.merged ? 1 : 0;
    if (strip(dkSepless(a)) === strip(dkSepless(b))) return accentMatters(a, b) ? 2 : 1;
    return 2;
  };
  const COST = [0, 1, 100], GAP = 100;
  const K = ek.map(t => words.map(w => kind(t.key, w)));
  const D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n; i >= 0; i--) {
    for (let j = m; j >= 0; j--) {
      if (i === n) D[i][j] = (m - j) * GAP;
      else if (j === m) D[i][j] = (n - i) * GAP;
      else D[i][j] = Math.min(COST[K[i][j]] + D[i + 1][j + 1], GAP + D[i + 1][j], GAP + D[i][j + 1]);
    }
  }
  const wst = words.map(() => null);
  let bad = 0, i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && D[i][j] === COST[K[i][j]] + D[i + 1][j + 1]) {
      const k = K[i][j];
      ek[i].st = k === 0 ? 'ok' : k === 1 ? 'near' : 'bad';
      if (k === 2) { wst[j] = 'wrong'; bad++; }
      i++; j++;
    } else if (i < n && (j === m || D[i][j] === GAP + D[i + 1][j])) {
      ek[i].st = 'bad'; bad++; i++;
    } else {
      wst[j] = 'extra'; bad++; j++;
    }
  }
  // back to the words as they were written
  const shownBack = typed.raw.map((w, ri) => {
    const sts = words.map((x, k) => x.raw.includes(ri) ? wst[k] : undefined).filter(x => x !== undefined);
    const st = sts.includes('wrong') ? 'wrong' : sts.length && sts.every(x => x === 'extra') ? 'extra' : null;
    return { w, st };
  });
  return { exp, given: shownBack, bad, near: ek.filter(t => t.st === 'near').length };
}
/* the accepted spelling closest to what was written (allé / allée / allés …) */
function dkBest(q, given) {
  return variants(q.text)
    .map(v => dkCompare(v, given))
    .sort((x, y) => x.bad - y.bad || x.near - y.near)[0];
}

/* expected text with each word marked; tap to hear it */
function dkAnswerButton(q, r) {
  const b = el('button', 'sbtn dk-answer');
  b.type = 'button';
  const said = spoken(q.text);
  b.setAttribute('aria-label', 'Произнеси: ' + said);
  b.innerHTML = ICON;
  const s = el('span');
  // brackets never change the spaces, so the words of q.text line up with the variant's
  const shown = q.text.split(/\s+/).filter(Boolean);
  r.exp.forEach((t, k) => {
    if (k) s.append(' ');
    s.appendChild(el('span', t.st ? 'dk-' + t.st : null, shown[k] || t.show));
  });
  b.appendChild(s);
  b.addEventListener('click', () => speak(said, b, DK_NORMAL));
  return b;
}
function dkGivenLine(r) {
  const p = el('p', 'fb-line dk-given');
  p.appendChild(el('span', null, 'Ти написа:'));
  const s = el('span');
  r.given.forEach((t, k) => {
    if (k) s.append(' ');
    s.appendChild(el('span', t.st === 'extra' ? 'dk-extra' : t.st === 'wrong' ? 'dk-bad' : null, t.w));
  });
  p.appendChild(s);
  return p;
}

/* ---------- settings ---------- */
function renderDkSettings() {
  $('d-kind').replaceChildren(...DK_KINDS.map(([id, label]) => toggleBtn(label, dk.kind === id, () => { dk.kind = id; dkSettingsChanged(); })));
  $('d-tenses').replaceChildren(...setToggles(TENSE_ITEMS, dk.tenses, dkSettingsChanged));
  $('d-groups').replaceChildren(...setToggles(GROUP_ITEMS, dk.groups, dkSettingsChanged));
  $('d-count').replaceChildren(...DK_COUNTS.map(n => toggleBtn(String(n), dk.count === n, () => { dk.count = n; dkSettingsChanged(); })));
  dkSum();
}
function dkSum() {
  if (dk.retry) {
    $('d-sum').textContent = 'Грешките · ' + questionsWord(dk.qs.length);
    return;
  }
  const n = dk.kind === 'sent' ? Math.min(dk.count, dkSentPool().length) : dk.count;
  const parts = [DK_KINDS.find(k => k[0] === dk.kind)[1], questionsWord(n), tensesLabel(dk.tenses)];
  const gl = groupsLabel(dk.groups);
  if (gl) parts.push(gl);
  $('d-sum').textContent = parts.join(' · ');
}
function dkSettingsChanged() {
  saveDkSettings();
  renderDkSettings();
  dkStart(null, false);
}

/* ---------- round ---------- */
function dkStart(qs, play) {
  stopAll();
  dk.retry = !!qs;
  dk.qs = qs || dkBuild();
  dk.i = 0;
  dk.score = 0;
  dk.wrong = [];
  dk.done = false;
  dkSum();
  dkRenderQ(play);
}

function dkPlay(rate, btn) {
  const q = dk.qs[dk.i];
  if (!q || !dk.ui) return;
  speak(spoken(q.text), btn || dk.ui.play, rate || DK_NORMAL);
}

function dkRenderQ(play) {
  if (!synth) {
    const box = el('div', 'qcard');
    box.append(el('p', 'eyebrow kind', 'Диктовка'),
      el('p', 'result-msg', 'Диктовката има нужда от глас, а този браузър не може да чете на глас. Отвори страницата в Chrome или Safari.'));
    dkRoot.replaceChildren(box);
    return;
  }
  const q = dk.qs[dk.i];
  dk.checked = false;
  const card = el('div', 'qcard');

  const top = el('div', 'qtop');
  const scoreEl = el('span', null, 'Верни: ' + dk.score);
  top.append(el('span', null, 'Въпрос ' + (dk.i + 1) + ' от ' + dk.qs.length), scoreEl);
  const prog = el('div', 'progress');
  const bar = el('i');
  bar.style.width = (dk.i / dk.qs.length * 100) + '%';
  prog.appendChild(bar);
  card.append(top, prog);

  card.appendChild(el('p', 'eyebrow kind', (q.type === 'form' ? 'Чуй формата' : 'Чуй изречението') + ' · ' + TENSE[q.tense].label));

  const playRow = el('div', 'dk-play');
  const playBtn = el('button', 'btn primary dk-btn');
  playBtn.type = 'button';
  playBtn.innerHTML = PLAY;
  playBtn.append(' Чуй');
  const slowBtn = el('button', 'btn dk-btn');
  slowBtn.type = 'button';
  slowBtn.innerHTML = PLAY;
  slowBtn.append(' Бавно');
  playRow.append(playBtn, slowBtn);
  card.appendChild(playRow);

  if (q.type === 'form') {
    if (DK_PERSON[q.p]) card.appendChild(el('p', 'bgline', 'Подсказка: ' + DK_PERSON[q.p]));
  } else {
    card.appendChild(el('p', 'bgline', q.bg));
  }

  const input = el(q.type === 'sent' ? 'textarea' : 'input', 'ans dk-ans');
  input.id = 'dk-answer';
  if (q.type === 'sent') input.rows = 2;
  else input.type = 'text';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocapitalize', 'none');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('enterkeyhint', 'go');
  input.setAttribute('lang', 'fr');
  input.setAttribute('aria-label', q.type === 'sent' ? 'Напиши изречението, което чу' : 'Напиши формата, която чу, с местоимението');
  input.placeholder = 'Напиши каквото чуваш';
  if (q.type === 'sent') {
    // grow with the text, so a long sentence is never cut off
    const grow = () => { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; };
    input.addEventListener('input', grow);
    requestAnimationFrame(grow);
  }
  card.appendChild(input);

  const keys = el('div', 'keys');
  keys.setAttribute('aria-label', 'Букви със знаци');
  DK_KEYS.forEach(k => {
    const b = el('button', null, k);
    b.type = 'button';
    b.setAttribute('aria-label', 'Въведи ' + k);
    b.addEventListener('pointerdown', e => e.preventDefault());
    b.addEventListener('click', () => insertChar(input, k));
    keys.appendChild(b);
  });
  card.appendChild(keys);

  const fb = el('div', 'feedback');
  fb.hidden = true;
  fb.setAttribute('aria-live', 'polite');
  card.appendChild(fb);

  const actions = el('div', 'actions');
  const skip = el('button', 'btn', 'Не знам');
  skip.type = 'button';
  const main = el('button', 'btn primary', 'Провери');
  main.type = 'button';
  actions.append(skip, main);
  card.appendChild(actions);

  const ui = { q, input, fb, skip, main, keys, scoreEl, bar, play: playBtn };
  dk.ui = ui;
  playBtn.addEventListener('click', () => dkPlay(null, playBtn));
  slowBtn.addEventListener('click', () => dkPlay(DK_SLOW, slowBtn));
  main.addEventListener('click', () => dk.checked ? dkNext() : dkCheck(ui, false));
  skip.addEventListener('click', () => dkCheck(ui, true));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      dk.checked ? dkNext() : dkCheck(ui, false);
    }
  });

  dkRoot.replaceChildren(card);
  if (play) {
    input.focus({ preventScroll: true });
    card.scrollIntoView({ block: 'nearest' });
    dkPlay();
  }
}

function dkCheck(ui, gaveUp) {
  if (dk.checked) return;
  const q = ui.q;
  const val = gaveUp ? '' : ui.input.value;
  if (!gaveUp && !val.trim()) { ui.input.focus(); return; }

  const r = dkBest(q, val);
  const exact = !gaveUp && r.bad === 0 && r.near === 0;
  const near = !gaveUp && r.bad === 0 && !exact;
  if (exact || near) dk.score++;
  else dk.wrong.push({ q, given: val.trim(), r });
  dk.checked = true;

  ui.input.readOnly = true;
  ui.input.classList.add(exact ? 'ok' : near ? 'near' : 'bad');
  ui.keys.hidden = true;
  ui.skip.hidden = true;
  ui.main.textContent = dk.i + 1 < dk.qs.length ? 'Напред' : 'Виж резултата';
  ui.scoreEl.textContent = 'Верни: ' + dk.score;
  ui.bar.style.width = ((dk.i + 1) / dk.qs.length * 100) + '%';

  const verdict = exact ? ['ok', 'Правилно!']
    : near ? ['near', 'Почти! Внимавай за знаците над буквите, тиретата и апострофите.']
    : gaveUp ? ['bad', 'Ето текста:'] : ['bad', r.bad === 1 ? 'Една грешка.' : r.bad + ' грешки.'];
  const answer = dkAnswerButton(q, gaveUp ? { exp: r.exp.map(t => ({ show: t.show })) } : r);
  const parts = [el('p', 'verdict ' + verdict[0], verdict[1]), answer];
  if (!exact && !gaveUp) parts.push(dkGivenLine(r));
  if (r.bad && r.near && !gaveUp) parts.push(el('p', 'fb-line', 'Вълнообразно подчертаното се зачита: липсва само знак над буквата, тире или апостроф.'));
  const bracketed = q.text.split(/\s+/).find(x => x.includes('('));
  if (!exact && bracketed) {
    parts.push(el('p', 'fb-line', 'Окончанието в скобите зависи от рода и числото. Тук са верни: ' + variants(bracketed.replace(DK_PUNCT, '')).join(', ') + '.'));
  }
  if (gaveUp) ui.input.placeholder = '';
  ui.fb.replaceChildren(...parts);
  ui.fb.hidden = false;
  ui.main.focus({ preventScroll: true });
  ui.fb.scrollIntoView({ block: 'nearest' });
  speak(spoken(q.text), answer, DK_NORMAL);
}

function dkNext() {
  stopAll();
  dk.i++;
  if (dk.i >= dk.qs.length) dkResult();
  else dkRenderQ(true);
}

function dkResult() {
  dk.done = true;
  dk.ui = null;
  const n = dk.qs.length, s = dk.score;
  const pct = n ? s / n : 0;
  const card = el('div', 'qcard');
  card.appendChild(el('p', 'eyebrow kind', 'Résultat'));
  const head = el('div', 'result-head');
  const score = el('p', 'score', String(s));
  score.appendChild(el('small', null, ' / ' + n + ' верни'));
  head.append(score, el('p', 'grade', 'Note : ' + Math.round(pct * 20) + '/20'));
  card.appendChild(head);

  const msg = el('p', 'result-msg');
  const [fr, bg] = pct >= 0.9 ? ['Excellent !', 'Отличен слух.']
    : pct >= 0.7 ? ['Très bien !', 'Много добре.']
    : pct >= 0.5 ? ['Pas mal.', 'Добре, още малко упражнения.']
    : ['Courage !', 'Слушай с бутона „Бавно“ и опитай пак.'];
  msg.append(el('i', null, fr), document.createTextNode(' ' + bg));
  card.appendChild(msg);

  if (dk.wrong.length) {
    const box = el('div', 'mistakes');
    box.appendChild(el('h3', null, 'Грешки'));
    const ul = el('ul');
    dk.wrong.forEach(({ q, given, r }) => {
      const li = el('li');
      li.appendChild(el('span', 'm-prompt', (q.type === 'form' ? 'Форма' : 'Изречение') + ' · ' + TENSE[q.tense].label));
      li.appendChild(dkAnswerButton(q, given ? r : { exp: r.exp.map(t => ({ show: t.show })) }));
      if (given) li.appendChild(dkGivenLine(r));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    card.appendChild(box);
  }

  const actions = el('div', 'actions');
  if (dk.wrong.length) {
    const retry = el('button', 'btn', 'Повтори грешните');
    retry.type = 'button';
    const again = dk.wrong.map(w => w.q);
    retry.addEventListener('click', () => dkStart(shuffle(again.slice()), true));
    actions.appendChild(retry);
  }
  const fresh = el('button', 'btn primary', 'Нова диктовка');
  fresh.type = 'button';
  fresh.addEventListener('click', () => dkStart(null, true));
  actions.appendChild(fresh);
  card.appendChild(actions);

  dkRoot.replaceChildren(card);
  dkSum();
  if (dk.wrong.length) {
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
  } else {
    fresh.focus({ preventScroll: true });
  }
  card.scrollIntoView({ block: 'nearest' });
}

/* opening the tab plays the current item; the tab click lets the browser speak */
$('tab-dictation').addEventListener('click', () => {
  if (dk.done || dk.checked || !dk.ui) return;
  dk.ui.input.focus({ preventScroll: true });
  dkRoot.scrollIntoView({ block: 'start' });
  dkPlay();
});

renderDkSettings();
dkStart(null, false);
