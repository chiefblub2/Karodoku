import { describe, expect, it } from 'vitest';
import { generate } from '../src/core/generator';
import { isBlocking } from '../src/core/model';
import { GameStore } from '../src/state/game';

const pz = generate({ size: 5, difficulty: 'easy', seed: 'game-store' });
const free = [...Array(pz.size ** 2).keys()].filter((c) => !isBlocking(pz.obj[c]));

describe('GameStore.place', () => {
  it('removes whoever stands on a tapped cell, whichever person is selected', () => {
    const g = new GameStore(pz);
    g.place(0, free[0]);
    g.place(1, free[0]);
    expect(g.progress.pos[0]).toBe(-1);
    expect(g.progress.pos[1]).toBe(-1);
  });

  it('moves the selected person to a free cell', () => {
    const g = new GameStore(pz);
    g.place(0, free[0]);
    g.place(0, free[1]);
    expect(g.progress.pos[0]).toBe(free[1]);
    expect(g.personAt(free[0])).toBe(-1);
  });

  it('keeps hint placements and restores removals on undo', () => {
    const g = new GameStore(pz);
    const p = g.hint()!;
    g.place((p + 1) % pz.size, pz.solution[p]);
    expect(g.progress.pos[p]).toBe(pz.solution[p]);

    const q = (p + 1) % pz.size;
    const cell = free.find((c) => g.personAt(c) < 0)!;
    g.place(q, cell);
    g.place(p, cell);
    expect(g.progress.pos[q]).toBe(-1);
    g.undo();
    expect(g.progress.pos[q]).toBe(cell);
  });
});
