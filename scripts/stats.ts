// Generator statistics: npx tsx scripts/stats.ts [count]
import { generate, lastAttempts } from '../src/core/generator';
const sizes = [5, 6, 7, 8], diffs = ['easy', 'medium', 'hard'] as const;
const n = Number(process.argv[2] || 10);
for (const size of sizes) for (const difficulty of diffs) {
  const t: number[] = [], at: number[] = [], lv: number[] = [], cl: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    const pz = generate({ size, difficulty, seed: 's' + i });
    t.push(performance.now() - t0); lv.push(pz.level); cl.push(pz.clues.length); at.push(lastAttempts);
  }
  const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length);
  console.log(`${size} ${difficulty.padEnd(6)} avg ${avg(t).toFixed(0)}ms max ${Math.max(...t).toFixed(0)}ms level ${avg(lv).toFixed(2)} clues ${avg(cl).toFixed(1)} attempts ${avg(at).toFixed(1)}`);
}
