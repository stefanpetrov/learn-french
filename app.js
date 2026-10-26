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
    ['je suis allé', 'с être: само някои глаголи за движение (aller, venir, partir, sortir…) и всички възвратни'],
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
function makeUtterance(text, target, follow, rate) {
  const u = new SpeechSynthesisUtterance(spoken(text));
  u.lang = 'fr-FR';
  if (voice) u.voice = voice;
  u.rate = rate || (slow ? 0.6 : 0.92);
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
function speak(text, target, rate) {
  if (!synth) return;
  stopAll();
  synth.speak(makeUtterance(text, target, false, rate));
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
const VIEWS = ['verbs', 'dialogues', 'cards', 'games', 'dictation', 'speak', 'test'];
let currentView = 'verbs';
function showView(name) {
  currentView = name;
  VIEWS.forEach(v => {
    $('view-' + v).hidden = v !== name;
    $('tab-' + v).setAttribute('aria-selected', String(v === name));
  });
  stopAll();
  save('verbes-view', name);
  if (name === 'games') gaGame();
  else gaView(name, $('tab-' + name).textContent);
}
VIEWS.forEach(v => $('tab-' + v).addEventListener('click', () => showView(v)));

/* ---------- games: one tab, several games ---------- */
/* Each game lives in #game-<id>. Switching games fires a "gamechange" event
   ({ from, to }) on document, so a game can stop its timers and sounds;
   gameShown(id) says whether a game is on screen right now. */
const GAMES = [
  ['pairs', 'Двойки', 'Свържи френското с българското или лицето с формата.'],
  ['when', 'Кога?', 'Виждаш кога става действието и сам избираш времето.'],
  ['aux', 'Être или avoir?', 'Кой спомагателен глагол е и как се пише причастието.'],
  ['listen', 'Чуй и разбери', 'Слушаш, без да виждаш текста, и избираш какво си чул.'],
  ['speed', '60 секунди', 'Колкото можеш повече верни форми за една минута.'],
  ['numbers', 'Числа и часове', 'Слушаш число, цена или час и го пишеш с цифри.']
];
const GAME_IDS = GAMES.map(g => g[0]);
let currentGame = GAME_IDS.includes(load('igri-game', 'pairs')) ? load('igri-game', 'pairs') : 'pairs';
const gameShown = id => currentView === 'games' && currentGame === id;
const gameLabel = id => GAMES.find(g => g[0] === id)[1];
function gaGame() { gaView('games-' + currentGame, 'Игри · ' + gameLabel(currentGame)); }
// the buttons are made once and only change their pressed state, so keyboard focus stays on them
const gameBtns = GAMES.map(([id, label]) => toggleBtn(label, false, () => showGame(id)));
$('game-picker').replaceChildren(...gameBtns);
function renderGamePicker() {
  GAMES.forEach(([id], k) => gameBtns[k].setAttribute('aria-pressed', String(id === currentGame)));
  $('game-lede').textContent = GAMES.find(g => g[0] === currentGame)[2];
}
function showGame(id) {
  const from = currentGame;
  currentGame = id;
  GAME_IDS.forEach(g => { $('game-' + g).hidden = g !== id; });
  renderGamePicker();
  save('igri-game', id);
  if (from === id) return;
  stopAll();
  document.dispatchEvent(new CustomEvent('gamechange', { detail: { from, to: id } }));
  if (currentView === 'games') gaGame();
}
GAME_IDS.forEach(g => { $('game-' + g).hidden = g !== currentGame; });
renderGamePicker();

/* the tab row scrolls sideways when it does not fit: fade the edge with more tabs,
   and keep the chosen tab in view */
const tabsBar = document.querySelector('.tabs');
function updateTabsFade() {
  const max = tabsBar.scrollWidth - tabsBar.clientWidth;
  tabsBar.classList.toggle('more-left', max > 1 && tabsBar.scrollLeft > 1);
  tabsBar.classList.toggle('more-right', max > 1 && tabsBar.scrollLeft < max - 1);
}
function showActiveTab() {
  const b = $('tab-' + currentView);
  if (!b || tabsBar.scrollWidth <= tabsBar.clientWidth) { updateTabsFade(); return; }
  const left = b.offsetLeft - tabsBar.offsetLeft, right = left + b.offsetWidth;
  if (left < tabsBar.scrollLeft + 16) tabsBar.scrollLeft = Math.max(0, left - 24);
  else if (right > tabsBar.scrollLeft + tabsBar.clientWidth - 16) tabsBar.scrollLeft = right - tabsBar.clientWidth + 24;
  updateTabsFade();
}
tabsBar.addEventListener('scroll', updateTabsFade, { passive: true });
window.addEventListener('resize', showActiveTab);
VIEWS.forEach(v => $('tab-' + v).addEventListener('click', showActiveTab));
// arrow keys move between tabs, as in a tab list
tabsBar.addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const k = VIEWS.indexOf(currentView);
  const order = [...tabsBar.querySelectorAll('button')].map(b => b.id.replace('tab-', ''));
  const i = order.indexOf(currentView);
  const next = order[(i + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length];
  if (k < 0 || !next) return;
  e.preventDefault();
  e.stopPropagation();
  $('tab-' + next).click();
  $('tab-' + next).focus();
});

/* ---------- answer checking ---------- */
function norm(s) {
  return s.normalize('NFC').toLowerCase().replace(/[’‘`´ʼ＇]/g, "'").replace(/[\u2010-\u2013\u2212]/g, '-').replace(/\s+/g, ' ').replace(/ ?' ?/g, "'").trim();
}
function strip(s) {
  return norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');
}
/* An accent slip usually still counts ("Почти"), but not when it makes another word:
   a / à, ou / où, la / là, du / dû, or a heard final é (joué ≠ joue). */
const ACCENT_WORDS = new Set(['a', 'ou', 'la', 'du']);
const finalE = w => /é(e?s?)$/.test(w.replace(/^.*'/, ''));
function accentMatters(exp, giv) {
  return ACCENT_WORDS.has(strip(exp)) || finalE(norm(exp)) !== finalE(norm(giv)) || addedAccent(exp, giv);
}
/* an accent on a letter that has none (alléés, àvons, jaï) is a misspelling, not a slip.
   Letters are compared without spaces, hyphens and apostrophes, œ as oe. */
function addedAccent(exp, giv) {
  const letters = x => norm(x).replace(/œ/g, 'oe').replace(/[\s'-]/g, '').normalize('NFD').match(/.[\u0300-\u036f]*/gu) || [];
  const e = letters(exp), g = letters(giv);
  return e.length === g.length && e.some((c, k) => c.length === 1 && g[k].length > 1 && g[k][0] === c);
}
/* same words, differing only in accents that do not change them */
function nearMatch(exp, giv) {
  const a = norm(exp).split(' '), b = norm(giv).split(' ');
  return a.length === b.length && a.every((w, k) => w === b[k] || (strip(w) === strip(b[k]) && !accentMatters(w, b[k])));
}

/* ---------- flashcards ---------- */
const KINDS = [['tr', 'Превод'], ['rv', 'Обратно'], ['cj', 'Спрежение']];
const CARD_COUNTS = [10, 20, 30];
const savedCards = load('cartes-set', {});
const cs = {
  kind: KINDS.some(k => k[0] === savedCards.kind) ? savedCards.kind : 'tr',
  count: CARD_COUNTS.includes(savedCards.count) ? savedCards.count : 10,
  tenses: validSet(savedCards.tenses, TENSE_IDS, ['pr']),
  groups: validSet(savedCards.groups, GROUP_IDS, GROUP_IDS),
  queue: [], total: 0, done: 0, missed: new Set(), streak: 0, flipped: false, busy: false,
  picked: false,   // the deck came from pickDeck (not "Пак същите" or "Само трудните")
  day: null        // the day the counts on screen are for
};

/* ---------- "Преговор навреме": when a card comes back ---------- */
/* Each card has a level and the day it is due again, saved in 'cartes-srs' as
   key -> [level, dueDay]. A day is a local calendar day, so "днес" follows the learner's
   clock and time zone. "Знам" on a card that is due (or new): one level up, back after
   SRS_INTERVALS[old level] days. "Знам" before the card's day changes nothing. "Още не":
   level 0, due today. A card is "научена" from level SRS_KNOWN: known on three different days. */
const SRS_KEY = 'cartes-srs';
const SRS_INTERVALS = [1, 3, 7, 16, 35, 75];   // days; the last one repeats
const SRS_KNOWN = 3;
const srsDay = d => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const srsToday = () => srsDay(new Date());
function srsHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function srsLoad() {
  const raw = load(SRS_KEY, null);
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    Object.keys(raw).forEach(k => {
      const v = raw[k];
      if (Array.isArray(v) && Number.isInteger(v[0]) && v[0] >= 0 && Number.isInteger(v[1])) out[k] = [v[0], v[1]];
    });
    return out;
  }
  // once, from the old counts ('cartes-box': key -> "Знам" in a row, 0..5), which stay as they are.
  // Known cards come back evenly over the next 7 days (in the order of a hash of their key,
  // so the same box always gives the same days), and the first day is not flooded.
  const box = load('cartes-box', {});
  const t = srsToday();
  const known = [];
  if (box && typeof box === 'object' && !Array.isArray(box)) {
    Object.keys(box).forEach(k => {
      const n = Math.floor(Number(box[k]));
      if (!Number.isFinite(n)) return;
      if (n >= SRS_KNOWN) known.push(k);
      else out[k] = [Math.max(n, 0), t];
    });
  }
  known.sort((a, b) => srsHash(a) - srsHash(b) || (a < b ? -1 : 1))
    .forEach((k, i) => { out[k] = [SRS_KNOWN, t + 1 + i % 7]; });
  // nothing to carry over: nothing is written until the first card is played
  if (Object.keys(out).length) save(SRS_KEY, out);
  return out;
}
let srs = srsLoad();

// 'new' (never played), 'due' (today or earlier) or 'later'
function srsState(key, t) {
  const s = srs[key];
  return !s ? 'new' : s[1] <= t ? 'due' : 'later';
}
function srsCounts(pool, t) {
  const n = { due: 0, fresh: 0, known: 0, tomorrow: 0, next: Infinity, total: pool.length };
  pool.forEach(c => {
    const s = srs[c.key];
    if (!s) { n.fresh++; return; }
    if (s[1] <= t) n.due++;
    else {
      if (s[1] === t + 1) n.tomorrow++;
      n.next = Math.min(n.next, s[1]);
    }
    if (s[0] >= SRS_KNOWN) n.known++;
  });
  return n;
}
function srsGrade(key, ok) {
  const t = srsToday();
  const s = srs[key];
  if (!ok) srs[key] = [0, t];
  else if (!s || s[1] <= t) {
    const lv = s ? s[0] : 0;
    srs[key] = [lv + 1, t + SRS_INTERVALS[Math.min(lv, SRS_INTERVALS.length - 1)]];
  } else return;   // known before its day: it keeps its level and its day
  save(SRS_KEY, srs);
}
const srsWhen = d => d === 1 ? 'утре' : 'след\u00a0' + d + '\u00a0дни';

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
function saveCardSettings() {
  save('cartes-set', { kind: cs.kind, count: cs.count, tenses: [...cs.tenses], groups: [...cs.groups] });
}

/* today's counts for the current settings: the line above the card and the one in Настройки */
function renderSrsCounts() {
  const t = srsToday();
  cs.day = t;
  const n = srsCounts(cardPool(), t);
  const known = 'Научени:\u00a0' + n.known + '\u00a0от\u00a0' + n.total;
  const items = n.due ? ['Днес за преговор:\u00a0' + n.due, 'Нови:\u00a0' + n.fresh, known]
    : [n.fresh ? 'Днес няма карти за преговор\u00a0– учиш нови' : 'Днес няма карти за преговор\u00a0– следващите са ' + srsWhen(n.next - t), known];
  const line = $('c-srs');
  if (line) line.replaceChildren(...items.flatMap((x, i) => i ? [document.createTextNode(' · '), el('span', null, x)] : [el('span', null, x)]));
  $('c-known').textContent = 'Карти с тези настройки: ' + n.total + '. За преговор днес: ' + n.due + ', нови: ' + n.fresh + ', научени: ' + n.known + '.';
  return n;
}
function showSrsLine(on) {
  const line = $('c-srs');
  if (line) line.hidden = !on;
}

function renderCardSettings() {
  $('c-kind').replaceChildren(...KINDS.map(([id, label]) => toggleBtn(label, cs.kind === id, () => { cs.kind = id; cardSettingsChanged(); })));
  $('c-tenses').replaceChildren(...setToggles(TENSE_ITEMS, cs.tenses, cardSettingsChanged));
  $('c-tense-field').hidden = cs.kind !== 'cj';
  $('c-groups').replaceChildren(...setToggles(GROUP_ITEMS, cs.groups, cardSettingsChanged));
  $('c-count').replaceChildren(...CARD_COUNTS.map(n => toggleBtn(String(n), cs.count === n, () => { cs.count = n; cardSettingsChanged(); })));
  const pool = cardPool();
  const parts = [KINDS.find(k => k[0] === cs.kind)[1], cardsWord(Math.min(cs.count, pool.length))];
  if (cs.kind === 'cj') parts.push(tensesLabel(cs.tenses));
  const gl = groupsLabel(cs.groups);
  if (gl) parts.push(gl);
  $('c-sum').textContent = parts.join(' · ');
  renderSrsCounts();
}
function cardSettingsChanged() {
  saveCardSettings();
  renderCardSettings();
  startCards();
}
$('c-reset').addEventListener('click', () => {
  if (!confirm('Да изчистя ли прогреса по всички карти?')) return;
  srs = {};
  save(SRS_KEY, srs);
  save('cartes-box', {});
  renderCardSettings();
  startCards();
});

/* Pick a deck of cs.count cards: first the cards due today or earlier (most overdue first,
   then lowest level), then new cards (random), and cards not due yet (earliest first) only
   when nothing else is left. One card per verb before any verb repeats. Cards also come in
   tiers, so "Нови думи" stays new: verbs not in skipInf first, then unplayed cards of those
   verbs (other forms), and the cards in skipKeys only when nothing else is left. */
function pickDeck(skipInf, skipKeys) {
  const skipV = skipInf || new Set();
  const skipK = skipKeys || new Set();
  const t = srsToday();
  const STATES = ['due', 'new', 'later'];
  // lists[tier][state], each in random order (the sort below is stable, so ties stay random)
  const lists = [0, 1, 2].map(() => STATES.map(() => []));
  shuffle(cardPool()).forEach(c => {
    const tier = !skipV.has(c.inf) ? 0 : !skipK.has(c.key) ? 1 : 2;
    lists[tier][STATES.indexOf(srsState(c.key, t))].push(c);
  });
  const byDay = (a, b) => srs[a.key][1] - srs[b.key][1] || srs[a.key][0] - srs[b.key][0];
  lists.forEach(l => { l[0].sort(byDay); l[2].sort(byDay); });
  // [tier, state] in the order they are used: due, then new cards of other verbs and of other
  // forms; cards not due yet after them; the cards in skipKeys last
  const steps =[[0, 0], [0, 1], [1, 0], [1, 1], [0, 2], [1, 2], [2, 0], [2, 1], [2, 2]];
  const deck = [], keys = new Set(), verbs = new Set();
  const add = c => { deck.push(c); keys.add(c.key); verbs.add(c.inf); };
  for (const [tier, state] of steps) {
    const list = lists[tier][state];
    for (const c of list) {
      if (deck.length >= cs.count) break;
      if (!verbs.has(c.inf)) add(c);
    }
    for (const c of list) {
      if (deck.length >= cs.count) break;
      if (!keys.has(c.key)) add(c);
    }
  }
  return shuffle(deck);
}

// a number and its noun stay on one line (non-breaking space)
const cardsWord = k => k + '\u00a0' + (k === 1 ? 'карта' : 'карти');
const questionsWord = k => k + '\u00a0' + (k === 1 ? 'въпрос' : 'въпроса');

/* keep: { inf, keys } of the round this one replays, so "new words" stays new
   after "same cards" or "only the hard ones". quiet: do not read the first card out. */
function startCards(list, keep, quiet) {
  stopAll();
  const deck = list || pickDeck();
  cs.picked = !list;
  cs.deck = deck.slice();
  cs.roundInf = new Set([...(keep ? keep.inf : []), ...deck.map(c => c.inf)]);
  cs.roundKeys = new Set([...(keep ? keep.keys : []), ...deck.map(c => c.key)]);
  cs.queue = deck.slice();
  cs.total = deck.length;
  cs.done = 0;
  cs.missed = new Set();
  cs.missedCards = [];
  cs.streak = 0;
  renderCard(quiet);
}

/* a new day while the app stays open: fresh counts, and a fresh deck if this one is untouched */
function srsNewDay() {
  if (cs.day === srsToday()) return;
  if (cardUI && cs.picked && !cs.done && !cs.flipped && !cs.missed.size) startCards(null, null, true);
  else renderSrsCounts();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) srsNewDay(); });
$('tab-cards').addEventListener('click', srsNewDay);

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

function renderCard(quiet) {
  cs.flipped = false;
  cs.busy = false;
  if (!cs.queue.length) { renderCardsEnd(); return; }
  const c = cs.queue[0];
  renderSrsCounts();
  showSrsLine(true);

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

  if (c.kind === 'tr' && currentView === 'cards' && !quiet) speak(c.inf, front.querySelector('.say'));
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
  srsGrade(c.key, ok);
  if (ok) {
    cs.streak++;
    cs.done++;
    cs.queue.shift();
  } else {
    // not known yet: it comes back 3 cards later in this round
    cs.streak = 0;
    if (!cs.missed.has(c.key)) { cs.missed.add(c.key); cs.missedCards.push(c); }
    const item = cs.queue.shift();
    cs.queue.splice(Math.min(3, cs.queue.length), 0, item);
  }
  stopAll();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { renderCard(); return; }
  card.classList.add(ok ? 'out-right' : 'out-left');
  setTimeout(renderCard, 220);
}

function renderCardsEnd() {
  cardUI = null;
  const n = cs.total, first = n - cs.missed.size;
  track('cards_complete', { kind: cs.kind, cards: n, known_first_time: first });
  const t = srsToday();
  const counts = renderSrsCounts();
  showSrsLine(false);   // the result below says it all
  const box = el('div', 'qcard');
  box.appendChild(el('p', 'eyebrow kind', 'Bravo !'));
  const score = el('p', 'score', String(first));
  score.appendChild(el('small', null, ' / ' + n + ' от първия път'));
  box.appendChild(score);
  const msg = el('p', 'result-msg');
  const soon = counts.due
    ? 'Днес остават още ' + cardsWord(counts.due) + ' за преговор' + (counts.tomorrow ? ', утре идват още\u00a0' + counts.tomorrow : '') + '.'
    : counts.tomorrow ? 'Утре за преговор: ' + cardsWord(counts.tomorrow) + '.'
    : counts.next < Infinity ? 'Следващият преговор е ' + srsWhen(counts.next - t) + '.' : '';
  msg.append(el('i', null, first === n ? 'Parfait ! ' : first >= n * 0.7 ? 'Très bien ! ' : 'Continue ! '),
    document.createTextNode('Научени карти: ' + counts.known + '\u00a0от\u00a0' + counts.total + '. ' + (soon ? soon + ' ' : '') +
      'Една карта е научена, когато я знаеш в три различни дни.'));   // three = SRS_KNOWN
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
  // the cards just known are not due again today, so a replay is practice only
  const practice = deck.every(c => srsState(c.key, t) === 'later') ? ' за упражнение' : '';
  const againBtn = choiceButton(
    one ? 'Пак същата карта' : 'Пак същите карти',
    (one ? 'Изиграй я отново' : 'Изиграй отново същите ' + cardsWord(n)) + practice,
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
    const verbsTxt = newVerbs === 1 ? '1\u00a0друг глагол' : newVerbs + '\u00a0други глагола';
    const parts = [];
    if (fresh.length) parts.push(fresh.length + '\u00a0с ' + (cj ? verbsTxt : fresh.length === 1 ? 'друга дума' : 'други думи'));
    if (otherForms) parts.push(otherForms + '\u00a0' + (otherForms === 1 ? 'друга форма' : 'други форми') + ' на същите глаголи');
    if (repeats) parts.push(repeats + '\u00a0от досегашните');
    let desc;
    if (fresh.length === next.length) desc = cardsWord(next.length) + ' с ' + (cj ? verbsTxt : 'други думи');
    else if (otherForms === next.length) desc = cardsWord(next.length) + ' с други форми на същите глаголи';
    else desc = cardsWord(next.length) + ': ' + parts.join(', ');
    // and where they are in the schedule: due today, never played, or not due yet
    const nDue = next.filter(c => srsState(c.key, t) === 'due').length;
    const nNew = next.filter(c => srsState(c.key, t) === 'new').length;
    const when = [];
    if (nDue) when.push(nDue === next.length ? 'всички за преговор' : nDue + '\u00a0за преговор');
    if (nNew) when.push(nNew === next.length ? 'всички нови' : nNew + '\u00a0нови');
    if (!when.length) when.push('за упражнение');
    desc += ' · ' + when.join(', ');
    const title = fresh.length ? (fresh.some(c => !srs[c.key]) ? 'Нови ' : 'Други ') + word : 'Други форми';
    newBtn = choiceButton(title, desc, () => startCards(next));
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
  // qs: the round's questions; queue: the order they are asked in, where a missed one
  // comes back once ({ q, again: true }); i: place in queue; done: first tries answered
  qs: [], queue: [], i: 0, done: 0, score: 0, wrong: [], checked: false
};
const TEST_AGAIN_AFTER = 3;   // a missed question comes back once, this many questions later
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
  st.queue = st.qs.map(q => ({ q, again: false }));
  renderSum();
  st.i = 0;
  st.done = 0;
  st.score = 0;
  st.wrong = [];
  renderQ(focus);
}

function renderQ(focus) {
  const item = st.queue[st.i];
  const q = item.q;
  st.checked = false;
  const card = el('div', 'qcard');

  // a second try is not a new question: the count, the score and the bar stay
  const top = el('div', 'qtop');
  const scoreEl = el('span', null, 'Верни: ' + st.score);
  top.append(el('span', null, item.again ? 'Още веднъж' : 'Въпрос ' + (st.done + 1) + ' от ' + st.qs.length), scoreEl);
  const prog = el('div', 'progress');
  const bar = el('i');
  bar.style.width = (st.done / st.qs.length * 100) + '%';
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

  const ui = { item, input, fb, skip, main, keys, scoreEl, bar };
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

/* "Защо е грешно" (explain.js): the rule behind a wrong form, or null */
function testWhy(q, val) {
  if ((q.type !== 'conj' && q.type !== 'sent') || typeof explainMistake !== 'function') return null;
  const x = { inf: q.inf, tense: q.tense, answer: q.answer };
  if (q.type === 'conj') x.p = q.p;
  try {
    const r = explainMistake(x, val);
    return r && r.text ? r.text : null;
  } catch (e) {
    return null;
  }
}

function check(ui, gaveUp) {
  if (st.checked) return;
  const { item } = ui;
  const q = item.q;
  const val = gaveUp ? '' : ui.input.value;
  if (!gaveUp && !val.trim()) { ui.input.focus(); return; }

  // a reflexive verb also counts without its pronoun: appeler for s'appeler
  const base = q.type === 'conj' ? [q.answer, q.full]
    : q.type === 'word' ? [q.answer, ...q.also].flatMap(x => [x, bareInf(x)]) : [q.answer];
  const cands = base.concat(...base.map(variants));
  const exact = !gaveUp && cands.some(c => norm(c) === norm(val));
  const near = !gaveUp && !exact && cands.some(c => nearMatch(c, val));
  const good = exact || near;
  const why = good || gaveUp ? null : testWhy(q, val);
  // only the first try counts; a miss (or "Не знам") comes back once, a few questions later
  if (!item.again) {
    st.done++;
    if (good) st.score++;
    else {
      st.wrong.push({ q, given: val.trim(), why });
      st.queue.splice(Math.min(st.i + 1 + TEST_AGAIN_AFTER, st.queue.length), 0, { q, again: true });
    }
  }
  st.checked = true;

  ui.input.readOnly = true;
  ui.input.classList.add(exact ? 'ok' : near ? 'near' : 'bad');
  ui.keys.hidden = true;
  ui.skip.hidden = true;
  ui.main.textContent = st.i + 1 < st.queue.length ? 'Напред' : 'Виж резултата';
  ui.scoreEl.textContent = 'Верни: ' + st.score;
  ui.bar.style.width = (st.done / st.qs.length * 100) + '%';

  const bravo = item.again && good;
  const verdict = exact ? ['ok', bravo ? 'Браво, този път вярно.' : 'Правилно!']
    : near ? ['near', (bravo ? 'Браво, този път вярно. ' : 'Почти! ') + 'Внимавай за знаците над буквите.']
    : gaveUp ? ['bad', 'Ето отговора:'] : ['bad', 'Грешно.'];
  const line = el('p', 'fb-line');
  if (q.type !== 'sent' && !exact) line.appendChild(el('span', null, 'Правилно е'));
  const sayBtn = answerFeedback(q);
  line.appendChild(sayBtn);
  ui.fb.replaceChildren(el('p', 'verdict ' + verdict[0], verdict[1]), line);
  if (why) ui.fb.appendChild(el('p', 'fb-why', 'Защо: ' + why));
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
  if (st.i >= st.queue.length) renderResult();
  else renderQ(true);
}

function renderResult() {
  const n = st.qs.length, s = st.score;
  const pct = n ? s / n : 0;
  track('test_complete', { questions: n, score_pct: Math.round(pct * 100), from_cards: !!st.fromCards, retry: !!st.retry });
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
    st.wrong.forEach(({ q, given, why }) => {
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
      if (why) li.appendChild(el('p', 'fb-why', 'Защо: ' + why));
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
if (startView === 'pairs') { startView = 'games'; showGame('pairs'); }   // "Двойки" used to be its own tab
if (!VIEWS.includes(startView)) startView = 'verbs';
const hashView = location.hash.slice(1);
if (VIEWS.includes(hashView)) startView = hashView;
if (GAME_IDS.includes(hashView)) { startView = 'games'; showGame(hashView); }
showView(startView);
stopAll();
requestAnimationFrame(showActiveTab);
document.fonts && document.fonts.ready.then(showActiveTab);

// no sound when the app goes to the background
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
