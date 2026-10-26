import { describe, expect, it } from 'vitest';
import { generate } from '../src/core/generator';
import type { Puzzle } from '../src/core/model';
import { isBlocking } from '../src/core/model';
import { plaqueSpot } from '../src/core/plaque';

/** Hand-made board: room 0 is a 1-wide vertical strip down column 0, room 1 fills the rest. */
function stripBoard(): Pick<Puzzle, 'size' | 'room' | 'obj'> {
  const N = 5;
  return { size: N, room: Array.from({ length: N * N }, (_, c) => (c % N === 0 ? 0 : 1)), obj: Array(N * N).fill(null) };
}

/** Longest blocker-free run of cells in room `r` along any one wall. */
function longestClearRun(pz: Puzzle, r: number): number {
  const N = pz.size;
  const ok = (row: number, col: number, dr: number, dc: number) => {
    if (row < 0 || col < 0 || row >= N || col >= N) return false;
    const c = row * N + col;
    if (pz.room[c] !== r || isBlocking(pz.obj[c])) return false;
    const nr = row + dr, nc = col + dc;
    return nr < 0 || nc < 0 || nr >= N || nc >= N || pz.room[nr * N + nc] !== r;
  };
  let best = 0;
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        let len = 0;
        while (len < 3 && ok(dr ? row : row + len, dr ? col + len : col, dr, dc)) len++;
        best = Math.max(best, len);
      }
    }
  }
  return best;
}

describe('plaqueSpot', () => {
  it('is deterministic', () => {
    const pz = generate({ size: 7, difficulty: 'medium', seed: 'plaque' });
    const a = pz.rooms.map((_, r) => plaqueSpot(pz, r));
    const b = pz.rooms.map((_, r) => plaqueSpot(structuredClone(pz), r));
    expect(b).toEqual(a);
  });

  it('puts a vertical strip room on its west or east wall', () => {
    const spot = plaqueSpot(stripBoard(), 0);
    expect(['W', 'E']).toContain(spot.side);
    expect(spot.len).toBeGreaterThanOrEqual(2);
  });

  it('keeps a room with a 2+ cell north wall on that wall', () => {
    const spot = plaqueSpot(stripBoard(), 1);
    expect(spot).toEqual({ side: 'N', row: 0, col: 1, len: 3 });
  });

  it('only uses a 1-cell plaque when no longer, unobstructed wall exists', () => {
    let rooms = 0;
    for (const size of [5, 6, 7, 8]) {
      for (let i = 0; i < 40; i++) {
        const pz = generate({ size, difficulty: 'medium', seed: `plaque-${i}` });
        pz.rooms.forEach((_, r) => {
          rooms++;
          const spot = plaqueSpot(pz, r);
          expect(spot.len).toBeGreaterThanOrEqual(1);
          if (spot.len === 1) expect(longestClearRun(pz, r), `${size}/${i}/room ${r}`).toBeLessThanOrEqual(1);
        });
      }
    }
    expect(rooms).toBeGreaterThan(500);
  });
});
