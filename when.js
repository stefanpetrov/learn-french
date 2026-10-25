/* "Кога?": a time word (hier, en ce moment, demain…) + person + verb; the learner picks the tense
   and types the form. Renders into #when (panel #game-when). */

/* Time words that decide the tense on their own: [French, tense, Bulgarian, for présent: now | habit].
   Words that fit more than one tense (aujourd'hui, maintenant, ce soir, ce matin, ce week-end, cet été,
   bientôt) are left out on purpose. */
const WN_TIME = [
  ['hier', 'pc', 'вчера'],
  ['hier soir', 'pc', 'снощи'],
  ['avant-hier', 'pc', 'онзи ден'],
  ['lundi dernier', 'pc', 'миналия понеделник'],
  ['mercredi dernier', 'pc', 'миналата сряда'],
  ['vendredi dernier', 'pc', 'миналия петък'],
  ['samedi dernier', 'pc', 'миналата събота'],
  ['dimanche dernier', 'pc', 'миналата неделя'],
  ['le week-end dernier', 'pc', 'миналия уикенд'],
  ['la semaine dernière', 'pc', 'миналата седмица'],
  ['le mois dernier', 'pc', 'миналия месец'],
  ["l'été dernier", 'pc', 'миналото лято'],
  ["l'année dernière", 'pc', 'миналата година'],
  ['il y a deux jours', 'pc', 'преди два дни'],
  ['il y a une semaine', 'pc', 'преди седмица'],

  ['en ce moment', 'pr', 'в момента', 'now'],
  ["d'habitude", 'pr', 'обикновено', 'habit'],
  ['tous les jours', 'pr', 'всеки ден', 'habit'],
  ['le samedi', 'pr', 'в събота (всяка)', 'habit'],
  ['le dimanche', 'pr', 'в неделя (всяка)', 'habit'],
  ['souvent', 'pr', 'често', 'habit'],
  ['chaque semaine', 'pr', 'всяка седмица', 'habit'],
  ['le soir', 'pr', 'вечер (всяка)', 'habit'],

  ['demain', 'fp', 'утре'],
  ['demain soir', 'fp', 'утре вечер'],
  ['après-demain', 'fp', 'вдругиден'],
  ['lundi prochain', 'fp', 'следващия понеделник'],
  ['vendredi prochain', 'fp', 'следващия петък'],
  ['samedi prochain', 'fp', 'следващата събота'],
  ['le week-end prochain', 'fp', 'следващия уикенд'],
  ['la semaine prochaine', 'fp', 'следващата седмица'],
  ['le mois prochain', 'fp', 'следващия месец'],
  ["l'été prochain", 'fp', 'следващото лято'],
  ["l'année prochaine", 'fp', 'догодина'],
  ['dans deux jours', 'fp', 'след два дни']
];
// with a time word s'appeler stops meaning "казвам се" ("Hier, je me suis appelé…")
const WN_SKIP = new Set(["s'appeler"]);
const WN_COUNTS = [10, 20];
const WN_AGAIN_AFTER = 3;   // a missed item comes back once, this many questions later

const savedWn = load('igri-koga', {}) || {};
const wn = {
  groups: validSet(savedWn.groups, GROUP_IDS, GROUP_IDS),
  count: WN_COUNTS.includes(savedWn.count) ? savedWn.count : 10,
  qs: [], i: 0, n: 0, done: 0, score: 0, wrong: [], checked: false, retry: false
};
const wnRoot = $('when');
const wnCap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- questions ---------- */
function wnPool() {
  return Object.keys(VERB).filter(inf => wn.groups.has(VERB[inf].g) && !WN_SKIP.has(inf));
}
// one verb at most once per round, so a few small groups give a shorter round
const wnSize = () => Math.min(wn.count, wnPool().length);

function wnQ(inf, p, tense, tw) {
  const f = forms(inf, tense)[p];
  return { inf, p, tense, tw, form: f, answer: formAnswer(f), say: wnCap(tw[0]) + ', ' + formText(f) };
}
function wnBuild() {
  const infs = shuffle(wnPool()).slice(0, wn.count);
  // the three tenses take turns, so a round holds about as many of each
  const turn = shuffle(TENSE_IDS.slice());
  const tenses = shuffle(infs.map((x, k) => turn[k % turn.length]));
  const decks = {};
  return infs.map((inf, k) => {
    const t = tenses[k];
    if (!decks[t] || !decks[t].length) decks[t] = shuffle(WN_TIME.filter(w => w[1] === t));
    return wnQ(inf, Math.floor(Math.random() * 6), t, decks[t].pop());
  });
}

/* The screen shows only the subject (je, tu, il…), the same in every tense: "j'" or a
   reflexive "je me" in front of the gap would give the tense away. So the answer is the
   form without the subject: ai joué, me suis réuni(e), vais jouer. */
// "je / j'" for je in every tense, so the screen never reads "je ai joué" and still hides the tense
const wnSubj = p => (p === 0 ? "je / j'" : SUBJ[p]);
function wnVerbPart(f, p) {
  const full = formText(f), s = SUBJ[p];
  if (full.startsWith(s + ' ')) return full.slice(s.length + 1);
  if (s === 'je' && full.startsWith("j'")) return full.slice(2);
  return formAnswer(f);
}
// accepted spellings of a form; loose also takes the Test's verb part (without "me")
function wnCands(f, p, loose) {
  const base = [wnVerbPart(f, p), formText(f)];
  if (loose) base.push(formAnswer(f));
  return base.concat(...base.map(variants));
}
function wnMatch(cands, val) {
  if (cands.some(c => norm(c) === norm(val))) return 'exact';
  if (cands.some(c => nearMatch(c, val))) return 'near';
  return null;
}
// why this tense: the time word decides
function wnRule(q) {
  const w = '„' + wnCap(q.tw[0]) + '“';
  if (q.tense === 'pc') return w + ' е минало, затова трябва passé composé.';
  if (q.tense === 'fp') return w + ' е бъдеще: futur proche.';
  return w + (q.tw[3] === 'habit' ? ' е навик: présent.' : ' е сега: présent.');
}

/* { verdict: ok | near | bad, kind, why? } */
function wnJudge(q, val) {
  const m = wnMatch(wnCands(q.form, q.p), val);
  if (m === 'exact') return { verdict: 'ok', kind: 'exact' };
  if (m === 'near') return { verdict: 'near', kind: 'accent' };
  // the same person in another tense
  // "je ai joué" for "j'ai joué": the right form, but je must become j' before a vowel
  if (q.p === 0 && formText(q.form).startsWith("j'") && /^\s*je\s+/i.test(val)
      && wnMatch(wnCands(q.form, 0), "j'" + val.replace(/^\s*je\s+/i, ''))) return { verdict: 'bad', kind: 'elision' };
  const other = TENSE_IDS.find(t => t !== q.tense && wnMatch(wnCands(forms(q.inf, t)[q.p], q.p, true), val));
  // présent for the future is fine French, but only when it is complete (with me / te / se)
  if (other === 'pr' && q.tense === 'fp' && wnMatch(wnCands(forms(q.inf, 'pr')[q.p], q.p), val)) return { verdict: 'near', kind: 'fp-pr' };
  if (other) return { verdict: 'bad', kind: 'tense' };
  // a reflexive verb without its me / te / se
  if (isReflexive(q.inf)) {
    const bare = q.tense === 'fp' ? ALLER[q.p] + ' ' + bareInf(q.inf) : q.answer;
    if (wnMatch(variants(bare), val)) return { verdict: 'bad', kind: 'refl' };
  }
  if (typeof explainMistake === 'function') {
    // the rule checker expects the Test's verb part, which has no leading me / te / se
    const given = isReflexive(q.inf) && q.tense !== 'fp' ? val.trim().replace(/^(?:(?:me|te|se|nous|vous)\s+|[mts]['’]\s*)/i, '') : val;
    try {
      const x = explainMistake({ inf: q.inf, tense: q.tense, p: q.p, answer: q.answer }, given);
      if (x && x.text) return { verdict: 'bad', kind: 'why', why: x.text };
    } catch (e) {}
  }
  return { verdict: 'bad', kind: 'wrong' };
}

/* ---------- layout and settings ---------- */
function wnField(id, label) {
  const f = el('div', 'field');
  const l = el('span', 'field-label', label);
  l.id = 'lbl-' + id;
  const seg = el('div', 'seg');
  seg.id = id;
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-labelledby', l.id);
  f.append(l, seg);
  return [f, seg];
}
const wnEls = (() => {
  const set = el('details', 'settings');
  const summary = el('summary');
  const sum = el('span', 'sum');
  sum.id = 'wn-sum';
  summary.append(el('span', null, 'Настройки'), sum);
  const body = el('div', 'settings-body');
  const [gField, groups] = wnField('wn-groups', 'Групи глаголи');
  const [cField, count] = wnField('wn-count', 'Брой въпроси');
  const short = el('p', 'set-note');
  short.hidden = true;
  cField.appendChild(short);
  body.append(gField, cField, el('p', 'set-note', 'Времената са смесени. Всяка промяна започва нов кръг.'));
  set.append(summary, body);

  const quiz = el('div');
  const tip = el('p', 'tip');
  ['Минало (hier, samedi dernier) → passé composé: j\'ai joué.',
    'Сега и навик (en ce moment, d\'habitude, le samedi) → présent: je joue.',
    'Бъдеще (demain, samedi prochain) → futur proche: je vais jouer.',
    'Пиши глагола без je, tu, il… (ai joué). При възвратните пиши и me, te, se: me suis réuni.'
  ].forEach((t, k) => { if (k) tip.appendChild(el('br')); tip.append(t); });
  wnRoot.replaceChildren(set, quiz, tip);
  return { groups, count, short, sum, quiz };
})();

function wnSum() {
  wnEls.sum.textContent = wn.retry ? 'Грешките · ' + questionsWord(wn.n)
    : [questionsWord(wnSize()), groupsLabel(wn.groups)].filter(Boolean).join(' · ');
}
function wnRenderSettings() {
  wnEls.groups.replaceChildren(...setToggles(GROUP_ITEMS, wn.groups, wnSettingsChanged));
  wnEls.count.replaceChildren(...WN_COUNTS.map(n => toggleBtn(String(n), wn.count === n, () => {
    if (wn.count !== n) { wn.count = n; wnSettingsChanged(); }
  })));
  const verbs = wnPool().length;
  wnEls.short.hidden = verbs >= wn.count;
  wnEls.short.textContent = 'С тези групи има ' + verbs + ' глагола, а всеки глагол е най-много веднъж в кръга.';
  wnSum();
}
function wnSettingsChanged() {
  // the toggles are drawn again: keep the focus on the one just pressed
  const a = document.activeElement;
  const seg = a && a.parentElement && wnRoot.contains(a) && a.parentElement.classList.contains('seg') ? a.parentElement : null;
  const k = seg ? [...seg.children].indexOf(a) : -1;
  save('igri-koga', { groups: [...wn.groups], count: wn.count });
  wnRenderSettings();
  if (seg && seg.children[k]) seg.children[k].focus({ preventScroll: true });
  wnStart(null, false);
}

/* ---------- round ---------- */
function wnStart(list, focus) {
  if (gameShown('when')) stopAll();
  const qs = list || wnBuild();
  wn.qs = qs.map((q, k) => Object.assign({}, q, { again: false, num: k + 1 }));
  wn.n = wn.qs.length;
  wn.i = 0;
  wn.done = 0;
  wn.score = 0;
  wn.wrong = [];
  wn.retry = !!list;
  wnSum();
  wnRenderQ(focus);
}

function wnRenderQ(focus) {
  const q = wn.qs[wn.i];
  wn.checked = false;
  const card = el('div', 'qcard');

  const top = el('div', 'qtop');
  const scoreEl = el('span', null, 'Верни: ' + wn.score);
  top.append(el('span', null, 'Въпрос ' + q.num + ' от ' + wn.n), scoreEl);
  const prog = el('div', 'progress');
  const bar = el('i');
  bar.style.width = (wn.done / wn.n * 100) + '%';
  prog.appendChild(bar);
  card.append(top, prog, el('p', 'eyebrow kind', q.again ? 'Още веднъж' : 'Кога?'));

  const time = el('p', 'big-text wn-time', wnCap(q.tw[0]) + ',');
  time.lang = 'fr';
  const head = el('div', 'qverb');
  head.append(sayButton(q.inf, 'say'), el('span', 'meaning', promptMeaning(q.inf)));

  const input = el('input', 'ans wide');
  input.type = 'text';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocapitalize', 'none');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('enterkeyhint', 'go');
  input.setAttribute('lang', 'fr');
  input.setAttribute('aria-label', 'Формата на ' + q.inf + ' за ' + wnSubj(q.p) + ' (' + wnCap(q.tw[0]) + ')');
  const line = el('p', 'qline');
  line.lang = 'fr';
  line.append(el('span', 'pr', wnSubj(q.p) + ' '), input);
  card.append(time, el('p', 'bgline', q.tw[2]), head, line);

  const keys = el('div', 'keys');
  keys.setAttribute('aria-label', 'Букви със знаци');
  KEYS.forEach(k => {
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

  const ui = { q, input, fb, skip, main, keys, scoreEl, bar };
  main.addEventListener('click', () => (wn.checked ? wnNext() : wnCheck(ui, false)));
  skip.addEventListener('click', () => wnCheck(ui, true));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      wn.checked ? wnNext() : wnCheck(ui, false);
    }
  });

  wnEls.quiz.replaceChildren(card);
  if (focus) {
    input.focus({ preventScroll: true });
    card.scrollIntoView({ block: 'nearest' });
  }
}

function wnCheck(ui, gaveUp) {
  if (wn.checked) return;
  const q = ui.q;
  const val = gaveUp ? '' : ui.input.value;
  if (!gaveUp && !val.trim()) { ui.input.focus(); return; }

  const r = gaveUp ? { verdict: 'bad', kind: 'gaveup' } : wnJudge(q, val);
  const good = r.verdict !== 'bad';
  // only the first try counts; a miss comes back once, a few questions later
  if (!q.again) {
    wn.done++;
    if (good) wn.score++;
    else {
      wn.wrong.push({ q, given: val.trim() });
      wn.qs.splice(Math.min(wn.i + 1 + WN_AGAIN_AFTER, wn.qs.length), 0, Object.assign({}, q, { again: true }));
    }
  }
  wn.checked = true;

  ui.input.readOnly = true;
  ui.input.classList.add(r.verdict);
  ui.keys.hidden = true;
  ui.skip.hidden = true;
  ui.main.textContent = wn.i + 1 < wn.qs.length ? 'Напред' : 'Виж резултата';
  ui.scoreEl.textContent = 'Верни: ' + wn.score;
  ui.bar.style.width = (wn.done / wn.n * 100) + '%';

  const formBtn = formButton(q.form);
  const parts = [];
  const verdict = (cls, text) => parts.push(el('p', 'verdict ' + cls, text));
  const note = (text, cls) => parts.push(el('p', cls || 'fb-line', text));
  const answer = label => {
    const p = el('p', 'fb-line');
    if (label) p.appendChild(el('span', null, label));
    p.appendChild(formBtn);
    parts.push(p);
  };
  const bravo = q.again && good;
  if (r.kind === 'exact') {
    verdict('ok', bravo ? 'Браво, този път вярно.' : 'Правилно!');
    answer(null);
  } else if (r.kind === 'accent') {
    verdict('near', bravo ? 'Браво, този път вярно. Внимавай за знаците над буквите.' : 'Почти! Внимавай за знаците над буквите.');
    answer('Правилно е');
  } else if (r.kind === 'fp-pr') {
    const text = 'Става и така: за бъдеще в разговор често се казва présent.';
    if (bravo) { verdict('near', 'Браво, този път вярно.'); note(text); } else verdict('near', text);
    answer('Тук упражняваме futur proche:');
  } else if (r.kind === 'tense') {
    verdict('bad', wnRule(q));
    answer('Правилно е');
  } else if (r.kind === 'gaveup') {
    verdict('bad', 'Ето отговора:');
    answer(null);
    note(wnRule(q));
  } else {
    verdict('bad', 'Грешно.');
    answer('Правилно е');
    if (r.kind === 'why') note('Защо: ' + r.why, 'fb-why');
    else if (r.kind === 'elision') note('Защо: пред гласна или h „je“ става „j\'“: ' + formText(q.form) + '.', 'fb-why');
    else if (r.kind === 'refl') note('Защо: глаголът е възвратен, затова трябва и „' + REFL[q.p] + '“.', 'fb-why');
    else note(wnRule(q));
  }
  if (q.tense === 'pc' && /\(/.test(q.answer)) {
    note('(e) и (s) се пишат според рода и числото: allé, allée, allés, allées.');
  }
  ui.fb.replaceChildren(...parts);
  ui.fb.hidden = false;
  if (!(r.kind === 'exact' && document.activeElement === ui.input)) ui.main.focus({ preventScroll: true });
  ui.fb.scrollIntoView({ block: 'nearest' });
  speak(q.say, formBtn);
}

function wnNext() {
  stopAll();
  wn.i++;
  if (wn.i >= wn.qs.length) wnResult();
  else wnRenderQ(true);
}

function wnResult() {
  const n = wn.n, s = wn.score;
  const pct = n ? s / n : 0;
  if (typeof track === 'function') track('when_complete', { questions: n, score_pct: Math.round(pct * 100) });
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
    : ['Courage !', 'Първо виж кога става: минало, сега или бъдеще. После избери времето.'];
  msg.append(el('i', null, fr), document.createTextNode(' ' + bg));
  card.appendChild(msg);

  if (wn.wrong.length) {
    const box = el('div', 'mistakes');
    box.appendChild(el('h3', null, 'Грешки'));
    const ul = el('ul');
    wn.wrong.forEach(({ q, given }) => {
      const li = el('li');
      li.appendChild(el('span', 'm-prompt', wnCap(q.tw[0]) + ', ' + wnSubj(q.p) + ' ___ (' + q.inf + ') · ' + TENSE[q.tense].label));
      if (given) {
        const g = el('span', 'm-prompt');
        g.append(document.createTextNode('Твоят отговор: '), el('span', 'given', given));
        li.appendChild(g);
      }
      li.appendChild(formButton(q.form));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    card.appendChild(box);
  }

  const actions = el('div', 'actions');
  if (wn.wrong.length) {
    const retry = el('button', 'btn', 'Повтори грешните');
    retry.type = 'button';
    const again = wn.wrong.map(w => w.q);
    retry.addEventListener('click', () => wnStart(shuffle(again.slice()), true));
    actions.appendChild(retry);
  }
  const fresh = el('button', 'btn primary', 'Нов кръг');
  fresh.type = 'button';
  fresh.addEventListener('click', () => wnStart(null, true));
  actions.appendChild(fresh);
  card.appendChild(actions);

  wnEls.quiz.replaceChildren(card);
  if (wn.wrong.length) {
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
  } else {
    fresh.focus({ preventScroll: true });
  }
  card.scrollIntoView({ block: 'nearest' });
}

/* no sound from this game once it is hidden or the app goes to the background.
   showView / showGame already stop everything; this only stops a sound of this game,
   never one another view has just started. */
const wnSpeaking = () => [...document.querySelectorAll('.speaking, .playing')].some(e => wnRoot.contains(e));
const wnFollow = () => { if (!gameShown('when') && wnSpeaking()) stopAll(); };
VIEWS.forEach(v => $('tab-' + v).addEventListener('click', wnFollow));
document.addEventListener('gamechange', wnFollow);
document.addEventListener('visibilitychange', () => { if (document.hidden && wnSpeaking()) stopAll(); });

wnRenderSettings();
wnStart(null, false);
