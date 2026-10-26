import { expect, it } from 'vitest';
import { generate } from '../src/core/generator';
import { GameStore } from '../src/state/game';

it('restarting a case also restarts the timer', () => {
  const g = new GameStore(generate({ size: 5, difficulty: 'easy', seed: 'reset' }));
  for (let i = 0; i < 7; i++) g.tick();
  g.hint();
  g.reset();
  expect(g.progress.elapsed).toBe(0);
  expect(g.progress.hints).toBe(0);
  expect(g.progress.pos.every((c) => c < 0)).toBe(true);
});
