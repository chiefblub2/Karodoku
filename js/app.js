import { generate } from './generator.js';
import { randomSeed } from './rng.js';
import { SUSPECTS, VICTIM, PERSON_HUES, SIZES, DIFFICULTIES, BLOCKING, OCCUPIABLE } from './model.js';
import { t, setLang, getLang, clueText, roomName, weaponName, objectName } from './i18n.js';

const $ = (id) => document.getElementById(id);
const ICONS = { chair: '🪑', bed: '🛏️', tub: '🛁', plant: '🪴', shelf: '📚', table: '', carpet: '' };
const ROOM_HUES = [38, 200, 110, 330, 265, 18, 170, 52, 290, 140, 230, 0];
const STORE = 'karodoku:';

let pz = null;       // current puzzle
let people = [];     // [{name, hue, victim}]
let st = null;       // play state
let tool = 0;        // person index or 'x'
let history = [];
let timerId = 0;
let checkedWrong = new Set();

// ---------- persistence ----------

const storage = {
  get(k) { try { return JSON.parse(localStorage.getItem(STORE + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(STORE + k, JSON.stringify(v)); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(STORE + k); } catch { /* ignore */ } },
};

const puzzleKey = () => `p:${pz.size}:${pz.difficulty}:${pz.seed}`;

function freshState() {
  return { pos: new Array(pz.size).fill(-1), marks: [], struck: [], locked: [], hints: 0, elapsed: 0, solved: false };
}

function save() { storage.set(puzzleKey(), st); }

// ---------- setup ----------

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readParams() {
  const q = new URLSearchParams(location.search);
  const saved = storage.get('settings') || {};
  const size = Number(q.get('n')) || saved.size || 6;
  const difficulty = q.get('d') || saved.difficulty || 'medium';
  const seed = q.get('s') || today();
  return {
    size: SIZES.includes(size) ? size : 6,
    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'medium',
    seed: seed.slice(0, 40),
  };
}

function load({ size, difficulty, seed }, push = true) {
  $('loading').hidden = false;
  // Let the spinner paint before the (short) synchronous generation.
  setTimeout(() => {
    pz = generate({ size, difficulty, seed });
    people = Array.from({ length: size }, (_, i) =>
      i === size - 1 ? { name: VICTIM, hue: 0, victim: true } : { name: SUSPECTS[i], hue: PERSON_HUES[i], victim: false });
    st = { ...freshState(), ...(storage.get(puzzleKey()) || {}) };
    history = [];
    checkedWrong.clear();
    tool = firstUnplaced() ?? 0;
    storage.set('settings', { size, difficulty });
    const url = new URL(location.href);
    url.searchParams.set('n', size);
    url.searchParams.set('d', difficulty);
    url.searchParams.set('s', seed);
    history_[push ? 'pushState' : 'replaceState'](null, '', url);
    $('sel-size').value = size;
    $('sel-diff').value = difficulty;
    $('loading').hidden = true;
    renderAll();
    startTimer();
  }, 20);
}
const history_ = window.history;

// ---------- rendering ----------

function renderStatic() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('btn-lang').textContent = getLang() === 'de' ? 'EN' : 'DE';
  $('sel-size').innerHTML = SIZES.map((n) => `<option value="${n}">${n} × ${n}</option>`).join('');
  $('sel-diff').innerHTML = DIFFICULTIES.map((d) => `<option value="${d}">${t(d)}</option>`).join('');
  $('rules-list').innerHTML = t('rules').map((r) => `<li>${r}</li>`).join('');
  $('howto').textContent = t('howTo');
  if (pz) { $('sel-size').value = pz.size; $('sel-diff').value = pz.difficulty; }
}

function renderAll() {
  renderStatic();
  $('story').textContent = t('story', VICTIM, weaponName(pz.weapon));
  const isDaily = /^\d{4}-\d{2}-\d{2}$/.test(pz.seed);
  $('puzzle-id').textContent = isDaily ? `📅 ${pz.seed}` : `#${pz.seed}`;
  renderBoard();
  renderPalette();
  renderClues();
  renderLegend();
  renderTimer();
}

function roomLabelCells() {
  // Each room is labelled in its first cell (reading order).
  const N = pz.size, out = new Map();
  for (let c = 0; c < N * N; c++) {
    const r = pz.room[c];
    if (!out.has(r)) out.set(r, c);
  }
  return new Set(out.values());
}

function renderBoard() {
  const N = pz.size, board = $('board');
  board.style.setProperty('--n', N);
  const labels = roomLabelCells();
  const occ = new Map(st.pos.map((c, p) => [c, p]).filter(([c]) => c >= 0));
  const rowCnt = new Array(N).fill(0), colCnt = new Array(N).fill(0);
  for (const c of occ.keys()) { rowCnt[Math.floor(c / N)]++; colCnt[c % N]++; }
  const marks = new Set(st.marks);
  const locked = new Set(st.locked);

  let html = '<div class="corner"></div>';
  for (let c = 0; c < N; c++) html += `<div class="coord">${String.fromCharCode(65 + c)}</div>`;
  for (let r = 0; r < N; r++) {
    html += `<div class="coord">${r + 1}</div>`;
    for (let c = 0; c < N; c++) {
      const i = r * N + c, room = pz.room[i], o = pz.obj[i];
      const cls = ['cell'];
      if (r === 0 || pz.room[i - N] !== room) cls.push('wt');
      if (r === N - 1 || pz.room[i + N] !== room) cls.push('wb');
      if (c === 0 || pz.room[i - 1] !== room) cls.push('wl');
      if (c === N - 1 || pz.room[i + 1] !== room) cls.push('wr');
      if (o && BLOCKING.has(o)) cls.push('blocked');
      const p = occ.get(i);
      if (p !== undefined && (rowCnt[r] > 1 || colCnt[c] > 1)) cls.push('conflict');
      if (p !== undefined && checkedWrong.has(p)) cls.push('wrong');
      if (p === undefined && (rowCnt[r] || colCnt[c])) cls.push('shade');

      let inner = '';
      if (o === 'table') inner += '<span class="obj obj-table"></span>';
      else if (o === 'carpet') inner += '<span class="obj obj-carpet"></span>';
      else if (o) inner += `<span class="obj">${ICONS[o]}</span>`;
      if (labels.has(i)) inner += `<span class="room-label">${roomName(pz.rooms[room].type)}</span>`;
      if (p !== undefined) {
        const pp = people[p];
        inner += `<span class="token${pp.victim ? ' victim' : ''}${locked.has(p) ? ' locked' : ''}" style="--ph:${pp.hue}">${pp.victim ? '💀' : pp.name[0]}</span>`;
      } else if (marks.has(i)) inner += '<span class="mark">✕</span>';

      const label = `${String.fromCharCode(65 + c)}${r + 1}, ${roomName(pz.rooms[room].type)}${o ? ', ' + objectName(o) : ''}${p !== undefined ? ', ' + people[p].name : ''}`;
      html += `<button type="button" class="${cls.join(' ')}" style="--rh:${ROOM_HUES[room % ROOM_HUES.length]}" data-cell="${i}" aria-label="${label}">${inner}</button>`;
    }
  }
  board.innerHTML = html;
}

function renderPalette() {
  const pal = $('palette');
  let html = people.map((pp, i) => {
    const placed = st.pos[i] >= 0;
    return `<button type="button" class="chip${tool === i ? ' active' : ''}${placed ? ' placed' : ''}${pp.victim ? ' victim' : ''}" data-person="${i}" style="--ph:${pp.hue}">
      <span class="chip-token">${pp.victim ? '💀' : pp.name[0]}</span><span class="chip-name">${pp.name}</span></button>`;
  }).join('');
  html += `<button type="button" class="chip tool${tool === 'x' ? ' active' : ''}" data-person="x"><span class="chip-token">✕</span><span class="chip-name">${t('marker')}</span></button>`;
  pal.innerHTML = html;
}

function renderClues() {
  const struck = new Set(st.struck);
  $('clues').innerHTML = pz.clues.map((cl, i) =>
    `<li class="${struck.has(i) ? 'struck' : ''}" data-clue="${i}" tabindex="0">${clueText(cl, pz, people)}</li>`).join('');
}

function renderLegend() {
  const present = new Set(pz.obj.filter(Boolean));
  const order = ['chair', 'bed', 'carpet', 'tub', 'table', 'plant', 'shelf'].filter((o) => present.has(o));
  $('legend').innerHTML = order.map((o) => {
    const icon = o === 'table' ? '<span class="obj obj-table"></span>' : o === 'carpet' ? '<span class="obj obj-carpet"></span>' : ICONS[o];
    return `<li class="${OCCUPIABLE.has(o) ? 'ok' : 'no'}"><span class="legend-icon">${icon}</span>${objectName(o)}<span class="legend-tag">${OCCUPIABLE.has(o) ? '✓' : '✕'}</span></li>`;
  }).join('');
}

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
function renderTimer() { $('timer').textContent = `⏱ ${fmtTime(st.elapsed)}${st.solved ? ' ✓' : ''}`; }

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (st.solved || document.hidden) return;
    st.elapsed++;
    renderTimer();
    if (st.elapsed % 5 === 0) save();
  }, 1000);
}

let toastTimer = 0;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ---------- game logic ----------

function firstUnplaced(after = -1) {
  const N = people.length;
  for (let k = 1; k <= N; k++) {
    const p = (after + k + N) % N;
    if (st.pos[p] < 0) return p;
  }
  return null;
}

function snapshot() {
  history.push(JSON.stringify({ pos: st.pos, marks: st.marks }));
  if (history.length > 200) history.shift();
}

function onCell(i) {
  if (st.solved) return;
  const o = pz.obj[i];
  if (o && BLOCKING.has(o)) { toast(t('blocked')); return; }
  const here = st.pos.indexOf(i);
  const locked = new Set(st.locked);
  checkedWrong.clear();

  if (tool === 'x') {
    if (here >= 0) return;
    snapshot();
    st.marks = st.marks.includes(i) ? st.marks.filter((m) => m !== i) : [...st.marks, i];
  } else {
    if (locked.has(tool) || (here >= 0 && locked.has(here))) return;
    snapshot();
    if (here === tool) {
      st.pos[tool] = -1;
    } else {
      if (here >= 0) st.pos[here] = -1;
      st.pos[tool] = i;
      st.marks = st.marks.filter((m) => m !== i);
      const next = firstUnplaced(tool);
      if (next !== null) tool = next;
    }
  }
  save();
  renderBoard();
  renderPalette();
  if (st.pos.every((c) => c >= 0)) evaluateComplete();
}

function evaluateComplete() {
  const correct = st.pos.every((c, p) => c === pz.solution[p]);
  if (correct) openAccuse();
  else toast(t('notComplete'));
}

function check() {
  checkedWrong = new Set(st.pos.map((c, p) => (c >= 0 && c !== pz.solution[p] ? p : -1)).filter((p) => p >= 0));
  toast(checkedWrong.size ? t('errors', checkedWrong.size) : t('allCorrectSoFar'));
  renderBoard();
}

function hint() {
  if (st.solved) return;
  const candidates = people.map((_, p) => p).filter((p) => st.pos[p] !== pz.solution[p]);
  if (!candidates.length) { toast(t('noHint')); return; }
  // Prefer fixing a wrong placement, otherwise reveal someone unplaced.
  const wrong = candidates.filter((p) => st.pos[p] >= 0);
  const p = (wrong.length ? wrong : candidates)[0];
  snapshot();
  const target = pz.solution[p];
  const other = st.pos.indexOf(target);
  if (other >= 0) st.pos[other] = -1;
  st.pos[p] = target;
  st.marks = st.marks.filter((m) => m !== target);
  st.locked = [...new Set([...st.locked, p])];
  st.hints++;
  checkedWrong.clear();
  const next = firstUnplaced(p);
  if (next !== null) tool = next;
  save();
  renderBoard();
  renderPalette();
  toast(t('hintUsed', people[p].name));
  if (st.pos.every((c) => c >= 0)) evaluateComplete();
}

function undo() {
  const prev = history.pop();
  if (!prev) return;
  const s = JSON.parse(prev);
  // Never undo a hint-locked placement.
  for (const p of st.locked) s.pos[p] = pz.solution[p];
  st.pos = s.pos; st.marks = s.marks;
  checkedWrong.clear();
  save();
  renderBoard();
  renderPalette();
}

function reset() {
  if (!confirm(t('confirmReset'))) return;
  st = freshState();
  history = [];
  checkedWrong.clear();
  tool = 0;
  save();
  renderAll();
}

function openAccuse() {
  const dlg = $('dlg-accuse');
  $('accuse-title').textContent = st.solved ? t('solvedTitle') : t('accuseTitle');
  $('accuse-list').innerHTML = '';
  $('accuse-actions').innerHTML = '';
  if (st.solved) return showSolved();
  $('accuse-text').textContent = t('accuseText', VICTIM);
  $('accuse-list').innerHTML = people.filter((pp) => !pp.victim).map((pp, i) =>
    `<button type="button" class="chip" data-accuse="${i}" style="--ph:${pp.hue}"><span class="chip-token">${pp.name[0]}</span><span class="chip-name">${pp.name}</span></button>`).join('');
  $('accuse-actions').innerHTML = `<button type="button" class="btn" data-close>${t('close')}</button>`;
  if (!dlg.open) dlg.showModal();
}

function accuse(p) {
  if (p === pz.murderer) {
    st.solved = true;
    save();
    renderTimer();
    showSolved();
  } else {
    $('accuse-text').textContent = t('wrongAccuse', people[p].name);
  }
}

function showSolved() {
  const dlg = $('dlg-accuse');
  $('accuse-title').textContent = t('solvedTitle');
  $('accuse-text').textContent = t('solvedText', people[pz.murderer].name, VICTIM, weaponName(pz.weapon), fmtTime(st.elapsed), st.hints);
  $('accuse-list').innerHTML = '';
  $('accuse-actions').innerHTML = `<button type="button" class="btn" data-close>${t('close')}</button>
    <button type="button" class="btn primary" data-next>${t('another')}</button>`;
  if (!dlg.open) dlg.showModal();
}

async function share() {
  const url = location.href;
  try {
    if (navigator.share) await navigator.share({ title: 'Karodoku', text: t('story', VICTIM, weaponName(pz.weapon)), url });
    else { await navigator.clipboard.writeText(url); toast(t('copied')); }
  } catch { /* cancelled */ }
}

// ---------- events ----------

function bind() {
  $('board').addEventListener('click', (e) => {
    const cell = e.target.closest('[data-cell]');
    if (cell) onCell(Number(cell.dataset.cell));
  });
  $('palette').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-person]');
    if (!chip) return;
    tool = chip.dataset.person === 'x' ? 'x' : Number(chip.dataset.person);
    renderPalette();
  });
  const toggleClue = (li) => {
    const i = Number(li.dataset.clue);
    st.struck = st.struck.includes(i) ? st.struck.filter((x) => x !== i) : [...st.struck, i];
    li.classList.toggle('struck');
    save();
  };
  $('clues').addEventListener('click', (e) => { const li = e.target.closest('[data-clue]'); if (li) toggleClue(li); });
  $('clues').addEventListener('keydown', (e) => {
    const li = e.target.closest('[data-clue]');
    if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleClue(li); }
  });

  $('btn-new').addEventListener('click', () =>
    load({ size: Number($('sel-size').value), difficulty: $('sel-diff').value, seed: randomSeed() }));
  $('btn-daily').addEventListener('click', () =>
    load({ size: Number($('sel-size').value), difficulty: $('sel-diff').value, seed: today() }));
  const settingsChanged = () =>
    load({ size: Number($('sel-size').value), difficulty: $('sel-diff').value, seed: pz.seed });
  $('sel-size').addEventListener('change', settingsChanged);
  $('sel-diff').addEventListener('change', settingsChanged);

  $('btn-check').addEventListener('click', check);
  $('btn-hint').addEventListener('click', hint);
  $('btn-undo').addEventListener('click', undo);
  $('btn-reset').addEventListener('click', reset);
  $('btn-share').addEventListener('click', share);
  $('btn-rules').addEventListener('click', () => $('dlg-rules').showModal());
  $('btn-lang').addEventListener('click', () => {
    setLang(getLang() === 'de' ? 'en' : 'de');
    storage.set('lang', getLang());
    renderAll();
  });

  $('dlg-accuse').addEventListener('click', (e) => {
    const a = e.target.closest('[data-accuse]');
    if (a) return accuse(Number(a.dataset.accuse));
    if (e.target.closest('[data-close]')) return $('dlg-accuse').close();
    if (e.target.closest('[data-next]')) {
      $('dlg-accuse').close();
      load({ size: pz.size, difficulty: pz.difficulty, seed: randomSeed() });
    }
  });
  // Tap on the backdrop closes dialogs.
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || document.querySelector('dialog[open]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= people.length) { tool = n - 1; renderPalette(); }
    else if (e.key === 'x' || e.key === 'X') { tool = 'x'; renderPalette(); }
  });

  window.addEventListener('popstate', () => load(readParams(), false));
  window.addEventListener('pagehide', () => st && save());
}

// ---------- boot ----------

const savedLang = storage.get('lang');
setLang(savedLang || ((navigator.language || 'de').startsWith('de') ? 'de' : 'en'));
renderStatic();
bind();
load(readParams(), false);
if (!storage.get('seenRules')) {
  storage.set('seenRules', true);
  $('dlg-rules').showModal();
}
