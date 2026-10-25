/* Pairs: match French and Bulgarian (or a person + verb and its form).
   "Свързване": two columns face up; "Памет": tiles face down, find the pairs.
   Uses helpers and data from app.js and data.js. */

const PR_MODES = [['match', 'Свързване'], ['memory', 'Памет']];
const PR_KINDS = [['tr', 'Превод'], ['cj', 'Спрежение']];
const PR_SIZES = [6, 8];
const PR_FLIP_BACK_MS = 900;

const savedPr = load('dvoiki-set', {}) || {};
const pr = {
  mode: PR_MODES.some(m => m[0] === savedPr.mode) ? savedPr.mode : 'match',
  kind: PR_KINDS.some(k => k[0] === savedPr.kind) ? savedPr.kind : 'tr',
  size: PR_SIZES.includes(savedPr.size) ? savedPr.size : 6,
  tenses: validSet(savedPr.tenses, TENSE_IDS, ['pr']),
  groups: validSet(savedPr.groups, GROUP_IDS, GROUP_IDS),
  pairs: [], tiles: [], sel: null, open: [], found: 0, mistakes: 0,
  start: 0, timer: null, busy: false, done: false
};
let prBest = load('dvoiki-best', {});
if (!prBest || typeof prBest !== 'object' || Array.isArray(prBest)) prBest = {};
const prRoot = $('pairs');

function savePrSettings() {
  save('dvoiki-set', { mode: pr.mode, kind: pr.kind, size: pr.size, tenses: [...pr.tenses], groups: [...pr.groups] });
}
const prBestKey = () => [pr.mode, pr.kind, pr.size].join(':');

/* ---------- pairs ---------- */
/* Each pair is { fr, bg, say }: fr is the French side, bg the other side,
   say what is spoken when the pair is found. No two pairs may share a side,
   so every tile has exactly one partner. */
function prBuild() {
  const infs = shuffle(Object.keys(VERB).filter(inf => pr.groups.has(VERB[inf].g)));
  const pairs = [];
  const usedA = new Set(), usedB = new Set();
  const add = p => {
    if (pairs.length >= pr.size || usedA.has(p.fr) || usedB.has(p.bg)) return;
    usedA.add(p.fr);
    usedB.add(p.bg);
    pairs.push(p);
  };
  if (pr.kind === 'tr') {
    // short meaning without brackets; verbs with the same meaning (живея) never meet in one game
    infs.forEach(inf => add({ fr: inf, bg: baseMeaning(VERB[inf].bg), say: inf }));
  } else {
    const items = [];
    infs.forEach(inf => pr.tenses.forEach(t => { for (let p = 0; p < 6; p++) items.push([inf, p, t]); }));
    shuffle(items);
    const usedInf = new Set();
    const tryAdd = ([inf, p, t]) => {
      const f = forms(inf, t)[p];
      const tag = pr.tenses.size > 1 ? ' · ' + TENSE_SHORT[t] : '';
      add({ fr: SUBJ[p] + ' · ' + inf + tag, bg: formAnswer(f), say: formText(f), inf });
    };
    // one form per verb first, then fill
    items.forEach(it => { if (!usedInf.has(it[0]) && pairs.length < pr.size) { const n = pairs.length; tryAdd(it); if (pairs.length > n) usedInf.add(it[0]); } });
    items.forEach(it => tryAdd(it));
  }
  return pairs;
}
const TENSE_SHORT = { pr: 'présent', pc: 'p. composé', fp: 'f. proche' };

/* ---------- settings ---------- */
function renderPrSettings() {
  $('p-mode').replaceChildren(...PR_MODES.map(([id, label]) => toggleBtn(label, pr.mode === id, () => { pr.mode = id; prSettingsChanged(); })));
  $('p-kind').replaceChildren(...PR_KINDS.map(([id, label]) => toggleBtn(label, pr.kind === id, () => { pr.kind = id; prSettingsChanged(); })));
  $('p-tenses').replaceChildren(...setToggles(TENSE_ITEMS, pr.tenses, prSettingsChanged));
  $('p-tense-field').hidden = pr.kind !== 'cj';
  $('p-groups').replaceChildren(...setToggles(GROUP_ITEMS, pr.groups, prSettingsChanged));
  $('p-size').replaceChildren(...PR_SIZES.map(n => toggleBtn(String(n), pr.size === n, () => { pr.size = n; prSettingsChanged(); })));
  const parts = [PR_MODES.find(m => m[0] === pr.mode)[1], PR_KINDS.find(k => k[0] === pr.kind)[1], pr.size + ' двойки'];
  if (pr.kind === 'cj') parts.push(tensesLabel(pr.tenses));
  const gl = groupsLabel(pr.groups);
  if (gl) parts.push(gl);
  $('p-sum').textContent = parts.join(' · ');
}
function prSettingsChanged() {
  savePrSettings();
  renderPrSettings();
  prStart(null);
}

/* ---------- game ---------- */
function prClock() {
  const s = Math.floor((performance.now() - pr.start) / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function prStopTimer() {
  if (pr.timer) { clearInterval(pr.timer); pr.timer = null; }
}
function prStart(pairs) {
  prStopTimer();
  stopAll();
  pr.pairs = pairs || prBuild();
  pr.sel = null;
  pr.open = [];
  pr.found = 0;
  pr.mistakes = 0;
  pr.busy = false;
  pr.done = false;
  pr.start = 0;
  pr.pausedAt = 0;
  prRender();
}

function prTile(pairIdx, side) {
  const p = pr.pairs[pairIdx];
  const b = el('button', 'pr-tile ' + (side === 'fr' ? 'pr-fr' : 'pr-bg'));
  b.type = 'button';
  const text = side === 'fr' ? p.fr : p.bg;
  if (side === 'fr' || pr.kind === 'cj') b.lang = 'fr';
  b.dataset.pair = String(pairIdx);
  b.dataset.side = side;
  if (pr.mode === 'memory') {
    b.append(el('span', 'pr-back', '?'), el('span', 'pr-face', text));
    b.setAttribute('aria-label', 'Скрита плочка');
  } else {
    b.append(el('span', 'pr-face', text));
  }
  b.addEventListener('click', () => prTap(b));
  return { b, pairIdx, side, text };
}

function prRender() {
  const box = el('div', 'qcard pr-box');
  const top = el('div', 'qtop');
  const clock = el('span', 'pr-clock', '0:00');
  const stat = el('span', null, 'Двойки: 0 от ' + pr.pairs.length);
  top.append(stat, clock);
  box.appendChild(top);
  box.appendChild(el('p', 'eyebrow kind', pr.mode === 'memory'
    ? 'Обръщай по две плочки и намери двойките'
    : pr.kind === 'tr' ? 'Свържи глагола със значението' : 'Свържи лицето и глагола с формата'));

  let grid;
  const tiles = [];
  if (pr.mode === 'match') {
    grid = el('div', 'pr-cols');
    const left = el('div', 'pr-col');
    const right = el('div', 'pr-col');
    shuffle(pr.pairs.map((p, k) => k)).forEach(k => { const t = prTile(k, 'fr'); tiles.push(t); left.appendChild(t.b); });
    shuffle(pr.pairs.map((p, k) => k)).forEach(k => { const t = prTile(k, 'bg'); tiles.push(t); right.appendChild(t.b); });
    grid.append(left, right);
  } else {
    grid = el('div', 'pr-grid' + (pr.pairs.length > 6 ? ' pr-grid4' : ''));
    shuffle(pr.pairs.flatMap((p, k) => [[k, 'fr'], [k, 'bg']])).forEach(([k, side]) => {
      const t = prTile(k, side);
      tiles.push(t);
      grid.appendChild(t.b);
    });
  }
  pr.tiles = tiles;
  box.appendChild(grid);

  const msg = el('p', 'fb-line pr-msg');
  msg.setAttribute('aria-live', 'polite');
  box.appendChild(msg);
  const actions = el('div', 'actions');
  const again = el('button', 'btn', 'Разбъркай отново');
  again.type = 'button';
  again.addEventListener('click', () => prStart(pr.pairs));
  const fresh = el('button', 'btn', 'Нови двойки');
  fresh.type = 'button';
  fresh.addEventListener('click', () => prStart(null));
  actions.append(again, fresh);
  box.appendChild(actions);
  pr.ui = { box, clock, stat, msg };
  prRoot.replaceChildren(box);
}

function prTick() {
  if (pr.ui) pr.ui.clock.textContent = prClock();
}
function prBegin() {
  if (pr.start) return;
  pr.start = performance.now();
  pr.timer = setInterval(prTick, 500);
}

function prSpeakFr(t) {
  const p = pr.pairs[t.pairIdx];
  if (t.side === 'fr' && pr.kind === 'tr') speak(p.say, t.b);
}

function prTap(b) {
  if (pr.done || pr.busy || b.classList.contains('found')) return;
  const t = pr.tiles.find(x => x.b === b);
  prBegin();
  if (pr.mode === 'memory') prTapMemory(t);
  else prTapMatch(t);
}

function prTapMatch(t) {
  if (pr.sel === t) { t.b.classList.remove('sel'); t.b.setAttribute('aria-pressed', 'false'); pr.sel = null; return; }
  if (!pr.sel || pr.sel.side === t.side) {
    if (pr.sel) { pr.sel.b.classList.remove('sel'); pr.sel.b.setAttribute('aria-pressed', 'false'); }
    pr.sel = t;
    t.b.classList.add('sel');
    t.b.setAttribute('aria-pressed', 'true');
    prSpeakFr(t);
    return;
  }
  const a = pr.sel;
  pr.sel = null;
  a.b.classList.remove('sel');
  a.b.setAttribute('aria-pressed', 'false');
  prJudge(a, t);
}

function prTapMemory(t) {
  if (pr.open.includes(t)) return;
  t.b.classList.add('open');
  t.b.setAttribute('aria-label', t.text);
  pr.open.push(t);
  prSpeakFr(t);
  if (pr.open.length < 2) return;
  const [a, c] = pr.open;
  pr.open = [];
  if (a.pairIdx === c.pairIdx && a.side !== c.side) {
    prJudge(a, c);
  } else {
    pr.busy = true;
    pr.mistakes++;
    a.b.classList.add('wrong');
    c.b.classList.add('wrong');
    pr.ui.msg.textContent = 'Не са двойка.';
    setTimeout(() => {
      [a, c].forEach(x => {
        x.b.classList.remove('open', 'wrong');
        x.b.setAttribute('aria-label', 'Скрита плочка');
      });
      pr.busy = false;
    }, PR_FLIP_BACK_MS);
  }
}

function prJudge(a, c) {
  if (a.pairIdx === c.pairIdx) {
    [a, c].forEach(x => {
      x.b.classList.add('found');
      x.b.classList.remove('open');
      x.b.disabled = true;
      x.b.setAttribute('aria-label', x.text + ' (намерено)');
    });
    pr.found++;
    pr.ui.stat.textContent = 'Двойки: ' + pr.found + ' от ' + pr.pairs.length;
    const p = pr.pairs[a.pairIdx];
    pr.ui.msg.textContent = p.fr + ' = ' + p.bg;
    speak(p.say, (a.side === 'fr' ? a : c).b);
    if (pr.found === pr.pairs.length) setTimeout(prEnd, 500);
  } else {
    pr.mistakes++;
    [a, c].forEach(x => {
      x.b.classList.add('wrong');
      setTimeout(() => x.b.classList.remove('wrong'), 450);
    });
    pr.ui.msg.textContent = 'Не са двойка. Опитай пак.';
  }
}

function prEnd() {
  if (pr.done) return;
  pr.done = true;
  prStopTimer();
  const secs = (performance.now() - pr.start) / 1000;
  const key = prBestKey();
  const old = prBest[key];
  const record = !old || secs < old;
  if (record) {
    prBest[key] = Math.round(secs * 10) / 10;
    save('dvoiki-best', prBest);
  }
  const card = el('div', 'qcard');
  card.appendChild(el('p', 'eyebrow kind', 'Bravo !'));
  const head = el('div', 'result-head');
  head.append(el('p', 'score', prClock()), el('p', 'grade', record ? 'Рекорд !' : 'Рекорд: ' + prFmt(old)));
  card.appendChild(head);
  const msg = el('p', 'result-msg');
  msg.append(el('i', null, pr.mistakes === 0 ? 'Parfait ! ' : pr.mistakes <= 2 ? 'Très bien ! ' : 'Continue ! '),
    document.createTextNode(pr.pairs.length + ' двойки, ' + (pr.mistakes === 1 ? '1 грешка.' : pr.mistakes + ' грешки.')));
  card.appendChild(msg);

  // all pairs to listen to once more
  const list = el('ul', 'pr-list');
  pr.pairs.forEach(p => {
    const li = el('li');
    li.append(sayButton(p.say, 'sbtn'), el('span', 'm-prompt', p.bg));
    list.appendChild(li);
  });
  card.appendChild(list);

  const actions = el('div', 'actions');
  const again = el('button', 'btn', 'Пак същите');
  again.type = 'button';
  again.addEventListener('click', () => prStart(pr.pairs));
  const fresh = el('button', 'btn primary', 'Нови двойки');
  fresh.type = 'button';
  fresh.addEventListener('click', () => prStart(null));
  actions.append(again, fresh);
  card.appendChild(actions);
  pr.ui = null;
  prRoot.replaceChildren(card);
  fresh.focus({ preventScroll: true });
  card.scrollIntoView({ block: 'nearest' });
}
function prFmt(secs) {
  const s = Math.round(secs);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/* the clock stops while the tab is not shown */
VIEWS.filter(v => v !== 'pairs').forEach(v => $('tab-' + v).addEventListener('click', () => {
  if (pr.start && !pr.done) { prStopTimer(); pr.pausedAt = performance.now(); }
}));
$('tab-pairs').addEventListener('click', () => {
  if (pr.pausedAt && !pr.done) {
    pr.start += performance.now() - pr.pausedAt;
    pr.pausedAt = 0;
    pr.timer = setInterval(prTick, 500);
  }
});

renderPrSettings();
prStart(null);
