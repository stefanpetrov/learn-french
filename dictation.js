/* Dictation: the app says a verb form or a whole sentence, the learner writes it.
   Uses helpers and data from app.js and data.js. */

const DK_KINDS = [['mix', 'Смесено'], ['form', 'Форми'], ['sent', 'Изречения']];
const DK_COUNTS = [10, 20];
const DK_KEYS = ['é', 'è', 'ê', 'à', 'â', 'ç', 'î', 'û'];
const DK_SLOW = 0.6;
// il/ils forms often sound the same (il joue, ils jouent), so say which one is meant
const DK_PERSON = { 2: 'един човек (той или тя)', 5: 'няколко души (те)' };
const DK_PUNCT = /[.,!?;:«»"“”…]/g;

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
function dkSentPool() {
  return SENT.filter(r => dk.tenses.has(r[0]) && dk.groups.has(VERB[r[1]].g));
}
function dkFormQ(inf, p, tense) {
  return { type: 'form', inf, p, tense, text: formText(forms(inf, tense)[p]) };
}
function dkSentQ(row) {
  const [tense, inf, s, a, bg] = row;
  return { type: 'sent', inf, tense, text: s.replace('___', a), bg };
}
function dkBuild() {
  const formPool = [];
  Object.keys(VERB).forEach(inf => {
    if (!dk.groups.has(VERB[inf].g)) return;
    dk.tenses.forEach(t => { for (let p = 0; p < 6; p++) formPool.push([inf, p, t]); });
  });
  const sentPool = dkSentPool();
  shuffle(formPool);
  shuffle(sentPool);
  let nS = dk.kind === 'form' ? 0 : dk.kind === 'sent' ? dk.count : Math.round(dk.count / 2);
  nS = Math.min(nS, sentPool.length);
  const nF = dk.kind === 'sent' ? 0 : dk.count - nS;

  // one form per verb before any verb repeats
  const fq = [];
  const used = new Set();
  for (const [inf, p, t] of formPool) {
    if (fq.length >= nF) break;
    if (used.has(inf)) continue;
    used.add(inf);
    fq.push(dkFormQ(inf, p, t));
  }
  for (const [inf, p, t] of formPool) {
    if (fq.length >= nF) break;
    if (!fq.some(q => q.inf === inf && q.p === p && q.tense === t)) fq.push(dkFormQ(inf, p, t));
  }
  return shuffle(sentPool.slice(0, nS).map(dkSentQ).concat(fq));
}

/* ---------- comparing what was written ---------- */
/* Word by word, ignoring capitals and punctuation. Each expected word is
   ok, near (only accents differ) or bad (missing or misspelled); extra words count as mistakes. */
function dkCompare(expected, given) {
  const exp = expected.split(/\s+/).filter(Boolean).map(show => ({ show, key: norm(show).replace(DK_PUNCT, '') }));
  const ek = exp.filter(t => t.key);
  const g = norm(given).replace(DK_PUNCT, ' ').split(' ').filter(Boolean);
  const a = ek.map(t => strip(t.key));
  const b = g.map(w => strip(w));
  const n = a.length, m = b.length;
  // longest common subsequence, so one missing word does not mark the rest as wrong
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const usedG = new Array(m).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ek[i].st = ek[i].key === g[j] ? 'ok' : 'near';
      usedG[j] = true;
      i++; j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      ek[i].st = 'bad'; i++;
    } else {
      j++;
    }
  }
  for (; i < n; i++) ek[i].st = 'bad';
  const extra = g.filter((w, k) => !usedG[k]);
  return {
    exp,
    given: g.map((w, k) => ({ w, extra: !usedG[k] })),
    bad: ek.filter(t => t.st === 'bad').length + extra.length,
    near: ek.filter(t => t.st === 'near').length
  };
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
  r.exp.forEach((t, k) => {
    if (k) s.append(' ');
    s.appendChild(el('span', t.st ? 'dk-' + t.st : null, t.show));
  });
  b.appendChild(s);
  b.addEventListener('click', () => speak(said, b));
  return b;
}
function dkGivenLine(r) {
  const p = el('p', 'fb-line dk-given');
  p.appendChild(el('span', null, 'Ти написа:'));
  const s = el('span');
  r.given.forEach((t, k) => {
    if (k) s.append(' ');
    s.appendChild(el('span', t.extra ? 'dk-extra' : null, t.w));
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
  speak(spoken(q.text), btn || dk.ui.play, rate);
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
  top.append(el('span', null, 'Диктовка ' + (dk.i + 1) + ' от ' + dk.qs.length), scoreEl);
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
  input.placeholder = q.type === 'sent' ? 'Напиши изречението' : 'напр. je joue';
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
    : near ? ['near', 'Почти! Внимавай за знаците над буквите.']
    : gaveUp ? ['bad', 'Ето текста:'] : ['bad', r.bad === 1 ? 'Една грешка.' : 'Грешки: ' + r.bad + '.'];
  const answer = dkAnswerButton(q, r);
  const parts = [el('p', 'verdict ' + verdict[0], verdict[1]), answer];
  if (!exact && !gaveUp) parts.push(dkGivenLine(r));
  if (!exact && /\(/.test(q.text)) parts.push(el('p', 'fb-line', 'В скобите е окончанието за женски род или множествено число: allé, allée, allés.'));
  ui.fb.replaceChildren(...parts);
  ui.fb.hidden = false;
  ui.main.focus({ preventScroll: true });
  ui.fb.scrollIntoView({ block: 'nearest' });
  speak(spoken(q.text), answer);
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
    : ['Courage !', 'Слушай бавно и опитай пак.'];
  msg.append(el('i', null, fr), document.createTextNode(' ' + bg));
  card.appendChild(msg);

  if (dk.wrong.length) {
    const box = el('div', 'mistakes');
    box.appendChild(el('h3', null, 'Грешки'));
    const ul = el('ul');
    dk.wrong.forEach(({ q, given, r }) => {
      const li = el('li');
      li.appendChild(el('span', 'm-prompt', (q.type === 'form' ? 'Форма' : 'Изречение') + ' · ' + TENSE[q.tense].label));
      if (given) {
        const g = el('span', 'm-prompt');
        g.append(document.createTextNode('Ти написа: '), el('span', 'given', given));
        li.appendChild(g);
      }
      li.appendChild(dkAnswerButton(q, r));
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
  if (!dk.done && !dk.checked && dk.ui) dkPlay();
});

renderDkSettings();
dkStart(null, false);
