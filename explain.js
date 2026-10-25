/* "Защо е грешно": explain a wrong verb form with the rule behind it.
   CONTRACT (used by the Test in app.js and by when.js):
     explainMistake(q, given) -> { kind, text } | null
       q:     { inf, tense: 'pr'|'pc'|'fp', p?: 0..5, answer }   answer = the expected verb part
              as in the Test (may hold (e)/(s)); p is optional (found from answer when missing)
       given: what the learner typed
       kind:  'person' | 'tense' | 'aux' | 'agree' | 'infinitive' | 'fp-inf' | 'no-aux'
       text:  one short Bulgarian sentence (informal "ти"), plain text
     Returns null when no rule is certain: then nothing extra is shown.

   How it works: every form of the verb that a learner could plausibly type is listed as a
   "shape" (a list of words without subject and reflexive pronouns): the right form of each
   person in each tense, and the typical wrong ones (wrong auxiliary, agreement with avoir,
   a participle without its auxiliary, a conjugated verb after aller…). The answer must be one
   of these shapes word for word. Accents may be left out, but an accent on a letter that has
   none makes another word (préféré is not préfère). When the answer could be read in two
   ways that need different rules, nothing is claimed. */

const XP_SUBJ = ['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles'];
const XP_REFL = ['me', 'te', 'se', 'nous', 'vous'];
const XP_ENDS = ['', 'e', 's', 'es'];
const xpCache = {};

/* the verb words of an answer: lower case, no punctuation, without the subject and,
   for a reflexive verb, without me / te / se (also the one after aller: vais me réunir) */
function xpCore(inf, s) {
  // allé(e) typed as in the hint counts as allée
  const w = norm(String(s).replace(/[()]/g, '').replace(/[.,!?;:«»"“”„…]/g, ' ')).split(' ').filter(Boolean);
  if (w.length > 1 && XP_SUBJ.includes(w[0])) w.shift();
  else if (/^j'./.test(w[0] || '')) w[0] = w[0].slice(2);
  if (isReflexive(inf)) {
    if (w.length > 1 && XP_REFL.includes(w[0])) w.shift();
    else if (/^[mts]'./.test(w[0] || '')) w[0] = w[0].slice(2);
    if (w.length > 2 && XP_REFL.includes(w[1])) w.splice(1, 1);
    else if (/^[mts]'./.test(w[1] || '')) w[1] = w[1].slice(2);
  }
  return w;
}

/* 2: the same word, 1: the same word with some accents left out, 0: another word
   (also a wrong or added accent: ête is not été, préféré is not préfère) */
function xpLetters(x) { return x.replace(/œ/g, 'oe').normalize('NFD').match(/.[̀-ͯ]*/gu) || []; }
function xpWord(exp, giv) {
  if (exp === giv) return 2;
  if (strip(exp) !== strip(giv)) return 0;
  const e = xpLetters(exp), g = xpLetters(giv);
  if (e.length !== g.length) return 0;
  return e.every((c, k) => g[k] === c || g[k].length === 1) ? 1 : 0;
}
function xpMatch(shape, words) {
  if (shape.length !== words.length) return 0;
  let best = 2;
  for (let k = 0; k < words.length && best; k++) best = Math.min(best, xpWord(shape[k], words[k]));
  return best;
}
const xpSame = (a, b) => a.length === b.length && a.every((x, k) => strip(x) === strip(b[k]));

/* every shape of one verb: { w: words, role, t: tense, p: person } */
function xpShapes(inf) {
  if (xpCache[inf]) return xpCache[inf];
  const v = VERB[inf];
  const b = norm(bareInf(inf)), pp = norm(v.pp);
  const own = v.aux === 'e' ? ETRE : AVOIR, other = v.aux === 'e' ? AVOIR : ETRE;
  const prWords = forms(inf, 'pr').map(f => norm(formAnswer(f)));
  const pps = ends => ends.filter(e => !(e === 's' && pp.endsWith('s'))).map(e => pp + e);
  // an "agreement" that is also a présent form (ai finis, suis réunis) may just be the
  // présent ending: no agreement rule for those
  const agreed = ends => pps(ends).filter(x => !prWords.includes(x));
  const all = pps(XP_ENDS);
  const S = [];
  const add = (w, role, t, p) => S.push({ w, role, t, p });
  for (let p = 0; p < 6; p++) {
    add([prWords[p]], 'form', 'pr', p);
    // passé composé: with être the participle agrees (e for a woman, s for more people)
    const ok = v.aux === 'a' ? [''] : p < 3 ? ['', 'e'] : p === 4 ? XP_ENDS : ['s', 'es'];
    pps(ok).forEach(x => add([own[p], x], 'form', 'pc', p));
    if (v.aux === 'a') agreed(['e', 's', 'es']).forEach(x => add([own[p], x], 'agree-avoir', 'pc', p));
    else if (p !== 4) agreed(p < 3 ? ['s', 'es'] : ['', 'e']).forEach(x => add([own[p], x], 'agree-etre', 'pc', p));
    all.forEach(x => add([other[p], x], 'aux', 'pc', p));
    add([own[p], b], 'aux-inf', 'pc', p);
    // futur proche
    add([ALLER[p], b], 'form', 'fp', p);
    // vais joue, vais joué (a feminine or plural participle there is more likely a typo)
    [...new Set(prWords.concat(pp))].filter(x => x !== b).forEach(x => add([ALLER[p], x], 'fp-conj', 'fp', p));
  }
  all.forEach(x => add([x], 'pp', 'pc', null));
  add([b], 'inf', null, null);
  return (xpCache[inf] = S);
}

/* the rule a group of matching shapes points to: a kind, null (it is the right person and
   tense, or two things are wrong at once) or undefined (says nothing for this tense) */
function xpKind(role, t, R, T, P) {
  const mine = R.some(p => P.includes(p));
  if (role === 'form') return t === T ? (mine ? null : 'person') : (mine ? 'tense' : null);
  if (role === 'pp') return T === 'pc' ? 'no-aux' : undefined;
  if (role === 'inf') return T === 'fp' ? undefined : 'infinitive';
  const kind = { 'agree-avoir': 'agree', 'agree-etre': 'agree', aux: 'aux', 'aux-inf': 'infinitive', 'fp-conj': 'fp-inf' }[role];
  const tense = role === 'fp-conj' ? 'fp' : 'pc';
  return T === tense && mine ? kind : null;
}

// fem: a feminine être participle (est allée, sont parties) is the form for elle / elles, not il / ils
const xpNames = (ps, fem) => {
  const n = ps.map(p => (fem && p === 2 ? 'elle' : fem && p === 5 ? 'elles' : SUBJ[p]));
  return n.length < 2 ? n.join('') : n.slice(0, -1).join(', ') + ' и ' + n[n.length - 1];
};
const xpTense = t => TENSE[t].label.toLowerCase();

function explainMistake(q, given) {
  if (!q || !VERB[q.inf] || !TENSE[q.tense] || typeof given !== 'string') return null;
  const inf = q.inf, T = q.tense;
  const known = Number.isInteger(q.p) && q.p >= 0 && q.p < 6;
  const f = known ? forms(inf, T)[q.p] : null;
  const answer = q.answer || (f ? formAnswer(f) : '');
  if (!answer) return null;
  const g = xpCore(inf, given);
  if (!g.length) return null;
  const shapes = xpShapes(inf);

  // who the answer is for: q.p, or every person whose form it is (je joue / il joue)
  const exp = variants(answer).map(a => xpCore(inf, a));
  const P = known ? [q.p]
    : [...new Set(shapes.filter(s => s.role === 'form' && s.t === T && exp.some(w => xpSame(s.w, w))).map(s => s.p))];
  if (!P.length) return null;

  // the right answer spelled differently (accents, an agreement for elle): no rule to tell
  if (exp.some(w => xpSame(w, g))) return null;
  if (shapes.some(s => s.role === 'form' && s.t === T && P.includes(s.p) && xpSame(s.w, g))) return null;

  // the shapes the answer is, best spelling first; same role and tense put together
  const hits = shapes.map(s => [s, xpMatch(s.w, g)])
    .filter(([s, m]) => m && xpKind(s.role, s.t, [s.p], T, P) !== undefined);
  if (!hits.length) return null;
  const top = Math.max(...hits.map(h => h[1]));
  const groups = {};
  hits.filter(h => h[1] === top).forEach(([s]) => {
    const key = s.role + ':' + s.t;
    (groups[key] = groups[key] || { role: s.role, t: s.t, R: [] }).R.push(s.p);
  });
  const read = Object.values(groups).map(x => Object.assign(x, { kind: xpKind(x.role, x.t, x.R, T, P) }));
  if (read.some(x => !x.kind) || new Set(read.map(x => x.kind)).size !== 1 || read.length !== 1) return null;
  const r = read[0];

  // the right answer: with the subject when the person is known (j'ai joué), else as in
  // the sentence (est allée)
  const full = known ? formText(f) : answer;
  const v = VERB[inf];
  let text;
  if (r.kind === 'person') {
    const R = [...new Set(r.R)].sort();
    const pp0 = strip(norm(v.pp)), last = strip(g[g.length - 1] || '');
    const fem = r.t === 'pc' && v.aux === 'e' && last.startsWith(pp0) && /^es?$/.test(last.slice(pp0.length));
    text = known
      ? 'Това е формата за ' + xpNames(R, fem) + '. За ' + SUBJ[q.p] + ' е: ' + (isReflexive(inf) ? full : answer) + '.'
      : 'Тази форма е за ' + xpNames(R, fem) + '. Виж кой е подлогът в изречението.';
  } else if (r.kind === 'tense') {
    text = 'Това е ' + xpTense(r.t) + ', а тук трябва ' + xpTense(T) + ': ' + full + '.';
  } else if (r.kind === 'aux') {
    text = inf + ' е с ' + (v.aux === 'e' ? 'être' : 'avoir') + ': ' + full + '.';
  } else if (r.kind === 'agree') {
    text = v.aux === 'a' ? 'С avoir причастието не се променя: ' + full + '.'
      : 'С être причастието се съгласува с подлога: ' + full + '.';
  } else if (r.kind === 'no-aux') {
    text = 'Липсва спомагателният глагол: ' + full + '.';
  } else if (r.kind === 'infinitive') {
    if (r.role === 'aux-inf') {
      text = 'След ' + (v.aux === 'e' ? ETRE : AVOIR)[P[0]] + ' идва минало причастие, а не инфинитив: ' + full + '.';
    } else {
      text = 'Това е инфинитивът. ' + (known ? 'За ' + SUBJ[q.p] + ' е: ' : 'Тук трябва: ') + full + '.';
    }
  } else {
    text = 'След ' + ALLER[P[0]] + ' идва инфинитив: ' + answer + '.';
  }
  return { kind: r.kind, text };
}
