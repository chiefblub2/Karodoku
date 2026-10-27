// Game state store. Views read snapshots and send intents; the store owns all rules of play.

import { isBlocking, rowOf, colOf } from '../core/model';
import type { Puzzle } from '../core/model';
import type { Progress } from './persist';
import { freshProgress, isProgress, load, progressKey, save } from './persist';

export type GameEvent =
  | { type: 'placed'; p: number; cell: number; from: number }
  | { type: 'removed'; p: number; cell: number }
  | { type: 'marked'; cell: number; on: boolean }
  | { type: 'blocked'; cell: number }
  | { type: 'hint'; p: number; cell: number }
  | { type: 'check'; wrong: number[] }
  | { type: 'complete'; correct: boolean }
  | { type: 'solved' }
  | { type: 'history' }
  | { type: 'reset' }
  | { type: 'struck' }
  | { type: 'tick' };

interface Snapshot { pos: number[]; marks: number[] }

export class GameStore {
  readonly pz: Puzzle;
  readonly key: string;
  progress: Progress;
  /** Persons flagged wrong by the last check (cleared on the next move). */
  wrong = new Set<number>();
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private listeners = new Set<(e: GameEvent) => void>();
  readonly resumed: boolean;
  /** False for throwaway games (the tutorial): nothing is read from or written to storage. */
  readonly saves: boolean;

  constructor(pz: Puzzle, opts: { persist?: boolean } = {}) {
    this.pz = pz;
    this.saves = opts.persist ?? true;
    this.key = progressKey(pz.size, pz.difficulty, pz.seed);
    const saved = this.saves ? load(this.key, isProgress(pz.size)) : null;
    this.progress = saved ?? freshProgress(pz.size);
    this.resumed = !!saved && (saved.pos.some((c) => c >= 0) || saved.marks.length > 0);
  }

  get size(): number { return this.pz.size; }

  subscribe(fn: (e: GameEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: GameEvent): void {
    if (e.type !== 'tick') this.persist();
    this.listeners.forEach((fn) => fn(e));
  }

  persist(): void { if (this.saves) save(this.key, this.progress); }

  // ---------- queries ----------

  personAt(cell: number): number { return this.progress.pos.indexOf(cell); }
  isLocked(p: number): boolean { return this.progress.locked.includes(p); }
  isComplete(): boolean { return this.progress.pos.every((c) => c >= 0); }
  isCorrect(): boolean { return this.progress.pos.every((c, p) => c === this.pz.solution[p]); }

  /** Persons sharing a row or column with someone else. */
  conflicts(): Set<number> {
    const N = this.size, out = new Set<number>();
    const pos = this.progress.pos;
    for (let a = 0; a < N; a++) {
      for (let b = a + 1; b < N; b++) {
        if (pos[a] < 0 || pos[b] < 0) continue;
        if (rowOf(pos[a], N) === rowOf(pos[b], N) || colOf(pos[a], N) === colOf(pos[b], N)) { out.add(a); out.add(b); }
      }
    }
    return out;
  }

  /** Free cells in a row or column that already has someone. */
  shadedCells(): Set<number> {
    const N = this.size, rows = new Set<number>(), cols = new Set<number>();
    for (const c of this.progress.pos) if (c >= 0) { rows.add(rowOf(c, N)); cols.add(colOf(c, N)); }
    const out = new Set<number>();
    for (let c = 0; c < N * N; c++) {
      if (this.personAt(c) >= 0) continue;
      if (rows.has(rowOf(c, N)) || cols.has(colOf(c, N))) out.add(c);
    }
    return out;
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  // ---------- intents ----------

  private snapshot(): Snapshot { return { pos: this.progress.pos.slice(), marks: this.progress.marks.slice() }; }

  private record(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 300) this.undoStack.shift();
    this.redoStack = [];
    this.wrong.clear();
  }

  /** Place person p on a free cell; an occupied cell instead loses whoever stands there. */
  place(p: number, cell: number): void {
    const pr = this.progress;
    if (pr.solved) return;
    if (isBlocking(this.pz.obj[cell])) { this.emit({ type: 'blocked', cell }); return; }
    const here = this.personAt(cell);
    if (here >= 0) {
      if (this.isLocked(here)) return;
      this.record();
      pr.pos[here] = -1;
      this.emit({ type: 'removed', p: here, cell });
      return;
    }
    if (this.isLocked(p)) return;
    this.record();
    const from = pr.pos[p];
    pr.pos[p] = cell;
    pr.marks = pr.marks.filter((m) => m !== cell);
    this.emit({ type: 'placed', p, cell, from });
    this.afterMove();
  }

  toggleMark(cell: number): void {
    const pr = this.progress;
    if (pr.solved || this.personAt(cell) >= 0) return;
    if (isBlocking(this.pz.obj[cell])) { this.emit({ type: 'blocked', cell }); return; }
    this.record();
    const on = !pr.marks.includes(cell);
    pr.marks = on ? [...pr.marks, cell] : pr.marks.filter((m) => m !== cell);
    this.emit({ type: 'marked', cell, on });
  }

  undo(): void { this.travel(this.undoStack, this.redoStack); }
  redo(): void { this.travel(this.redoStack, this.undoStack); }

  private travel(from: Snapshot[], to: Snapshot[]): void {
    const snap = from.pop();
    if (!snap || this.progress.solved) return;
    to.push(this.snapshot());
    // Hint placements are permanent.
    for (const p of this.progress.locked) {
      const cell = this.pz.solution[p];
      const other = snap.pos.indexOf(cell);
      if (other >= 0 && other !== p) snap.pos[other] = -1;
      snap.pos[p] = cell;
    }
    this.progress.pos = snap.pos;
    this.progress.marks = snap.marks;
    this.wrong.clear();
    this.emit({ type: 'history' });
  }

  check(): number[] {
    const wrong = this.progress.pos.flatMap((c, p) => (c >= 0 && c !== this.pz.solution[p] ? [p] : []));
    this.wrong = new Set(wrong);
    this.emit({ type: 'check', wrong });
    return wrong;
  }

  /** Put one person in the right place: fix a wrong placement first, else reveal someone unplaced. */
  hint(): number | null {
    const pr = this.progress;
    if (pr.solved) return null;
    const off = pr.pos.flatMap((c, p) => (c !== this.pz.solution[p] ? [p] : []));
    if (!off.length) return null;
    const wrong = off.filter((p) => pr.pos[p] >= 0);
    const p = (wrong.length ? wrong : off)[0];
    this.record();
    const cell = this.pz.solution[p];
    const other = this.personAt(cell);
    if (other >= 0) pr.pos[other] = -1;
    pr.pos[p] = cell;
    pr.marks = pr.marks.filter((m) => m !== cell);
    pr.locked = [...new Set([...pr.locked, p])];
    pr.hints++;
    this.emit({ type: 'hint', p, cell });
    this.afterMove();
    return p;
  }

  private afterMove(): void {
    if (this.isComplete()) this.emit({ type: 'complete', correct: this.isCorrect() });
  }

  accuse(p: number): boolean {
    if (!this.isCorrect()) return false;
    if (p !== this.pz.murderer) return false;
    this.progress.solved = true;
    this.emit({ type: 'solved' });
    return true;
  }

  reset(): void {
    this.progress = { ...this.progress, pos: new Array(this.size).fill(-1), marks: [], struck: [], locked: [], hints: 0, elapsed: 0, solved: false };
    this.undoStack = [];
    this.redoStack = [];
    this.wrong.clear();
    this.emit({ type: 'reset' });
  }

  toggleStrike(i: number): void {
    const st = this.progress.struck;
    this.progress.struck = st.includes(i) ? st.filter((x) => x !== i) : [...st, i];
    this.emit({ type: 'struck' });
  }

  tick(): void {
    if (this.progress.solved) return;
    this.progress.elapsed++;
    if (this.progress.elapsed % 5 === 0) this.persist();
    this.emit({ type: 'tick' });
  }
}
