/* French verbs app: verb list, flashcards and test, in three tenses.
   Data (GROUPS, SENT) comes from data.js. */

const ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const PLAY = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14l12-7z" fill="currentColor"/></svg>';
const STOP = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/></svg>';

const $ = id => document.getElementById(id);

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

/* ---------- tenses ---------- */
const TENSES = [
  { id: 'pr', label: 'Présent', bg: 'сегашно време' },
  { id: 'pc', label: 'Passé composé', bg: 'минало време' },
  { id: 'fp', label: 'Futur proche', bg: 'близко бъдеще' }
];
const TENSE = Object.fromEntries(TENSES.map(t => [t.id, t]));
const TENSE_NOTE = {
  pc: ['Как се образува', [
    ['j\'ai joué', 'avoir в сегашно време + минало причастие'],
    ['je suis allé', 'с être: глаголите за движение (aller, venir, partir, sortir…) и всички възвратни'],
    ['elle est allée', 'с être причастието се съгласува: +e за женски род, +s за множествено число'],
    ['je me suis réuni', 'при възвратните местоимението е пред être']
  ]],
  fp: ['Как се образува', [
    ['je vais jouer', 'aller в сегашно време + инфинитив'],
    ['nous allons partir', 'за планове и неща, които ще станат скоро'],
    ['je vais me réunir', 'при възвратните местоимението е пред инфинитива']
  ]]
};

const SUBJ = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];
const AVOIR = ['ai', 'as', 'a', 'avons', 'avez', 'ont'];
const ETRE = ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'];
const ALLER = ['vais', 'vas', 'va', 'allons', 'allez', 'vont'];
const REFL = ['me', 'te', 'se', 'nous', 'vous', 'se'];
const AGREE = ['(e)', '(e)', '', '(e)s', '(e)(s)', 's'];

const startsWithVowel = s => /^[aeiouyhéèêâîôûœ]/i.test(s);
/* "je" + "ai" -> "j'", "me" + "appeler" -> "m'", otherwise word + space */
function elide(word, next) {
  return ['je', 'me', 'te', 'se'].includes(word) && startsWithVowel(next) ? word[0] + "'" : word + ' ';
}
const isReflexive = inf => /^(se |s')/.test(inf);
const bareInf = inf => inf.replace(/^(se |s')/, '');

/* A form is { pron, pre, red, post }: the subject part (muted), then the verb with the
   part that changes shown in red. Text in (brackets) is an optional agreement ending. */
const formText = f => f.pron + f.pre + f.red + f.post;
const formAnswer = f => f.pre + f.red + f.post;
const spoken = t => t.replace(/\([^)]*\)/g, '');

function splitForm(text) {
  const cut = Math.max(text.lastIndexOf(' '), text.lastIndexOf("'")) + 1;
  return [text.slice(0, cut), text.slice(cut)];
}

const VERB = {};
GROUPS.forEach(g => g.verbs.forEach(([inf, bg, conj, aux, pp]) => {
  VERB[inf] = { g: g.id, bg, present: conj.split(', '), aux, pp, ends: g.ends, cache: {} };
}));

function forms(inf, tense) {
  const v = VERB[inf];
  if (v.cache[tense]) return v.cache[tense];
  const refl = isReflexive(inf);
  const out = SUBJ.map((s, i) => {
    if (tense === 'pr') {
      const [pron, word] = splitForm(v.present[i]);
      const end = v.ends ? v.ends[i] : '';
      if (end && word.length > end.length && word.endsWith(end)) {
        return { pron, pre: word.slice(0, -end.length), red: end, post: '' };
      }
      return { pron, pre: word, red: '', post: '' };
    }
    if (tense === 'pc') {
      const aux = v.aux === 'e' ? ETRE[i] : AVOIR[i];
      const pron = refl ? s + ' ' + elide(REFL[i], aux) : elide(s, aux);
      return { pron, pre: aux + ' ', red: v.pp + (v.aux === 'e' ? AGREE[i] : ''), post: '' };
    }
    const b = bareInf(inf);
    return { pron: s + ' ', pre: '', red: ALLER[i], post: ' ' + (refl ? elide(REFL[i], b) + b : inf) };
  });
  v.cache[tense] = out;
  return out;
}

/* all spellings accepted for an answer with optional (e)/(s) endings */
function variants(s) {
  const m = s.match(/\(([^)]*)\)/);
  if (!m) return [s];
  const a = s.slice(0, m.index), b = s.slice(m.index + m[0].length);
  return variants(a + b).concat(variants(a + m[1] + b));
}

/* ---------- speech ---------- */
const synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
let voice = null;
let slow = load('verbes-slow', 0) === 1;

const hint = $('hint');
function showHint(text) { hint.textContent = text; hint.hidden = false; }

function loadVoices() {
  if (!synth) return;
  const vs = synth.getVoices();
  voice = vs.find(v => /^fr[-_]FR/i.test(v.lang)) || vs.find(v => /^fr/i.test(v.lang)) || null;
  if (vs.length && !voice) {
    showHint('На устройството няма френски глас, затова думите може да звучат с чужд акцент. Добави френски глас от настройките на телефона: Text-to-speech → Google → Инсталиране на гласови данни → Français.');
  } else if (voice) {
    hint.hidden = true;
  }
}
if (synth) {
  loadVoices();
  if ('onvoiceschanged' in synth) synth.onvoiceschanged = loadVoices;
} else {
  showHint('Този браузър не може да чете на глас. Отвори страницата в Chrome или Safari.');
}

function clearSpeaking() {
  document.querySelectorAll('.speaking').forEach(e => e.classList.remove('speaking'));
}
function setPlaying(btn, on) {
  btn.classList.toggle('playing', on);
  const lbl = btn.querySelector('.lbl');
  if (lbl) {
    lbl.textContent = on ? 'Спри' : btn.dataset.label;
    btn.querySelector('svg').outerHTML = on ? STOP : PLAY;
  } else {
    btn.innerHTML = on ? STOP : PLAY;
  }
}
function clearPlaying() {
  document.querySelectorAll('.playing').forEach(b => setPlaying(b, false));
}
function makeUtterance(text, target, follow) {
  const u = new SpeechSynthesisUtterance(spoken(text));
  u.lang = 'fr-FR';
  if (voice) u.voice = voice;
  u.rate = slow ? 0.6 : 0.92;
  u.onstart = () => {
    clearSpeaking();
    if (target) {
      target.classList.add('speaking');
      if (follow) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      }
    }
  };
  u.onend = u.onerror = () => { if (target) target.classList.remove('speaking'); };
  return u;
}
function stopAll() {
  if (!synth) return;
  synth.cancel();
  clearSpeaking();
  clearPlaying();
}
function speak(text, target) {
  if (!synth) return;
  stopAll();
  synth.speak(makeUtterance(text, target, false));
}
function playSeq(btn, items, follow) {
  if (!synth) return;
  const wasPlaying = btn.classList.contains('playing');
  stopAll();
  if (wasPlaying) return;
  setPlaying(btn, true);
  items.forEach(([text, target], i) => {
    const u = makeUtterance(text, target, follow);
    if (i === items.length - 1) {
      const prev = u.onend;
      u.onend = u.onerror = () => { prev(); if (btn.classList.contains('playing')) setPlaying(btn, false); };
    }
    synth.speak(u);
  });
}

/* ---------- helpers ---------- */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sayButton(text, cls) {
  const b = el('button', cls);
  b.type = 'button';
  b.setAttribute('aria-label', 'Произнеси: ' + text);
  b.innerHTML = ICON;
  b.appendChild(el('span', null, text));
  b.addEventListener('click', e => { e.stopPropagation(); speak(text, b); });
  return b;
}
/* one conjugated form: subject muted, changing part in red */
function formButton(f, cls) {
  const text = formText(f);
  const b = el('button', cls || 'form');
  b.type = 'button';
  b.setAttribute('aria-label', 'Произнеси: ' + spoken(text));
  b.innerHTML = ICON;
  const s = el('span');
  if (f.pron) s.appendChild(el('span', 'pr', f.pron));
  if (f.pre) s.appendChild(document.createTextNode(f.pre));
  if (f.red) s.appendChild(el('span', 'end', f.red));
  if (f.post) s.appendChild(document.createTextNode(f.post));
  b.appendChild(s);
  b.addEventListener('click', e => { e.stopPropagation(); speak(text, b); });
  return b;
}
/* a whole sentence with the verb in red */
function sentenceButton(before, answer, after) {
  const full = before + answer + after;
  const b = el('button', 'sbtn');
  b.type = 'button';
  b.setAttribute('aria-label', 'Произнеси: ' + spoken(full));
  b.innerHTML = ICON;
  const s = el('span');
  s.append(document.createTextNode(before), el('span', 'end', answer), document.createTextNode(after));
  b.appendChild(s);
  b.addEventListener('click', () => speak(full, b));
  return b;
}
function toggleBtn(label, pressed, onClick) {
  const b = el('button', 'toggle', label);
  b.type = 'button';
  b.setAttribute('aria-pressed', String(pressed));
  b.addEventListener('click', onClick);
  return b;
}
/* toggles for a Set that must keep at least one item */
function setToggles(items, set, onChange) {
  return items.map(([id, label]) => toggleBtn(label, set.has(id), () => {
    if (set.has(id)) {
      if (set.size === 1) return;
      set.delete(id);
    } else {
      set.add(id);
    }
    onChange();
  }));
}
function validSet(saved, allowed, fallback) {
  const ids = Array.isArray(saved) ? saved.filter(id => allowed.includes(id)) : [];
  return new Set(ids.length ? ids : fallback);
}
const GROUP_IDS = GROUPS.map(g => g.id);
const GROUP_ITEMS = GROUPS.map(g => [g.id, g.chip]);
const TENSE_IDS = TENSES.map(t => t.id);
const TENSE_ITEMS = TENSES.map(t => [t.id, t.label]);
const tensesLabel = set => TENSE_IDS.filter(t => set.has(t)).map(t => TENSE[t].label).join(', ');
function groupsLabel(set) {
  if (set.size === GROUPS.length) return null;
  return set.size + '\u00a0' + (set.size === 1 ? 'група' : 'групи');
}

/* ---------- verb list ---------- */
const chips = $('chips');
const root = $('groups');
let listTense = TENSE_IDS.includes(load('verbes-tense', 'pr')) ? load('verbes-tense', 'pr') : 'pr';

GROUPS.forEach(g => {
  const a = el('a', null, g.chip);
  a.href = '#' + g.id;
  chips.appendChild(a);
});

function renderTenseBar() {
  $('tense-bar').replaceChildren(...TENSES.map(t => {
    const b = toggleBtn(t.label, t.id === listTense, () => {
      listTense = t.id;
      save('verbes-tense', listTense);
      stopAll();
      renderTenseBar();
      renderVerbs();
    });
    return b;
  }));
}

function renderNote(title, items) {
  const n = el('div', 'note');
  n.appendChild(el('h3', null, title));
  items.forEach(([fr, bg]) => {
    const it = el('div', 'note-item');
    it.append(sayButton(fr, 'chip'), el('span', null, bg));
    n.appendChild(it);
  });
  return n;
}

function renderVerbs() {
  const t = listTense;
  const parts = [];
  if (TENSE_NOTE[t]) parts.push(renderNote(...TENSE_NOTE[t]));

  GROUPS.forEach(g => {
    const sec = el('section');
    sec.id = g.id;

    let sub = '';
    if (t === 'pr') sub = g.sub;
    else if (t === 'pc') {
      const withEtre = g.verbs.filter(v => v[3] === 'e').map(v => v[0]);
      sub = withEtre.length ? 'Със être: ' + withEtre.join(', ') + '. Останалите са с avoir.' : 'Всички са с avoir.';
    }

    const head = el('div', 'sec-head');
    const hText = el('div');
    hText.appendChild(el('h2', null, g.title));
    if (sub) hText.appendChild(el('p', 'sub', sub));
    const play = el('button', 'play');
    play.type = 'button';
    play.dataset.label = 'Чуй глаголите';
    play.innerHTML = PLAY + '<span class="lbl">Чуй глаголите</span>';
    head.append(hText, play);
    sec.appendChild(head);

    const queue = [];
    g.verbs.forEach(([inf, bg, , aux]) => {
      const row = el('div', 'verb');
      const say = sayButton(inf, 'say');
      const vplay = el('button', 'vplay');
      vplay.type = 'button';
      vplay.setAttribute('aria-label', 'Чуй спрежението на ' + inf);
      vplay.innerHTML = PLAY;
      const meaning = el('div', 'meaning', bg);
      if (t === 'pc' && aux === 'e') meaning.append(' ', el('span', 'tag', 'être'));
      row.append(say, meaning, vplay);

      const grid = el('div', 'conj');
      const fq = [];
      forms(inf, t).forEach(f => {
        const fb = formButton(f);
        grid.appendChild(fb);
        fq.push([formText(f), fb]);
      });
      row.appendChild(grid);
      vplay.addEventListener('click', () => playSeq(vplay, fq, false));

      queue.push([inf, say]);
      sec.appendChild(row);
    });
    play.addEventListener('click', () => playSeq(play, queue, true));

    if (t === 'pr' && g.note) sec.appendChild(renderNote(g.note.title, g.note.items));
    parts.push(sec);
  });
  root.replaceChildren(...parts);
}

$('meta').textContent = Object.keys(VERB).length + ' глагола · 3 времена · il важи и за elle, ils и за elles';

/* ---------- speed toggle ---------- */
const bN = $('spd-normal');
const bS = $('spd-slow');
function setSlow(v) {
  slow = v;
  bN.setAttribute('aria-pressed', String(!v));
  bS.setAttribute('aria-pressed', String(v));
  save('verbes-slow', v ? 1 : 0);
}
bN.addEventListener('click', () => setSlow(false));
bS.addEventListener('click', () => setSlow(true));
setSlow(slow);

/* ---------- tabs ---------- */
const VIEWS = ['verbs', 'cards', 'test'];
let currentView = 'verbs';
function showView(name) {
  currentView = name;
  VIEWS.forEach(v => {
    $('view-' + v).hidden = v !== name;
    $('tab-' + v).setAttribute('aria-selected', String(v === name));
  });
  stopAll();
  save('verbes-view', name);
}
VIEWS.forEach(v => $('tab-' + v).addEventListener('click', () => showView(v)));

/* ---------- answer checking ---------- */
function norm(s) {
  return s.normalize('NFC').toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').replace(/' /g, "'").trim();
}
function strip(s) {
  return norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');
}

/* ---------- flashcards ---------- */
const KINDS = [['tr', 'Превод'], ['rv', 'Обратно'], ['cj', 'Спрежение']];
const CARD_COUNTS = [10, 20, 30];
const KNOWN_BOX = 3;
const savedCards = load('cartes-set', {});
const cs = {
  kind: KINDS.some(k => k[0] === savedCards.kind) ? savedCards.kind : 'tr',
  count: CARD_COUNTS.includes(savedCards.count) ? savedCards.count : 10,
  tenses: validSet(savedCards.tenses, TENSE_IDS, ['pr']),
  groups: validSet(savedCards.groups, GROUP_IDS, GROUP_IDS),
  queue: [], total: 0, done: 0, missed: new Set(), streak: 0, flipped: false, busy: false
};
let boxes = load('cartes-box', {});
if (typeof boxes !== 'object' || Array.isArray(boxes)) boxes = {};

function cardPool() {
  const pool = [];
  Object.keys(VERB).forEach(inf => {
    if (!cs.groups.has(VERB[inf].g)) return;
    if (cs.kind === 'cj') {
      cs.tenses.forEach(t => { for (let p = 0; p < 6; p++) pool.push({ key: 'cj:' + t + ':' + inf + ':' + p, kind: 'cj', inf, t, p }); });
    } else {
      pool.push({ key: cs.kind + ':' + inf, kind: cs.kind, inf });
    }
  });
  return pool;
}
function knownCount(pool) {
  return pool.filter(c => (boxes[c.key] || 0) >= KNOWN_BOX).length;
}
function saveCardSettings() {
  save('cartes-set', { kind: cs.kind, count: cs.count, tenses: [...cs.tenses], groups: [...cs.groups] });
}

function renderCardSettings() {
  $('c-kind').replaceChildren(...KINDS.map(([id, label]) => toggleBtn(label, cs.kind === id, () => { cs.kind = id; cardSettingsChanged(); })));
  $('c-tenses').replaceChildren(...setToggles(TENSE_ITEMS, cs.tenses, cardSettingsChanged));
  $('c-tense-field').hidden = cs.kind !== 'cj';
  $('c-groups').replaceChildren(...setToggles(GROUP_ITEMS, cs.groups, cardSettingsChanged));
  $('c-count').replaceChildren(...CARD_COUNTS.map(n => toggleBtn(String(n), cs.count === n, () => { cs.count = n; cardSettingsChanged(); })));
  const pool = cardPool();
  $('c-known').textContent = 'Научени карти с тези настройки: ' + knownCount(pool) + ' от ' + pool.length + '.';
  const parts = [KINDS.find(k => k[0] === cs.kind)[1], cardsWord(Math.min(cs.count, pool.length))];
  if (cs.kind === 'cj') parts.push(tensesLabel(cs.tenses));
  const gl = groupsLabel(cs.groups);
  if (gl) parts.push(gl);
  $('c-sum').textContent = parts.join(' · ');
}
function cardSettingsChanged() {
  saveCardSettings();
  renderCardSettings();
  startCards();
}
$('c-reset').addEventListener('click', () => {
  if (!confirm('Да изчистя ли прогреса по всички карти?')) return;
  boxes = {};
  save('cartes-box', boxes);
  renderCardSettings();
  startCards();
});

/* Pick a deck of cs.count cards: least known first (random within the same
   level) and one card per verb before any verb repeats. Cards come in tiers:
   verbs not in skipInf first, then unplayed cards of those verbs (other forms),
   and the cards in skipKeys only when nothing else is left. */
function pickDeck(skipInf, skipKeys) {
  const skipV = skipInf || new Set();
  const skipK = skipKeys || new Set();
  const ranked = shuffle(cardPool())
    .map(c => [c, boxes[c.key] || 0])
    .sort((a, b) => a[1] - b[1])
    .map(x => x[0]);
  const tiers = [
    ranked.filter(c => !skipV.has(c.inf)),
    ranked.filter(c => skipV.has(c.inf) && !skipK.has(c.key)),
    ranked.filter(c => skipV.has(c.inf) && skipK.has(c.key))
  ];
  const deck = [];
  tiers.forEach(tier => {
    const used = new Set();
    for (const c of tier) {
      if (deck.length >= cs.count) break;
      if (used.has(c.inf)) continue;
      used.add(c.inf);
      deck.push(c);
    }
    for (const c of tier) {
      if (deck.length >= cs.count) break;
      if (!deck.includes(c)) deck.push(c);
    }
  });
  return shuffle(deck);
}

// a number and its noun stay on one line (non-breaking space)
const cardsWord = k => k + '\u00a0' + (k === 1 ? 'карта' : 'карти');
const questionsWord = k => k + '\u00a0' + (k === 1 ? 'въпрос' : 'въпроса');

/* keep: { inf, keys } of the round this one replays, so "new words" stays new
   after "same cards" or "only the hard ones" */
function startCards(list, keep) {
  stopAll();
  const deck = list || pickDeck();
  cs.deck = deck.slice();
  cs.roundInf = new Set([...(keep ? keep.inf : []), ...deck.map(c => c.inf)]);
  cs.roundKeys = new Set([...(keep ? keep.keys : []), ...deck.map(c => c.key)]);
  cs.queue = deck.slice();
  cs.total = deck.length;
  cs.done = 0;
  cs.missed = new Set();
  cs.missedCards = [];
  cs.streak = 0;
  renderCard();
}

function cardFaces(c) {
  const front = el('div', 'face front');
  const back = el('div', 'face back');
  const v = VERB[c.inf];
  if (c.kind === 'tr') {
    front.append(el('p', 'eyebrow', 'Какво означава?'), sayButton(c.inf, 'say big'));
    back.append(el('p', 'eyebrow', c.inf), el('p', 'big-text', v.bg));
    const f = forms(c.inf, 'pr')[0];
    back.appendChild(formButton(f));
  } else if (c.kind === 'rv') {
    front.append(el('p', 'eyebrow', 'Как е на френски?'), el('p', 'big-text', promptMeaning(c.inf)));
    back.append(el('p', 'eyebrow', v.bg), sayButton(c.inf, 'say big'));
  } else {
    const f = forms(c.inf, c.t)[c.p];
    const head = el('div', 'qverb');
    head.append(sayButton(c.inf, 'say'), el('span', 'meaning', promptMeaning(c.inf)));
    const q = el('p', 'big-text');
    q.append(el('span', 'pr', f.pron.trim()), document.createTextNode(' …'));
    front.append(el('p', 'eyebrow', TENSE[c.t].label), head, q);
    back.append(el('p', 'eyebrow', TENSE[c.t].label + ' · ' + c.inf), formButton(f, 'form big'));
  }
  front.appendChild(el('p', 'fc-hint', 'Чукни картата, за да я обърнеш'));
  return [front, back];
}
function cardSpeech(c) {
  if (c.kind === 'cj') return formText(forms(c.inf, c.t)[c.p]);
  return c.inf;
}

const cardsRoot = $('cards');
let cardUI = null;

function renderCard() {
  cs.flipped = false;
  cs.busy = false;
  if (!cs.queue.length) { renderCardsEnd(); return; }
  const c = cs.queue[0];

  const box = el('div', 'fc-box');
  const top = el('div', 'qtop');
  top.append(el('span', null, 'Остават ' + cs.queue.length + ' от ' + cs.total), el('span', 'streak', cs.streak >= 2 ? 'Серия: ' + cs.streak : ''));
  const prog = el('div', 'progress');
  const bar = el('i');
  bar.style.width = (cs.done / cs.total * 100) + '%';
  prog.appendChild(bar);

  const card = el('div', 'fcard');
  const inner = el('div', 'fc-inner');
  const [front, back] = cardFaces(c);
  back.setAttribute('aria-hidden', 'true');
  inner.append(front, back);
  card.appendChild(inner);

  const actions = el('div', 'actions fc-actions');
  const flip = el('button', 'btn primary', 'Обърни');
  flip.type = 'button';
  const again = el('button', 'btn', 'Още не');
  again.type = 'button';
  again.hidden = true;
  const known = el('button', 'btn primary', 'Знам');
  known.type = 'button';
  known.hidden = true;
  actions.append(again, flip, known);

  const keys = el('p', 'fc-keys', 'Плъзни надясно = знам, наляво = още не.');
  box.append(top, prog, card, actions, keys);
  cardsRoot.replaceChildren(box);

  cardUI = { c, card, front, back, flip, again, known };
  flip.addEventListener('click', doFlip);
  again.addEventListener('click', () => grade(false));
  known.addEventListener('click', () => grade(true));

  // tap to flip, swipe to grade
  let x0 = null, y0 = null;
  card.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    x0 = e.clientX;
    y0 = e.clientY;
    try { card.setPointerCapture(e.pointerId); } catch (err) {}
  });
  card.addEventListener('pointercancel', () => { x0 = null; });
  card.addEventListener('pointerup', e => {
    if (x0 == null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (cs.flipped && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) grade(dx > 0);
    else if (!cs.flipped && Math.abs(dx) < 10 && Math.abs(dy) < 10) doFlip();
  });

  if (c.kind === 'tr') speak(c.inf, front.querySelector('.say'));
}

function doFlip() {
  if (!cardUI || cs.flipped) return;
  cs.flipped = true;
  const { c, card, front, back, flip, again, known } = cardUI;
  card.classList.add('flipped');
  front.setAttribute('aria-hidden', 'true');
  back.removeAttribute('aria-hidden');
  flip.hidden = true;
  again.hidden = false;
  known.hidden = false;
  known.focus({ preventScroll: true });
  speak(cardSpeech(c), back.querySelector('.say, .form'));
}

function grade(ok) {
  if (!cardUI || !cs.flipped || cs.busy) return;
  cs.busy = true;
  const { c, card } = cardUI;
  const b = boxes[c.key] || 0;
  if (ok) {
    boxes[c.key] = Math.min(b + 1, 5);
    cs.streak++;
    cs.done++;
    cs.queue.shift();
  } else {
    boxes[c.key] = 0;
    cs.streak = 0;
    if (!cs.missed.has(c.key)) { cs.missed.add(c.key); cs.missedCards.push(c); }
    const item = cs.queue.shift();
    cs.queue.splice(Math.min(3, cs.queue.length), 0, item);
  }
  save('cartes-box', boxes);
  stopAll();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { renderCard(); return; }
  card.classList.add(ok ? 'out-right' : 'out-left');
  setTimeout(renderCard, 220);
}

function renderCardsEnd() {
  cardUI = null;
  const n = cs.total, first = n - cs.missed.size;
  const box = el('div', 'qcard');
  box.appendChild(el('p', 'eyebrow kind', 'Bravo !'));
  const score = el('p', 'score', String(first));
  score.appendChild(el('small', null, ' / ' + n + ' от първия път'));
  box.appendChild(score);
  const pool = cardPool();
  const msg = el('p', 'result-msg');
  msg.append(el('i', null, first === n ? 'Parfait ! ' : first >= n * 0.7 ? 'Très bien ! ' : 'Continue ! '),
    document.createTextNode('Научени карти: ' + knownCount(pool) + ' от ' + pool.length + '. Една карта е научена, когато я знаеш ' + KNOWN_BOX + ' пъти подред.'));
  box.appendChild(msg);

  // what next: test these words, replay the same cards, or new words
  const deck = cs.deck.slice();
  const missed = cs.missedCards.slice();
  const round = { inf: new Set(cs.roundInf), keys: new Set(cs.roundKeys) };
  const cj = cs.kind === 'cj';
  const word = cj ? 'глаголи' : 'думи';
  const one = n === 1;

  box.appendChild(el('h3', 'next-title', 'Какво следва?'));
  const choices = el('div', 'choices');

  const testBtn = choiceButton(
    cj ? (new Set(deck.map(c => c.inf)).size === 1 ? 'Тест с този глагол' : 'Тест с тези глаголи')
      : (one ? 'Тест с тази дума' : 'Тест с тези думи'),
    (cj ? (one ? 'Пишеш същата форма' : 'Пишеш същите форми') : 'Виждаш значението и пишеш глагола на френски') + ' · ' + questionsWord(n),
    () => startTestFromCards(deck), true);
  const againBtn = choiceButton(
    one ? 'Пак същата карта' : 'Пак същите карти',
    one ? 'Изиграй я отново' : 'Изиграй отново същите ' + cardsWord(n),
    () => startCards(shuffle(deck.slice()), round));
  choices.append(testBtn, againBtn);
  if (missed.length && missed.length < n) {
    const hard = el('button', 'linkbtn choice-sub', 'Само трудните (' + missed.length + ')');
    hard.type = 'button';
    hard.addEventListener('click', () => startCards(shuffle(missed.slice()), round));
    choices.appendChild(hard);
  }

  // the next deck is picked now, so the description says exactly what it holds
  const next = pickDeck(round.inf, round.keys);
  const fresh = next.filter(c => !round.inf.has(c.inf));
  const newVerbs = new Set(fresh.map(c => c.inf)).size;
  const otherForms = next.filter(c => round.inf.has(c.inf) && !round.keys.has(c.key)).length;
  const repeats = next.length - fresh.length - otherForms;
  let newBtn;
  if (repeats === next.length) {
    newBtn = choiceButton('Още ' + word,
      cj ? 'Няма други карти с тези настройки. Отвори Настройки и добави времена или групи.'
        : 'Няма други думи с тези настройки. Отвори Настройки и добави групи.',
      () => {
        const set = $('c-settings');
        set.open = true;
        set.querySelector('summary').focus({ preventScroll: true });
        set.scrollIntoView({ block: 'nearest' });
      });
  } else {
    const verbsTxt = newVerbs === 1 ? '1\u00a0нов глагол' : newVerbs + '\u00a0нови глагола';
    const parts = [];
    if (fresh.length) parts.push(fresh.length + '\u00a0с ' + (cj ? verbsTxt : fresh.length === 1 ? 'нова дума' : 'нови думи'));
    if (otherForms) parts.push(otherForms + '\u00a0' + (otherForms === 1 ? 'друга форма' : 'други форми') + ' на същите глаголи');
    if (repeats) parts.push(repeats + '\u00a0от досегашните');
    let desc;
    if (fresh.length === next.length) desc = cardsWord(next.length) + ' с ' + (cj ? verbsTxt : 'други думи');
    else if (otherForms === next.length) desc = cardsWord(next.length) + ' с други форми на същите глаголи';
    else desc = cardsWord(next.length) + ': ' + parts.join(', ');
    newBtn = choiceButton(fresh.length ? 'Нови ' + word : 'Други форми', desc, () => startCards(next));
  }
  choices.appendChild(newBtn);
  box.appendChild(choices);

  cardsRoot.replaceChildren(box);
  renderCardSettings();
  testBtn.focus({ preventScroll: true });
}

function choiceButton(title, desc, onClick, primary) {
  const b = el('button', 'choice' + (primary ? ' primary' : ''));
  b.type = 'button';
  b.append(el('span', 'choice-title', title), el('span', 'choice-desc', desc));
  b.addEventListener('click', onClick);
  return b;
}

/* a test round made of the cards just played */
function cardQuestion(c) {
  return c.kind === 'cj' ? conjQ(c.inf, c.p, c.t) : wordQ(c.inf);
}
function startTestFromCards(deck) {
  showView('test');
  startRound(shuffle(deck.map(cardQuestion)), true, true);
}

document.addEventListener('keydown', e => {
  if (currentView !== 'cards' || !cardUI) return;
  if (e.target.closest('input, textarea, summary') || e.altKey || e.ctrlKey || e.metaKey) return;
  const btn = e.target.closest('button');
  if (!cs.flipped && (e.key === ' ' || e.key === 'Enter') && (!btn || btn === $('tab-cards'))) { e.preventDefault(); doFlip(); }
  else if (cs.flipped && e.key === 'ArrowRight') { e.preventDefault(); grade(true); }
  else if (cs.flipped && e.key === 'ArrowLeft') { e.preventDefault(); grade(false); }
});

/* ---------- test ---------- */
const MODES = [['mix', 'Смесено'], ['conj', 'Спрежения'], ['sent', 'Изречения']];
const COUNTS = [10, 20];
const KEYS = ['é', 'è', 'ê', 'ç', 'î', 'ô'];

const savedTest = load('verbes-test', {}) || {};
const st = {
  mode: MODES.some(m => m[0] === savedTest.mode) ? savedTest.mode : 'mix',
  count: COUNTS.includes(savedTest.count) ? savedTest.count : 10,
  groups: validSet(savedTest.groups, GROUP_IDS, GROUP_IDS),
  tenses: validSet(savedTest.tenses, TENSE_IDS, ['pr']),
  qs: [], i: 0, score: 0, wrong: [], checked: false
};
function saveSettings() {
  save('verbes-test', { mode: st.mode, count: st.count, groups: [...st.groups], tenses: [...st.tenses] });
}

function conjQ(inf, p, tense) {
  const f = forms(inf, tense)[p];
  return { type: 'conj', inf, p, tense, form: f, pron: f.pron, answer: formAnswer(f), full: formText(f), speak: formText(f) };
}
/* vocabulary question: Bulgarian meaning -> French infinitive.
   Brackets with French in them are hidden, so plaire's hint does not give the answer away. */
const baseMeaning = bg => bg.replace(/\s*\([^)]*\)/g, '').trim();
const promptMeaning = inf => VERB[inf].bg.replace(/\s*\([^)]*[a-z][^)]*\)/gi, '').trim();
function wordQ(inf) {
  const bg = promptMeaning(inf);
  // other verbs with the same meaning count too (живея: vivre, habiter)
  const same = Object.keys(VERB).filter(x => x !== inf && baseMeaning(VERB[x].bg) === baseMeaning(VERB[inf].bg));
  return { type: 'word', inf, tense: null, answer: inf, also: same, speak: inf, bg };
}
function sentQ(row) {
  const [tense, inf, s, a, bg] = row;
  const [before, after] = s.split('___');
  return { type: 'sent', tense, inf, before, after, answer: a, speak: before + a + after, bg };
}
function sentPoolFor() {
  return SENT.filter(r => st.tenses.has(r[0]) && st.groups.has(VERB[r[1]].g));
}
function buildRound() {
  const conjPool = [];
  Object.keys(VERB).forEach(inf => {
    if (!st.groups.has(VERB[inf].g)) return;
    st.tenses.forEach(t => { for (let p = 0; p < 6; p++) conjPool.push([inf, p, t]); });
  });
  const sentPool = sentPoolFor();
  shuffle(conjPool);
  shuffle(sentPool);

  let nS = st.mode === 'conj' ? 0 : st.mode === 'sent' ? st.count : Math.round(st.count / 2);
  nS = Math.min(nS, sentPool.length);
  const nC = st.mode === 'sent' ? 0 : st.count - nS;

  const cq = [];
  const usedVerb = new Set();
  for (const [inf, p, t] of conjPool) {
    if (cq.length >= nC) break;
    if (usedVerb.has(inf)) continue;
    usedVerb.add(inf);
    cq.push(conjQ(inf, p, t));
  }
  for (const [inf, p, t] of conjPool) {
    if (cq.length >= nC) break;
    if (cq.some(q => q.inf === inf && q.p === p && q.tense === t)) continue;
    cq.push(conjQ(inf, p, t));
  }
  return shuffle(sentPool.slice(0, nS).map(sentQ).concat(cq));
}

function renderSettings() {
  $('set-mode').replaceChildren(...MODES.map(([id, label]) => toggleBtn(label, st.mode === id, () => { st.mode = id; settingsChanged(); })));
  $('set-tenses').replaceChildren(...setToggles(TENSE_ITEMS, st.tenses, settingsChanged));
  $('set-groups').replaceChildren(...setToggles(GROUP_ITEMS, st.groups, settingsChanged));
  $('set-count').replaceChildren(...COUNTS.map(n => toggleBtn(String(n), st.count === n, () => { st.count = n; settingsChanged(); })));
  renderSum();
}
function renderSum() {
  if (st.fromCards || st.retry) {
    $('set-sum').textContent = (st.fromCards ? 'По картите · ' : 'Грешките · ') + questionsWord(st.qs.length);
    return;
  }
  // only "Изречения" can run short: few sentences for some groups and tenses
  const n = st.mode === 'sent' ? Math.min(st.count, sentPoolFor().length) : st.count;
  const parts = [MODES.find(x => x[0] === st.mode)[1], questionsWord(n), tensesLabel(st.tenses)];
  const gl = groupsLabel(st.groups);
  if (gl) parts.push(gl);
  $('set-sum').textContent = parts.join(' · ');
}
function settingsChanged() {
  saveSettings();
  renderSettings();
  startRound(null, false);
}

const quiz = $('quiz');
function startRound(qs, focus, fromCards) {
  stopAll();
  st.fromCards = !!fromCards;
  st.retry = !!qs && !fromCards;
  st.qs = qs || buildRound();
  renderSum();
  st.i = 0;
  st.score = 0;
  st.wrong = [];
  renderQ(focus);
}

function renderQ(focus) {
  const q = st.qs[st.i];
  st.checked = false;
  const card = el('div', 'qcard');

  const top = el('div', 'qtop');
  const scoreEl = el('span', null, 'Верни: ' + st.score);
  top.append(el('span', null, 'Въпрос ' + (st.i + 1) + ' от ' + st.qs.length), scoreEl);
  const prog = el('div', 'progress');
  const bar = el('i');
  bar.style.width = (st.i / st.qs.length * 100) + '%';
  prog.appendChild(bar);
  card.append(top, prog);

  const tl = q.tense ? TENSE[q.tense].label : '';
  card.appendChild(el('p', 'eyebrow kind', q.type === 'conj' ? 'Спрегни в ' + tl
    : q.type === 'sent' ? 'Попълни глагола в ' + tl : 'Напиши инфинитива на френски'));

  const input = el('input', 'ans' + (q.tense !== 'pr' ? ' wide' : ''));
  input.id = 'answer';
  input.type = 'text';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocapitalize', 'none');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('enterkeyhint', 'go');
  input.setAttribute('lang', 'fr');

  if (q.type === 'conj') {
    input.setAttribute('aria-label', 'Формата на ' + q.inf + ' за ' + q.pron.trim() + ' в ' + tl);
    const head = el('div', 'qverb');
    head.append(sayButton(q.inf, 'say'), el('span', 'meaning', promptMeaning(q.inf)));
    const line = el('p', 'qline');
    if (q.pron) line.appendChild(el('span', 'pr', q.pron));
    line.appendChild(input);
    card.append(head, line);
  } else if (q.type === 'word') {
    input.setAttribute('aria-label', 'Френският глагол за „' + q.bg + '“');
    const line = el('p', 'qline');
    line.appendChild(input);
    card.append(el('p', 'big-text', q.bg), line);
  } else {
    input.setAttribute('aria-label', 'Глаголът ' + q.inf + ' в изречението');
    const p = el('p', 'sentence');
    p.append(document.createTextNode(q.before), input, document.createTextNode(' '), el('span', 'inf-hint', '(' + q.inf + ')'), document.createTextNode(q.after));
    card.append(p, el('p', 'bgline', q.bg));
  }

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

  const ui = { input, fb, skip, main, keys, scoreEl, bar };
  main.addEventListener('click', () => st.checked ? next() : check(ui, false));
  skip.addEventListener('click', () => check(ui, true));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      st.checked ? next() : check(ui, false);
    }
  });

  quiz.replaceChildren(card);
  if (focus) {
    input.focus({ preventScroll: true });
    card.scrollIntoView({ block: 'nearest' });
  }
}

function insertChar(input, ch) {
  if (input.readOnly) return;
  const focused = document.activeElement === input;
  const a = focused ? input.selectionStart : input.value.length;
  const b = focused ? input.selectionEnd : input.value.length;
  input.value = input.value.slice(0, a) + ch + input.value.slice(b);
  input.focus();
  input.setSelectionRange(a + 1, a + 1);
}

function answerFeedback(q) {
  if (q.type === 'conj') return formButton(q.form);
  if (q.type === 'word') return sayButton(q.inf, 'form');
  return sentenceButton(q.before, q.answer, q.after);
}

function check(ui, gaveUp) {
  if (st.checked) return;
  const q = st.qs[st.i];
  const val = gaveUp ? '' : ui.input.value;
  if (!gaveUp && !val.trim()) { ui.input.focus(); return; }

  // a reflexive verb also counts without its pronoun: appeler for s'appeler
  const base = q.type === 'conj' ? [q.answer, q.full]
    : q.type === 'word' ? [q.answer, ...q.also].flatMap(x => [x, bareInf(x)]) : [q.answer];
  const cands = base.concat(...base.map(variants));
  const exact = !gaveUp && cands.some(c => norm(c) === norm(val));
  const near = !gaveUp && !exact && cands.some(c => strip(c) === strip(val));
  const good = exact || near;
  if (good) st.score++;
  else st.wrong.push({ q, given: val.trim() });
  st.checked = true;

  ui.input.readOnly = true;
  ui.input.classList.add(exact ? 'ok' : near ? 'near' : 'bad');
  ui.keys.hidden = true;
  ui.skip.hidden = true;
  ui.main.textContent = st.i + 1 < st.qs.length ? 'Напред' : 'Виж резултата';
  ui.scoreEl.textContent = 'Верни: ' + st.score;
  ui.bar.style.width = ((st.i + 1) / st.qs.length * 100) + '%';

  const verdict = exact ? ['ok', 'Правилно!']
    : near ? ['near', 'Почти! Внимавай за знаците над буквите.']
    : gaveUp ? ['bad', 'Ето отговора:'] : ['bad', 'Грешно.'];
  const line = el('p', 'fb-line');
  if (q.type !== 'sent' && !exact) line.appendChild(el('span', null, 'Правилно е'));
  const sayBtn = answerFeedback(q);
  line.appendChild(sayBtn);
  ui.fb.replaceChildren(el('p', 'verdict ' + verdict[0], verdict[1]), line);
  if (q.tense === 'pc' && /\(/.test(q.answer)) {
    ui.fb.appendChild(el('p', 'fb-line', '(e) и (s) се пишат според рода и числото: allé, allée, allés, allées.'));
  }
  ui.fb.hidden = false;
  if (!(exact && document.activeElement === ui.input)) ui.main.focus({ preventScroll: true });
  ui.fb.scrollIntoView({ block: 'nearest' });
  speak(q.speak, sayBtn);
}

function next() {
  stopAll();
  st.i++;
  if (st.i >= st.qs.length) renderResult();
  else renderQ(true);
}

function renderResult() {
  const n = st.qs.length, s = st.score;
  const pct = n ? s / n : 0;
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
    : ['Courage !', 'Прегледай глаголите и опитай пак.'];
  msg.append(el('i', null, fr), document.createTextNode(' ' + bg));
  card.appendChild(msg);

  if (st.wrong.length) {
    const box = el('div', 'mistakes');
    box.appendChild(el('h3', null, 'Грешки'));
    const ul = el('ul');
    st.wrong.forEach(({ q, given }) => {
      const li = el('li');
      const prompt = el('span', 'm-prompt');
      const tl = q.tense ? TENSE[q.tense].label : '';
      if (q.type === 'conj') prompt.textContent = q.inf + ' → ' + q.pron + '___ · ' + tl;
      else if (q.type === 'word') prompt.textContent = q.bg + ' → ___';
      else prompt.textContent = q.before + '___' + q.after + ' (' + q.inf + ') · ' + tl;
      li.appendChild(prompt);
      if (given) {
        const g = el('span', 'm-prompt');
        g.append(document.createTextNode('Твоят отговор: '), el('span', 'given', given));
        li.appendChild(g);
      }
      li.appendChild(answerFeedback(q));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    card.appendChild(box);
  }

  const actions = el('div', 'actions');
  if (st.wrong.length) {
    const retry = el('button', 'btn', 'Повтори грешните');
    retry.type = 'button';
    const again = st.wrong.map(w => w.q);
    const fromCards = st.fromCards;
    retry.addEventListener('click', () => startRound(shuffle(again.slice()), true, fromCards));
    actions.appendChild(retry);
  }
  const fresh = el('button', st.fromCards ? 'btn' : 'btn primary', 'Нов тест');
  fresh.type = 'button';
  fresh.addEventListener('click', () => startRound(null, true));
  actions.appendChild(fresh);
  if (st.fromCards) {
    const back = el('button', 'btn primary', 'Към картите');
    back.type = 'button';
    back.addEventListener('click', () => {
      showView('cards');
      const target = cardsRoot.querySelector('.choice') || (cardUI && (cs.flipped ? cardUI.known : cardUI.flip)) || $('tab-cards');
      target.focus({ preventScroll: true });
      cardsRoot.scrollIntoView({ block: 'nearest' });
    });
    actions.appendChild(back);
  }
  card.appendChild(actions);

  quiz.replaceChildren(card);
  if (st.wrong.length) {
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
  } else {
    actions.querySelector('.primary').focus({ preventScroll: true });
  }
  card.scrollIntoView({ block: 'nearest' });
}

/* ---------- start ---------- */
renderTenseBar();
renderVerbs();
renderSettings();
startRound(null, false);
renderCardSettings();
startCards();

let startView = load('verbes-view', 'verbs');
if (!VIEWS.includes(startView)) startView = 'verbs';
if (location.hash === '#test') startView = 'test';
if (location.hash === '#cards') startView = 'cards';
showView(startView);
stopAll();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
