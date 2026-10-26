/// <reference lib="webworker" />
import { generate } from '../core/generator';
import type { GenerateRequest, GenerateResponse } from './protocol';

self.onmessage = (e: MessageEvent<GenerateRequest>) => {
  const { id, options } = e.data;
  const t0 = performance.now();
  let msg: GenerateResponse;
  try {
    msg = { id, ok: true, puzzle: generate(options), ms: performance.now() - t0 };
  } catch (err) {
    msg = { id, ok: false, error: String(err) };
  }
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);
};
