/* "Числа и часове": hear a number, a price or a time (Belgian septante / nonante or
   French soixante-dix / quatre-vingt-dix) and type it in digits. Renders into #numbers
   (panel #game-numbers). Uses helpers from app.js. */

const NU_COUNT = 10;
const NU_NORMAL = 0.92;
const NU_SLOW = 0.6;
const NU_AGAIN_AFTER = 3;   // a missed item comes back once, this many questions later
const NU_KEY = 'igri-chisla';
const NU_VARIANTS = [['be', 'Белгийски', 'septante, nonante'], ['fr', 'Френски', 'soixante-dix, quatre-vingt-dix']];
const NU_KINDS = [['mix', 'Смесено'], ['num', 'Числа'], ['price', 'Цени'], ['time', 'Часове']];
// how many numbers, prices and times a round holds
const NU_MIX = { mix: [4, 3, 3], num: [10, 0, 0], price: [0, 10, 0], time: [0, 0, 10] };
const NU_LABEL = { num: 'Число', price: 'Цена', time: 'Час' };
const NU_ASK = { num: 'Чуй и напиши числото с цифри.', price: 'Чуй цената и я напиши с цифри.', time: 'Чуй часа и го напиши с цифри.' };
const NU_FIELD = { num: 'Числото с цифри', price: 'Цената в евро, с цифри', time: 'Часът с цифри' };
const NU_FORMAT = {
  num: 'Пиши числото с цифри, например 92.',
  price: 'Пиши цената с цифри, например 75,50 или 12.',
  time: 'Пиши часа с цифри, например 17:45 или 8h00.'
};
const NU_IN = { be: 'В Белгия:', fr: 'Във Франция:' };

/* ---------- numbers in words (0–9999), traditional spelling ---------- */
/* v: 'be' (septante, nonante) or 'fr' (soixante-dix, quatre-vingt-dix). 80 is quatre-vingts
   in both (Belgium does not say huitante). fem: une for un at the end (vingt et une heures). */
const NU_UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const NU_TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'septante', '', 'nonante'];

function nuBelow100(n, v) {
  if (n < 20) return NU_UNITS[n];
  const t = Math.floor(n / 10), u = n % 10;
  // quatre-vingts takes an s only at the end: quatre-vingt-un, quatre-vingt-dix
  if (t === 8) return u ? 'quatre-vingt-' + NU_UNITS[u] : 'quatre-vingts';
  if (v === 'fr' && t === 9) return 'quatre-vingt-' + NU_UNITS[n - 80];
  if (v === 'fr' && t === 7) return n === 71 ? 'soixante et onze' : 'soixante-' + NU_UNITS[n - 60];
  return u === 0 ? NU_TENS[t] : u === 1 ? NU_TENS[t] + ' et un' : NU_TENS[t] + '-' + NU_UNITS[u];
}
function nuBelow1000(n, v) {
  const h = Math.floor(n / 100), r = n % 100;
  if (!h) return nuBelow100(r, v);
  // cents takes an s only at the end: deux cents, deux cent un
  const cent = h === 1 ? 'cent' : NU_UNITS[h] + (r ? ' cent' : ' cents');
  return r ? cent + ' ' + nuBelow100(r, v) : cent;
}
/* ord: the number names a page, a room, a bus or a year, not an amount; then a final
   quatre-vingts / cents loses its s (la page quatre-vingt, en mille neuf cent quatre-vingt) */
function nuWords(n, v, fem, ord) {
  const th = Math.floor(n / 1000), r = n % 1000;
  // mille never changes: deux mille
  const s = !th ? nuBelow1000(r, v) : (th === 1 ? 'mille' : NU_UNITS[th] + ' mille') + (r ? ' ' + nuBelow1000(r, v) : '');
  const w = fem ? s.replace(/(^|[ -])un$/, '$1une') : s;
  return ord ? w.replace(/(vingt|cent)s$/, '$1') : w;
}

/* how the number is built, for the hints: soixante-dix-huit = 60 + 18, quatre-vingt-dix-sept = 4 × 20 + 17 */
function nuTailExpr(r, v) {
  if (r >= 80 && (r < 90 || v === 'fr')) return '4 × 20' + (r > 80 ? ' + ' + (r - 80) : '');
  if (r >= 70 && r < 80 && v === 'fr') return '60 + ' + (r - 60);
  return String(r);
}
function nuExpr(n, v) {
  const th = Math.floor(n / 1000), h = Math.floor(n % 1000 / 100), r = n % 100;
  const parts = [];
  if (th) parts.push(String(th * 1000));
  if (h) parts.push(String(h * 100));
  if (r) parts.push(nuTailExpr(r, v));
  return parts.join(' + ');
}
/* the digits someone writes who puts down each word as heard (soixante-dix-huit → 6018),
   each with how the number is really built: [{ d: digits, x: expression }] */
function nuTailOpts(r, v) {
  const t = Math.floor(r / 10), u = r % 10;
  const o = (d, x) => ({ d: String(d), x });
  const out = [];
  if (r >= 17 && r <= 19) out.push(o('10' + u, '10 + ' + u));
  else if (r >= 20 && r < 70 && u) out.push(o(t * 10 + '' + u, t * 10 + ' + ' + u));
  else if (r >= 70 && r < 80 && v === 'fr') {
    out.push(o('60' + (r - 60), '60 + ' + (r - 60)));
    if (r >= 77) out.push(o('6010' + (r - 70), '60 + 10 + ' + (r - 70)));
  } else if (r >= 80 && (r < 90 || v === 'fr')) {
    const k = r - 80;
    out.push(o('420' + (k || ''), '4 × 20' + (k ? ' + ' + k : '')));
    if (k) out.push(o('80' + k, '80 + ' + k));
    if (k >= 17) out.push(o('42010' + (k - 10), '4 × 20 + 10 + ' + (k - 10)), o('8010' + (k - 10), '80 + 10 + ' + (k - 10)));
  } else if (r >= 70 && u) out.push(o(t * 10 + '' + u, t * 10 + ' + ' + u));
  return [o(r, String(r))].concat(out);
}
function nuCombos(n, v) {
  const th = Math.floor(n / 1000), h = Math.floor(n % 1000 / 100), r = n % 100;
  let combos = [{ d: '', x: [] }];
  const add = opts => { combos = combos.flatMap(c => opts.map(o => ({ d: c.d + o.d, x: c.x.concat(o.x) }))); };
  if (th) add(th === 1 ? [{ d: '1000', x: '1000' }] : [{ d: String(th * 1000), x: String(th * 1000) }, { d: th + '1000', x: th + ' × 1000' }]);
  if (h) add(h === 1 ? [{ d: '100', x: '100' }] : [{ d: String(h * 100), x: String(h * 100) }, { d: h + '100', x: h + ' × 100' }]);
  if (r || !n) add(nuTailOpts(r, v));
  return combos.map(c => ({ d: c.d, x: c.x.join(' + ') })).filter(c => c.d !== String(n));
}
const NU_BIG_TENS = { 6: 'soixante = 60', 7: 'septante = 70', 8: 'quatre-vingts = 80', 9: 'nonante = 90' };

/* a short hint for the usual slips with this number, or null. d: the digits typed */
function nuNumHint(n, d, v, fem, ord) {
  if (!/^\d+$/.test(d)) return null;
  const typed = parseInt(d, 10);
  if (typed === n) return null;
  const w = nuWords(n, v, fem, ord);
  const c = nuCombos(n, v).find(o => o.d === d.replace(/^0+(?=\d)/, ''));
  if (c) return w + ' = ' + c.x + ' = ' + n;
  const r = n % 100, t = typed % 100, diff = typed - n;
  const how = () => w + ' = ' + nuExpr(n, v) + ' = ' + n;
  if (Math.floor(typed / 100) === Math.floor(n / 100)) {
    if (v === 'fr' && r >= 70) return how();
    if (v === 'be' && r >= 80 && r < 90 && (t < 60 || t % 10 !== r % 10)) return how();
    // septante-deux heard as douze or deux
    if (v === 'be' && r >= 70 && t < 60 && t % 10 === r % 10) return NU_BIG_TENS[Math.floor(r / 10)] + '.';
    // the unit is right, the tens are not: septante = 70, soixante = 60
    if (r >= 60 && t >= 60 && t % 10 === r % 10) {
      if (v === 'be') return NU_BIG_TENS[Math.floor(r / 10)] + ', ' + NU_BIG_TENS[Math.floor(t / 10)] + '.';
      return w + ' = ' + n + '. ' + typed + ' е ' + nuWords(typed, v, fem, ord) + '.';
    }
    // seize ≠ six, douze ≠ deux
    const teen = r >= 12 && r <= 16 && diff === -10 ? r : r >= 2 && r <= 6 && diff === 10 ? r + 10 : 0;
    if (teen) return NU_UNITS[teen] + ' = ' + teen + ', ' + NU_UNITS[teen - 10] + ' = ' + (teen - 10) + '.';
    if (r >= 17 && r <= 19 && diff === -10) return NU_UNITS[r] + ' = 10 + ' + (r - 10) + ' = ' + r + '.';
  }
  return null;
}

/* ---------- reading what was typed ---------- */
const nuClean = s => s.normalize('NFKC').replace(/[   ]/g, ' ').trim().toLowerCase();
const nuPad = k => String(k).padStart(2, '0');
// 92, 1 978, 1.978
function nuParseNum(s) {
  const t = nuClean(s).replace(/[\s.'’]/g, '').replace(/,$/, '');
  return /^\d{1,7}$/.test(t) ? { n: parseInt(t, 10), d: t } : null;
}
// 75,50 · 75.50 · 75,5 · 75€50 · 75 50 · 75,50 € · 12 · 12,00 · 12€ · 12,-
function nuParsePrice(s) {
  const t = nuClean(s).replace(/^(?:€|eur)\s*/, '').replace(/\s*(?:€|euros?|eur)$/, '').replace(/\s*(?:,-|[,.])$/, '');
  let m = t.match(/^(\d{1,7})$/);
  if (m) return { e: parseInt(m[1], 10), c: 0, d: m[1], cents: false };
  m = t.match(/^(\d{1,7})\s*(?:[,.]|€|euros?|eur|\s)\s*(\d{1,2})$/);
  if (m) return { e: parseInt(m[1], 10), c: parseInt(m[2], 10) * (m[2].length === 1 ? 10 : 1), d: m[1], cd: m[2], cents: true };
  return null;
}
// 17:45 · 17h45 · 17.45 · 17 45 · 17u45 · 8 · 8h · 8:00 · 08:00 · 8h00
function nuParseTime(s) {
  const t = nuClean(s).replace(/\s+/g, ' ');
  let m = t.match(/^(\d{1,2})\s*(?:[:.,hu]|\s)\s*(\d{1,2})$/);
  if (m) return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
  m = t.match(/^(\d{1,2})\s*[hu]?$/);
  if (m) return { h: parseInt(m[1], 10), m: 0 };
  return null;
}
function nuRead(q, val) {
  return q.type === 'num' ? nuParseNum(val) : q.type === 'price' ? nuParsePrice(val) : nuParseTime(val);
}

/* ---------- questions ---------- */
const nuRand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const nuAny = list => list[Math.floor(Math.random() * list.length)];
/* mostly numbers whose last two digits are 70–99 (Belgium and France say them differently,
   and 80–89 is tricky in both), sometimes 60–69, and the rest of the time any number */
function nuWeighted(list) {
  const hot = list.filter(n => n % 100 >= 70), warm = list.filter(n => n % 100 >= 60 && n % 100 < 70);
  const r = Math.random();
  return nuAny(r < 0.6 && hot.length ? hot : r < 0.7 && warm.length ? warm : list);
}
function nuPick(lo, hi) {
  const list = [];
  for (let n = lo; n <= hi; n++) list.push(n);
  return nuWeighted(list);
}
const nuOther = v => (v === 'be' ? 'fr' : 'be');
const nuTime = (h, m) => h + ':' + nuPad(m);

// Brussels postal codes, said as one number: mille septante
const NU_POSTCODES = [[1000, 'Bruxelles'], [1020, 'Laeken'], [1030, 'Schaerbeek'], [1040, 'Etterbeek'],
  [1050, 'Ixelles'], [1060, 'Saint-Gilles'], [1070, 'Anderlecht'], [1080, 'Molenbeek'], [1081, 'Koekelberg'],
  [1082, 'Berchem-Sainte-Agathe'], [1083, 'Ganshoren'], [1090, 'Jette'], [1140, 'Evere'], [1160, 'Auderghem'],
  [1170, 'Watermael-Boitsfort'], [1180, 'Uccle'], [1190, 'Forest'], [1210, 'Saint-Josse']];
const NU_NUM_FRAMES = [
  { before: 'Je prends le tram ', after: '.', pick: () => nuWeighted([3, 4, 7, 8, 9, 19, 25, 39, 51, 55, 62, 81, 82, 92, 93, 97]) },
  { before: 'Je prends le bus ', after: '.', pick: () => nuPick(12, 99), ord: true },
  { before: "J'habite au numéro ", after: '.', pick: () => nuPick(2, 199), ord: true },
  { before: 'La chambre ', after: '.', pick: () => nuPick(2, 399), ord: true },
  { before: 'Il a ', after: ' ans.', pick: () => nuPick(18, 99) },
  { before: 'Ma grand-mère a ', after: ' ans.', pick: () => nuPick(60, 99) },
  { before: 'Le train part de la voie ', after: '.', pick: () => nuRand(2, 22) },
  { before: "C'est à la page ", after: '.', pick: () => nuPick(2, 300), ord: true },
  { before: 'Il y a ', after: ' personnes.', pick: () => nuPick(2, 99), fem: true },
  { before: 'Il est né en ', after: '.', pick: () => nuPick(1940, 2012), ord: true },
  { before: "Le code postal, c'est ", after: '.', pick: () => nuWeighted(NU_POSTCODES.map(p => p[0])), post: true }
];
const NU_PRICE_FRAMES = [['Ça fait ', '.'], ["C'est ", '.'], ['Ça coûte ', '.'], ['Le billet coûte ', '.'], ['Le menu est à ', '.']];
const NU_CENTS = [10, 20, 25, 30, 40, 45, 50, 60, 65, 69, 70, 75, 79, 80, 85, 89, 90, 95, 99];
// 24-hour times: [before, after, first hour, last hour, minutes]
const NU_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 7, 12, 17, 23, 26, 38, 42, 47, 52, 58];
const NU_TIME_FRAMES = [
  ['Il est ', '.', 6, 23, NU_MINUTES],
  ['Le train part à ', '.', 5, 23, NU_MINUTES],
  ['Le magasin ouvre à ', '.', 7, 10, [0, 0, 30]],
  ['Le magasin ferme à ', '.', 17, 21, [0, 0, 30]],
  ['Le film commence à ', '.', 18, 22, [0, 15, 30, 45]],
  ["J'ai rendez-vous à ", '.', 8, 18, [0, 15, 30, 45]]
];
const NU_DAY_FRAMES = [['Il est ', '.'], ['On se voit à ', '.']];

function nuItem(type, v, before, words, after, extra) {
  return Object.assign({ type, v, before, after, words, say: before + words + after, again: false }, extra);
}
function nuNumQ(f, v) {
  const n = f.pick();
  const words = nuWords(n, v, f.fem, f.ord);
  const post = f.post ? NU_POSTCODES.find(p => p[0] === n) : null;
  return nuItem('num', v, f.before, words, f.after, {
    n, fem: !!f.fem, ord: !!f.ord, key: 'num:' + n, digits: String(n),
    other: nuWords(n, nuOther(v), f.fem, f.ord),
    note: post ? n + ' = ' + post[1] : ''
  });
}
const nuPriceWords = (e, c, v) => nuWords(e, v) + (e === 1 ? ' euro' : ' euros') + (c ? ' ' + nuWords(c, v) : '');
function nuPriceQ(f, v) {
  const r = Math.random();
  let e, c;
  if (r < 0.5) { e = nuPick(2, 99); c = Math.random() < 0.5 ? 0 : nuWeighted(NU_CENTS); }
  else if (r < 0.9) { e = nuRand(1, 19); c = nuWeighted(NU_CENTS); }
  else { e = nuPick(100, 299); c = 0; }
  return nuItem('price', v, f[0], nuPriceWords(e, c, v), f[1], {
    e, c, key: 'price:' + e + ',' + c, digits: e + (c ? ',' + nuPad(c) : '') + ' €',
    other: nuPriceWords(e, c, nuOther(v))
  });
}
const nuHourWords = (h, v) => nuWords(h, v, true) + (h === 1 ? ' heure' : ' heures');
function nuTimeQ(f, v) {
  const [before, after, lo, hi, mins] = f;
  const h = nuRand(lo, hi), m = nuAny(mins);
  // minutes are feminine too (vingt et une), so none end in 1
  const words = nuHourWords(h, v) + (m ? ' ' + nuWords(m, v, true) : '');
  return nuItem('time', v, before, words, after, {
    h, m, alt: [[h, m]], key: 'time:' + h + ':' + m, digits: nuTime(h, m), other: '', day: null
  });
}
/* everyday times: et quart, et demie, moins le quart, midi, minuit. Without the 24-hour
   clock the morning and the afternoon sound the same, so both count (3:15 and 15:15). */
function nuDayQ(f, v) {
  const kind = nuAny(['quart', 'demie', 'moins', 'moins', 'midi', 'minuit']);
  let words, alt, note;
  if (kind === 'quart' || kind === 'demie') {
    const h = nuRand(1, 11), m = kind === 'quart' ? 15 : 30;
    words = nuHourWords(h, v) + (kind === 'quart' ? ' et quart' : ' et demie');
    alt = [[h, m], [h + 12, m]];
    note = kind === 'quart' ? 'et quart = и четвърт (:15).' : 'et demie = и половина (:30).';
  } else if (kind === 'moins') {
    const h = nuRand(2, 11), k = nuAny([15, 15, 5, 10, 20]);
    const less = k === 15 ? 'moins le quart' : 'moins ' + nuWords(k, v, true);
    words = nuHourWords(h, v) + ' ' + less;
    alt = [[h - 1, 60 - k], [h + 11, 60 - k]];
    note = less + ' = без ' + { 5: 'пет', 10: 'десет', 15: 'четвърт', 20: 'двайсет' }[k] + ': ' + words + ' = ' + nuTime(h - 1, 60 - k) + '.';
  } else if (kind === 'midi') {
    const m = nuAny([0, 0, 15, 30]);
    words = 'midi' + (m === 15 ? ' et quart' : m === 30 ? ' et demi' : '');
    alt = [[12, m]];
    note = 'midi = 12:00, обед' + (m === 15 ? '; et quart = и четвърт' : m === 30 ? '; et demi = и половина' : '') + '.';
  } else {
    const m = nuAny([0, 0, 30]);
    words = 'minuit' + (m ? ' et demi' : '');
    alt = [[0, m]];
    note = 'minuit = 0:00, полунощ' + (m ? '; et demi = и половина' : '') + '.';
  }
  return nuItem('time', v, f[0], words, f[1], {
    h: alt[0][0], m: alt[0][1], alt, key: 'time:' + words, other: '', day: kind,
    digits: alt.map(a => nuTime(a[0], a[1])).join(' или '), note
  });
}

function nuBuild() {
  const v = nu.variant;
  const [nN, nP, nT] = NU_MIX[nu.kind];
  const used = new Set();
  // the same number, price or time at most once in a round
  const unique = make => {
    let q = make();
    for (let k = 0; k < 40 && used.has(q.key); k++) q = make();
    used.add(q.key);
    return q;
  };
  const qs = [];
  const nf = shuffle(NU_NUM_FRAMES.slice()), pf = shuffle(NU_PRICE_FRAMES.slice()), tf = shuffle(NU_TIME_FRAMES.slice());
  for (let k = 0; k < nN; k++) qs.push(unique(() => nuNumQ(nf[k % nf.length], v)));
  for (let k = 0; k < nP; k++) qs.push(unique(() => nuPriceQ(pf[k % pf.length], v)));
  // mostly the 24-hour clock, as on timetables and opening hours
  const nDay = Math.round(nT * 0.3);
  for (let k = 0; k < nT - nDay; k++) qs.push(unique(() => nuTimeQ(tf[k % tf.length], v)));
  for (let k = 0; k < nDay; k++) qs.push(unique(() => nuDayQ(nuAny(NU_DAY_FRAMES), v)));
  return shuffle(qs);
}

/* ---------- checking ---------- */
const nuSameTime = (a, b) => a[0] % 24 === b[0] % 24 && a[1] === b[1];
function nuPriceHint(q, got) {
  if (got.e === q.e && q.c && !got.cents) return 'Числото след ' + (q.e === 1 ? 'euro' : 'euros') + ' е центовете: ' + q.words + ' = ' + q.digits + '.';
  if (q.c && !got.cents && got.d === q.e + nuPad(q.c)) return 'Между еврото и центовете сложи запетая: ' + q.digits + '.';
  if (got.e !== q.e) return nuNumHint(q.e, got.d, q.v);
  if (got.c !== q.c && got.cents) return nuNumHint(q.c, nuPad(got.c), q.v);
  return null;
}
function nuTimeHint(q, got) {
  if (got.m === q.m && q.h >= 13 && got.h === q.h - 12) {
    return nuHourWords(q.h, q.v) + ' = ' + q.h + ' ч. Пиши ' + q.digits + ', не ' + nuTime(got.h, got.m) + '.';
  }
  if (got.h % 24 !== q.h % 24) return nuNumHint(q.h, String(got.h), q.v, true);
  if (got.m !== q.m) return nuNumHint(q.m, String(got.m), q.v, true);
  return null;
}
/* { verdict: ok | near | bad, near?: text, why?: hint } */
function nuJudge(q, got) {
  if (q.type === 'num') return got.n === q.n ? { verdict: 'ok' } : { verdict: 'bad', why: nuNumHint(q.n, got.d, q.v, q.fem, q.ord) };
  if (q.type === 'price') return got.e === q.e && got.c === q.c ? { verdict: 'ok' } : { verdict: 'bad', why: nuPriceHint(q, got) };
  const g = [got.h, got.m];
  if (q.alt.some(a => nuSameTime(a, g))) return { verdict: 'ok' };
  // huit heures typed as 20:00: on the 24-hour clock 20:00 is vingt heures
  if (!q.day && q.h <= 11 && nuSameTime([q.h + 12, q.m], g)) {
    const pm = nuHourWords(q.h + 12, q.v) + (q.m ? ' ' + nuWords(q.m, q.v, true) : '');
    return { verdict: 'near', near: '„' + q.words + '“ е ' + q.digits + ', а ' + nuTime(q.h + 12, q.m) + ' е „' + pm + '“.' };
  }
  return { verdict: 'bad', why: q.day ? null : nuTimeHint(q, got) };
}

/* ---------- speech ---------- */
/* the Belgian words in a Belgian voice when the phone has one, else the app's French voice */
function nuBeVoice() {
  return synth ? synth.getVoices().find(x => /^fr[-_]BE/i.test(x.lang)) || null : null;
}
function nuSay(text, target, rate, v) {
  if (!synth) return;
  const be = v === 'be' ? nuBeVoice() : null;
  if (!be) { speak(text, target, rate); return; }
  stopAll();   // cancels this utterance too, as every other sound in the app
  const u = makeUtterance(text, target, false, rate);
  u.voice = be;
  u.lang = be.lang.replace('_', '-');
  synth.speak(u);
}
// never a sound while the game is not on screen
const nuCanSpeak = () => !!synth && gameShown('numbers') && !document.hidden && !document.querySelector('dialog[open]');

function nuSayBtn(text, cls, v, label) {
  const b = el('button', cls);
  b.type = 'button';
  b.lang = 'fr';
  b.setAttribute('aria-label', 'Произнеси: ' + text);
  b.innerHTML = ICON;
  b.appendChild(label || el('span', null, text));
  b.addEventListener('click', () => nuSay(text, b, NU_NORMAL, v));
  return b;
}
// the phrase, with the number in red
function nuSentence(q) {
  const s = el('span');
  s.append(q.before, el('span', 'end', q.words), q.after);
  return nuSayBtn(q.say, 'sbtn nu-say', q.v, s);
}
function nuLine(label, ...items) {
  const p = el('p', 'fb-line');
  if (label) p.appendChild(el('span', null, label));
  p.append(...items);
  return p;
}
const nuDigits = q => el('span', 'nu-digits', q.digits);
// the other variant, when it says the number differently: Във Франция: soixante-quinze
function nuOtherLine(q) {
  if (!q.other || q.other === q.words) return null;
  const o = nuOther(q.v);
  return nuLine(NU_IN[o], nuSayBtn(q.other, 'form nu-other', o));
}

/* ---------- page: settings, the game, the tip ---------- */
const savedNu = load(NU_KEY, {}) || {};
const nu = {
  variant: NU_VARIANTS.some(x => x[0] === savedNu.variant) ? savedNu.variant : 'be',
  kind: NU_KINDS.some(x => x[0] === savedNu.kind) ? savedNu.kind : 'mix',
  // qs: the questions of the round (first tries); queue: what is asked, with the second tries
  qs: [], queue: [], i: 0, done: 0, score: 0, wrong: [], checked: false, retry: false, ui: null
};
const nuRoot = $('numbers');
const nuPlay = el('div');

function nuField(id, label) {
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
let nuSumEl = null, nuVoiceNote = null;
function nuSetup() {
  const tip = el('p', 'tip');
  ['В Белгия 70 е septante, а 90 е nonante: septante-cinq = 75, nonante-deux = 92.',
    'Във Франция се смята: soixante-dix = 60 + 10, soixante-quinze = 60 + 15, quatre-vingt-dix = 4 × 20 + 10.',
    '80 е quatre-vingts и в двете страни (не huitante), 81 е quatre-vingt-un.',
    'Цената пиши със запетая (75,50), а часа – 17:45 или 17h45. Enter проверява.'
  ].forEach((t, k) => { if (k) tip.appendChild(el('br')); tip.append(t); });
  if (!synth) {
    const box = el('div', 'qcard');
    box.append(el('p', 'eyebrow kind', 'Числа и часове'),
      el('p', 'result-msg', 'Този браузър не може да чете на глас, а тази игра има нужда от глас. Отвори страницата в Chrome или Safari.'));
    nuRoot.replaceChildren(box, tip);
    return false;
  }
  const set = el('details', 'settings');
  const summary = el('summary');
  nuSumEl = el('span', 'sum');
  nuSumEl.id = 'nu-sum';
  summary.append(el('span', null, 'Настройки'), nuSumEl);
  const body = el('div', 'settings-body');
  const [vField, vSeg] = nuField('nu-variant', 'Вариант');
  vSeg.classList.add('nu-variant');
  nuVoiceNote = el('p', 'set-note');
  nuVoiceNote.hidden = true;
  vField.appendChild(nuVoiceNote);
  const [kField, kSeg] = nuField('nu-kind', 'Вид');
  body.append(vField, kField, el('p', 'set-note', 'Всяка промяна започва нов кръг.'));
  set.append(summary, body);

  // the buttons stay, so the focus stays on the one pressed
  const vBtns = NU_VARIANTS.map(([id, name, words]) => {
    const b = toggleBtn('', nu.variant === id, () => {
      if (nu.variant === id) return;
      nu.variant = id;
      vBtns.forEach((x, k) => x.setAttribute('aria-pressed', String(NU_VARIANTS[k][0] === id)));
      nuSettingsChanged();
    });
    const w = el('span', 'nu-sub', words);
    w.lang = 'fr';
    b.append(el('span', null, name), w);
    return b;
  });
  vSeg.replaceChildren(...vBtns);
  const kBtns = NU_KINDS.map(([id, label]) => toggleBtn(label, nu.kind === id, () => {
    if (nu.kind === id) return;
    nu.kind = id;
    kBtns.forEach((x, k) => x.setAttribute('aria-pressed', String(NU_KINDS[k][0] === id)));
    nuSettingsChanged();
  }));
  kSeg.replaceChildren(...kBtns);

  nuRoot.replaceChildren(set, nuPlay, tip);
  nuShowVoiceNote();
  if (synth.addEventListener) synth.addEventListener('voiceschanged', nuShowVoiceNote);
  return true;
}
function nuShowVoiceNote() {
  if (!nuVoiceNote) return;
  nuVoiceNote.hidden = !(nu.variant === 'be' && synth.getVoices().length && !nuBeVoice());
  nuVoiceNote.textContent = 'На това устройство няма белгийски глас. Чуваш френски глас, но с белгийските думи.';
}
function nuSettingsChanged() {
  save(NU_KEY, { variant: nu.variant, kind: nu.kind });
  nuShowVoiceNote();
  nuStart(null, false);
}
function nuSum() {
  nuSumEl.textContent = nu.retry ? 'Грешките · ' + questionsWord(nu.qs.length)
    : [NU_VARIANTS.find(x => x[0] === nu.variant)[1], NU_KINDS.find(x => x[0] === nu.kind)[1], questionsWord(NU_COUNT)].join(' · ');
}

/* ---------- round ---------- */
/* play: started by a tap (Напред, Нов кръг, Повтори грешните), so the first item is said at once */
function nuStart(list, play) {
  if (gameShown('numbers')) stopAll();
  nu.retry = !!list;
  nu.qs = list || nuBuild();
  nu.queue = nu.qs.slice();
  nu.i = 0;
  nu.done = 0;
  nu.score = 0;
  nu.wrong = [];
  nuSum();
  nuRenderQ(play);
}

/* say the item; the first time the answer field opens. Returns whether it could be said. */
function nuListen(rate, btn) {
  const ui = nu.ui;
  if (!ui || !nuCanSpeak()) return false;
  if (!ui.heard) {
    ui.heard = true;
    // the big "Чуй" becomes "Чуй пак" (the same button)
    ui.playBtn.className = 'btn dk-btn';
    ui.playBtn.innerHTML = PLAY;
    ui.playBtn.append(' Чуй пак');
    ui.slowBtn.hidden = false;
    if (!nu.checked) {
      ui.input.disabled = false;
      ui.skip.disabled = false;
      ui.main.disabled = false;
    }
  }
  nuSay(ui.q.say, btn || ui.playBtn, rate || NU_NORMAL, ui.q.v);
  return true;
}

function nuRenderQ(play) {
  const q = nu.queue[nu.i];
  nu.checked = false;
  const card = el('div', 'qcard nu-card');

  // a second try is not a new question: the count, the score and the bar stay
  const num = q.again ? nu.done : nu.done + 1;
  const top = el('div', 'qtop');
  const scoreEl = el('span', null, 'Верни: ' + nu.score);
  top.append(el('span', null, 'Въпрос ' + num + ' от ' + nu.qs.length), scoreEl);
  const prog = el('div', 'progress');
  const bar = el('i');
  bar.style.width = (nu.done / nu.qs.length * 100) + '%';
  prog.appendChild(bar);
  card.append(top, prog, el('p', 'eyebrow kind', q.again ? 'Още веднъж' : NU_LABEL[q.type]), el('p', 'bgline', NU_ASK[q.type]));

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

  const input = el('input', 'ans nu-ans');
  input.type = 'text';
  input.setAttribute('inputmode', q.type === 'time' ? 'text' : 'decimal');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocapitalize', 'none');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('enterkeyhint', 'go');
  input.setAttribute('maxlength', '16');
  input.setAttribute('aria-label', NU_FIELD[q.type]);
  if (q.type === 'time') input.placeholder = 'чч:мм';
  input.disabled = true;
  const line = el('p', 'qline nu-line');
  line.appendChild(input);
  if (q.type === 'price') line.appendChild(el('span', 'nu-unit', '€'));
  const fmt = el('p', 'nu-fmt');
  fmt.setAttribute('aria-live', 'polite');
  card.append(row, line, fmt);

  const fb = el('div', 'feedback');
  fb.hidden = true;
  fb.setAttribute('aria-live', 'polite');
  card.appendChild(fb);

  const actions = el('div', 'actions');
  const skip = el('button', 'btn', 'Не знам');
  skip.type = 'button';
  skip.disabled = true;
  const main = el('button', 'btn primary', 'Провери');
  main.type = 'button';
  main.disabled = true;
  actions.append(skip, main);
  card.appendChild(actions);

  nu.ui = { card, q, input, fmt, fb, skip, main, scoreEl, bar, playBtn, slowBtn, heard: false };
  playBtn.addEventListener('click', () => {
    const first = !nu.ui.heard;
    if (nuListen(NU_NORMAL, playBtn) && first && !nu.checked) input.focus({ preventScroll: true });
  });
  slowBtn.addEventListener('click', () => nuListen(NU_SLOW, slowBtn));
  // a tap on "Чуй пак" or "Бавно" keeps the focus (and the phone keyboard) in the field
  [playBtn, slowBtn].forEach(b => b.addEventListener('pointerdown', e => {
    if (document.activeElement === input) e.preventDefault();
  }));
  input.addEventListener('input', () => { fmt.textContent = ''; });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nu.checked ? nuNext() : nuCheck(false);
    }
  });
  skip.addEventListener('click', () => nuCheck(true));
  main.addEventListener('click', () => (nu.checked ? nuNext() : nuCheck(false)));

  nuPlay.replaceChildren(card);
  if (play) {
    // after a tap the phone may speak at once; otherwise the big "Чуй" waits for one
    (nuListen(NU_NORMAL, playBtn) ? input : playBtn).focus({ preventScroll: true });
    card.scrollIntoView({ block: 'nearest' });
  }
}

function nuCheck(gaveUp) {
  const ui = nu.ui;
  if (!ui || nu.checked || !ui.heard) return;
  const q = ui.q;
  const val = gaveUp ? '' : ui.input.value;
  if (!gaveUp && !val.trim()) { ui.input.focus(); return; }
  const got = gaveUp ? null : nuRead(q, val);
  // not something we can read as a number: say how to write it, and nothing counts yet
  if (!gaveUp && !got) {
    ui.fmt.textContent = NU_FORMAT[q.type];
    ui.input.focus();
    return;
  }
  ui.fmt.textContent = '';
  const r = gaveUp ? { verdict: 'bad' } : nuJudge(q, got);
  const good = r.verdict !== 'bad';
  // only the first try counts; a miss (or "Не знам") comes back once, a few questions later
  if (!q.again) {
    nu.done++;
    if (good) nu.score++;
    else {
      nu.wrong.push({ q, given: val.trim(), why: r.why || null });
      nu.queue.splice(Math.min(nu.i + 1 + NU_AGAIN_AFTER, nu.queue.length), 0, Object.assign({}, q, { again: true }));
    }
  }
  nu.checked = true;

  ui.input.readOnly = true;
  ui.input.placeholder = '';
  ui.input.classList.add(r.verdict);
  ui.skip.hidden = true;
  ui.main.textContent = nu.i + 1 < nu.queue.length ? 'Напред' : 'Виж резултата';
  ui.scoreEl.textContent = 'Верни: ' + nu.score;
  ui.bar.style.width = (nu.done / nu.qs.length * 100) + '%';

  const bravo = q.again && good;
  const text = r.verdict === 'ok' ? (bravo ? 'Браво, този път вярно.' : 'Правилно!')
    : r.verdict === 'near' ? (bravo ? 'Браво, този път вярно. ' : 'Почти! ') + r.near
    : gaveUp ? 'Ето отговора:' : 'Грешно.';
  const sentence = nuSentence(q);
  const parts = [el('p', 'verdict ' + r.verdict, text), nuLine(null, sentence)];
  if (r.verdict === 'bad' && !gaveUp) {
    parts.push(nuLine('Ти написа:', el('span', 'given nu-given', val.trim())));
  }
  parts.push(nuLine(r.verdict === 'ok' ? 'С цифри:' : 'Правилно е:', nuDigits(q)));
  const other = nuOtherLine(q);
  if (other) parts.push(other);
  if (q.note) parts.push(el('p', r.verdict === 'bad' && q.day ? 'fb-why' : 'fb-line', q.note));
  if (r.why) parts.push(el('p', 'fb-why', r.why));
  ui.fb.replaceChildren(...parts);
  ui.fb.hidden = false;
  if (!(r.verdict === 'ok' && document.activeElement === ui.input)) ui.main.focus({ preventScroll: true });
  ui.fb.scrollIntoView({ block: 'nearest' });
  if (nuCanSpeak()) nuSay(q.say, sentence, NU_NORMAL, q.v);
}

function nuNext() {
  if (!nu.checked) return;
  stopAll();
  nu.i++;
  if (nu.i >= nu.queue.length) nuResult();
  else nuRenderQ(true);
}

function nuResult() {
  nu.ui = null;
  const n = nu.qs.length, s = nu.score;
  const pct = n ? s / n : 0;
  track('numbers_complete', { questions: n, score_pct: Math.round(pct * 100) });
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

  if (nu.wrong.length) {
    const box = el('div', 'mistakes');
    box.appendChild(el('h3', null, 'Грешки'));
    const ul = el('ul');
    nu.wrong.forEach(({ q, given, why }) => {
      const li = el('li');
      li.appendChild(el('span', 'm-prompt', NU_LABEL[q.type] + ' · ' + NU_VARIANTS.find(x => x[0] === q.v)[1]));
      li.appendChild(nuSentence(q));
      if (given) {
        const g = el('span', 'm-prompt');
        g.append('Твоят отговор: ', el('span', 'given', given));
        li.appendChild(g);
      }
      const right = el('span', 'm-prompt');
      right.append('Правилно: ', nuDigits(q));
      li.appendChild(right);
      if (why) li.appendChild(el('p', 'fb-why', why));
      else if (q.day && q.note) li.appendChild(el('p', 'fb-why', q.note));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    card.appendChild(box);
  }

  const actions = el('div', 'actions');
  if (nu.wrong.length) {
    const retry = el('button', 'btn', 'Повтори грешните');
    retry.type = 'button';
    const again = nu.wrong.map(w => Object.assign({}, w.q, { again: false }));
    retry.addEventListener('click', () => nuStart(shuffle(again.slice()), true));
    actions.appendChild(retry);
  }
  const fresh = el('button', 'btn primary', 'Нов кръг');
  fresh.type = 'button';
  fresh.addEventListener('click', () => nuStart(null, true));
  actions.appendChild(fresh);
  card.appendChild(actions);

  nuPlay.replaceChildren(card);
  nuSum();
  if (nu.wrong.length) {
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
  } else {
    fresh.focus({ preventScroll: true });
  }
  card.scrollIntoView({ block: 'nearest' });
}

/* no sound from this game once it is hidden, covered by a dialog or the app goes to the
   background. showView / showGame already stop everything; this only stops a sound of this
   game, never one another view has just started. */
const nuSpeaking = () => !!nuRoot.querySelector('.speaking, .playing');
const nuFollow = () => { if (!nuCanSpeak() && nuSpeaking()) stopAll(); };
VIEWS.forEach(v => $('tab-' + v).addEventListener('click', nuFollow));
document.addEventListener('gamechange', nuFollow);
document.addEventListener('visibilitychange', nuFollow);

if (nuSetup()) nuStart(null, false);
