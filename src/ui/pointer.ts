// Shared pointer handling for board views: press-to-preview, tap, long-press (mark), hover (ghost pawn), room plaques.

import type { Intent } from './view';

export const LONG_PRESS_MS = 400;
export const MOVE_TOLERANCE = 10;

export interface PointerOptions {
  /** Map client coordinates to a cell, −1 if outside the board. */
  pick(x: number, y: number): number;
  /** Room whose name plaque is under the pointer, −1 for none. Checked before `pick`. */
  pickRoom?(x: number, y: number): number;
  emit(i: Intent): void;
  /** Return true to swallow a pointerdown (e.g. multi-touch pinch in progress). */
  busy?(): boolean;
}

/**
 * Mouse: hover previews, a click acts at once. Touch and pen: holding a finger on a cell previews it
 * (`press`, updated while the finger moves, −1 when it ends); releasing on the same cell without
 * moving taps it, anything else cancels.
 */
export function attachPointer(el: HTMLElement, opt: PointerOptions): () => void {
  let downId = -1, downX = 0, downY = 0, downCell = -1, timer = 0, longFired = false, cancelled = false;
  let lastHover = -1, lastPress = -1;

  const hover = (cell: number) => {
    if (cell === lastHover) return;
    lastHover = cell;
    opt.emit({ type: 'hover', cell });
  };
  const press = (cell: number) => {
    if (cell === lastPress) return;
    lastPress = cell;
    opt.emit({ type: 'press', cell });
  };

  const cellAt = (x: number, y: number) => ((opt.pickRoom?.(x, y) ?? -1) >= 0 ? -1 : opt.pick(x, y));

  const onDown = (e: PointerEvent) => {
    if (e.button > 0) return;
    if (downId >= 0 || opt.busy?.()) { cancel(); return; }
    downId = e.pointerId; downX = e.clientX; downY = e.clientY;
    longFired = false; cancelled = false;
    const room = opt.pickRoom?.(e.clientX, e.clientY) ?? -1;
    const cell = room >= 0 ? -1 : opt.pick(e.clientX, e.clientY);
    downCell = cell;
    if (e.pointerType !== 'mouse') press(cell);
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (cancelled || (cell < 0 && room < 0)) return;
      longFired = true;
      press(-1);
      // Holding a plaque only names the room, it never marks a cell.
      opt.emit(room >= 0 ? { type: 'room', room } : { type: 'longpress', cell });
    }, LONG_PRESS_MS);
  };

  const cancel = () => { cancelled = true; clearTimeout(timer); downId = -1; press(-1); };

  const onMove = (e: PointerEvent) => {
    if (e.pointerId === downId) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > MOVE_TOLERANCE) { cancelled = true; clearTimeout(timer); }
      if (e.pointerType !== 'mouse') {
        if (opt.busy?.()) press(-1);
        else if (!longFired) press(cellAt(e.clientX, e.clientY));
      }
    }
    if (e.pointerType === 'mouse') hover(cellAt(e.clientX, e.clientY));
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== downId) return;
    clearTimeout(timer);
    downId = -1;
    // End the preview first, so a tap that follows can show its own banner.
    press(-1);
    if (cancelled || longFired || opt.busy?.()) return;
    const room = opt.pickRoom?.(e.clientX, e.clientY) ?? -1;
    if (room >= 0) { opt.emit({ type: 'room', room }); return; }
    const cell = opt.pick(e.clientX, e.clientY);
    // A touch that ends on another cell (or off the board) was a look, not a move.
    if (cell >= 0 && (e.pointerType === 'mouse' || cell === downCell)) opt.emit({ type: 'tap', cell });
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
