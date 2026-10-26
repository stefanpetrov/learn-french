/* "60 секунди": as many right forms as you can in one minute, tapping one of four.
   Renders into #speed (panel #game-speed).
   An item is a subject · infinitive, the tense and the meaning; the four answers are the verb
   part (as in the Test: "avons fini") of the right form, of the same person in another tense
   and of other persons in the same tense. A miss comes back once, 3 items later, and does not
   count again. The clock runs only while the game is on screen, the app is in front and no
   dialog is open. Uses helpers and data from app.js, data.js and explain.js. */

const SD_SECONDS = 60;
const SD_AGAIN_AFTER = 3;   // a missed item comes back once, this many items later
const SD_LOW = 10;          // the last seconds are shown in red
const SD_GUARD_MS = 700;    // right after the end a late tap on "Пак" or "Настройки" does nothing
// how long the marks stay before the next item: [right, wrong or a second try]
const SD_WAIT = [300, 700];
const SD_WAIT_REDUCED = [150, 450];
const SD_SHOW_GUARD_MS = 300;

const savedSd = load('igri-60-set', {}) || {};
const sd = {
  tenses: validSet(savedSd.tenses, TENSE_IDS, ['pr']),
  groups: validSet(savedSd.groups, GROUP_IDS, GROUP_IDS),
  // the round: left = ms left when the clock last stopped, since = when it started again (0: stopped)
  running: false, left: 0, since: 0, tick: null, wait: null, busy: false, key: '', endedAt: -Infinity,
  q: null, shown: 0, shownAt: 0, answered: 0, score: 0, wrong: [], again: [], deck: [], tdeck: [], lastInf: null,
  ui: null
};
let sdBest = load('igri-60-best', {});
if (!sdBest || typeof sdBest !== 'object' || Array.isArray(sdBest)) sdBest = {};

// the record belongs to the set of tenses
const sdKey = set => TENSE_IDS.filter(t => set.has(t)).join('+');
const sdOldBest = key => (Number.isFinite(sdBest[key]) && sdBest[key] > 0 ? sdBest[key] : 0);
const sdRight = n => n + ' ' + (n === 1 ? 'верен отговор' : 'верни отговора');
const sdFr = text => { const s = el('span', null, text); s.lang = 'fr'; return s; };

/* ---------- items ---------- */
const sdPool = () => Object.keys(VERB).filter(inf => sd.groups.has(VERB[inf].g));
// every verb once before any comes back, and never the same verb twice in a row
function sdPickInf() {
  const pool = sdPool();
  if (pool.length < 2) return pool[0];
  for (;;) {
    if (!sd.deck.length) sd.deck = shuffle(pool.slice());
    const k = sd.deck.findIndex(inf => inf !== sd.lastInf);
    if (k >= 0) return sd.deck.splice(k, 1)[0];
    sd.deck = [];
  }
}
function sdPickTense() {
  if (!sd.tdeck.length) sd.tdeck = shuffle([...sd.tenses]);
  return sd.tdeck.pop();
}

/* the right verb part and three real forms of the same verb: the same person in another tense,
   other persons in the same tense. No two may read the same ("(e)" left out). */
const sdSame = (a, b) => norm(spoken(a)) === norm(spoken(b));
function sdOptions(inf, tense, p) {
  const right = formAnswer(forms(inf, tense)[p]);
  const otherTense = shuffle(TENSE_IDS.filter(t => t !== tense)).map(t => formAnswer(forms(inf, t)[p]));
  const otherPerson = shuffle([0, 1, 2, 3, 4, 5].filter(x => x !== p)).map(x => formAnswer(forms(inf, tense)[x]));
  // one other tense, or two when the round mixes tenses
  const nTense = sd.tenses.size > 1 && Math.random() < 0.5 ? 2 : 1;
  const opts = [right];
  const add = text => { if (opts.length < 4 && !opts.some(o => sdSame(o, text))) opts.push(text); };
  otherTense.slice(0, nTense).forEach(add);
  otherPerson.forEach(add);
  otherTense.forEach(add);
  shuffle(opts);
  return { opts, answer: opts.indexOf(right) };
}
function sdItem(inf, tense, p, again) {
  return Object.assign({ inf, tense, p, form: forms(inf, tense)[p], again }, sdOptions(inf, tense, p));
}
function sdNextItem() {
  // a missed item, once it is due (later, if its verb was the last one)
  const k = sd.again.findIndex(a => a.due <= sd.shown && a.q.inf !== sd.lastInf);
  if (k >= 0) {
    const q = sd.again.splice(k, 1)[0].q;
    return sdItem(q.inf, q.tense, q.p, true);
  }
  return sdItem(sdPickInf(), sdPickTense(), Math.floor(Math.random() * 6), false);
}

/* ---------- page: settings, the game, the tip ---------- */
const sdRoot = $('speed');
function sdField(id, label) {
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
const sdEls = (() => {
  const set = el('details', 'settings');
  const summary = el('summary');
  const sum = el('span', 'sum');
  sum.id = 'sd-sum';
  summary.append(el('span', null, 'Настройки'), sum);
  const body = el('div', 'settings-body');
  const [tField, tenses] = sdField('sd-tenses', 'Времена');
  const [gField, groups] = sdField('sd-groups', 'Групи глаголи');
  body.append(tField, gField, el('p', 'set-note', 'Всяка промяна те връща в началото, дори по време на игра.'));
  set.append(summary, body);

  const play = el('div');
  play.id = 'sd-play';
  const tip = el('p', 'tip', 'Тук тренираш да разпознаваш бързо вярната форма: лицето, времето и окончанието. Другите три отговора са истински форми на същия глагол, но за друго лице или в друго време. Грешка взима време, а грешният въпрос се връща още веднъж след малко. Рекордът се пази отделно за всеки избор на времена. С клавиатура: 1–4 избира отговор.');
  sdRoot.replaceChildren(set, play, tip);
  return { set, summary, sum, tenses, groups, play };
})();

function sdRenderSettings() {
  sdEls.tenses.replaceChildren(...setToggles(TENSE_ITEMS, sd.tenses, sdSettingsChanged));
  sdEls.groups.replaceChildren(...setToggles(GROUP_ITEMS, sd.groups, sdSettingsChanged));
  sdEls.sum.textContent = [tensesLabel(sd.tenses), groupsLabel(sd.groups)].filter(Boolean).join(' · ');
}
function sdSettingsChanged() {
  // the toggles are drawn again: keep the focus on the one just pressed
  const a = document.activeElement;
  const seg = a && a.parentElement && sdRoot.contains(a) && a.parentElement.classList.contains('seg') ? a.parentElement : null;
  const k = seg ? [...seg.children].indexOf(a) : -1;
  save('igri-60-set', { tenses: [...sd.tenses], groups: [...sd.groups] });
  sdRenderSettings();
  if (seg && seg.children[k]) seg.children[k].focus({ preventScroll: true });
  sdStop();
  sdRenderStart();
}

/* the start screen: the record for these tenses and "Старт"; the round never starts by itself */
function sdRenderStart() {
  sd.ui = null;
  const card = el('div', 'qcard sd-intro');
  const old = sdOldBest(sdKey(sd.tenses));
  const rec = el('p', 'sd-record');
  if (old) rec.append('Рекорд за ', sdFr(tensesLabel(sd.tenses)), ': ', el('b', null, sdRight(old)), '.');
  else rec.append('Още нямаш рекорд за ', sdFr(tensesLabel(sd.tenses)), '.');
  const go = el('button', 'btn primary sd-go', 'Старт');
  go.type = 'button';
  go.addEventListener('click', sdBegin);
  card.append(el('p', 'eyebrow kind', '60 секунди'),
    el('p', 'sd-lead', 'Имаш една минута. Чукни вярната форма и веднага идва следващата.'), rec, go);
  sdEls.play.replaceChildren(card);
  return go;
}

/* ---------- the clock ---------- */
const sdCanPlay = () => gameShown('speed') && !document.hidden && !document.querySelector('dialog[open]');
const sdLeft = () => (sd.since ? sd.left - (performance.now() - sd.since) : sd.left);
function sdPause() {
  if (!sd.since) return;
  sd.left = sdLeft();
  sd.since = 0;
  clearInterval(sd.tick);
  sd.tick = null;
  sdDraw();
}
function sdResume() {
  if (!sd.running || sd.since) return;
  sd.since = performance.now();
  sd.tick = setInterval(sdTick, 100);
  sdDraw();
}
function sdTick() {
  if (!sd.running) return;
  if (!sdCanPlay()) { sdPause(); return; }
  if (sdLeft() <= 0) { sdEnd(); return; }
  sdDraw();
}
function sdDraw() {
  const ui = sd.ui;
  if (!ui || !sd.running) return;
  const ms = Math.max(0, sdLeft());
  const s = Math.ceil(ms / 1000);
  const text = s === 1 ? 'Остава 1 с' : 'Остават ' + s + ' с';
  if (ui.time.textContent !== text) ui.time.textContent = text;
  ui.bar.style.width = (ms / (SD_SECONDS * 1000) * 100) + '%';
  ui.card.classList.toggle('sd-low', s <= SD_LOW);
}
// the clock runs only while the game can be seen
function sdFollow() {
  if (sd.running) {
    if (sdCanPlay()) sdResume();
    else sdPause();
  }
  if (!gameShown('speed') && sdRoot.querySelector('.speaking, .playing')) stopAll();
}
function sdStop() {
  sd.running = false;
  sd.since = 0;
  clearInterval(sd.tick);
  sd.tick = null;
  clearTimeout(sd.wait);
  sd.wait = null;
  sd.busy = false;
}
// focus moves only while the game is on screen (and not under a dialog)
function sdFocus(target) {
  if (target && sdCanPlay()) target.focus({ preventScroll: true });
}

/* ---------- round ---------- */
function sdBegin() {
  if (performance.now() - sd.endedAt < SD_GUARD_MS) return;
  stopAll();
  sdStop();
  Object.assign(sd, {
    running: true, left: SD_SECONDS * 1000, key: sdKey(sd.tenses),
    q: null, shown: 0, shownAt: 0, answered: 0, score: 0, wrong: [], again: [], deck: [], tdeck: [], lastInf: null
  });
  sdRenderRun();
  sdShow(sdNextItem());
  sdFollow();
  sdFocus(sd.ui.btns[0]);
  sd.ui.card.scrollIntoView({ block: 'nearest' });
}

function sdRenderRun() {
  const card = el('div', 'qcard sd-card');
  const top = el('div', 'qtop');
  const time = el('span', 'sd-time');
  time.setAttribute('role', 'timer');
  const scoreEl = el('span', 'sd-score', 'Верни: 0');
  top.append(time, scoreEl);
  const prog = el('div', 'progress');
  const bar = el('i');
  prog.appendChild(bar);

  const eyebrow = el('p', 'eyebrow kind');
  const prompt = el('div', 'sd-prompt');
  const who = el('p', 'sd-who');
  who.lang = 'fr';
  const tense = el('p', 'sd-tense');
  tense.lang = 'fr';
  const meaning = el('p', 'sd-meaning');
  prompt.append(who, tense, meaning);

  // the same four buttons all round, so the focus stays on the one at the same place
  const opts = el('div', 'sd-opts');
  opts.setAttribute('role', 'group');
  opts.setAttribute('aria-label', 'Избери формата');
  const btns = [0, 1, 2, 3].map(k => {
    const b = el('button', 'sd-opt');
    b.type = 'button';
    b.lang = 'fr';
    b.setAttribute('aria-keyshortcuts', String(k + 1));
    b.addEventListener('click', () => sdAnswer(k));
    opts.appendChild(b);
    return b;
  });

  // what happened (seen and read out), then the next item (read out only)
  const status = el('p', 'sd-status');
  status.setAttribute('aria-live', 'polite');
  const say = el('p', 'sr-only');
  say.setAttribute('aria-live', 'polite');
  card.append(top, prog, eyebrow, prompt, opts, status, say);
  sd.ui = { card, time, scoreEl, bar, eyebrow, who, tense, meaning, btns, status, say };
  sdEls.play.replaceChildren(card);
}

function sdShow(q) {
  const ui = sd.ui;
  sd.q = q;
  sd.shown++;
  sd.shownAt = performance.now();
  sd.lastInf = q.inf;
  sd.busy = false;
  const tl = TENSE[q.tense].label;
  ui.eyebrow.textContent = q.again ? 'Още веднъж' : 'Избери формата';
  ui.who.replaceChildren(SUBJ[q.p], el('span', 'sd-dot', ' · '), q.inf);
  ui.tense.textContent = tl;
  ui.meaning.textContent = promptMeaning(q.inf);
  ui.btns.forEach((b, k) => {
    b.classList.remove('ok', 'bad');
    b.hidden = k >= q.opts.length;
    b.textContent = q.opts[k] || '';
  });
  ui.status.className = 'sd-status';
  ui.status.textContent = '';
  ui.say.textContent = (q.again ? 'Още веднъж: ' : '') + SUBJ[q.p] + ', ' + q.inf + ', ' + tl + '.';
}

/* k: the button tapped (or key 1–4) */
function sdAnswer(k) {
  const ui = sd.ui, q = sd.q;
  if (!sd.running || sd.busy || !ui || !q || k >= q.opts.length || !sdCanPlay()) return;
  // a second tap of a double tap on Старт / Пак (or on the same spot right after a quick answer)
  // lands on the new options: nobody can read a new item that fast
  if (performance.now() - sd.shownAt < SD_SHOW_GUARD_MS) return;
  sd.busy = true;
  const good = k === q.answer;
  // only the first try counts; a miss comes back once, 3 items later
  if (!q.again) {
    sd.answered++;
    if (good) sd.score++;
    else {
      sd.wrong.push({ q, given: q.opts[k] });
      sd.again.push({ q, due: sd.shown + SD_AGAIN_AFTER });
    }
  }
  ui.scoreEl.textContent = 'Верни: ' + sd.score;
  ui.btns[q.answer].classList.add('ok');
  if (!good) ui.btns[k].classList.add('bad');
  ui.status.className = 'sd-status verdict ' + (good ? 'ok' : 'bad');
  if (good) ui.status.textContent = q.again ? 'Браво, този път вярно.' : 'Правилно!';
  else ui.status.replaceChildren('Грешно. Правилно е ', sdFr(q.opts[q.answer]), '.');
  // keyboard play goes on from the same place
  if (!ui.btns.includes(document.activeElement)) sdFocus(ui.btns[k]);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (reduce ? SD_WAIT_REDUCED : SD_WAIT)[good && !q.again ? 0 : 1];
  sd.wait = setTimeout(() => {
    sd.wait = null;
    if (sd.running && sd.ui === ui) sdShow(sdNextItem());
  }, wait);
}

function sdEnd() {
  if (!sd.running) return;
  sdStop();
  sd.left = 0;
  sd.endedAt = performance.now();
  sd.ui = null;
  const n = sd.answered, s = sd.score;
  const pct = n ? s / n : 0;
  track('speed_complete', { questions: n, score_pct: Math.round(pct * 100) });
  const old = sdOldBest(sd.key);
  const record = s > old;
  if (record) {
    sdBest[sd.key] = s;
    save('igri-60-best', sdBest);
  }

  const card = el('div', 'qcard');
  card.appendChild(el('p', 'eyebrow kind', 'Résultat'));
  const head = el('div', 'result-head');
  const score = el('p', 'score', String(s));
  score.appendChild(el('small', null, n ? ' / ' + n + ' верни' : ' верни'));
  head.appendChild(score);
  if (record || old) head.appendChild(el('p', 'grade', record ? 'Нов рекорд!' : 'Рекорд: ' + old));
  card.appendChild(head);

  const msg = el('p', 'result-msg');
  const [fr, bg] = !n ? ['Temps écoulé !', 'Времето свърши преди първия отговор. Пробвай пак.']
    : pct >= 0.9 ? ['Excellent !', 'Бързо и точно.']
    : pct >= 0.7 ? ['Très bien !', 'Много добре.']
    : pct >= 0.5 ? ['Pas mal.', 'Карай малко по-бавно: всяка грешка ти взима време.']
    : ['Courage !', 'Не бързай. Първо виж лицето и времето, после избирай.'];
  const what = n ? ' Отговори на ' + questionsWord(n) + ' за една минута.' : '';
  msg.append(el('i', null, fr), document.createTextNode(' ' + bg + what));
  card.appendChild(msg);

  if (sd.wrong.length) {
    const box = el('div', 'mistakes');
    box.appendChild(el('h3', null, 'Грешки'));
    const ul = el('ul');
    sd.wrong.forEach(({ q, given }) => {
      const li = el('li');
      const prompt = el('span', 'm-prompt');
      prompt.append(sdFr(SUBJ[q.p] + ' · ' + q.inf + ' · ' + TENSE[q.tense].label));
      const g = el('span', 'm-prompt');
      const gv = el('span', 'given', given);
      gv.lang = 'fr';
      g.append('Твоят отговор: ', gv);
      li.append(prompt, g, formButton(q.form));
      const why = sdWhy(q, given);
      if (why) li.appendChild(el('p', 'fb-why', 'Защо: ' + why));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    card.appendChild(box);
  }

  const actions = el('div', 'actions');
  const toSettings = el('button', 'btn', 'Настройки');
  toSettings.type = 'button';
  toSettings.addEventListener('click', () => {
    if (performance.now() - sd.endedAt < SD_GUARD_MS) return;
    sdRenderStart();
    sdEls.set.open = true;
    sdEls.summary.focus({ preventScroll: true });
    sdEls.set.scrollIntoView({ block: 'nearest' });
  });
  const again = el('button', 'btn primary', 'Пак');
  again.type = 'button';
  again.addEventListener('click', sdBegin);
  actions.append(toSettings, again);
  card.appendChild(actions);

  sdEls.play.replaceChildren(card);
  if (sd.wrong.length) {
    card.tabIndex = -1;
    sdFocus(card);
  } else {
    sdFocus(again);
  }
  card.scrollIntoView({ block: 'nearest' });
}

/* "Защо: …" (explain.js) for the form tapped, or null */
function sdWhy(q, given) {
  if (typeof explainMistake !== 'function') return null;
  try {
    const r = explainMistake({ inf: q.inf, tense: q.tense, p: q.p, answer: formAnswer(q.form) }, given);
    return r && r.text ? r.text : null;
  } catch (e) {
    return null;
  }
}

/* keys 1–4 answer while the round runs and the game is on screen */
document.addEventListener('keydown', e => {
  if (!sd.running || !sd.ui || !gameShown('speed') || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
  if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  // the digit keys of the top row by position too: on a Belgian AZERTY keyboard they type & é " '
  let k = ['1', '2', '3', '4'].indexOf(e.key);
  if (k < 0) k = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
  if (k < 0) return;
  e.preventDefault();
  sdAnswer(k);
});

/* the clock waits while another tab or game is shown, the app is in the background or a dialog
   (Запази прогреса) is open, and goes on after; no sound of this game once it is hidden */
VIEWS.forEach(v => $('tab-' + v).addEventListener('click', sdFollow));
document.addEventListener('gamechange', sdFollow);
document.addEventListener('visibilitychange', () => {
  sdFollow();
  if (document.hidden && sdRoot.querySelector('.speaking, .playing')) stopAll();
});
if ('MutationObserver' in window) {
  // a dialog opens or closes (its "open" attribute), or the games tab or this game is hidden or shown
  new MutationObserver(sdFollow).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['open'] });
  const shown = new MutationObserver(sdFollow);
  ['view-games', 'game-speed'].forEach(id => shown.observe($(id), { attributes: true, attributeFilter: ['hidden'] }));
}

sdRenderSettings();
sdRenderStart();
