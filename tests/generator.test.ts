import { describe, expect, it } from 'vitest';
import { clueHolds, besideMap, clueRefs } from '../src/core/clues';
import { generate, roomNeighbours } from '../src/core/generator';
import type { Difficulty, Puzzle } from '../src/core/model';
import { DIFFICULTIES, FLOOR_FAMILY, SIZES, colOf, isOccupiable, rowOf } from '../src/core/model';
import { countSolutions, solveLogically, verify } from '../src/core/solver';

const SEEDS = Number(process.env.KARODOKU_SEEDS ?? 12);
const timings: Record<string, number[]> = {};

const cache = new Map<string, Puzzle>();
function puzzle(size: number, difficulty: Difficulty, seed: string): Puzzle {
  const key = `${size}|${difficulty}|${seed}`;
  if (!cache.has(key)) {
    const t0 = performance.now();
    cache.set(key, generate({ size, difficulty, seed }));
    (timings[`${size}×${size} ${difficulty}`] ??= []).push(performance.now() - t0);
  }
  return cache.get(key)!;
}

describe.each(SIZES.flatMap((size) => DIFFICULTIES.map((d) => [size, d] as const)))('%i×%i %s', (size, difficulty) => {
  const seeds = Array.from({ length: SEEDS }, (_, i) => `seed-${i}`);

  it('has exactly one solution, matching the stored one', () => {
    for (const seed of seeds) {
      const pz = puzzle(size, difficulty, seed);
      const res = countSolutions(pz, pz.clues, 2, 1e8);
      expect(res.aborted, seed).toBe(false);
      expect(res.count, seed).toBe(1);
      expect(res.solution, seed).toEqual(pz.solution);
    }
  });

  it('obeys the game rules', () => {
    for (const seed of seeds) {
      const pz = puzzle(size, difficulty, seed);
      const N = pz.size;
      expect(new Set(pz.solution.map((c) => rowOf(c, N))).size).toBe(N);
      expect(new Set(pz.solution.map((c) => colOf(c, N))).size).toBe(N);
      expect(pz.solution.every((c) => isOccupiable(pz.obj[c]))).toBe(true);
      const vr = pz.room[pz.solution[N - 1]];
      expect(pz.solution.filter((c) => pz.room[c] === vr)).toHaveLength(2);
      expect(pz.room[pz.solution[pz.murderer]]).toBe(vr);
      expect(pz.murderer).not.toBe(N - 1);
      expect(verify(pz, pz.clues, pz.solution)).toBe(true);
      expect(pz.cast).toHaveLength(N - 1);
      expect(new Set(pz.cast).size).toBe(N - 1);
      expect(pz.clues.filter((cl) => clueRefs(cl).people.includes(N - 1)), seed).toEqual([]);
    }
  });

  it('has a minimal clue set', () => {
    for (const seed of seeds) {
      const pz = puzzle(size, difficulty, seed);
      pz.clues.forEach((_, i) => {
        const fewer = pz.clues.filter((__, j) => j !== i);
        expect(countSolutions(pz, fewer, 2, 1e8).count, `${seed} clue ${i}`).toBeGreaterThan(1);
      });
    }
  });

  it('is solvable without guessing at the right difficulty', () => {
    for (const seed of seeds) {
      const pz = puzzle(size, difficulty, seed);
      const logic = solveLogically(pz, pz.clues);
      expect(logic.solved, seed).toBe(true);
      expect(logic.level).toBe(pz.level);
      if (difficulty === 'easy') expect(logic.level).toBe(1);
    }
    if (difficulty === 'hard') {
      // Hard puzzles should mostly need several what-if rounds.
      const deep = seeds.filter((s) => solveLogically(puzzle(size, 'hard', s), puzzle(size, 'hard', s).clues).whatIfs >= 4);
      expect(deep.length).toBeGreaterThanOrEqual(Math.ceil(seeds.length * 0.75));
    }
  });

  it('is deterministic per seed', () => {
    const a = puzzle(size, difficulty, seeds[0]);
    const b = generate({ size, difficulty, seed: seeds[0] });
    expect(b).toEqual(a);
    const c = generate({ size, difficulty, seed: 'something-else' });
    expect(c).not.toEqual(a);
  });

  it('never gives neighbouring rooms the same floor family', () => {
    for (const seed of seeds) {
      const pz = puzzle(size, difficulty, seed);
      roomNeighbours(pz.room, pz.size).forEach((nb, r) => {
        for (const o of nb) expect(FLOOR_FAMILY[pz.rooms[o].type]).not.toBe(FLOOR_FAMILY[pz.rooms[r].type]);
      });
    }
  });
});

describe('clues', () => {
  it('reference the people, rooms and objects they mention', () => {
    expect(clueRefs({ t: 'sameRoom', p: 1, q: 3 })).toEqual({ people: [1, 3], rooms: [], objects: [] });
    expect(clueRefs({ t: 'inRoom', p: 2, r: 4 })).toEqual({ people: [2], rooms: [4], objects: [] });
    expect(clueRefs({ t: 'beside', p: 0, o: 'plant' })).toEqual({ people: [0], rooms: [], objects: ['plant'] });
    expect(clueRefs({ t: 'roomCount', r: 2, n: 0 })).toEqual({ people: [], rooms: [2], objects: [] });
  });

  it('all hold for the stored solution', () => {
    const pz = puzzle(8, 'hard', 'seed-0');
    const beside = besideMap(pz);
    for (const cl of pz.clues) expect(clueHolds(pz, beside, cl, pz.solution)).toBe(true);
  });

  it('verify rejects broken solutions', () => {
    const pz = puzzle(6, 'medium', 'seed-1');
    const swapped = pz.solution.slice();
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(verify(pz, pz.clues, swapped)).toBe(false);
  });
});

describe('generation time', () => {
  it('stays within budget (reported)', () => {
    const lines: string[] = [];
    for (const [k, t] of Object.entries(timings)) {
      const avg = t.reduce((a, b) => a + b, 0) / t.length;
      lines.push(`${k.padEnd(14)} avg ${avg.toFixed(0).padStart(4)} ms   max ${Math.max(...t).toFixed(0).padStart(4)} ms`);
      expect(Math.max(...t), k).toBeLessThan(1500);
    }
    console.log('\n' + lines.join('\n'));
  });
});
