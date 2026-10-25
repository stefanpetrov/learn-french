/* "Être или avoir?": which auxiliary a verb takes in passé composé, and how the participle
   is spelled. Renders into #aux (panel #game-aux).
   (A) "Être или avoir?": a verb and two buttons, être and avoir.
   (B) "Как се пише?": a named subject + the auxiliary + a blank, and four spellings.
   Uses helpers and data from app.js and data.js. */

const AX_COUNT = 10;
const AX_MODES = [['mix', 'Смесено'], ['aux', 'Être или avoir?'], ['pp', 'Как се пише?']];
const AX_VERBS = [['all', 'С нови глаголи'], ['lesson', 'Само от урока']];

/* common être verbs that are not in the lesson: [infinitive, Bulgarian, participle, what follows
   the participle in part B]. Only verbs that are always with être in this meaning (no monter,
   descendre, passer; rentrer and retourner here mean "come back", without an object). */
const AX_EXTRA = [
  ['arriver', 'пристигам', 'arrivé', 'à la gare'],
  ['rester', 'оставам', 'resté', 'à la maison'],
  ['rentrer', 'прибирам се', 'rentré', 'à minuit'],
  ['tomber', 'падам', 'tombé', 'de vélo'],
  ['entrer', 'влизам', 'entré', 'dans le café'],
  ['naître', 'раждам се', 'né', 'à Bruxelles'],
  ['mourir', 'умирам', 'mort', 'de rire'],
  ['retourner', 'връщам се', 'retourné', 'à Paris'],
  ['se promener', 'разхождам се', 'promené', 'dans le parc'],
  ['se reposer', 'почивам си', 'reposé', ''],
  ["s'amuser", 'забавлявам се', 'amusé', ''],
  ['se coucher', 'лягам си', 'couché', 'tard'],
  ['se lever', 'ставам', 'levé', 'tôt']
];

/* Lesson verbs in part B, with what follows the participle, so that the sentence sounds
   natural. Left out: s'appeler, devenir (its adjective agrees too), and verbs that sound
   odd without more words (savoir, plaire, permettre…). The objects all come after the
   verb, so with avoir nothing ever agrees. */
const AX_TAIL = new Map(Object.entries({
  'être': 'en retard', 'avoir': 'de la chance', 'aller': 'au cinéma', 'faire': 'du vélo',
  'jouer': 'au tennis', 'aimer': 'le film', 'adorer': 'le concert', 'détester': 'le match',
  'écouter': 'de la musique', 'regarder': 'un film', 'parler': 'au téléphone', 'habiter': 'à Bruxelles',
  'travailler': 'samedi', 'danser': '', 'chanter': '', 'voyager': 'en Italie',
  'finir': '', 'choisir': '', 'réfléchir': '', 'grandir': '', 'grossir': '', 'applaudir': '', 'ralentir': '',
  'se réunir': 'au café', 'partir': 'en vacances', 'sortir': 'hier soir', 'dormir': '', 'servir': 'le dîner',
  'vivre': 'à Paris', 'venir': 'à la fête', 'revenir': 'de vacances', 'se souvenir': 'de tout',
  'lire': 'un livre', 'écrire': 'une lettre', 'traduire': 'le texte', 'conduire': '',
  'construire': 'un château de sable', 'mettre': 'un pull', 'répondre': '', 'entendre': 'un bruit',
  'attendre': 'le bus', 'perdre': '', 'voir': 'la mer', 'prendre': 'le bus', 'apprendre': 'le français',
  'comprendre': '', 'boire': 'un café', 'recevoir': 'un cadeau'
}));
// one person does not "get together"
const AX_PLURAL_ONLY = new Set(['se réunir']);
// avoir verbs that look like the être ones: the rule says why they are not
const AX_MOVE_AVOIR = new Set(['voyager', 'conduire', 'atterrir']);
const AX_CHANGE_AVOIR = new Set(['grandir', 'grossir', 'vieillir', 'rougir', 'guérir']);

const AX_SUBJ = [
  { name: 'Marc', f: false, pl: false, bg: 'м. р.' },
  { name: 'Léa', f: true, pl: false, bg: 'ж. р.' },
  { name: 'Marc et Paul', f: false, pl: true, bg: 'м. р., мн. ч.' },
  { name: 'Léa et Chloé', f: true, pl: true, bg: 'ж. р., мн. ч.' },
  { name: 'Léa et Marc', f: false, pl: true, bg: 'смесено → м. р., мн. ч.' }
];

const savedAx = load('igri-aux-set', {}) || {};
const ax = {
  mode: AX_MODES.some(m => m[0] === savedAx.mode) ? savedAx.mode : 'mix',
  verbs: AX_VERBS.some(v => v[0] === savedAx.verbs) ? savedAx.verbs : 'all',
  // qs: the questions of the round (first tries); queue: what is asked, with the second tries
  qs: [], queue: [], i: 0, done: 0, score: 0, wrong: [], answered: false, retry: false, ui: null
};

/* ---------- verbs and questions ---------- */
function axVerbs() {
  const out = Object.keys(VERB).map(inf => ({
    inf, bg: promptMeaning(inf), aux: VERB[inf].aux, pp: VERB[inf].pp, extra: false,
    tail: AX_TAIL.has(inf) ? AX_TAIL.get(inf) : null, plOnly: AX_PLURAL_ONLY.has(inf)
  }));
  if (ax.verbs === 'all') {
    AX_EXTRA.forEach(([inf, bg, pp, tail]) => out.push({ inf, bg, aux: 'e', pp, extra: true, tail, plOnly: false }));
  }
  return out;
}

/* "je suis parti(e)", "j'ai joué": the example for part A */
function axExample(it) {
  if (!it.extra) return forms(it.inf, 'pc')[0];
  return { pron: isReflexive(it.inf) ? 'je ' + elide('me', 'suis') : 'je ', pre: 'suis ', red: it.pp + '(e)', post: '' };
}

/* participle, +e, +s, +es; a participle in -s takes no second s (pris, prise, prises) */
function axSpellings(pp) {
  return [...new Set([pp, pp + 'e', /s$/.test(pp) ? pp : pp + 's', pp + 'es'])];
}
/* with être the participle agrees with the subject */
function axAgree(pp, subj) {
  const w = subj.f ? pp + 'e' : pp;
  return subj.pl && !/s$/.test(w) ? w + 's' : w;
}

function axAuxQ(it) {
  return { type: 'aux', it, opts: ['être', 'avoir'], answer: it.aux === 'e' ? 0 : 1 };
}
function axPpQ(it, subj) {
  const opts = axSpellings(it.pp);
  const correct = it.aux === 'e' ? axAgree(it.pp, subj) : it.pp;
  const verb = it.aux === 'e' ? (subj.pl ? 'sont' : 'est') : (subj.pl ? 'ont' : 'a');
  const refl = isReflexive(it.inf) ? (subj.pl ? 'se ' : "s'") : '';
  return {
    type: 'pp', it, subj, opts, answer: opts.indexOf(correct), correct,
    before: subj.name + ' ' + refl + verb + ' ', after: (it.tail ? ' ' + it.tail : '') + '.'
  };
}

// half of k, an odd k rounds up or down at random
const axHalf = k => (k % 2 ? Math.floor(k / 2) + (Math.random() < 0.5 ? 1 : 0) : k / 2);

/* 10 questions: about half A and half B, and in both about half être and half avoir.
   The lesson has few être verbs, so the être ones come from the lesson and the extra list. */
function axBuild() {
  const nA = ax.mode === 'aux' ? AX_COUNT : ax.mode === 'pp' ? 0 : AX_COUNT / 2;
  const nB = AX_COUNT - nA;
  const eA = axHalf(nA);
  const eB = ax.mode === 'mix' ? AX_COUNT / 2 - eA : axHalf(nB);
  const verbs = shuffle(axVerbs());
  const used = new Set();
  // k verbs that pass ok(), each verb once in the round (again only if too few are left)
  const take = (k, ok) => {
    const out = [];
    [false, true].forEach(again => verbs.forEach(it => {
      if (out.length < k && ok(it) && !out.includes(it) && (again || !used.has(it.inf))) { used.add(it.inf); out.push(it); }
    }));
    return out;
  };
  // part B first: fewer verbs fit it
  const forB = take(eB, it => it.aux === 'e' && it.tail != null).concat(take(nB - eB, it => it.aux === 'a' && it.tail != null));
  const forA = take(eA, it => it.aux === 'e').concat(take(nA - eA, it => it.aux === 'a'));
  // every subject once before any comes back
  let deck = [];
  const subjFor = it => {
    const fits = s => !it.plOnly || s.pl;
    if (!deck.some(fits)) deck = shuffle(AX_SUBJ.slice());
    return deck.splice(deck.findIndex(fits), 1)[0];
  };
  return shuffle(forA.map(axAuxQ).concat(forB.map(it => axPpQ(it, subjFor(it)))));
}

/* ---------- rules for the feedback ---------- */
function axAuxRule(it) {
  if (it.aux === 'e') {
    if (isReflexive(it.inf)) return it.inf + ' е с être: всички възвратни глаголи са с être.';
    if (it.inf === 'rester') return 'rester е с être, като глаголите за движение и промяна (aller, venir, partir, arriver…).';
    return it.inf + ' е с être: глаголите за движение и промяна (aller, venir, partir, arriver…) и всички възвратни глаголи.';
  }
  let s = it.inf + ' е с avoir, като повечето глаголи.';
  if (AX_MOVE_AVOIR.has(it.inf)) s += ' С être са само някои глаголи за движение: aller, venir, partir, arriver…';
  else if (AX_CHANGE_AVOIR.has(it.inf)) s += ' С être са само някои глаголи за промяна: devenir, naître, mourir.';
  return s;
}
function axPpRule(q) {
  if (q.it.aux === 'e') return 'С être причастието се съгласува с подлога: ' + q.subj.name + ' (' + q.subj.bg + ') → ' + q.correct + '.';
  return 'С avoir причастието не се променя: ' + q.before + q.correct + '.';
}
function axSpeech(q) {
  return q.type === 'aux' ? formText(axExample(q.it)) : q.before + q.correct + q.after;
}
function axAnswerButton(q) {
  return q.type === 'aux' ? formButton(axExample(q.it)) : sentenceButton(q.before, q.correct, q.after);
}
function axNewTag() {
  const t = el('span', 'tag aux-new', 'нов');
  t.title = 'Не е от урока';
  t.lang = 'bg';
  return t;
}

/* ---------- page: settings, the game, the rules ---------- */
const axRoot = $('aux');
const axPlay = el('div');
axPlay.id = 'aux-play';

function axField(id, label, note) {
  const f = el('div', 'field');
  const l = el('span', 'field-label', label);
  l.id = 'lbl-' + id;
  const g = el('div', 'seg');
  g.id = id;
  g.setAttribute('role', 'group');
  g.setAttribute('aria-labelledby', l.id);
  f.append(l, g);
  if (note) f.appendChild(el('p', 'set-note', note));
  return f;
}
/* one choice out of items; the buttons stay, so focus stays on the one pressed */
function axChoice(group, items, get, set) {
  const btns = items.map(([id, label]) => toggleBtn(label, get() === id, () => {
    if (get() === id) return;
    set(id);
    btns.forEach((b, k) => b.setAttribute('aria-pressed', String(items[k][0] === id)));
    axSettingsChanged();
  }));
  $(group).replaceChildren(...btns);
}
function axSum() {
  const parts = ax.retry ? ['Грешките', questionsWord(ax.qs.length)]
    : [AX_MODES.find(m => m[0] === ax.mode)[1], questionsWord(AX_COUNT), ax.verbs === 'all' ? 'с нови глаголи' : 'само от урока'];
  $('aux-sum').textContent = parts.join(' · ');
}
function axSettingsChanged() {
  save('igri-aux-set', { mode: ax.mode, verbs: ax.verbs });
  axStart(null, false);
}

function axSetup() {
  const set = el('details', 'settings');
  const summary = el('summary');
  const sum = el('span', 'sum');
  sum.id = 'aux-sum';
  summary.append(el('span', null, 'Настройки'), sum);
  const body = el('div', 'settings-body');
  body.append(
    axField('aux-mode', 'Вид въпроси', 'Être или avoir?: избираш спомагателния глагол. Как се пише?: избираш как се пише причастието.'),
    axField('aux-verbs', 'Глаголи', '„нов“ е глагол с être, който не е от урока: arriver, rester, tomber…'),
    el('p', 'set-note', 'Всяка промяна започва нова игра.'));
  set.append(summary, body);

  const tip = el('p', 'tip');
  tip.append(el('b', null, 'Être или avoir? '),
    'С être са глаголите за движение и промяна (aller, venir, partir, arriver, rester…) и всички възвратни: je me suis levé. Останалите са с avoir: j\'ai joué. ',
    el('b', null, 'Как се пише? '),
    'С être причастието се съгласува с подлога: +e за женски род, +s за множествено число (Léa est partie, Léa et Chloé sont parties). Смесена група е като мъжки род: Léa et Marc sont partis. С avoir причастието не се променя: Léa a dansé. С клавиатура: 1–4 избира отговор.');
  axRoot.replaceChildren(set, axPlay, tip);

  axChoice('aux-mode', AX_MODES, () => ax.mode, v => { ax.mode = v; });
  axChoice('aux-verbs', AX_VERBS, () => ax.verbs, v => { ax.verbs = v; });
}

/* ---------- round ---------- */
function axStart(qs, focus) {
  stopAll();
  ax.retry = !!qs;
  ax.qs = qs || axBuild();
  ax.queue = ax.qs.map(q => ({ q, again: false }));
  ax.i = 0;
  ax.done = 0;
  ax.score = 0;
  ax.wrong = [];
  axSum();
  axRenderQ(focus);
}

function axRenderQ(focus) {
  const item = ax.queue[ax.i];
  const q = item.q;
  ax.answered = false;
  const card = el('div', 'qcard');
  card.tabIndex = -1;

  // a second try is not a new question: the count, the score and the bar stay
  const top = el('div', 'qtop');
  const scoreEl = el('span', null, 'Верни: ' + ax.score);
  top.append(el('span', null, 'Въпрос ' + (item.again ? ax.done : ax.done + 1) + ' от ' + ax.qs.length), scoreEl);
  const prog = el('div', 'progress');
  const bar = el('i');
  bar.style.width = (ax.done / ax.qs.length * 100) + '%';
  prog.appendChild(bar);
  card.append(top, prog);
  card.appendChild(el('p', 'eyebrow kind', item.again ? 'Още веднъж' : q.type === 'aux' ? 'Être или avoir?' : 'Как се пише?'));

  let say = null, blank = null;
  if (q.type === 'aux') {
    const head = el('div', 'qverb');
    say = sayButton(q.it.inf, 'say');
    const meaning = el('span', 'meaning', q.it.bg);
    if (q.it.extra) meaning.append(' ', axNewTag());
    head.append(say, meaning);
    card.append(head, el('p', 'bgline', 'С кой спомагателен глагол е в passé composé?'));
  } else {
    const p = el('p', 'sentence');
    p.lang = 'fr';
    blank = el('span', 'aux-blank', ' ');
    const gap = el('span', 'sr-only', 'празно място');
    gap.lang = 'bg';
    blank.appendChild(gap);
    p.append(q.before, blank, ' ', el('span', 'inf-hint', '(' + q.it.inf + ')'), q.after);
    if (q.it.extra) p.append(' ', axNewTag());
    card.append(p, el('p', 'bgline', q.subj.name + ': ' + q.subj.bg));
  }

  const opts = el('div', 'aux-opts' + (q.type === 'aux' ? ' aux-two' : ''));
  opts.setAttribute('role', 'group');
  opts.setAttribute('aria-label', q.type === 'aux' ? 'Спомагателен глагол' : 'Как се пише причастието');
  const btns = q.opts.map((o, k) => {
    const b = el('button', 'aux-opt', o);
    b.type = 'button';
    b.lang = 'fr';
    b.setAttribute('aria-keyshortcuts', String(k + 1));
    b.addEventListener('click', () => axAnswer(k));
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
  const main = el('button', 'btn primary', 'Напред');
  main.type = 'button';
  main.hidden = true;
  actions.append(skip, main);
  card.appendChild(actions);
  skip.addEventListener('click', () => axAnswer(null));
  main.addEventListener('click', axNext);

  ax.ui = { card, item, q, btns, blank, fb, skip, main, scoreEl, bar };
  axPlay.replaceChildren(card);
  if (focus) {
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: 'nearest' });
    if (say && gameShown('aux')) speak(q.it.inf, say);
  }
}

/* k: the option chosen, null for "Не знам" */
function axAnswer(k) {
  const ui = ax.ui;
  if (!ui || ax.answered) return;
  ax.answered = true;
  const { q, item } = ui;
  const gaveUp = k == null;
  const good = !gaveUp && k === q.answer;
  // only the first try counts; a wrong one comes back once, 3 questions later
  if (!item.again) {
    ax.done++;
    if (good) ax.score++;
    else {
      ax.wrong.push({ q, given: gaveUp ? '' : q.opts[k] });
      ax.queue.splice(Math.min(ax.i + 4, ax.queue.length), 0, { q, again: true });
    }
  }

  ui.btns.forEach((b, j) => {
    b.disabled = true;
    if (j === q.answer) b.classList.add('ok');
    else if (j === k) b.classList.add('bad');
  });
  if (ui.blank && !gaveUp) {
    ui.blank.textContent = q.opts[k];
    ui.blank.classList.add(good ? 'ok' : 'bad');
  }
  ui.skip.hidden = true;
  ui.main.hidden = false;
  ui.main.textContent = ax.i + 1 < ax.queue.length ? 'Напред' : 'Виж резултата';
  ui.scoreEl.textContent = 'Верни: ' + ax.score;
  ui.bar.style.width = (ax.done / ax.qs.length * 100) + '%';

  const verdict = good ? ['ok', item.again ? 'Браво, този път вярно.' : 'Правилно!']
    : gaveUp ? ['bad', 'Ето отговора:'] : ['bad', 'Грешно.'];
  const sayEl = axAnswerButton(q);
  const line = el('p', 'fb-line');
  line.appendChild(sayEl);
  if (q.type === 'aux' && q.it.aux === 'e') line.appendChild(el('span', null, '(e) се пише, ако го казва жена.'));
  ui.fb.replaceChildren(el('p', 'verdict ' + verdict[0], verdict[1]),
    el('p', 'fb-line aux-rule', q.type === 'aux' ? axAuxRule(q.it) : axPpRule(q)), line);
  ui.fb.hidden = false;
  ui.main.focus({ preventScroll: true });
  ui.fb.scrollIntoView({ block: 'nearest' });
  speak(axSpeech(q), sayEl);
}

function axNext() {
  if (!ax.answered) return;
  stopAll();
  ax.i++;
  if (ax.i >= ax.queue.length) axResult();
  else axRenderQ(true);
}

function axResult() {
  ax.ui = null;
  const n = ax.qs.length, s = ax.score;
  const pct = n ? s / n : 0;
  track('aux_complete', { questions: n, score_pct: Math.round(pct * 100) });
  const card = el('div', 'qcard');
  card.appendChild(el('p', 'eyebrow kind', 'Résultat'));

  const head = el('div', 'result-head');
  const score = el('p', 'score', String(s));
  score.appendChild(el('small', null, ' / ' + n + ' верни'));
  head.append(score, el('p', 'grade', 'Note : ' + Math.round(pct * 20) + '/20'));
  card.appendChild(head);

  const msg = el('p', 'result-msg');
  const [fr, bg] = pct >= 0.9 ? ['Excellent !', 'Отлично.']
    : pct >= 0.7 ? ['Très bien !', 'Много добре.']
    : pct >= 0.5 ? ['Pas mal.', 'Добре, още малко упражнения.']
    : ['Courage !', 'Прочети двете правила под играта и опитай пак.'];
  msg.append(el('i', null, fr), document.createTextNode(' ' + bg));
  card.appendChild(msg);

  if (ax.wrong.length) {
    const box = el('div', 'mistakes');
    box.appendChild(el('h3', null, 'Грешки'));
    const ul = el('ul');
    ax.wrong.forEach(({ q, given }) => {
      const li = el('li');
      li.appendChild(el('span', 'm-prompt', q.type === 'aux' ? 'Être или avoir? · ' + q.it.inf
        : q.before + '___ (' + q.it.inf + ')' + q.after));
      if (given) {
        const g = el('span', 'm-prompt');
        g.append('Твоят отговор: ', el('span', 'given', given));
        li.appendChild(g);
      }
      li.appendChild(axAnswerButton(q));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    card.appendChild(box);
  }

  const actions = el('div', 'actions');
  if (ax.wrong.length) {
    const retry = el('button', 'btn', 'Повтори грешните');
    retry.type = 'button';
    const again = ax.wrong.map(w => w.q);
    retry.addEventListener('click', () => axStart(shuffle(again.slice()), true));
    actions.appendChild(retry);
  }
  const fresh = el('button', 'btn primary', 'Нова игра');
  fresh.type = 'button';
  fresh.addEventListener('click', () => axStart(null, true));
  actions.appendChild(fresh);
  card.appendChild(actions);

  axPlay.replaceChildren(card);
  if (ax.wrong.length) {
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
  } else {
    fresh.focus({ preventScroll: true });
  }
  card.scrollIntoView({ block: 'nearest' });
}

/* 1–4 answer while the question has focus; Enter on the card goes on */
axPlay.addEventListener('keydown', e => {
  const ui = ax.ui;
  if (!ui || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const k = ['1', '2', '3', '4'].indexOf(e.key);
  if (k >= 0 && k < ui.btns.length && !ax.answered) {
    e.preventDefault();
    axAnswer(k);
  } else if (e.key === 'Enter' && ax.answered && e.target === ui.card) {
    e.preventDefault();
    axNext();
  }
});

/* no sound from this game while it is not on screen or the app is in the background
   (app.js stops it too; this only ever stops this game's own speech) */
const axFollow = () => { if (!gameShown('aux') && axPlay.querySelector('.speaking, .playing')) stopAll(); };
VIEWS.forEach(v => $('tab-' + v).addEventListener('click', axFollow));
document.addEventListener('gamechange', axFollow);
document.addEventListener('visibilitychange', () => { if (document.hidden && axPlay.querySelector('.speaking, .playing')) stopAll(); });

axSetup();
axStart(null, false);
