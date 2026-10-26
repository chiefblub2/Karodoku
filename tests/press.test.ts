import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { generate } from '../src/core/generator';
import { isBlocking } from '../src/core/model';
import { GameStore } from '../src/state/game';
import { LONG_PRESS_MS, attachPointer } from '../src/ui/pointer';
import type { Intent } from '../src/ui/view';

// Just enough DOM for the banner and the live region.
beforeAll(() => {
  const els = new Map<string, unknown>();
  vi.stubGlobal('document', {
    querySelector: (sel: string) => {
      if (!els.has(sel)) els.set(sel, { innerHTML: '', textContent: '', classList: { add() {}, remove() {} } });
      return els.get(sel);
    },
  });
  vi.stubGlobal('window', globalThis);
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

/** A 10×10 px grid of cells on a fake element; pointer events are plain Events with the fields we read. */
function board(size: number, emit: (i: Intent) => void) {
  const el = new EventTarget() as unknown as HTMLElement;
  attachPointer(el, {
    pick: (x, y) => {
      const k = Math.floor(x / 40), r = Math.floor(y / 40);
      return k >= 0 && r >= 0 && k < size && r < size ? r * size + k : -1;
    },
    emit,
  });
  const at = (c: number) => ({ x: (c % size) * 40 + 20, y: Math.floor(c / size) * 40 + 20 });
  const fire = (type: string, x: number, y: number, pointerType = 'touch') =>
    el.dispatchEvent(Object.assign(new Event(type), { pointerId: 1, pointerType, button: 0, clientX: x, clientY: y }));
  return { at, fire };
}

const pz = generate({ size: 5, difficulty: 'easy', seed: 'press' });
const free = [...Array(pz.size ** 2).keys()].filter((c) => !isBlocking(pz.obj[c]));

async function setup() {
  const { App } = await import('../src/ui/app');
  const app = new App();
  app.pz = pz;
  app.game = new GameStore(pz);
  app.tool = 0;
  const intents: Intent[] = [];
  const b = board(pz.size, (i) => { intents.push(i); app.onIntent(i); });
  return { app, g: app.game, intents, ...b };
}

describe('press to preview, release to place', () => {
  it('previews while pressed and places on release over the same cell', async () => {
    const { app, g, intents, at, fire } = await setup();
    const c = free[0];
    fire('pointerdown', at(c).x, at(c).y);
    expect(intents).toEqual([{ type: 'press', cell: c }]);
    expect(g.progress.pos[0]).toBe(-1);
    expect(app.viewModel().hoverCell).toBe(c);
    expect(app.viewModel().outlineRoom).toBe(pz.room[c]);
    fire('pointerup', at(c).x + 3, at(c).y);
    expect(intents.slice(1)).toEqual([{ type: 'press', cell: -1 }, { type: 'tap', cell: c }]);
    expect(g.progress.pos[0]).toBe(c);
    expect(app.viewModel().outlineRoom).toBe(-1);
  });

  it('follows the finger and cancels when it is dragged away', async () => {
    const { app, g, intents, at, fire } = await setup();
    const [a, b] = [free[0], free.find((c) => c !== free[0])!];
    fire('pointerdown', at(a).x, at(a).y);
    fire('pointermove', at(b).x, at(b).y);
    expect(intents.at(-1)).toEqual({ type: 'press', cell: b });
    expect(app.viewModel().hoverCell).toBe(b);
    fire('pointerup', at(b).x, at(b).y);
    expect(intents.some((i) => i.type === 'tap')).toBe(false);
    expect(g.progress.pos.every((p) => p < 0)).toBe(true);
    expect(app.viewModel().hoverCell).toBe(-1);
  });

  it('cancels when released off the board', async () => {
    const { g, intents, at, fire } = await setup();
    fire('pointerdown', at(free[0]).x, at(free[0]).y);
    fire('pointermove', -50, -50);
    fire('pointerup', -50, -50);
    expect(intents.some((i) => i.type === 'tap')).toBe(false);
    expect(g.progress.pos.every((p) => p < 0)).toBe(true);
  });

  it('marks on long-press instead of placing', async () => {
    const { g, intents, at, fire } = await setup();
    const c = free[1];
    fire('pointerdown', at(c).x, at(c).y);
    vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    fire('pointerup', at(c).x, at(c).y);
    expect(intents.filter((i) => i.type === 'longpress')).toEqual([{ type: 'longpress', cell: c }]);
    expect(intents.some((i) => i.type === 'tap')).toBe(false);
    expect(g.progress.marks).toEqual([c]);
    expect(g.progress.pos.every((p) => p < 0)).toBe(true);
  });

  it('places on a mouse click without a press preview', async () => {
    const { g, intents, at, fire } = await setup();
    const c = free[2];
    fire('pointerdown', at(c).x, at(c).y, 'mouse');
    fire('pointerup', at(c).x, at(c).y, 'mouse');
    expect(intents.some((i) => i.type === 'press')).toBe(false);
    expect(g.progress.pos[0]).toBe(c);
  });
});
