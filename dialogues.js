/* Short dialogues: listen (two voices, translation), fill in the verbs, or play a role.
   Data: DIALOGUES from dialogues-data.js. Gaps in the French are written {answer|infinitive|tense}.
   Uses helpers from app.js, dictation.js and speaking.js. */

const DL_GAP = /\{([^|{}]+)\|([^|{}]+)\|(pr|pc|fp)\}/g;
const DL_SLOW = 0.6;
const DL_NORMAL = 0.92;
const DL_MODES = [['listen', 'Слушай'], ['fill', 'Попълни'], ['role', 'Роля']];

let dlProgress = load('dialozi', {});
if (!dlProgress || typeof dlProgress !== 'object' || Array.isArray(dlProgress)) dlProgress = {};
const dl = {
  cur: null, mode: 'listen', showBg: load('dialozi-bg', 1) !== 0, slow: false,
  playing: false, role: null, step: 0, rec: null, ui: null, lastInput: null
};
const dlRoot = $('dialogues');

/* ---------- text ---------- */
const dlText = fr => fr.replace(DL_GAP, '$1');                 // the full French line
function dlParts(fr) {                                          // text pieces and gaps, in order
  const parts = [];
  let last = 0;
  fr.replace(DL_GAP, (m, answer, inf, tense, at) => {
    if (at > last) parts.push({ text: fr.slice(last, at) });
    parts.push({ gap: true, answer, inf, tense });
    last = at + m.length;
  });
  if (last < fr.length) parts.push({ text: fr.slice(last) });
  return parts;
}
const dlSpeaker = (d, who) => who === 'A' ? d.a : d.b;

/* ---------- voices: two speakers, two voices if the phone has them ---------- */
function dlVoices() {
  const fr = synth ? synth.getVoices().filter(v => /^fr/i.test(v.lang)) : [];
  return fr;
}
function dlUtterance(d, line, target) {
  const sp = dlSpeaker(d, line.who);
  const u = makeUtterance(dlText(line.fr), target, true, dl.slow ? DL_SLOW : DL_NORMAL);
  const vs = dlVoices();
  if (vs.length > 1) u.voice = vs[line.who === 'A' ? 0 : 1];
  u.pitch = sp.gender === 'f' ? 1.15 : 0.85;
  return u;
}
function dlStop() {
  stopAll();
  dl.playing = false;
  if (dl.rec) { const r = dl.rec; r.cancelled = true; dl.rec = null; try { r.abort(); } catch (e) {} }
  if (dl.ui && dl.ui.playAll) dl.ui.playAll.querySelector('.lbl').textContent = 'Пусни целия диалог';
}
function dlSay(d, line, target, onend) {
  if (!synth) { if (onend) onend(); return; }
  stopAll();
  const u = dlUtterance(d, line, target);
  if (onend) { const prev = u.onend; u.onend = u.onerror = () => { prev(); onend(); }; }
  synth.speak(u);
}

/* ---------- list ---------- */
function dlList() {
  dlStop();
  dl.cur = null;
  dl.ui = null;
  const wrap = el('div', 'dl-listbox');
  wrap.appendChild(el('p', 'set-note', 'Кратки разговори за свободното време. Избери един.'));
  const ul = el('div', 'choices');
  DIALOGUES.forEach(d => {
    const done = dlProgress[d.id] || {};
    const b = el('button', 'choice dl-pick');
    b.type = 'button';
    const title = el('span', 'choice-title', d.title);
    title.lang = 'fr';
    const meta = [d.titleBg, d.tenses.map(t => TENSE[t].label).join(', ')];
    if (done.fill) meta.push('попълнено ' + done.fill);
    if (done.role) meta.push('роля ✓');
    b.append(title, el('span', 'choice-desc', meta.join(' · ')));
    b.addEventListener('click', () => dlOpen(d));
    ul.appendChild(b);
  });
  wrap.appendChild(ul);
  dlRoot.replaceChildren(wrap);
}

/* ---------- one dialogue ---------- */
function dlOpen(d, mode) {
  dlStop();
  dl.cur = d;
  dl.mode = mode || dl.mode;
  const box = el('div', 'qcard dl-box');

  const head = el('div', 'dl-head');
  const back = el('button', 'linkbtn', '← Всички диалози');
  back.type = 'button';
  back.addEventListener('click', dlList);
  const h = el('h2', 'dl-title', d.title);
  h.lang = 'fr';
  head.append(back, h, el('p', 'sub', d.titleBg + ' · ' + d.a.name + ' и ' + d.b.name));
  box.appendChild(head);

  const modes = el('div', 'seg');
  DL_MODES.forEach(([id, label]) => modes.appendChild(toggleBtn(label, dl.mode === id, () => dlOpen(d, id))));
  box.appendChild(modes);

  const body = el('div', 'dl-body');
  box.appendChild(body);
  dlRoot.replaceChildren(box);
  dl.ui = { box, body };
  if (dl.mode === 'listen') dlListen(d, body);
  else if (dl.mode === 'fill') dlFill(d, body);
  else dlRole(d, body);
  box.scrollIntoView({ block: 'nearest' });
}

function dlBubble(d, line, content) {
  const sp = dlSpeaker(d, line.who);
  const b = el('div', 'dl-line ' + (line.who === 'A' ? 'dl-a' : 'dl-b'));
  b.appendChild(el('span', 'dl-name', sp.name));
  b.appendChild(content);
  return b;
}
function dlSayButton(d, line) {
  const btn = el('button', 'sbtn dl-fr');
  btn.type = 'button';
  btn.lang = 'fr';
  btn.innerHTML = ICON;
  btn.appendChild(el('span', null, dlText(line.fr)));
  btn.setAttribute('aria-label', 'Произнеси: ' + dlText(line.fr));
  btn.addEventListener('click', () => { dl.playing = false; dlSay(d, line, btn); });
  return btn;
}

function dlControls(body, d, withPlayAll) {
  const row = el('div', 'dl-controls');
  if (withPlayAll) {
    const playAll = el('button', 'btn primary dk-btn');
    playAll.type = 'button';
    playAll.innerHTML = PLAY;
    playAll.appendChild(el('span', 'lbl', 'Пусни целия диалог'));
    playAll.addEventListener('click', () => dlPlayAll(d));
    row.appendChild(playAll);
    dl.ui.playAll = playAll;
  }
  const slow = toggleBtn('Бавно', dl.slow, () => {
    dl.slow = !dl.slow;
    slow.setAttribute('aria-pressed', String(dl.slow));
  });
  row.appendChild(slow);
  const tr = toggleBtn('Превод', dl.showBg, () => {
    dl.showBg = !dl.showBg;
    save('dialozi-bg', dl.showBg ? 1 : 0);
    tr.setAttribute('aria-pressed', String(dl.showBg));
    body.classList.toggle('dl-nobg', !dl.showBg);
  });
  row.appendChild(tr);
  body.classList.toggle('dl-nobg', !dl.showBg);
  return row;
}

/* listen: the whole dialogue, line by line */
function dlListen(d, body) {
  body.appendChild(dlControls(body, d, true));
  const lines = el('div', 'dl-lines');
  dl.ui.buttons = d.lines.map(line => {
    const c = el('div');
    const fr = dlSayButton(d, line);
    c.append(fr, el('p', 'dl-bg', line.bg));
    lines.appendChild(dlBubble(d, line, c));
    return fr;
  });
  body.appendChild(lines);
  body.appendChild(el('p', 'set-note', 'Чукни реплика, за да я чуеш. Скрий превода, когато искаш да провериш дали разбираш.'));
}
function dlPlayAll(d) {
  if (dl.playing) { dlStop(); return; }
  dlStop();
  dl.playing = true;
  dl.ui.playAll.querySelector('.lbl').textContent = 'Спри';
  const run = k => {
    if (!dl.playing || dl.cur !== d || !dl.ui || !dl.ui.buttons) return;
    if (k >= d.lines.length) { dlStop(); return; }
    dlSay(d, d.lines[k], dl.ui.buttons[k], () => { if (dl.playing) setTimeout(() => run(k + 1), 250); });
    dl.playing = true;
  };
  run(0);
}

/* fill in: type the verbs */
function dlFill(d, body) {
  body.appendChild(dlControls(body, d, false));
  const lines = el('div', 'dl-lines');
  const gaps = [];
  d.lines.forEach(line => {
    const c = el('div');
    const p = el('p', 'dl-fr dl-fill');
    p.lang = 'fr';
    dlParts(line.fr).forEach(part => {
      if (!part.gap) { p.appendChild(document.createTextNode(part.text)); return; }
      const input = el('input', 'ans dl-gap');
      input.type = 'text';
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'none');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('lang', 'fr');
      input.size = Math.max(5, part.answer.length + 1);
      input.placeholder = part.inf;
      input.setAttribute('aria-label', 'Глаголът ' + part.inf + ' в ' + TENSE[part.tense].label);
      input.addEventListener('focus', () => { dl.lastInput = input; });
      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const k = gaps.findIndex(g => g.input === input);
        const nextGap = gaps.slice(k + 1).find(g => !g.input.readOnly);
        if (nextGap) nextGap.input.focus();
        else check.click();
      });
      p.appendChild(input);
      gaps.push({ input, part, line });
    });
    const speakBtn = el('button', 'vplay dl-play');
    speakBtn.type = 'button';
    speakBtn.innerHTML = PLAY;
    speakBtn.setAttribute('aria-label', 'Чуй репликата');
    speakBtn.addEventListener('click', () => dlSay(d, line, speakBtn));
    const row = el('div', 'dl-fillrow');
    row.append(p, speakBtn);
    c.append(row, el('p', 'dl-bg', line.bg));
    lines.appendChild(dlBubble(d, line, c));
  });
  body.appendChild(lines);

  const keys = el('div', 'keys');
  keys.setAttribute('aria-label', 'Букви със знаци');
  DK_KEYS.forEach(k => {
    const b = el('button', null, k);
    b.type = 'button';
    b.setAttribute('aria-label', 'Въведи ' + k);
    b.addEventListener('pointerdown', e => e.preventDefault());
    b.addEventListener('click', () => { if (dl.lastInput) insertChar(dl.lastInput, k); });
    keys.appendChild(b);
  });
  body.appendChild(keys);

  const fb = el('div', 'feedback');
  fb.hidden = true;
  fb.setAttribute('aria-live', 'polite');
  body.appendChild(fb);
  const actions = el('div', 'actions');
  const reset = el('button', 'btn', 'Започни отначало');
  reset.type = 'button';
  reset.addEventListener('click', () => dlOpen(d, 'fill'));
  const check = el('button', 'btn primary', 'Провери');
  check.type = 'button';
  check.addEventListener('click', () => {
    let ok = 0;
    gaps.forEach(g => {
      const val = g.input.value;
      const cands = variants(g.part.answer);
      const exact = cands.some(c => norm(c) === norm(val));
      const near = !exact && val.trim() && cands.some(c => nearMatch(c, val));
      g.input.classList.remove('ok', 'near', 'bad');
      g.input.classList.add(exact ? 'ok' : near ? 'near' : 'bad');
      if (exact || near) ok++;
      if (!exact) {
        g.input.title = g.part.answer;
        if (!near) {
          // show the right form next to the field
          let hint = g.input.nextSibling;
          if (!(hint && hint.classList && hint.classList.contains('dl-right'))) {
            hint = el('span', 'dl-right');
            g.input.after(hint);
          }
          hint.textContent = ' ' + g.part.answer;
        }
      }
      g.input.readOnly = true;
    });
    const n = gaps.length;
    fb.replaceChildren(el('p', 'verdict ' + (ok === n ? 'ok' : ok >= n * 0.6 ? 'near' : 'bad'),
      ok === n ? 'Браво! Всички глаголи са верни.' : 'Верни: ' + ok + ' от ' + n + '. Правилните форми са до полетата.'));
    if (gaps.some(g => g.input.classList.contains('near'))) fb.appendChild(el('p', 'fb-line', 'Жълтите се зачитат, но внимавай за знаците над буквите.'));
    fb.hidden = false;
    check.hidden = true;
    const prev = dlProgress[d.id] || {};
    const best = prev.fillOk || 0;
    if (ok >= best) dlProgress[d.id] = { ...prev, fillOk: ok, fill: ok + '/' + n };
    save('dialozi', dlProgress);
    reset.focus({ preventScroll: true });
    fb.scrollIntoView({ block: 'nearest' });
  });
  actions.append(reset, check);
  body.appendChild(actions);
  body.appendChild(el('p', 'set-note', 'Напиши глагола във времето, което се търси (под полето е инфинитивът). В passé composé пиши и спомагателния глагол (avons joué), а във futur proche и aller (vais voir).'));
}

/* role play: the app says the other person's lines, you say yours */
function dlRole(d, body) {
  if (!dl.role) {
    body.appendChild(el('p', 'set-note', 'Избери кой си. Приложението казва репликите на другия, а ти казваш своите на глас.'));
    const ch = el('div', 'actions dl-roles');
    ['A', 'B'].forEach(who => {
      const sp = dlSpeaker(d, who);
      const b = el('button', 'btn' + (who === 'A' ? ' primary' : ''), 'Аз съм ' + sp.name);
      b.type = 'button';
      b.addEventListener('click', () => { dl.role = who; dl.step = 0; dlOpen(d, 'role'); });
      ch.appendChild(b);
    });
    body.appendChild(ch);
    return;
  }
  const me = dl.role;
  const top = el('div', 'dl-controls');
  const slow = toggleBtn('Бавно', dl.slow, () => { dl.slow = !dl.slow; slow.setAttribute('aria-pressed', String(dl.slow)); });
  const switchRole = el('button', 'linkbtn', 'Смени ролята');
  switchRole.type = 'button';
  switchRole.addEventListener('click', () => { dl.role = me === 'A' ? 'B' : 'A'; dl.step = 0; dlOpen(d, 'role'); });
  top.append(slow, switchRole);
  body.appendChild(top);
  const lines = el('div', 'dl-lines');
  body.appendChild(lines);
  dl.ui.lines = lines;
  dl.step = 0;
  dlRoleStep(d);
}
function dlRoleStep(d) {
  if (!dl.ui || dl.cur !== d || !dl.ui.lines) return;
  const lines = dl.ui.lines;
  if (dl.step >= d.lines.length) {
    const done = el('div', 'feedback');
    done.append(el('p', 'verdict ok', 'Браво! Изигра целия диалог.'));
    const again = el('button', 'btn primary', 'Пак');
    again.type = 'button';
    again.addEventListener('click', () => { dl.step = 0; dlOpen(d, 'role'); });
    const other = el('button', 'btn', 'Другата роля');
    other.type = 'button';
    other.addEventListener('click', () => { dl.role = dl.role === 'A' ? 'B' : 'A'; dl.step = 0; dlOpen(d, 'role'); });
    const act = el('div', 'actions');
    act.append(other, again);
    done.appendChild(act);
    lines.appendChild(done);
    dlProgress[d.id] = { ...(dlProgress[d.id] || {}), role: true };
    save('dialozi', dlProgress);
    again.focus({ preventScroll: true });
    done.scrollIntoView({ block: 'nearest' });
    return;
  }
  const line = d.lines[dl.step];
  if (line.who !== dl.role) {
    // the other person speaks, then it is your turn
    const c = el('div');
    const fr = dlSayButton(d, line);
    c.append(fr, el('p', 'dl-bg', line.bg));
    lines.appendChild(dlBubble(d, line, c));
    fr.scrollIntoView({ block: 'nearest' });
    const stepNow = dl.step;
    const go = () => { if (dl.cur === d && dl.step === stepNow && currentView === 'dialogues') { dl.step++; dlRoleStep(d); } };
    if (synth) dlSay(d, line, fr, () => setTimeout(go, 300));
    else go();
    return;
  }
  // your line: the Bulgarian first, the French after you say it
  const c = el('div', 'dl-mine');
  c.appendChild(el('p', 'dl-bg dl-prompt', line.bg));
  const hidden = el('div');
  hidden.hidden = true;
  const fr = dlSayButton(d, line);
  hidden.appendChild(fr);
  const heard = el('p', 'fb-line sp-heard');
  heard.hidden = true;
  const res = el('p', 'dk-answer sp-words');
  res.hidden = true;
  const act = el('div', 'dl-controls');
  const mic = el('button', 'btn primary sp-mic');
  mic.type = 'button';
  mic.innerHTML = MIC;
  mic.appendChild(el('span', 'lbl', 'Кажи'));
  const show = el('button', 'btn', SpeechRec ? 'Покажи' : 'Кажи го и виж');
  show.type = 'button';
  const next = el('button', 'btn' + (SpeechRec ? '' : ' primary'), 'Напред');
  next.type = 'button';
  next.hidden = true;
  if (SpeechRec) act.appendChild(mic);
  act.append(show, next);
  c.append(hidden, heard, res, act);
  lines.appendChild(dlBubble(d, line, c));
  c.scrollIntoView({ block: 'nearest' });
  const reveal = () => {
    hidden.hidden = false;
    next.hidden = false;
    show.hidden = true;
    next.classList.add('primary');
    dlSay(d, line, fr);
  };
  show.addEventListener('click', reveal);
  next.addEventListener('click', () => {
    dlStop();
    act.remove();
    hidden.hidden = false;
    dl.step++;
    dlRoleStep(d);
  });
  mic.addEventListener('click', () => dlRoleListen(d, line, { mic, heard, res, reveal, next }));
  (SpeechRec ? mic : show).focus({ preventScroll: true });
}
/* one listening try for your line; the result shows which words were understood */
function dlRoleListen(d, line, ui) {
  if (dl.rec) { try { dl.rec.stop(); } catch (e) {} return; }
  stopAll();
  const rec = new SpeechRec();
  rec.lang = 'fr-FR';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let finalText = '', interimText = '', error = null;
  const timer = setTimeout(() => { try { rec.stop(); } catch (e) {} }, SP_LISTEN_MS);
  rec.onresult = e => {
    if (rec.cancelled) return;
    const results = [...e.results];
    const text = results.map(r => r[0].transcript).join(' ').trim();
    ui.heard.textContent = text ? 'Чух: ' + text : '';
    ui.heard.hidden = !text;
    if (results.every(r => r.isFinal)) finalText = text;
    else interimText = text;
  };
  rec.onerror = e => { error = e.error; };
  rec.onend = () => {
    clearTimeout(timer);
    if (dl.rec === rec) dl.rec = null;
    ui.mic.classList.remove('listening');
    ui.mic.querySelector('.lbl').textContent = 'Кажи';
    if (rec.cancelled || dl.cur !== d) return;
    const text = finalText || interimText;
    if (!text) {
      ui.res.replaceChildren(document.createTextNode(SP_ERRORS[error && error !== 'aborted' ? error : 'no-speech'] || SP_ERRORS.other));
      ui.res.className = 'verdict bad';
      ui.res.hidden = false;
      return;
    }
    const r = spMatch(dlText(line.fr), text);
    ui.res.className = 'dk-answer sp-words';
    ui.res.replaceChildren();
    r.exp.forEach((t, k) => {
      if (k) ui.res.append(' ');
      ui.res.appendChild(el('span', t.st === 'bad' ? 'dk-bad' : null, t.show));
    });
    ui.res.prepend(el('span', 'verdict ' + (r.ok === r.total ? 'ok' : 'near'), r.ok === r.total ? 'Чудесно! ' : 'Почти: '));
    ui.res.hidden = false;
    ui.reveal();
  };
  dl.rec = rec;
  ui.mic.classList.add('listening');
  ui.mic.querySelector('.lbl').textContent = 'Говори сега…';
  try { rec.start(); } catch (e) { dl.rec = null; ui.mic.classList.remove('listening'); ui.mic.querySelector('.lbl').textContent = 'Кажи'; }
}

/* leaving the tab or the app stops speech and the mic */
VIEWS.filter(v => v !== 'dialogues').forEach(v => $('tab-' + v).addEventListener('click', () => {
  dl.playing = false;
  if (dl.rec) { const r = dl.rec; r.cancelled = true; dl.rec = null; try { r.abort(); } catch (e) {} }
  if (dl.cur && dl.mode === 'role' && dl.role) dl.rolePaused = true;
}));
// a role play that was left in the middle starts again from the top
$('tab-dialogues').addEventListener('click', () => {
  if (dl.rolePaused && dl.cur) { dl.rolePaused = false; dlOpen(dl.cur, 'role'); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) dlStop(); });

dlList();
