// Puzzle generator: floor plan → hidden solution → furniture → clues → unique, minimal clue set.

import { makeRng } from './rng.js';
import { ROOM_TYPES, BLOCKING, occupiablePool, blockingPool } from './model.js';
import { countSolutions, besideMap, isOccupiable } from './solver.js';

const EXTRA_CLUES = { easy: 3, medium: 1, hard: 0 };
const WEAPONS = ['candlestick', 'rope', 'dagger', 'poison', 'revolver', 'wrench', 'vase', 'teapot'];

// Guillotine-split the square into rectangles, optionally merge two neighbours into an L/T shape.
function buildRooms(N, k, rng) {
  const merge = rng.next() < 0.6;
  const target = merge ? k + 1 : k;
  let rects = [{ r: 0, c: 0, h: N, w: N }];
  while (rects.length < target) {
    const cand = rects.filter((x) => x.h * x.w >= 4);
    if (!cand.length) break;
    let total = 0;
    for (const x of cand) total += (x.h * x.w) ** 2;
    let roll = rng.next() * total, pick = cand[0];
    for (const x of cand) { roll -= (x.h * x.w) ** 2; if (roll <= 0) { pick = x; break; } }

    const horiz = pick.h > pick.w || (pick.h === pick.w && rng.next() < 0.5);
    const len = horiz ? pick.h : pick.w, other = horiz ? pick.w : pick.h;
    const min = other === 1 ? 2 : 1;
    if (len - min < min) continue;
    const cut = rng.int(min, len - min);
    rects = rects.filter((x) => x !== pick);
    if (horiz) rects.push({ ...pick, h: cut }, { ...pick, r: pick.r + cut, h: pick.h - cut });
    else rects.push({ ...pick, w: cut }, { ...pick, c: pick.c + cut, w: pick.w - cut });
  }

  const grid = new Array(N * N);
  rects.forEach((x, i) => {
    for (let r = x.r; r < x.r + x.h; r++) for (let c = x.c; c < x.c + x.w; c++) grid[r * N + c] = i;
  });

  if (merge && rects.length > 2) {
    const pairs = [];
    for (let i = 0; i < N * N; i++) {
      const r = Math.floor(i / N), c = i % N;
      if (c + 1 < N && grid[i] !== grid[i + 1]) pairs.push([grid[i], grid[i + 1]]);
      if (r + 1 < N && grid[i] !== grid[i + N]) pairs.push([grid[i], grid[i + N]]);
    }
    const [a, b] = rng.pick(pairs);
    for (let i = 0; i < grid.length; i++) if (grid[i] === b) grid[i] = a;
  }

  // Renumber rooms in reading order.
  const map = new Map();
  return grid.map((g) => {
    if (!map.has(g)) map.set(g, map.size);
    return map.get(g);
  });
}

function candidateClues(pz, sol, rng) {
  const N = pz.size, P = N, victim = P - 1;
  const beside = besideMap(pz);
  const roomOf = sol.map((c) => pz.room[c]);
  const rowOf = sol.map((c) => Math.floor(c / N));
  const colOf = sol.map((c) => c % N);
  const groups = { position: [], order: [], room: [], notRoom: [], rich: [] };

  for (let p = 0; p < P; p++) {
    const c = sol[p];
    groups.position.push({ t: 'row', p, v: rowOf[p] }, { t: 'col', p, v: colOf[p] });
    groups.room.push({ t: 'inRoom', p, r: roomOf[p] });
    const others = rng.shuffle(pz.rooms.map((_, i) => i).filter((r) => r !== roomOf[p]));
    for (const r of others.slice(0, 2)) groups.notRoom.push({ t: 'notInRoom', p, r });
    if (pz.obj[c]) groups.rich.push({ t: 'onObject', p, o: pz.obj[c] });
    else groups.rich.push({ t: 'onFloor', p });
    for (const o of beside[c]) groups.rich.push({ t: 'beside', p, o });
    if (p !== victim && roomOf.filter((r) => r === roomOf[p]).length === 1) groups.rich.push({ t: 'alone', p });
  }

  for (let p = 0; p < P; p++) {
    for (let q = p + 1; q < P; q++) {
      const [a, b] = rng.next() < 0.5 ? [p, q] : [q, p];
      // Pair clues with the victim's room-mate would give the murderer away too cheaply.
      const touchesVictim = p === victim || q === victim;
      if (!touchesVictim) {
        if (roomOf[p] === roomOf[q]) groups.rich.push({ t: 'sameRoom', p: a, q: b });
        else if (rng.next() < 0.5) groups.rich.push({ t: 'diffRoom', p: a, q: b });
      }
      groups.order.push(rowOf[a] < rowOf[b] ? { t: 'north', p: a, q: b } : { t: 'north', p: b, q: a });
      groups.order.push(colOf[a] < colOf[b] ? { t: 'west', p: a, q: b } : { t: 'west', p: b, q: a });
      if (Math.abs(rowOf[p] - rowOf[q]) === 1 && Math.abs(colOf[p] - colOf[q]) === 1) {
        groups.rich.push({ t: 'diag', p: a, q: b });
      }
    }
  }
  return groups;
}

// Remove clues greedily while the solution stays unique. Boring clue kinds are tried first,
// so the interesting ones are what tends to survive.
function reduceClues(pz, groups, rng) {
  const order = [
    ...rng.shuffle(groups.position),
    ...rng.shuffle(groups.order),
    ...rng.shuffle(groups.room),
    ...rng.shuffle(groups.notRoom),
    ...rng.shuffle(groups.rich),
  ];
  let kept = order.slice();
  const removed = [];
  for (const cl of order) {
    const trial = kept.filter((x) => x !== cl);
    const res = countSolutions(pz, trial, 2, 200000);
    if (!res.aborted && res.count === 1) { kept = trial; removed.push(cl); }
  }
  return { kept, removed };
}

function tryGenerate(N, difficulty, rng) {
  const roomCountTarget = N - 1 + rng.int(0, 1);
  const room = buildRooms(N, roomCountTarget, rng);
  const roomTotal = Math.max(...room) + 1;
  if (roomTotal < 3) return null;
  const rooms = rng.shuffle(ROOM_TYPES).slice(0, roomTotal).map((type) => ({ type }));

  // Hidden solution: one person per row/column; victim alone with exactly one suspect.
  let cells = null, victimCell = -1;
  for (let i = 0; i < 300 && victimCell < 0; i++) {
    const perm = rng.shuffle([...Array(N).keys()]);
    cells = perm.map((c, r) => r * N + c);
    const cnt = new Array(roomTotal).fill(0);
    for (const c of cells) cnt[room[c]]++;
    const candidates = cells.filter((c) => cnt[room[c]] === 2);
    if (candidates.length) victimCell = rng.pick(candidates);
  }
  if (victimCell < 0) return null;
  const suspects = rng.shuffle(cells.filter((c) => c !== victimCell));
  const solution = [...suspects, victimCell];
  const victimRoom = room[victimCell];
  const murderer = solution.findIndex((c, p) => p !== N - 1 && room[c] === victimRoom);

  // Furniture.
  const occupied = new Set(solution);
  const obj = new Array(N * N).fill(null);
  for (let c = 0; c < N * N; c++) {
    const type = rooms[room[c]].type;
    const x = rng.next();
    if (occupied.has(c)) {
      if (x < 0.45) obj[c] = rng.pick(occupiablePool(type));
    } else if (x < 0.36) obj[c] = rng.pick(blockingPool(type));
    else if (x < 0.5) obj[c] = rng.pick(occupiablePool(type));
  }
  // Every room needs at least one cell a person could use, otherwise it looks broken.
  for (let r = 0; r < roomTotal; r++) {
    const rc = [...Array(N * N).keys()].filter((c) => room[c] === r);
    if (!rc.some((c) => isOccupiable(obj[c]))) obj[rng.pick(rc)] = null;
  }

  const pz = { size: N, room, rooms, obj };
  pz.beside = besideMap(pz);
  const groups = candidateClues(pz, solution, rng);
  const all = Object.values(groups).flat();
  if (countSolutions(pz, all).count !== 1) return null;

  const { kept, removed } = reduceClues(pz, groups, rng);
  const helpful = rng.shuffle(removed.filter((c) => c.t === 'inRoom' || c.t === 'onObject' || c.t === 'beside'));
  const clues = [...kept, ...helpful.slice(0, EXTRA_CLUES[difficulty] ?? 0)];
  const check = countSolutions(pz, clues);
  if (check.count !== 1 || check.solution.some((c, i) => c !== solution[i])) return null;

  // Present clues in a pleasant order: grouped by the first person mentioned.
  const sorted = rng.shuffle(clues).sort((a, b) => a.p - b.p);
  delete pz.beside;
  return { ...pz, clues: sorted, solution, murderer, weapon: rng.pick(WEAPONS) };
}

export function generate({ size = 6, difficulty = 'medium', seed = 'karodoku' } = {}) {
  const rng = makeRng(`${seed}|${size}|${difficulty}`);
  for (let attempt = 0; attempt < 100; attempt++) {
    const pz = tryGenerate(size, difficulty, rng);
    if (pz) return { ...pz, seed, difficulty };
  }
  throw new Error('Could not generate a puzzle');
}

export { BLOCKING };
