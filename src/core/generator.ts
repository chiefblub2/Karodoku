// Puzzle generator: floor plan → hidden solution → furniture → candidate clues →
// minimal unique clue set → difficulty rating by the logical solver.

import type { Clue } from './clues';
import { besideMap, clueRefs } from './clues';
import type { Difficulty, ObjectType, Puzzle, Room, RoomType } from './model';
import { FLOOR_FAMILY, ROOM_TYPES, SUSPECTS, WEAPONS, colOf, isOccupiable, rowOf } from './model';
import type { Rng } from './rng';
import { makeRng } from './rng';
import type { LogicResult } from './solver';
import { countSolutions, solveLogically } from './solver';

export interface GenerateOptions { size: number; difficulty: Difficulty; seed: string }

// ---------- floor plan ----------

interface Rect { r: number; c: number; h: number; w: number }

/** Guillotine-split the square into rectangles, optionally merging two neighbours into an L/T shape. */
export function buildRooms(N: number, k: number, rng: Rng): number[] {
  const merge = rng.next() < 0.6;
  const target = merge ? k + 1 : k;
  let rects: Rect[] = [{ r: 0, c: 0, h: N, w: N }];
  let guard = 0;
  while (rects.length < target && guard++ < 200) {
    const cand = rects.filter((x) => x.h * x.w >= 4);
    if (!cand.length) break;
    let total = 0;
    for (const x of cand) total += (x.h * x.w) ** 2;
    let roll = rng.next() * total;
    let pick = cand[0];
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

  const grid = new Array<number>(N * N);
  rects.forEach((x, i) => {
    for (let r = x.r; r < x.r + x.h; r++) for (let c = x.c; c < x.c + x.w; c++) grid[r * N + c] = i;
  });

  if (merge && rects.length > 2) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < N * N; i++) {
      const r = rowOf(i, N), c = colOf(i, N);
      if (c + 1 < N && grid[i] !== grid[i + 1]) pairs.push([grid[i], grid[i + 1]]);
      if (r + 1 < N && grid[i] !== grid[i + N]) pairs.push([grid[i], grid[i + N]]);
    }
    const [a, b] = rng.pick(pairs);
    for (let i = 0; i < grid.length; i++) if (grid[i] === b) grid[i] = a;
  }

  // Renumber rooms in reading order.
  const map = new Map<number, number>();
  return grid.map((g) => {
    if (!map.has(g)) map.set(g, map.size);
    return map.get(g)!;
  });
}

export function roomNeighbours(room: number[], N: number): Set<number>[] {
  const count = Math.max(...room) + 1;
  const nb = Array.from({ length: count }, () => new Set<number>());
  for (let i = 0; i < N * N; i++) {
    const c = colOf(i, N), r = rowOf(i, N);
    if (c + 1 < N && room[i] !== room[i + 1]) { nb[room[i]].add(room[i + 1]); nb[room[i + 1]].add(room[i]); }
    if (r + 1 < N && room[i] !== room[i + N]) { nb[room[i]].add(room[i + N]); nb[room[i + N]].add(room[i]); }
  }
  return nb;
}

/** Distinct room types such that neighbouring rooms never share a floor family. */
function assignRoomTypes(room: number[], N: number, rng: Rng): Room[] | null {
  const count = Math.max(...room) + 1;
  const nb = roomNeighbours(room, N);
  for (let attempt = 0; attempt < 30; attempt++) {
    const types: RoomType[] = [];
    const pool = rng.shuffle(ROOM_TYPES);
    let ok = true;
    for (let r = 0; r < count && ok; r++) {
      const banned = new Set([...nb[r]].filter((x) => x < r).map((x) => FLOOR_FAMILY[types[x]]));
      const t = pool.find((x) => !types.includes(x) && !banned.has(FLOOR_FAMILY[x]));
      if (t) types.push(t); else ok = false;
    }
    if (ok) return types.map((type) => ({ type }));
  }
  return null;
}

// ---------- furniture ----------

function occupiablePool(type: RoomType): ObjectType[] {
  if (type === 'bedroom' || type === 'guest') return ['bed', 'bed', 'rug', 'chair'];
  if (type === 'bathroom') return ['tub', 'rug', 'rug'];
  return ['chair', 'chair', 'rug'];
}

function blockingPool(type: RoomType): ObjectType[] {
  switch (type) {
    case 'library':
    case 'study': return ['shelf', 'shelf', 'table', 'plant'];
    case 'conservatory': return ['plant', 'plant', 'plant', 'table'];
    case 'kitchen':
    case 'dining': return ['table', 'table', 'plant', 'shelf'];
    case 'billiard': return ['table', 'table', 'shelf'];
    case 'bathroom': return ['plant', 'shelf'];
    case 'cellar': return ['shelf', 'shelf', 'table'];
    default: return ['table', 'plant', 'shelf'];
  }
}

function furnish(N: number, room: number[], rooms: Room[], occupied: Set<number>, rng: Rng): (ObjectType | null)[] {
  const obj: (ObjectType | null)[] = new Array(N * N).fill(null);
  const tubs = new Set<number>();
  for (let c = 0; c < N * N; c++) {
    const type = rooms[room[c]].type;
    const x = rng.next();
    let o: ObjectType | null = null;
    if (occupied.has(c)) {
      if (x < 0.45) o = rng.pick(occupiablePool(type));
    } else if (x < 0.36) o = rng.pick(blockingPool(type));
    else if (x < 0.5) o = rng.pick(occupiablePool(type));
    // One bathtub per bathroom is plenty.
    if (o === 'tub') {
      if (tubs.has(room[c])) o = 'rug';
      else tubs.add(room[c]);
    }
    obj[c] = o;
  }
  // Every room needs at least one usable cell, otherwise it looks broken.
  for (let r = 0; r < rooms.length; r++) {
    const rc = room.flatMap((x, c) => (x === r ? [c] : []));
    if (!rc.some((c) => isOccupiable(obj[c]))) obj[rng.pick(rc)] = null;
  }
  return obj;
}

// ---------- clues ----------

interface ClueGroups {
  position: Clue[]; // row / column
  order: Clue[]; // north / west
  direct: Clue[]; // in room, on object
  negative: Clue[]; // not in room, different rooms, bare floor
  rich: Clue[]; // beside, alone, same room, diagonal, room counts
}

function candidateClues(N: number, room: number[], rooms: Room[], obj: (ObjectType | null)[], sol: number[], rng: Rng): ClueGroups {
  const P = N, victim = P - 1;
  const beside = besideMap({ size: N, room, rooms, obj });
  const roomOfP = sol.map((c) => room[c]);
  const g: ClueGroups = { position: [], order: [], direct: [], negative: [], rich: [] };

  // The victim gets no clues: they take the one cell left once every suspect is placed.
  for (let p = 0; p < victim; p++) {
    const c = sol[p];
    g.position.push({ t: 'row', p, v: rowOf(c, N) }, { t: 'col', p, v: colOf(c, N) });
    g.direct.push({ t: 'inRoom', p, r: roomOfP[p] });
    const others = rng.shuffle(rooms.map((_, i) => i).filter((r) => r !== roomOfP[p]));
    for (const r of others.slice(0, 2)) g.negative.push({ t: 'notInRoom', p, r });
    const o = obj[c];
    if (o) g.direct.push({ t: 'onObject', p, o });
    else g.negative.push({ t: 'onFloor', p });
    for (const b of beside[c]) g.rich.push({ t: 'beside', p, o: b });
    if (roomOfP.filter((r) => r === roomOfP[p]).length === 1) g.rich.push({ t: 'alone', p });
  }

  for (let p = 0; p < victim; p++) {
    for (let q = p + 1; q < victim; q++) {
      const [a, b] = rng.next() < 0.5 ? [p, q] : [q, p];
      if (roomOfP[p] === roomOfP[q]) g.rich.push({ t: 'sameRoom', p: a, q: b });
      else if (rng.next() < 0.3) g.negative.push({ t: 'diffRoom', p: a, q: b });
      if (Math.abs(rowOf(sol[p], N) - rowOf(sol[q], N)) === 1 && Math.abs(colOf(sol[p], N) - colOf(sol[q], N)) === 1) {
        g.rich.push({ t: 'diag', p: a, q: b });
      }
    }
  }

  // Order clues: consecutive rows/columns pin down the suspects' whole order (so the full
  // candidate set is always unique); a few long-range ones add variety.
  const S = victim;
  const byRow = [...Array(S).keys()].sort((a, b) => sol[a] - sol[b]);
  const byCol = [...Array(S).keys()].sort((a, b) => colOf(sol[a], N) - colOf(sol[b], N));
  for (let i = 0; i + 1 < S; i++) {
    g.order.push({ t: 'north', p: byRow[i], q: byRow[i + 1] });
    g.order.push({ t: 'west', p: byCol[i], q: byCol[i + 1] });
  }
  for (let k = 0; k < Math.floor(N / 2); k++) {
    const i = rng.int(0, S - 3), j = rng.int(i + 2, S - 1);
    g.order.push(rng.next() < 0.5 ? { t: 'north', p: byRow[i], q: byRow[j] } : { t: 'west', p: byCol[i], q: byCol[j] });
  }

  const victimRoom = roomOfP[victim];
  for (let r = 0; r < rooms.length; r++) {
    if (r === victimRoom) continue;
    g.rich.push({ t: 'roomCount', r, n: roomOfP.filter((x) => x === r).length });
  }
  return g;
}

/** Clue kinds tried first are the most likely to be removed. */
function removalOrder(g: ClueGroups, difficulty: Difficulty, rng: Rng): Clue[] {
  const s = <T,>(a: T[]) => rng.shuffle(a);
  switch (difficulty) {
    case 'easy': return [...s(g.position), ...s(g.order), ...s(g.negative), ...s(g.rich), ...s(g.direct)];
    case 'medium':
    case 'hard': return [...s(g.position), ...s(g.order), ...s(g.direct), ...s(g.negative), ...s(g.rich)];
  }
}

/**
 * Greedily drop clues while the solution stays unique. Every suspect keeps at least one clue that
 * mentions them, even when logic alone would place them, so nobody looks forgotten; apart from
 * those, the result is minimal.
 */
export function reduceClues(board: Pick<Puzzle, 'size' | 'room' | 'rooms' | 'obj'>, order: Clue[]): Clue[] {
  let kept = order.slice();
  for (const cl of order) {
    const trial = kept.filter((x) => x !== cl);
    if (clueRefs(cl).people.some((p) => !trial.some((x) => clueRefs(x).people.includes(p)))) continue;
    const res = countSolutions(board, trial, 2, 1_000_000);
    if (!res.aborted && res.count === 1) kept = trial;
  }
  return kept;
}

/**
 * Difficulty is judged by the logical solver (every puzzle must be solvable without guessing):
 * easy needs only direct deductions, medium at most a few what-if rounds, hard several.
 */
function acceptable(difficulty: Difficulty, logic: LogicResult, attempt: number): boolean {
  // After many failed attempts relax the preference, never the "no guessing" guarantee.
  if (attempt > 40) return true;
  switch (difficulty) {
    case 'easy': return logic.level === 1;
    case 'medium': return logic.level === 2 && logic.whatIfs <= 3;
    case 'hard': return logic.level === 2 && logic.whatIfs >= 4;
  }
}

function tryGenerate(N: number, difficulty: Difficulty, rng: Rng, attempt: number): Omit<Puzzle, 'seed' | 'difficulty'> | null {
  const room = buildRooms(N, N - 1 + rng.int(0, 1), rng);
  const roomTotal = Math.max(...room) + 1;
  if (roomTotal < 3) return null;
  const rooms = assignRoomTypes(room, N, rng);
  if (!rooms) return null;

  // Hidden solution: one person per row/column; the victim shares a room with exactly one suspect.
  let cells: number[] = [];
  let victimCell = -1;
  for (let i = 0; i < 300 && victimCell < 0; i++) {
    const perm = rng.shuffle([...Array(N).keys()]);
    cells = perm.map((c, r) => r * N + c);
    const cnt = new Array<number>(roomTotal).fill(0);
    for (const c of cells) cnt[room[c]]++;
    const candidates = cells.filter((c) => cnt[room[c]] === 2);
    if (candidates.length) victimCell = rng.pick(candidates);
  }
  if (victimCell < 0) return null;
  const suspects = rng.shuffle(cells.filter((c) => c !== victimCell));
  const solution = [...suspects, victimCell];
  const victimRoom = room[victimCell];
  const murderer = solution.findIndex((c, p) => p !== N - 1 && room[c] === victimRoom);

  const obj = furnish(N, room, rooms, new Set(solution), rng);
  const board = { size: N, room, rooms, obj };
  const groups = candidateClues(N, room, rooms, obj, solution, rng);
  const all = Object.values(groups).flat() as Clue[];
  if (countSolutions(board, all).count !== 1) return null;

  const kept = reduceClues(board, removalOrder(groups, difficulty, rng));
  const check = countSolutions(board, kept);
  if (check.count !== 1 || check.solution!.some((c, i) => c !== solution[i])) return null;

  const logic = solveLogically(board, kept, 2);
  if (!logic.solved) return null;
  if (!acceptable(difficulty, logic, attempt)) return null;

  // Present clues grouped by the first person mentioned; room counts last.
  const key = (c: Clue) => ('p' in c ? c.p : N);
  const clues = rng.shuffle(kept).sort((a, b) => key(a) - key(b));
  const cast = rng.shuffle(SUSPECTS.map((_, i) => i)).slice(0, N - 1).sort((a, b) => a - b);
  return { size: N, room, rooms, obj, cast, clues, solution, murderer, weapon: rng.pick(WEAPONS), level: logic.level };
}

export let lastAttempts = 0;

export function generate({ size, difficulty, seed }: GenerateOptions): Puzzle {
  const rng = makeRng(`k2|${seed}|${size}|${difficulty}`);
  for (let attempt = 0; attempt < 200; attempt++) {
    const pz = tryGenerate(size, difficulty, rng, attempt);
    lastAttempts = attempt + 1;
    if (pz) return { ...pz, seed, difficulty };
  }
  throw new Error(`Could not generate a ${size}×${size} ${difficulty} puzzle for seed ${seed}`);
}
