// Where a room's name plaque goes: shared by the 2D and 3D boards, DOM-free.

import type { Puzzle } from './model';
import { isBlocking } from './model';

export type PlaqueSide = 'N' | 'S' | 'W' | 'E';

/** A run of 1–3 room cells along one wall; (row, col) is its top/left cell. */
export interface PlaqueSpot { side: PlaqueSide; row: number; col: number; len: number }

const SIDES: readonly PlaqueSide[] = ['N', 'S', 'W', 'E'];
/** Horizontal plates read best; a vertical one only wins when it is clearly longer. */
const SIDE_COST: Record<PlaqueSide, number> = { N: 0, S: 0.55, W: 0.9, E: 0.9 };
const STEP: Record<PlaqueSide, [number, number]> = { N: [-1, 0], S: [1, 0], W: [0, -1], E: [0, 1] };

/**
 * Best wall run for room `r`: long, and not hidden behind tall furniture (a bookcase costs more
 * than a cell of length, tables and plants only nibble at it). Deterministic: candidates are
 * scored in a fixed order and only a strictly better score replaces the current best.
 */
export function plaqueSpot(pz: Pick<Puzzle, 'size' | 'room' | 'obj'>, r: number): PlaqueSpot {
  const N = pz.size;
  const walled = (row: number, col: number, side: PlaqueSide): boolean => {
    if (row < 0 || col < 0 || row >= N || col >= N || pz.room[row * N + col] !== r) return false;
    const [dr, dc] = STEP[side];
    const nr = row + dr, nc = col + dc;
    return nr < 0 || nc < 0 || nr >= N || nc >= N || pz.room[nr * N + nc] !== r;
  };
  let best: PlaqueSpot = { side: 'N', row: 0, col: 0, len: 0 };
  let bestScore = -Infinity;
  for (const side of SIDES) {
    const horizontal = side === 'N' || side === 'S';
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        let cost = SIDE_COST[side];
        for (let len = 1; len <= 3; len++) {
          const cr = horizontal ? row : row + len - 1, cc = horizontal ? col + len - 1 : col;
          if (!walled(cr, cc, side)) break;
          const o = pz.obj[cr * N + cc];
          cost += o === 'shelf' ? 2 : isBlocking(o) ? 0.45 : 0;
          // Prefer plates further up the board, then further left.
          const tie = horizontal ? row * 0.05 : row * 0.01 + col * 0.002;
          const score = Math.min(len, 2.5) - cost - tie;
          if (score > bestScore) { bestScore = score; best = { side, row, col, len }; }
        }
      }
    }
  }
  return best;
}
