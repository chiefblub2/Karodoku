// Backtracking solver: counts the solutions of a puzzle under a set of clues.
//
// Global rules (always on):
//  * every row and every column holds exactly one person,
//  * nobody stands on blocking furniture,
//  * the victim (last person) shares their room with exactly one other person.

import { OCCUPIABLE, BLOCKING } from './model.js';

export const UNARY = new Set(['inRoom', 'notInRoom', 'onObject', 'onFloor', 'beside', 'row', 'col']);
export const BINARY = new Set(['sameRoom', 'diffRoom', 'north', 'west', 'diag']);

export function isOccupiable(obj) {
  return obj == null || OCCUPIABLE.has(obj);
}

// For every cell: the set of blocking furniture types orthogonally adjacent to it.
export function besideMap(pz) {
  const { size: N, obj } = pz;
  const out = [];
  for (let c = 0; c < N * N; c++) {
    const r = Math.floor(c / N), k = c % N;
    const s = new Set();
    for (const [dr, dk] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const rr = r + dr, kk = k + dk;
      if (rr < 0 || kk < 0 || rr >= N || kk >= N) continue;
      const o = obj[rr * N + kk];
      if (o && BLOCKING.has(o)) s.add(o);
    }
    out.push(s);
  }
  return out;
}

export function unaryOk(pz, beside, cl, c) {
  const N = pz.size;
  switch (cl.t) {
    case 'inRoom': return pz.room[c] === cl.r;
    case 'notInRoom': return pz.room[c] !== cl.r;
    case 'onObject': return pz.obj[c] === cl.o;
    case 'onFloor': return pz.obj[c] == null;
    case 'beside': return beside[c].has(cl.o);
    case 'row': return Math.floor(c / N) === cl.v;
    case 'col': return c % N === cl.v;
  }
  throw new Error('unknown unary clue ' + cl.t);
}

export function binaryOk(pz, cl, a, b) {
  const N = pz.size;
  switch (cl.t) {
    case 'sameRoom': return pz.room[a] === pz.room[b];
    case 'diffRoom': return pz.room[a] !== pz.room[b];
    case 'north': return Math.floor(a / N) < Math.floor(b / N);
    case 'west': return a % N < b % N;
    case 'diag':
      return Math.abs(Math.floor(a / N) - Math.floor(b / N)) === 1 && Math.abs((a % N) - (b % N)) === 1;
  }
  throw new Error('unknown binary clue ' + cl.t);
}

export function countSolutions(pz, clues, limit = 2, nodeLimit = 2e6) {
  const N = pz.size, P = N, victim = P - 1;
  const beside = pz.beside || besideMap(pz);
  const roomCount = pz.rooms.length;

  const base = [];
  for (let c = 0; c < N * N; c++) if (isOccupiable(pz.obj[c])) base.push(c);
  const dom = Array.from({ length: P }, () => base);
  const bins = Array.from({ length: P }, () => []);
  const alone = new Array(P).fill(false);
  for (const cl of clues) {
    if (UNARY.has(cl.t)) dom[cl.p] = dom[cl.p].filter((c) => unaryOk(pz, beside, cl, c));
    else if (cl.t === 'alone') alone[cl.p] = true;
    else { bins[cl.p].push(cl); bins[cl.q].push(cl); }
  }

  const pos = new Int16Array(P).fill(-1);
  const rowUsed = new Uint8Array(N), colUsed = new Uint8Array(N);
  const roomCnt = new Uint8Array(roomCount), roomAlone = new Uint8Array(roomCount);
  let count = 0, nodes = 0, solution = null, aborted = false;

  function feasible(p, c) {
    if (rowUsed[Math.floor(c / N)] || colUsed[c % N]) return false;
    const R = pz.room[c];
    if (roomAlone[R]) return false;
    if (alone[p] && roomCnt[R] > 0) return false;
    if (p === victim && roomCnt[R] > 1) return false;
    if (pos[victim] >= 0 && pz.room[pos[victim]] === R && roomCnt[R] >= 2) return false;
    for (const cl of bins[p]) {
      const other = cl.p === p ? cl.q : cl.p;
      const oc = pos[other];
      if (oc < 0) continue;
      if (!(cl.p === p ? binaryOk(pz, cl, c, oc) : binaryOk(pz, cl, oc, c))) return false;
    }
    return true;
  }

  function rec(depth) {
    if (++nodes > nodeLimit) { aborted = true; return true; }
    if (depth === P) {
      if (roomCnt[pz.room[pos[victim]]] !== 2) return false;
      count++;
      if (!solution) solution = Array.from(pos);
      return count >= limit;
    }
    // Most-constrained person first (also acts as forward checking).
    let best = -1, bestOpts = null;
    for (let p = 0; p < P; p++) {
      if (pos[p] >= 0) continue;
      const opts = [];
      for (const c of dom[p]) if (feasible(p, c)) opts.push(c);
      if (opts.length === 0) return false;
      if (best < 0 || opts.length < bestOpts.length) { best = p; bestOpts = opts; }
    }
    for (const c of bestOpts) {
      const r = Math.floor(c / N), k = c % N, R = pz.room[c];
      pos[best] = c; rowUsed[r] = 1; colUsed[k] = 1; roomCnt[R]++;
      if (alone[best]) roomAlone[R] = 1;
      if (rec(depth + 1)) return true;
      pos[best] = -1; rowUsed[r] = 0; colUsed[k] = 0; roomCnt[R]--;
      if (alone[best]) roomAlone[R] = 0;
    }
    return false;
  }

  rec(0);
  return { count, solution, aborted };
}
