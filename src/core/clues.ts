// Clue data types, evaluation and references (for UI highlighting).

import type { ObjectType } from './model';
import { BLOCKING, colOf, rowOf } from './model';

export type UnaryClue =
  | { t: 'inRoom'; p: number; r: number }
  | { t: 'notInRoom'; p: number; r: number }
  | { t: 'onObject'; p: number; o: ObjectType }
  | { t: 'onFloor'; p: number }
  | { t: 'beside'; p: number; o: ObjectType }
  | { t: 'row'; p: number; v: number }
  | { t: 'col'; p: number; v: number };

export type BinaryClue = { t: 'sameRoom' | 'diffRoom' | 'north' | 'west' | 'diag'; p: number; q: number };

export type GlobalClue =
  | { t: 'alone'; p: number }
  | { t: 'roomCount'; r: number; n: number };

export type Clue = UnaryClue | BinaryClue | GlobalClue;
export type ClueType = Clue['t'];

const UNARY_TYPES = new Set<ClueType>(['inRoom', 'notInRoom', 'onObject', 'onFloor', 'beside', 'row', 'col']);
const BINARY_TYPES = new Set<ClueType>(['sameRoom', 'diffRoom', 'north', 'west', 'diag']);
export const isUnary = (c: Clue): c is UnaryClue => UNARY_TYPES.has(c.t);
export const isBinary = (c: Clue): c is BinaryClue => BINARY_TYPES.has(c.t);

/** Minimal board description needed to evaluate clues. */
export interface Board {
  size: number;
  room: number[];
  rooms: unknown[];
  obj: (ObjectType | null)[];
}

/** For every cell: the blocking furniture types orthogonally adjacent to it. */
export function besideMap(b: Board): Set<ObjectType>[] {
  const N = b.size;
  const out: Set<ObjectType>[] = [];
  for (let c = 0; c < N * N; c++) {
    const r = rowOf(c, N), k = colOf(c, N);
    const s = new Set<ObjectType>();
    for (const [dr, dk] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const rr = r + dr, kk = k + dk;
      if (rr < 0 || kk < 0 || rr >= N || kk >= N) continue;
      const o = b.obj[rr * N + kk];
      if (o && BLOCKING.has(o)) s.add(o);
    }
    out.push(s);
  }
  return out;
}

export function unaryOk(b: Board, beside: Set<ObjectType>[], cl: UnaryClue, c: number): boolean {
  switch (cl.t) {
    case 'inRoom': return b.room[c] === cl.r;
    case 'notInRoom': return b.room[c] !== cl.r;
    case 'onObject': return b.obj[c] === cl.o;
    case 'onFloor': return b.obj[c] === null;
    case 'beside': return beside[c].has(cl.o);
    case 'row': return rowOf(c, b.size) === cl.v;
    case 'col': return colOf(c, b.size) === cl.v;
  }
}

/** a = cell of cl.p, b = cell of cl.q */
export function binaryOk(bd: Board, cl: BinaryClue, a: number, b: number): boolean {
  const N = bd.size;
  switch (cl.t) {
    case 'sameRoom': return bd.room[a] === bd.room[b];
    case 'diffRoom': return bd.room[a] !== bd.room[b];
    case 'north': return rowOf(a, N) < rowOf(b, N);
    case 'west': return colOf(a, N) < colOf(b, N);
    case 'diag': return Math.abs(rowOf(a, N) - rowOf(b, N)) === 1 && Math.abs(colOf(a, N) - colOf(b, N)) === 1;
  }
}

/** Check a full assignment (cell per person) against one clue. */
export function clueHolds(b: Board, beside: Set<ObjectType>[], cl: Clue, pos: readonly number[]): boolean {
  if (isUnary(cl)) return unaryOk(b, beside, cl, pos[cl.p]);
  if (isBinary(cl)) return binaryOk(b, cl, pos[cl.p], pos[cl.q]);
  if (cl.t === 'alone') {
    const R = b.room[pos[cl.p]];
    return pos.every((c, i) => i === cl.p || b.room[c] !== R);
  }
  return pos.filter((c) => b.room[c] === cl.r).length === cl.n;
}

export interface ClueRefs { people: number[]; rooms: number[]; objects: ObjectType[] }

/** Which people, rooms and objects a clue talks about (used for highlighting). */
export function clueRefs(cl: Clue): ClueRefs {
  const people: number[] = [];
  const rooms: number[] = [];
  const objects: ObjectType[] = [];
  if ('p' in cl) people.push(cl.p);
  if ('q' in cl) people.push(cl.q);
  if ('r' in cl) rooms.push(cl.r);
  if ('o' in cl) objects.push(cl.o);
  return { people, rooms, objects };
}
