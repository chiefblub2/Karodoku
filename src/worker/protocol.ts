import type { GenerateOptions } from '../core/generator';
import type { Puzzle } from '../core/model';

export interface GenerateRequest { id: number; options: GenerateOptions }
export type GenerateResponse =
  | { id: number; ok: true; puzzle: Puzzle; ms: number }
  | { id: number; ok: false; error: string };
