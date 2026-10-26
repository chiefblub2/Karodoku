// Two solvers:
//  * countSolutions – exhaustive backtracking, the ground truth for uniqueness.
//  * solveLogically – human-style deductions without guessing, used to rate difficulty.
//
// Global rules (always on):
//  * every row and every column holds exactly one person,
//  * nobody stands on blocking furniture,
//  * the victim (last person) shares their room with exactly one other person.

import type { BinaryClue, Board, Clue } from './clues';
import { besideMap, binaryOk, clueHolds, isBinary, isUnary, unaryOk } from './clues';
import { colOf, isOccupiable, rowOf } from './model';

export interface CountResult { count: number; solution: number[] | null; aborted: boolean }

// Cell sets are 64-bit masks stored as two 32-bit halves (boards are at most 8×8).
type Mask = readonly [number, number];

const popcount = (x: number): number => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

function maskOf(cells: number, pred: (c: number) => boolean): Mask {
  let lo = 0, hi = 0;
  for (let c = 0; c < cells; c++) if (pred(c)) { if (c < 32) lo |= 1 << c; else hi |= 1 << (c - 32); }
  return [lo >>> 0, hi >>> 0];
}

interface Link { other: number; lo: Uint32Array; hi: Uint32Array }
interface BoardCache { beside: ReturnType<typeof besideMap>; unary: WeakMap<Clue, Mask>; links: WeakMap<Clue, [Link, Link]> }
// Clue masks are reused across the many counts made while reducing a clue set.
const boardCaches = new WeakMap<Board, BoardCache>();
function cacheFor(b: Board): BoardCache {
  let c = boardCaches.get(b);
  if (!c) boardCaches.set(b, (c = { beside: besideMap(b), unary: new WeakMap(), links: new WeakMap() }));
  return c;
}

/**
 * Exhaustive solution counter (stops at `limit`). Every unplaced person keeps a bitmask of
 * the cells still open to them; placing someone narrows everybody else's mask.
 */
export function countSolutions(b: Board, clues: readonly Clue[], limit = 2, nodeLimit = 2_000_000): CountResult {
  const N = b.size, P = N, victim = P - 1, cells = N * N, R = b.rooms.length;
  const beside = cacheFor(b).beside;
  const rowM = Array.from({ length: N }, (_, r) => maskOf(cells, (c) => rowOf(c, N) === r));
  const colM = Array.from({ length: N }, (_, k) => maskOf(cells, (c) => colOf(c, N) === k));
  const roomM = Array.from({ length: R }, (_, r) => maskOf(cells, (c) => b.room[c] === r));

  const cache = cacheFor(b);
  const start = { lo: new Uint32Array(P), hi: new Uint32Array(P) };
  const free = maskOf(cells, (c) => isOccupiable(b.obj[c]));
  start.lo.fill(free[0]);
  start.hi.fill(free[1]);
  for (const cl of clues) {
    if (!isUnary(cl)) continue;
    let m = cache.unary.get(cl);
    if (!m) cache.unary.set(cl, (m = maskOf(cells, (c) => unaryOk(b, beside, cl, c))));
    start.lo[cl.p] &= m[0];
    start.hi[cl.p] &= m[1];
  }

  // Pair clues: for each side and each cell, the cells still compatible for the other person.
  const links: Link[][] = Array.from({ length: P }, () => []);
  for (const cl of clues) {
    if (!isBinary(cl)) continue;
    let pair = cache.links.get(cl);
    if (!pair) {
      pair = [true, false].map((forward) => {
        const lo = new Uint32Array(cells), hi = new Uint32Array(cells);
        for (let a = 0; a < cells; a++) {
          [lo[a], hi[a]] = maskOf(cells, (x) => (forward ? binaryOk(b, cl, a, x) : binaryOk(b, cl, x, a)));
        }
        return { other: forward ? cl.q : cl.p, lo, hi };
      }) as [Link, Link];
      cache.links.set(cl, pair);
    }
    links[cl.p].push(pair[0]);
    links[cl.q].push(pair[1]);
  }
  const alone = new Array<boolean>(P).fill(false);
  const roomLimit = new Array<number>(R).fill(-1);
  for (const cl of clues) {
    if (cl.t === 'alone') alone[cl.p] = true;
    else if (cl.t === 'roomCount') roomLimit[cl.r] = cl.n;
  }

  const pos = new Int16Array(P).fill(-1);
  const roomCnt = new Uint8Array(R);
  const stackLo = Array.from({ length: P + 1 }, () => new Uint32Array(P));
  const stackHi = Array.from({ length: P + 1 }, () => new Uint32Array(P));
  stackLo[0].set(start.lo);
  stackHi[0].set(start.hi);
  let count = 0, nodes = 0, aborted = false;
  let solution: number[] | null = null;

  const shut = (lo: Uint32Array, hi: Uint32Array, q: number, m: Mask) => { lo[q] &= ~m[0]; hi[q] &= ~m[1]; };
  const shutRoomForAll = (lo: Uint32Array, hi: Uint32Array, r: number) => {
    for (let q = 0; q < P; q++) if (pos[q] < 0) shut(lo, hi, q, roomM[r]);
  };

  const rec = (depth: number): boolean => {
    if (++nodes > nodeLimit) { aborted = true; return true; }
    if (depth === P) {
      if (roomCnt[b.room[pos[victim]]] !== 2) return false;
      for (let r = 0; r < R; r++) if (roomLimit[r] >= 0 && roomCnt[r] !== roomLimit[r]) return false;
      count++;
      if (!solution) solution = Array.from(pos);
      return count >= limit;
    }
    const lo = stackLo[depth], hi = stackHi[depth];
    // Most-constrained person first.
    let best = -1, bestN = 99;
    for (let p = 0; p < P; p++) {
      if (pos[p] >= 0) continue;
      const n = popcount(lo[p]) + popcount(hi[p]);
      if (n === 0) return false;
      if (n < bestN) { best = p; bestN = n; }
    }
    const nlo = stackLo[depth + 1], nhi = stackHi[depth + 1];
    for (let c = 0; c < cells; c++) {
      if (!(c < 32 ? (lo[best] >>> c) & 1 : (hi[best] >>> (c - 32)) & 1)) continue;
      const r = b.room[c];
      if (alone[best] && roomCnt[r] > 0) continue;
      if (best === victim && roomCnt[r] > 1) continue;
      nlo.set(lo);
      nhi.set(hi);
      pos[best] = c;
      roomCnt[r]++;
      const rm = rowM[rowOf(c, N)], cm = colM[colOf(c, N)];
      for (let q = 0; q < P; q++) { nlo[q] &= ~(rm[0] | cm[0]); nhi[q] &= ~(rm[1] | cm[1]); }
      for (const l of links[best]) { nlo[l.other] &= l.lo[c]; nhi[l.other] &= l.hi[c]; }
      if (alone[best]) shutRoomForAll(nlo, nhi, r);
      for (let q = 0; q < P; q++) if (alone[q] && pos[q] < 0) shut(nlo, nhi, q, roomM[r]);
      if (roomLimit[r] >= 0 && roomCnt[r] >= roomLimit[r]) shutRoomForAll(nlo, nhi, r);
      if (roomCnt[r] >= 2) {
        // A full victim room takes nobody else; a room with two people can't take the victim.
        if (pos[victim] >= 0 && b.room[pos[victim]] === r) shutRoomForAll(nlo, nhi, r);
        else if (pos[victim] < 0) shut(nlo, nhi, victim, roomM[r]);
      }
      if (rec(depth + 1)) return true;
      pos[best] = -1;
      roomCnt[r]--;
    }
    return false;
  };

  rec(0);
  return { count, solution, aborted };
}

/** Does a full assignment satisfy every rule and clue? */
export function verify(b: Board, clues: readonly Clue[], pos: readonly number[]): boolean {
  const N = b.size;
  if (pos.length !== N || pos.some((c) => c < 0 || c >= N * N)) return false;
  if (new Set(pos.map((c) => rowOf(c, N))).size !== N) return false;
  if (new Set(pos.map((c) => colOf(c, N))).size !== N) return false;
  if (pos.some((c) => !isOccupiable(b.obj[c]))) return false;
  const vr = b.room[pos[N - 1]];
  if (pos.filter((c) => b.room[c] === vr).length !== 2) return false;
  const beside = besideMap(b);
  return clues.every((cl) => clueHolds(b, beside, cl, pos));
}

// ---------------------------------------------------------------------------
// Logical solver (no guessing).
//   Level 1: clue filtering, row/column singles (naked and hidden), arc consistency on
//            pair clues, and room bookkeeping (alone, room counts, the victim rule).
//   Level 2: level 1 plus one-step "what if" tests: a candidate is eliminated if placing
//            the person there leads to a contradiction under level 1.

/** whatIfs = how many times the solver had to fall back to what-if reasoning. */
export interface LogicResult { solved: boolean; level: number; whatIfs: number }

type Domains = Uint8Array[];

class Logic {
  readonly N: number;
  readonly P: number;
  readonly cells: number;
  readonly roomCells: number[][];
  readonly binaries: BinaryClue[];
  readonly alone: number[];
  readonly roomLimit: number[];

  constructor(readonly b: Board, readonly clues: readonly Clue[]) {
    this.N = b.size; this.P = b.size; this.cells = b.size * b.size;
    this.roomCells = b.rooms.map(() => [] as number[]);
    b.room.forEach((r, c) => this.roomCells[r].push(c));
    this.binaries = clues.filter(isBinary);
    this.alone = clues.filter((c) => c.t === 'alone').map((c) => (c as { p: number }).p);
    this.roomLimit = new Array<number>(b.rooms.length).fill(-1);
    for (const c of clues) if (c.t === 'roomCount') this.roomLimit[c.r] = c.n;
  }

  initial(): Domains {
    const { b, P, cells } = this;
    const beside = besideMap(b);
    const dom: Domains = [];
    for (let p = 0; p < P; p++) {
      const d = new Uint8Array(cells);
      for (let c = 0; c < cells; c++) d[c] = isOccupiable(b.obj[c]) ? 1 : 0;
      dom.push(d);
    }
    for (const cl of this.clues) {
      if (!isUnary(cl)) continue;
      const d = dom[cl.p];
      for (let c = 0; c < cells; c++) if (d[c] && !unaryOk(b, beside, cl, c)) d[c] = 0;
    }
    return dom;
  }

  /** Returns false on contradiction. Mutates dom. */
  propagate(dom: Domains): boolean {
    const { N, P, cells, b, roomCells } = this;
    const victim = P - 1;
    const R = roomCells.length;
    let changed = true;

    const removeWhere = (p: number, pred: (c: number) => boolean): void => {
      const d = dom[p];
      for (let c = 0; c < cells; c++) if (d[c] && pred(c)) { d[c] = 0; changed = true; }
    };
    const inside = (p: number, r: number): boolean => {
      const d = dom[p];
      let any = false;
      for (let c = 0; c < cells; c++) if (d[c]) { if (b.room[c] !== r) return false; any = true; }
      return any;
    };
    const canBe = (p: number, r: number): boolean => roomCells[r].some((c) => dom[p][c] === 1);

    while (changed) {
      changed = false;

      // Naked singles on rows/columns + empty-domain check.
      for (let p = 0; p < P; p++) {
        let rowMask = 0, colMask = 0;
        for (let c = 0; c < cells; c++) if (dom[p][c]) { rowMask |= 1 << rowOf(c, N); colMask |= 1 << colOf(c, N); }
        if (!rowMask) return false;
        if ((rowMask & (rowMask - 1)) === 0) {
          for (let q = 0; q < P; q++) if (q !== p) removeWhere(q, (c) => (1 << rowOf(c, N)) === rowMask);
        }
        if ((colMask & (colMask - 1)) === 0) {
          for (let q = 0; q < P; q++) if (q !== p) removeWhere(q, (c) => (1 << colOf(c, N)) === colMask);
        }
      }

      // Hidden singles: a row/column only one person can still reach must be theirs.
      for (let line = 0; line < N; line++) {
        for (const byRow of [true, false]) {
          let who = -1, n = 0;
          for (let p = 0; p < P && n < 2; p++) {
            for (let k = 0; k < N; k++) {
              const c = byRow ? line * N + k : k * N + line;
              if (dom[p][c]) { who = p; n++; break; }
            }
          }
          if (n === 0) return false;
          if (n === 1) removeWhere(who, (c) => (byRow ? rowOf(c, N) : colOf(c, N)) !== line);
        }
      }

      // Arc consistency on pair clues.
      for (const cl of this.binaries) {
        for (const forward of [true, false]) {
          const p = forward ? cl.p : cl.q, q = forward ? cl.q : cl.p;
          const dp = dom[p], dq = dom[q];
          for (let a = 0; a < cells; a++) {
            if (!dp[a]) continue;
            let support = false;
            for (let x = 0; x < cells && !support; x++) {
              if (!dq[x] || rowOf(x, N) === rowOf(a, N) || colOf(x, N) === colOf(a, N)) continue;
              support = forward ? binaryOk(b, cl, a, x) : binaryOk(b, cl, x, a);
            }
            if (!support) { dp[a] = 0; changed = true; }
          }
        }
      }

      // Room bookkeeping.
      for (const p of this.alone) {
        for (let r = 0; r < R; r++) {
          if (inside(p, r)) for (let q = 0; q < P; q++) if (q !== p) removeWhere(q, (c) => b.room[c] === r);
          for (let q = 0; q < P; q++) if (q !== p && inside(q, r)) removeWhere(p, (c) => b.room[c] === r);
        }
      }
      for (let r = 0; r < R; r++) {
        const limit = this.roomLimit[r];
        if (limit < 0) continue;
        const fixed: number[] = [], possible: number[] = [];
        for (let p = 0; p < P; p++) { if (inside(p, r)) fixed.push(p); if (canBe(p, r)) possible.push(p); }
        if (fixed.length > limit || possible.length < limit) return false;
        if (fixed.length === limit) {
          for (const p of possible) if (!fixed.includes(p)) removeWhere(p, (c) => b.room[c] === r);
        } else if (possible.length === limit) {
          for (const p of possible) removeWhere(p, (c) => b.room[c] !== r);
        }
      }
      // Victim rule: exactly one other person in the victim's room.
      for (let r = 0; r < R; r++) {
        if (!canBe(victim, r)) continue;
        const fixed: number[] = [], possible: number[] = [];
        for (let p = 0; p < victim; p++) { if (inside(p, r)) fixed.push(p); if (canBe(p, r)) possible.push(p); }
        if (fixed.length >= 2 || possible.length === 0) {
          removeWhere(victim, (c) => b.room[c] === r);
          continue;
        }
        if (inside(victim, r)) {
          if (fixed.length === 1) {
            for (const p of possible) if (p !== fixed[0]) removeWhere(p, (c) => b.room[c] === r);
          } else if (possible.length === 1) {
            removeWhere(possible[0], (c) => b.room[c] !== r);
          }
        }
      }
    }
    return true;
  }

  assignment(dom: Domains): number[] | null {
    const pos: number[] = [];
    for (const d of dom) {
      let found = -1;
      for (let c = 0; c < this.cells; c++) if (d[c]) { if (found >= 0) return null; found = c; }
      if (found < 0) return null;
      pos.push(found);
    }
    return pos;
  }
}

export function solveLogically(b: Board, clues: readonly Clue[], maxLevel = 2): LogicResult {
  const L = new Logic(b, clues);
  const dom = L.initial();
  let level = 1, whatIfs = 0;
  if (!L.propagate(dom)) return { solved: false, level, whatIfs };
  for (;;) {
    const pos = L.assignment(dom);
    if (pos) return { solved: verify(b, clues, pos), level, whatIfs };
    if (maxLevel < 2) return { solved: false, level, whatIfs };
    level = 2;
    let progress = false;
    for (let p = 0; p < L.P && !progress; p++) {
      for (let c = 0; c < L.cells; c++) {
        if (!dom[p][c]) continue;
        const trial = dom.map((d) => d.slice());
        trial[p].fill(0);
        trial[p][c] = 1;
        if (!L.propagate(trial)) {
          dom[p][c] = 0;
          progress = true;
        }
      }
    }
    if (progress) whatIfs++;
    if (!progress) return { solved: false, level, whatIfs };
    if (!L.propagate(dom)) return { solved: false, level, whatIfs };
  }
}
