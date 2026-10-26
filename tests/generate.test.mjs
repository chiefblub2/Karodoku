// Run with: node tests/generate.test.mjs
// Generates puzzles for every size/difficulty and verifies they are uniquely solvable.

import { generate } from '../js/generator.js';
import { countSolutions } from '../js/solver.js';
import { isOccupiable } from '../js/solver.js';

const SIZES = [5, 6, 7, 8];
const DIFFS = ['easy', 'medium', 'hard'];
const PER = Number(process.argv[2] || 8);
let failures = 0;

for (const size of SIZES) {
  for (const difficulty of DIFFS) {
    const times = [], clueCounts = [];
    for (let i = 0; i < PER; i++) {
      const seed = `test-${i}`;
      const t0 = performance.now();
      const pz = generate({ size, difficulty, seed });
      times.push(performance.now() - t0);
      clueCounts.push(pz.clues.length);

      const res = countSolutions(pz, pz.clues, 2, 1e7);
      const fail = (msg) => { failures++; console.error(`FAIL ${size}/${difficulty}/${seed}: ${msg}`); };
      if (res.count !== 1) fail(`expected 1 solution, got ${res.count}`);
      if (res.solution && res.solution.some((c, k) => c !== pz.solution[k])) fail('solution mismatch');
      const rows = new Set(pz.solution.map((c) => Math.floor(c / size)));
      const cols = new Set(pz.solution.map((c) => c % size));
      if (rows.size !== size || cols.size !== size) fail('not one per row/col');
      if (pz.solution.some((c) => !isOccupiable(pz.obj[c]))) fail('person on blocking object');
      const vr = pz.room[pz.solution[size - 1]];
      const inVr = pz.solution.filter((c) => pz.room[c] === vr).length;
      if (inVr !== 2) fail('victim room must contain exactly 2 people');
      if (pz.room[pz.solution[pz.murderer]] !== vr) fail('murderer not in victim room');
      if (generate({ size, difficulty, seed }).clues.length !== pz.clues.length) fail('not deterministic');
    }
    const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0);
    console.log(`${size}x${size} ${difficulty.padEnd(6)} avg ${avg(times)}ms, max ${Math.max(...times).toFixed(0)}ms, clues ${Math.min(...clueCounts)}–${Math.max(...clueCounts)}`);
  }
}

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('All puzzles valid.');
