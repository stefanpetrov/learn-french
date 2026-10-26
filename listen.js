/* "Чуй и разбери": hear a form or a phrase without seeing it and pick what was heard.
   Renders into #listen (panel #game-listen).
   (A) "Кога е?": one verb form; the learner picks when it happens (passé composé, présent, futur proche).
   (B) "Кое чу?": one of two short phrases; the learner picks which one, or "Звучат еднакво".
   The text shows only after the answer. Uses helpers and data from app.js and data.js. */

const LS_COUNT = 10;
const LS_NORMAL = 0.92;
const LS_SLOW = 0.6;
const LS_AGAIN_AFTER = 3;   // a missed item comes back once, this many questions later
const LS_MODES = [['mix', 'Смесено'], ['when', 'Кога е?'], ['pair', 'Кое чу?']];
// (A) the three answers, in time order: [tense, Bulgarian, French]
const LS_TIMES = [['pc', 'Вчера', 'passé composé'], ['pr', 'Сега', 'présent'], ['fp', 'Утре', 'futur proche']];
const LS_SAME = 'Звучат еднакво';

/* (B) minimal pairs: [kind, phrase 1, phrase 2, why]. Each pair was checked by ear;
   pairs whose sound was not certain are left out.
   same:    the written -ent is silent: il joue = ils jouent (elle = elles before a consonant)
   liaison: before a vowel the s of ils / elles is heard as z: il aime ≠ ils aiment
   plural:  the plural has a sound of its own at the end, or is another word: il part ≠ ils partent
   ont:     ils ont (z) ≠ ils sont (s)
   jai:     j'ai „же“ ≠ je „жъ“: je fais ≠ j'ai fait */
// \u2011 is a hyphen that never breaks the line: „‑ent“ stays whole
const lsSame = (a, b) => ['same', a, b, '\u2011ent накрая не се чете, затова звучат еднакво. Разбираш по другите думи.'];
const lsLiaison = (a, b, sound) => ['liaison', a, b, 'При ' + b.split(' ')[0] + ' пред гласна s се чете като z: „' + sound + '“.'];
const lsEnd = (a, b, letter, sound) => ['plural', a, b, 'В ' + b + ' накрая се чува ' + letter + (sound ? ': „' + sound + '“' : '') + '.'];
const lsJai = (a, b, more) => ['jai', a, b, 'j\'ai звучи като „же“, je – като кратко „жъ“.' + (more ? ' ' + more : '')];
const LS_PAIRS = [
  lsSame('il joue', 'ils jouent'),
  lsSame('il danse', 'ils dansent'),
  lsSame('il chante', 'ils chantent'),
  lsSame('il parle', 'ils parlent'),
  lsSame('il regarde', 'ils regardent'),
  lsSame('il travaille', 'ils travaillent'),
  lsSame('il voit', 'ils voient'),
  lsSame('il croit', 'ils croient'),
  lsSame("il s'appelle", "ils s'appellent"),
  lsSame('elle déteste', 'elles détestent'),
  lsSame('elle préfère', 'elles préfèrent'),
  lsSame('elle voyage', 'elles voyagent'),

  lsLiaison('il aime', 'ils aiment', 'ил зем'),
  lsLiaison('il écoute', 'ils écoutent', 'ил зекут'),
  lsLiaison('il habite', 'ils habitent', 'ил забит'),
  lsLiaison('il adore', 'ils adorent', 'ил задор'),
  lsLiaison('elle aime', 'elles aiment', 'ел зем'),
  lsLiaison('elle écoute', 'elles écoutent', 'ел зекут'),

  lsEnd('il part', 'ils partent', 't', 'парт'),
  lsEnd('il sort', 'ils sortent', 't', 'сорт'),
  lsEnd('il met', 'ils mettent', 't', 'мет'),
  lsEnd('il dort', 'ils dorment', 'm', 'дорм'),
  lsEnd('il boit', 'ils boivent', 'v', 'буав'),
  lsEnd('il lit', 'ils lisent', 'z', 'лиз'),
  lsEnd('il finit', 'ils finissent', 's', 'финис'),
  lsEnd('il choisit', 'ils choisissent', 's', 'шуазис'),
  lsEnd('il répond', 'ils répondent', 'd'),
  ['plural', 'il prend', 'ils prennent', 'В ils prennent накрая се чува n, а il prend завършва през носа.'],
  ['plural', 'il vient', 'ils viennent', 'В ils viennent накрая се чува n, а il vient завършва през носа.'],
  ['plural', 'il va', 'ils vont', 'Формата е друга: il va е „ва“, а ils vont – „вон“, през носа.'],
  ['plural', 'il fait', 'ils font', 'Формата е друга: il fait е „фе“, а ils font – „фон“, през носа.'],

  ['ont', 'ils ont', 'ils sont', 'В ils ont се чува z (ont = имат), а в ils sont – s (sont = са).'],
  ['ont', 'elles ont', 'elles sont', 'В elles ont се чува z (ont = имат), а в elles sont – s (sont = са).'],

  lsJai('je fais', "j'ai fait"),
  lsJai('je finis', "j'ai fini"),
  lsJai('je choisis', "j'ai choisi"),
  lsJai('je traduis', "j'ai traduit"),
  lsJai('je construis', "j'ai construit"),
  lsJai('je joue', "j'ai joué", 'И joué завършва на „уе“, а joue – на „у“.')
];

const savedLs = load('igri-chuy', {}) || {};
const ls = {
  mode: LS_MODES.some(m => m[0] === savedLs.mode) ? savedLs.mode : 'mix',
  // qs: the questions of the round (first tries); queue: what is asked, with the second tries
  qs: [], queue: [], i: 0, done: 0, score: 0, wrong: [], answered: false, retry: false, ui: null
};
const lsRoot = $('listen');
const lsPlay = el('div');
lsPlay.id = 'ls-play';
const lsCoin = () => (Math.random() < 0.5 ? 0 : 1);
// never a sound while the game is not on screen
const lsCanSpeak = () => !!synth && gameShown('listen') && !document.hidden;

/* ---------- questions ---------- */
function lsWhen(inf, p, tense) {
  const form = forms(inf, tense)[p];
  return { type: 'when', inf, p, tense, form, text: formText(form), answer: LS_TIMES.findIndex(t => t[0] === tense) };
}
/* said: 0 or 1, the phrase the phone says; for a pair that sounds the same the answer is "Звучат еднакво" */
function lsPair(pair, said) {
  const [kind, a, b, why] = pair;
  return { type: 'pair', pair, kind, a, b, why, said, text: said ? b : a, answer: kind === 'same' ? 2 : said };
}
/* the same item once more. A pair is said again at random, so the answer has to be heard
   and cannot be remembered from the first time. */
function lsAgain(q) {
  return Object.assign(q.type === 'pair' ? lsPair(q.pair, lsCoin()) : Object.assign({}, q), { again: true });
}

function lsBuild() {
  const nA = ls.mode === 'when' ? LS_COUNT : ls.mode === 'pair' ? 0 : LS_COUNT / 2;
  const nB = LS_COUNT - nA;
  // (A) every verb at most once; the three tenses take turns, so there are about as many of each
  const infs = shuffle(Object.keys(VERB)).slice(0, nA);
  const turn = shuffle(TENSE_IDS.slice());
  const tenses = shuffle(infs.map((x, k) => turn[k % turn.length]));
  const qa = infs.map((inf, k) => lsWhen(inf, Math.floor(Math.random() * 6), tenses[k]));
  // (B) the kinds of pairs take turns, so a round has a bit of everything
  const kinds = shuffle([...new Set(LS_PAIRS.map(p => p[0]))]);
  const decks = {};
  const qb = [];
  for (let k = 0; k < nB; k++) {
    const kind = kinds[k % kinds.length];
    if (!decks[kind] || !decks[kind].length) decks[kind] = shuffle(LS_PAIRS.filter(p => p[0] === kind));
    qb.push(lsPair(decks[kind].pop(), lsCoin()));
  }
  return shuffle(qa.concat(qb));
}

function lsOptLabel(q, k) {
  return q.type === 'when' ? LS_TIMES[k][1] + ' · ' + LS_TIMES[k][2] : [q.a, q.b, LS_SAME][k];
}
/* why this tense: what can be heard */
function lsRule(q) {
  const ans = formAnswer(q.form);
  if (q.tense === 'pc') return 'Чуваш ' + (VERB[q.inf].aux === 'e' ? 'être' : 'avoir') + ' и минало причастие: ' + ans + '.';
  if (q.tense === 'fp') return 'Чуваш aller и инфинитив: ' + ans + '.';
  if (q.inf === 'aller') return 'Чуваш само ' + ans + ', без инфинитив след него.';
  if (q.inf === 'avoir' || q.inf === 'être') return 'Чуваш само ' + ans + ', без минало причастие след него.';
  return 'Чуваш само една глаголна форма, без avoir, être или aller пред нея: ' + ans + '.';
}
/* both phrases with ▶: what was said and the other one, or the two that sound the same
   (short: in the list of mistakes, where the line above already says they sound the same) */
function lsPairLines(q, short) {
  const a = sayButton(q.a, 'form'), b = sayButton(q.b, 'form');
  const line = (label, ...btns) => {
    const p = el('p', 'fb-line');
    if (label) p.appendChild(el('span', null, label));
    p.append(...btns);
    return p;
  };
  const heard = q.said ? b : a;
  if (q.kind === 'same') return { heard, lines: [line(short ? null : 'Звучат еднакво:', a, b)] };
  return { heard, lines: [line('Чу:', heard), line('Другото е:', q.said ? a : b)] };
}

/* ---------- page: settings, the game, the tip ---------- */
function lsSetup() {
  if (!synth) {
    const box = el('div', 'qcard');
    box.append(el('p', 'eyebrow kind', 'Чуй и разбери'),
      el('p', 'result-msg', 'Този браузър не може да чете на глас, а тази игра има нужда от глас. Отвори страницата в Chrome или Safari.'));
    lsRoot.replaceChildren(box);
    return false;
  }
  const set = el('details', 'settings');
  const summary = el('summary');
  const sum = el('span', 'sum');
  sum.id = 'ls-sum';
  summary.append(el('span', null, 'Настройки'), sum);
  const body = el('div', 'settings-body');
  const field = el('div', 'field');
  const label = el('span', 'field-label', 'Вид въпроси');
  label.id = 'lbl-ls-mode';
  const seg = el('div', 'seg');
  seg.id = 'ls-mode';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-labelledby', label.id);
  field.append(label, seg, el('p', 'set-note', 'Кога е?: чуваш една глаголна форма и избираш времето. Кое чу?: чуваш едното от две кратки изречения и избираш кое е, или „Звучат еднакво“.'));
  body.append(field, el('p', 'set-note', 'Всяка промяна започва нов кръг.'));
  set.append(summary, body);

  // the buttons stay, so the focus stays on the one pressed
  const btns = LS_MODES.map(([id, text]) => toggleBtn(text, ls.mode === id, () => {
    if (ls.mode === id) return;
    ls.mode = id;
    btns.forEach((b, k) => b.setAttribute('aria-pressed', String(LS_MODES[k][0] === id)));
    save('igri-chuy', { mode: ls.mode });
    lsStart(null, false);
  }));
  seg.replaceChildren(...btns);

  const tip = el('p', 'tip');
  tip.textContent = 'Някои форми не се различават на слух: il joue и ils jouent звучат еднакво, защото \u2011ent накрая не се чете. Това е нормално – и французите разбират кое е по другите думи в изречението. Слушай за това, което се чува: z след ils пред гласна (ils aiment), звук накрая (ils partent), „же“ в j\'ai (j\'ai fait). Текстът се показва чак след отговора. С клавиатура: 1–3 избира отговор.';
  lsRoot.replaceChildren(set, lsPlay, tip);
  return true;
}
function lsSum() {
  $('ls-sum').textContent = ls.retry ? 'Грешките · ' + questionsWord(ls.qs.length)
    : LS_MODES.find(m => m[0] === ls.mode)[1] + ' · ' + questionsWord(LS_COUNT);
}

/* ---------- round ---------- */
/* play: started by a tap (Нов кръг, Повтори грешните), so the first item is said at once */
function lsStart(list, play) {
  if (gameShown('listen')) stopAll();
  ls.retry = !!list;
  ls.qs = list || lsBuild();
  ls.queue = ls.qs.slice();
  ls.i = 0;
  ls.done = 0;
  ls.score = 0;
  ls.wrong = [];
  lsSum();
  lsRenderQ(play);
}

/* say the item; the first time the answers open. Returns whether it could be said. */
function lsListen(rate, btn) {
  const ui = ls.ui;
  if (!ui || !lsCanSpeak()) return false;
  if (!ui.heard) {
    ui.heard = true;
    // the big "Чуй" becomes "Чуй пак" (the same button, so the focus stays on it)
    ui.playBtn.className = 'btn dk-btn';
    ui.playBtn.innerHTML = PLAY;
    ui.playBtn.append(' Чуй пак');
    ui.slowBtn.hidden = false;
    if (!ls.answered) {
      ui.btns.forEach(b => { b.disabled = false; });
      ui.skip.disabled = false;
    }
  }
  speak(ui.q.text, btn || ui.playBtn, rate || LS_NORMAL);
  return true;
}

function lsRenderQ(play) {
  const q = ls.queue[ls.i];
  ls.answered = false;
  const card = el('div', 'qcard');
  card.tabIndex = -1;
  card.setAttribute('role', 'group');

  // a second try is not a new question: the count, the score and the bar stay
  const num = q.again ? ls.done : ls.done + 1;
  card.setAttribute('aria-label', 'Въпрос ' + num + ' от ' + ls.qs.length);
  const top = el('div', 'qtop');
  const scoreEl = el('span', null, 'Верни: ' + ls.score);
  top.append(el('span', null, 'Въпрос ' + num + ' от ' + ls.qs.length), scoreEl);
  const prog = el('div', 'progress');
  const bar = el('i');
  bar.style.width = (ls.done / ls.qs.length * 100) + '%';
  prog.appendChild(bar);
  card.append(top, prog,
    el('p', 'eyebrow kind', q.again ? 'Още веднъж' : q.type === 'when' ? 'Кога е?' : 'Кое чу?'),
    el('p', 'bgline', q.type === 'when' ? 'Чуй глагола и избери кога става.'
      : 'Кое от двете чу? Ако не се чува разлика, избери „' + LS_SAME + '“.'));

  const row = el('div', 'dk-play');
  const playBtn = el('button', 'btn primary dk-btn ls-big');
  playBtn.type = 'button';
  playBtn.innerHTML = PLAY;
  playBtn.append(' Чуй');
  const slowBtn = el('button', 'btn dk-btn');
  slowBtn.type = 'button';
  slowBtn.innerHTML = PLAY;
  slowBtn.append(' Бавно');
  slowBtn.hidden = true;
  row.append(playBtn, slowBtn);
  card.appendChild(row);

  const opts = el('div', 'ls-opts');
  opts.setAttribute('role', 'group');
  opts.setAttribute('aria-label', q.type === 'when' ? 'Кога става' : 'Какво чу');
  const labels = q.type === 'when' ? LS_TIMES.map(t => [t[1], t[2]]) : [[q.a], [q.b], [LS_SAME]];
  const btns = labels.map(([main, sub], k) => {
    const b = el('button', 'ls-opt');
    b.type = 'button';
    b.disabled = true;
    b.setAttribute('aria-keyshortcuts', String(k + 1));
    const m = el('span', null, main);
    if (q.type === 'pair' && k < 2) {
      m.lang = 'fr';
      b.classList.add('ls-fr');
    }
    b.appendChild(m);
    if (sub) {
      const s = el('span', 'ls-sub', sub);
      s.lang = 'fr';
      b.append(' ', s);
    }
    b.addEventListener('click', () => lsAnswer(k));
    opts.appendChild(b);
    return b;
  });
  card.appendChild(opts);

  const fb = el('div', 'feedback');
  fb.hidden = true;
  fb.setAttribute('aria-live', 'polite');
  card.appendChild(fb);

  const actions = el('div', 'actions');
  const skip = el('button', 'btn', 'Не знам');
  skip.type = 'button';
  skip.disabled = true;
  const main = el('button', 'btn primary', 'Напред');
  main.type = 'button';
  main.hidden = true;
  actions.append(skip, main);
  card.appendChild(actions);

  ls.ui = { card, q, btns, fb, skip, main, scoreEl, bar, playBtn, slowBtn, heard: false };
  playBtn.addEventListener('click', () => lsListen(LS_NORMAL, playBtn));
  slowBtn.addEventListener('click', () => lsListen(LS_SLOW, slowBtn));
  skip.addEventListener('click', () => lsAnswer(null));
  main.addEventListener('click', lsNext);

  lsPlay.replaceChildren(card);
  if (play) {
    // after a tap the phone may speak at once; otherwise the big "Чуй" waits for one
    (lsListen(LS_NORMAL, playBtn) ? card : playBtn).focus({ preventScroll: true });
    card.scrollIntoView({ block: 'nearest' });
  }
}

/* k: the answer chosen, null for "Не знам" */
function lsAnswer(k) {
  const ui = ls.ui;
  if (!ui || ls.answered || !ui.heard) return;
  ls.answered = true;
  const q = ui.q;
  const gaveUp = k == null;
  const good = !gaveUp && k === q.answer;
  // only the first try counts; a miss comes back once, 3 questions later
  if (!q.again) {
    ls.done++;
    if (good) ls.score++;
    else {
      ls.wrong.push({ q, given: gaveUp ? '' : lsOptLabel(q, k) });
      ls.queue.splice(Math.min(ls.i + 1 + LS_AGAIN_AFTER, ls.queue.length), 0, lsAgain(q));
    }
  }

  ui.btns.forEach((b, j) => {
    b.disabled = true;
    if (j === q.answer) b.classList.add('ok');
    else if (j === k) b.classList.add('bad');
  });
  ui.skip.hidden = true;
  ui.main.hidden = false;
  ui.main.textContent = ls.i + 1 < ls.queue.length ? 'Напред' : 'Виж резултата';
  ui.scoreEl.textContent = 'Верни: ' + ls.score;
  ui.bar.style.width = (ls.done / ls.qs.length * 100) + '%';

  const text = good ? (q.again ? 'Браво, този път вярно.' : 'Правилно!')
    : gaveUp ? 'Ето отговора:'
    : q.type === 'pair' && k === 2 ? 'Грешно. Тези две звучат различно.'
    : 'Грешно.';
  const parts = [el('p', 'verdict ' + (good ? 'ok' : 'bad'), text)];
  let target;
  if (q.type === 'when') {
    target = formButton(q.form);
    const line = el('p', 'fb-line');
    const tl = el('span', null, TENSE[q.tense].label);
    tl.lang = 'fr';
    line.append(target, tl);
    parts.push(line);
    if (!good) parts.push(el('p', 'fb-line ls-why', lsRule(q)));
    parts.push(el('p', 'fb-line', q.inf + ' – ' + promptMeaning(q.inf)));
  } else {
    const r = lsPairLines(q);
    target = r.heard;
    parts.push(...r.lines, el('p', 'fb-line ls-why', q.why));
  }
  ui.fb.replaceChildren(...parts);
  ui.fb.hidden = false;
  ui.main.focus({ preventScroll: true });
  ui.fb.scrollIntoView({ block: 'nearest' });
  if (lsCanSpeak()) speak(q.text, target);
}

function lsNext() {
  if (!ls.answered) return;
  stopAll();
  ls.i++;
  if (ls.i >= ls.queue.length) lsResult();
  else lsRenderQ(true);
}

function lsResult() {
  ls.ui = null;
  const n = ls.qs.length, s = ls.score;
  const pct = n ? s / n : 0;
  track('listen_complete', { questions: n, score_pct: Math.round(pct * 100) });
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
    : pct >= 0.5 ? ['Pas mal.', 'Добре, още малко слушане.']
    : ['Courage !', 'Слушай с „Бавно“ и опитай пак.'];
  msg.append(el('i', null, fr), document.createTextNode(' ' + bg));
  card.appendChild(msg);

  if (ls.wrong.length) {
    const box = el('div', 'mistakes');
    box.appendChild(el('h3', null, 'Грешки'));
    const ul = el('ul');
    ls.wrong.forEach(({ q, given }) => {
      const li = el('li');
      li.appendChild(el('span', 'm-prompt', q.type === 'when' ? 'Кога е? · ' + TENSE[q.tense].label
        : 'Кое чу? · ' + (q.kind === 'same' ? 'звучат еднакво' : 'звучат различно')));
      if (given) {
        const g = el('span', 'm-prompt');
        g.append('Твоят отговор: ', el('span', 'given', given));
        li.appendChild(g);
      }
      if (q.type === 'when') li.appendChild(formButton(q.form));
      else li.append(...lsPairLines(q, true).lines);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    card.appendChild(box);
  }

  const actions = el('div', 'actions');
  if (ls.wrong.length) {
    const retry = el('button', 'btn', 'Повтори грешните');
    retry.type = 'button';
    const again = ls.wrong.map(w => (w.q.type === 'pair' ? lsPair(w.q.pair, lsCoin()) : Object.assign({}, w.q)));
    retry.addEventListener('click', () => lsStart(shuffle(again.slice()), true));
    actions.appendChild(retry);
  }
  const fresh = el('button', 'btn primary', 'Нов кръг');
  fresh.type = 'button';
  fresh.addEventListener('click', () => lsStart(null, true));
  actions.appendChild(fresh);
  card.appendChild(actions);

  lsPlay.replaceChildren(card);
  lsSum();
  if (ls.wrong.length) {
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
  } else {
    fresh.focus({ preventScroll: true });
  }
  card.scrollIntoView({ block: 'nearest' });
}

/* 1–3 answer while the question has focus; Enter on the card goes on */
lsPlay.addEventListener('keydown', e => {
  const ui = ls.ui;
  if (!ui || e.altKey || e.ctrlKey || e.metaKey) return;
  // also the top-row digit keys by position (AZERTY types & é " without Shift)
  let k = ['1', '2', '3'].indexOf(e.key);
  if (k < 0) k = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
  if (k >= 0 && ui.heard && !ls.answered) {
    e.preventDefault();
    lsAnswer(k);
  } else if (e.key === 'Enter' && ls.answered && e.target === ui.card) {
    e.preventDefault();
    lsNext();
  }
});

/* no sound from this game once it is hidden or the app goes to the background.
   showView / showGame already stop everything; this only stops a sound of this game,
   never one another view has just started. */
const lsSpeaking = () => !!lsRoot.querySelector('.speaking, .playing');
const lsFollow = () => { if (!gameShown('listen') && lsSpeaking()) stopAll(); };
VIEWS.forEach(v => $('tab-' + v).addEventListener('click', lsFollow));
document.addEventListener('gamechange', lsFollow);
document.addEventListener('visibilitychange', () => { if (document.hidden && lsSpeaking()) stopAll(); });

if (lsSetup()) lsStart(null, false);
