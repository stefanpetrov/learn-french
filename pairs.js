/* Pairs: match French and Bulgarian (or a person + verb and its form).
   "Свързване": two columns face up; "Памет": tiles face down, find the pairs.
   Uses helpers and data from app.js and data.js. */

const PR_MODES = [['match', 'Свързване'], ['memory', 'Памет']];
const PR_KINDS = [['tr', 'Превод'], ['cj', 'Спрежение']];
const PR_SIZES = [6, 8];
const PR_FLIP_BACK_MS = 900;
const TENSE_SHORT = { pr: 'présent', pc: 'p. composé', fp: 'f. proche' };

const savedPr = load('dvoiki-set', {}) || {};
const pr = {
  mode: PR_MODES.some(m => m[0] === savedPr.mode) ? savedPr.mode : 'match',
  kind: PR_KINDS.some(k => k[0] === savedPr.kind) ? savedPr.kind : 'tr',
  size: PR_SIZES.includes(savedPr.size) ? savedPr.size : 6,
  tenses: validSet(savedPr.tenses, TENSE_IDS, ['pr']),
  groups: validSet(savedPr.groups, GROUP_IDS, GROUP_IDS),
  pairs: [], tiles: [], sel: null, open: [], seen: new Set(), found: 0, mistakes: 0,
  start: 0, pausedAt: 0, elapsed: 0, timer: null, endTimer: null, flipTimer: null, busy: false, done: false
};
let prBest = load('dvoiki-best', {});
if (!prBest || typeof prBest !== 'object' || Array.isArray(prBest)) prBest = {};
const prRoot = $('pairs');

function savePrSettings() {
  save('dvoiki-set', { mode: pr.mode, kind: pr.kind, size: pr.size, tenses: [...pr.tenses], groups: [...pr.groups] });
}
// the record belongs to the game actually played (fewer pairs when the groups are small)
const prBestKey = () => [pr.mode, pr.kind, pr.pairs.length].join(':');
const prOldBest = key => (Number.isFinite(prBest[key]) && prBest[key] > 0 ? prBest[key] : 0);

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
      add({ fr: SUBJ[p] + ' · ' + inf, tag: pr.tenses.size > 1 ? TENSE_SHORT[t] : '', bg: formAnswer(f), say: formText(f), inf });
    };
    // one form per verb first, then fill
    items.forEach(it => {
      if (usedInf.has(it[0]) || pairs.length >= pr.size) return;
      const n = pairs.length;
      tryAdd(it);
      if (pairs.length > n) usedInf.add(it[0]);
    });
    items.forEach(it => tryAdd(it));
  }
  return pairs;
}
/* how many pairs the settings can give (Превод runs short with one small group) */
function prAvailable() {
  if (pr.kind !== 'tr') return pr.size;
  const meanings = new Set(Object.keys(VERB).filter(inf => pr.groups.has(VERB[inf].g)).map(inf => baseMeaning(VERB[inf].bg)));
  return Math.min(pr.size, meanings.size);
}

/* ---------- settings ---------- */
function prChoice(items, cur, set) {
  return items.map(([id, label]) => toggleBtn(label, cur === id, () => { if (cur !== id) { set(id); prSettingsChanged(); } }));
}
function renderPrSettings() {
  $('p-mode').replaceChildren(...prChoice(PR_MODES, pr.mode, v => { pr.mode = v; }));
  $('p-kind').replaceChildren(...prChoice(PR_KINDS, pr.kind, v => { pr.kind = v; }));
  $('p-tenses').replaceChildren(...setToggles(TENSE_ITEMS, pr.tenses, prSettingsChanged));
  $('p-tense-field').hidden = pr.kind !== 'cj';
  $('p-groups').replaceChildren(...setToggles(GROUP_ITEMS, pr.groups, prSettingsChanged));
  $('p-size').replaceChildren(...prChoice(PR_SIZES.map(n => [n, String(n)]), pr.size, v => { pr.size = v; }));
  const parts = [PR_MODES.find(m => m[0] === pr.mode)[1], PR_KINDS.find(k => k[0] === pr.kind)[1], prAvailable() + ' двойки'];
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

/* ---------- time ---------- */
const prNow = () => (pr.start ? (performance.now() - pr.start) / 1000 : 0);
const prClock = secs => { const s = Math.floor(secs); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
// tenths, so a new record never looks the same as the old one
const prFmt = secs => prClock(secs) + ',' + Math.floor((secs * 10) % 10);
function prStopTimer() {
  if (pr.timer) { clearInterval(pr.timer); pr.timer = null; }
}
function prTick() {
  if (pr.ui) pr.ui.clock.textContent = prClock(prNow());
}
function prBegin() {
  if (pr.start) return;
  pr.start = performance.now();
  pr.timer = setInterval(prTick, 500);
}
function prPause() {
  if (pr.start && !pr.done && !pr.pausedAt) { prStopTimer(); pr.pausedAt = performance.now(); }
}
function prResume() {
  if (pr.pausedAt && !pr.done) {
    pr.start += performance.now() - pr.pausedAt;
    pr.pausedAt = 0;
    pr.timer = setInterval(prTick, 500);
  }
}

/* ---------- game ---------- */
function prStart(pairs) {
  prStopTimer();
  clearTimeout(pr.endTimer);
  clearTimeout(pr.flipTimer);
  stopAll();
  pr.pairs = pairs || prBuild();
  pr.sel = null;
  pr.open = [];
  pr.seen = new Set();
  pr.found = 0;
  pr.mistakes = 0;
  pr.busy = false;
  pr.done = false;
  pr.start = 0;
  pr.pausedAt = 0;
  pr.elapsed = 0;
  prRender();
}

function prTile(pairIdx, side) {
  const p = pr.pairs[pairIdx];
  const b = el('button', 'pr-tile ' + (side === 'fr' ? 'pr-fr' : 'pr-bg'));
  b.type = 'button';
  const text = side === 'fr' ? p.fr : p.bg;
  const face = el('span', 'pr-face', text);
  if (side === 'fr' || pr.kind === 'cj') face.lang = 'fr';
  if (side === 'fr' && p.tag) face.append(el('small', 'pr-tag', p.tag));
  b.dataset.pair = String(pairIdx);
  b.dataset.side = side;
  const label = text + (side === 'fr' && p.tag ? ', ' + p.tag : '');
  if (pr.mode === 'memory') {
    b.append(el('span', 'pr-back', '?'), face);
    b.setAttribute('aria-label', 'Скрита плочка');
  } else {
    b.append(face);
    b.setAttribute('aria-pressed', 'false');
  }
  b.addEventListener('click', () => prTap(b));
  return { b, pairIdx, side, text, label };
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
  if (pr.pairs.length < pr.size) {
    box.appendChild(el('p', 'set-note', 'С тези групи стават само ' + pr.pairs.length + ' двойки. Добави групи от Настройки за повече.'));
  }

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

function prSpeakFr(t) {
  const p = pr.pairs[t.pairIdx];
  if (t.side === 'fr' && pr.kind === 'tr') speak(p.say, t.b);
}

function prTap(b) {
  if (pr.done || pr.busy || b.classList.contains('found')) return;
  const t = pr.tiles.find(x => x.b === b);
  if (!t) return;
  prBegin();
  if (pr.mode === 'memory') prTapMemory(t);
  else prTapMatch(t);
}

function prSelect(t, on) {
  t.b.classList.toggle('sel', on);
  t.b.setAttribute('aria-pressed', String(on));
}
function prTapMatch(t) {
  if (pr.sel === t) { prSelect(t, false); pr.sel = null; return; }
  if (!pr.sel || pr.sel.side === t.side) {
    if (pr.sel) prSelect(pr.sel, false);
    pr.sel = t;
    prSelect(t, true);
    prSpeakFr(t);
    return;
  }
  const a = pr.sel;
  pr.sel = null;
  prSelect(a, false);
  prJudge(a, t, true);
}

function prTapMemory(t) {
  if (pr.open.includes(t)) return;
  t.b.classList.add('open');
  t.b.setAttribute('aria-label', t.label);
  pr.open.push(t);
  prSpeakFr(t);
  if (pr.open.length < 2) return;
  const [a, c] = pr.open;
  pr.open = [];
  // a mistake only when you could have known: the partner of the first tile, or the second tile, was seen before
  const partner = pr.tiles.find(x => x.pairIdx === a.pairIdx && x !== a);
  const avoidable = pr.seen.has(partner) || pr.seen.has(c);
  pr.seen.add(a);
  pr.seen.add(c);
  if (a.pairIdx === c.pairIdx) {
    prJudge(a, c, false);
    return;
  }
  pr.busy = true;
  if (avoidable) pr.mistakes++;
  a.b.classList.add('wrong');
  c.b.classList.add('wrong');
  pr.ui.msg.textContent = 'Не са двойка.';
  pr.flipTimer = setTimeout(() => {
    [a, c].forEach(x => {
      x.b.classList.remove('open', 'wrong');
      x.b.setAttribute('aria-label', 'Скрита плочка');
    });
    pr.busy = false;
  }, PR_FLIP_BACK_MS);
}

function prJudge(a, c, countMistake) {
  if (a.pairIdx === c.pairIdx) {
    [a, c].forEach(x => {
      x.b.classList.add('found');
      x.b.classList.remove('open');
      x.b.disabled = true;
      x.b.setAttribute('aria-label', x.label + ' (намерена)');
    });
    pr.found++;
    pr.ui.stat.textContent = 'Двойки: ' + pr.found + ' от ' + pr.pairs.length;
    const p = pr.pairs[a.pairIdx];
    pr.ui.msg.textContent = p.fr + ' = ' + p.bg;
    speak(p.say, (a.side === 'fr' ? a : c).b);
    if (pr.found === pr.pairs.length) {
      // the time stops at the last pair; the result screen follows
      pr.elapsed = prNow();
      prStopTimer();
      pr.done = true;
      pr.endTimer = setTimeout(prEnd, 500);
    }
  } else {
    if (countMistake) pr.mistakes++;
    [a, c].forEach(x => {
      x.b.classList.add('wrong');
      setTimeout(() => x.b.classList.remove('wrong'), 450);
    });
    pr.ui.msg.textContent = 'Не са двойка. Опитай пак.';
  }
}

function prEnd() {
  pr.endTimer = null;
  if (!pr.done || !pr.ui || pr.found < pr.pairs.length) return;
  const secs = pr.elapsed;
  track('pairs_complete', { mode: pr.mode, kind: pr.kind, pairs: pr.pairs.length, seconds: Math.round(secs), mistakes: pr.mistakes });
  const key = prBestKey();
  const old = prOldBest(key);
  const record = !old || secs < old;
  if (record) {
    prBest[key] = Math.floor(secs * 10) / 10;
    save('dvoiki-best', prBest);
  }
  const card = el('div', 'qcard');
  card.appendChild(el('p', 'eyebrow kind', 'Bravo !'));
  const head = el('div', 'result-head');
  head.append(el('p', 'score', prFmt(secs)), el('p', 'grade', record ? 'Нов рекорд!' : 'Рекорд: ' + prFmt(old)));
  card.appendChild(head);
  const msg = el('p', 'result-msg');
  msg.append(el('i', null, pr.mistakes === 0 ? 'Parfait ! ' : pr.mistakes <= 2 ? 'Très bien ! ' : 'Continue ! '),
    document.createTextNode(pr.pairs.length + ' двойки, ' + (pr.mistakes === 1 ? '1 грешка.' : pr.mistakes + ' грешки.')));
  card.appendChild(msg);

  // all pairs to listen to once more; in Спрежение show what was asked next to the form
  const list = el('ul', 'pr-list');
  pr.pairs.forEach(p => {
    const li = el('li');
    li.append(sayButton(p.say, 'sbtn'), el('span', 'm-prompt', pr.kind === 'cj' ? p.fr + (p.tag ? ' · ' + p.tag : '') : p.bg));
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

/* the clock stops while the game is not shown or the app is in the background */
// it runs only while the game is on screen, the app is in front and no dialog covers it
const prCanPlay = () => gameShown('pairs') && !document.hidden && !document.querySelector('dialog[open]');
const prFollow = () => (prCanPlay() ? prResume() : prPause());
VIEWS.forEach(v => $('tab-' + v).addEventListener('click', prFollow));
document.addEventListener('gamechange', prFollow);
document.addEventListener('visibilitychange', prFollow);

renderPrSettings();
prStart(null);
