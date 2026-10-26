// Shared pointer handling for board views: tap, long-press (mark), hover (ghost pawn), room plaques.

import type { Intent } from './view';

export const LONG_PRESS_MS = 400;
const MOVE_TOLERANCE = 10;

export interface PointerOptions {
  /** Map client coordinates to a cell, −1 if outside the board. */
  pick(x: number, y: number): number;
  /** Room whose name plaque is under the pointer, −1 for none. Checked before `pick`. */
  pickRoom?(x: number, y: number): number;
  emit(i: Intent): void;
  /** Return true to swallow a pointerdown (e.g. multi-touch pinch in progress). */
  busy?(): boolean;
}

export function attachPointer(el: HTMLElement, opt: PointerOptions): () => void {
  let downId = -1, downX = 0, downY = 0, timer = 0, longFired = false, cancelled = false;
  let lastHover = -1;

  const hover = (cell: number) => {
    if (cell === lastHover) return;
    lastHover = cell;
    opt.emit({ type: 'hover', cell });
  };

  const onDown = (e: PointerEvent) => {
    if (e.button > 0) return;
    if (downId >= 0 || opt.busy?.()) { cancel(); return; }
    downId = e.pointerId; downX = e.clientX; downY = e.clientY;
    longFired = false; cancelled = false;
    const room = opt.pickRoom?.(e.clientX, e.clientY) ?? -1;
    const cell = room >= 0 ? -1 : opt.pick(e.clientX, e.clientY);
    if (e.pointerType !== 'mouse') hover(cell);
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (cancelled || (cell < 0 && room < 0)) return;
      longFired = true;
      // Holding a plaque only names the room, it never marks a cell.
      opt.emit(room >= 0 ? { type: 'room', room } : { type: 'longpress', cell });
    }, LONG_PRESS_MS);
  };

  const cancel = () => { cancelled = true; clearTimeout(timer); downId = -1; };

  const cellAt = (x: number, y: number) => ((opt.pickRoom?.(x, y) ?? -1) >= 0 ? -1 : opt.pick(x, y));

  const onMove = (e: PointerEvent) => {
    if (e.pointerId === downId) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > MOVE_TOLERANCE) { cancelled = true; clearTimeout(timer); }
      if (e.pointerType !== 'mouse') hover(cellAt(e.clientX, e.clientY));
    }
    if (e.pointerType === 'mouse') hover(cellAt(e.clientX, e.clientY));
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== downId) return;
    clearTimeout(timer);
    downId = -1;
    if (e.pointerType !== 'mouse') hover(-1);
    if (cancelled || longFired || opt.busy?.()) return;
    const room = opt.pickRoom?.(e.clientX, e.clientY) ?? -1;
    if (room >= 0) { opt.emit({ type: 'room', room }); return; }
    const cell = opt.pick(e.clientX, e.clientY);
    if (cell >= 0) opt.emit({ type: 'tap', cell });
  };

  const onLeave = (e: PointerEvent) => { if (e.pointerType === 'mouse') hover(-1); };
  const onContext = (e: Event) => e.preventDefault();

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('contextmenu', onContext);
  return () => {
    clearTimeout(timer);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', cancel);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('contextmenu', onContext);
  };
}
