import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { generate } from '../src/core/generator';
import { GameStore } from '../src/state/game';

// Just enough DOM for the banner and the live region.
const els = new Map<string, { innerHTML: string; textContent: string; classList: { add(): void; remove(): void } }>();
beforeAll(() => {
  vi.stubGlobal('document', {
    querySelector: (sel: string) => {
      if (!els.has(sel)) els.set(sel, { innerHTML: '', textContent: '', classList: { add() {}, remove() {} } });
      return els.get(sel);
    },
  });
  vi.stubGlobal('window', globalThis);
});
afterAll(() => vi.unstubAllGlobals());

it('a room intent names the room without touching the game', async () => {
  const { App } = await import('../src/ui/app');
  const app = new App();
  const pz = generate({ size: 6, difficulty: 'easy', seed: 'room-intent' });
  app.pz = pz;
  app.game = new GameStore(pz);
  app.game.place(0, pz.solution[0]);
  app.game.toggleMark(pz.solution[2]);
  app.tool = 1;
  const before = structuredClone(app.game.progress);
  vi.useFakeTimers();
  try {
    app.onIntent({ type: 'room', room: 2 });
    expect(app.game.progress).toEqual(before);
    expect(app.tool).toBe(1);
    expect(app.viewModel().highlightRooms.has(2)).toBe(true);
    expect(els.get('#live')?.textContent).toBeTruthy();
    vi.advanceTimersByTime(1600);
    expect(app.viewModel().highlightRooms.has(2)).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});
