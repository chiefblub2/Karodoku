// Runs puzzle generation in a Web Worker (falls back to the main thread if workers fail).

import type { GenerateOptions } from '../core/generator';
import type { Puzzle } from '../core/model';
import type { GenerateRequest, GenerateResponse } from './protocol';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (p: Puzzle) => void; reject: (e: Error) => void }>();
export let lastGenerationMs = 0;

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./generate.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<GenerateResponse>) => {
      const job = pending.get(e.data.id);
      if (!job) return;
      pending.delete(e.data.id);
      if (e.data.ok) {
        lastGenerationMs = e.data.ms;
        performance.measure('karodoku-generate', { start: performance.now() - e.data.ms, duration: e.data.ms });
        job.resolve(e.data.puzzle);
      }
      else job.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      worker = null;
      pending.forEach((job) => job.reject(new Error('worker failed')));
      pending.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

export async function generatePuzzle(options: GenerateOptions): Promise<Puzzle> {
  const w = getWorker();
  if (w) {
    try {
      return await new Promise<Puzzle>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        w.postMessage({ id, options } satisfies GenerateRequest);
      });
    } catch { /* fall through */ }
  }
  const { generate } = await import('../core/generator');
  const t0 = performance.now();
  const pz = generate(options);
  lastGenerationMs = performance.now() - t0;
  return pz;
}
