// Versioned localStorage persistence. Anything that doesn't match the schema is discarded.

import type { Difficulty } from '../core/model';
import { DIFFICULTIES, SIZES } from '../core/model';
import type { Lang } from '../i18n';

export const SCHEMA_VERSION = 2;
const PREFIX = 'karodoku2:';

function raw(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function load<T>(key: string, valid: (v: unknown) => v is T): T | null {
  const ls = raw();
  if (!ls) return null;
  try {
    const text = ls.getItem(PREFIX + key);
    if (!text) return null;
    const v: unknown = JSON.parse(text);
    if (valid(v)) return v;
    ls.removeItem(PREFIX + key);
  } catch { /* corrupt or blocked */ }
  return null;
}

export function save(key: string, value: unknown): void {
  try { raw()?.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* quota or private mode */ }
}

export function remove(key: string): void {
  try { raw()?.removeItem(PREFIX + key); } catch { /* ignore */ }
}

/** Drop data from older versions of the app (key prefix "karodoku:"). */
export function purgeLegacy(): void {
  const ls = raw();
  if (!ls) return;
  try {
    const old: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith('karodoku:')) old.push(k);
    }
    old.forEach((k) => ls.removeItem(k));
  } catch { /* ignore */ }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isIntArray = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => Number.isInteger(x));

// ---------- settings ----------

export type RendererChoice = '3d' | '2d';

export interface Settings {
  schemaVersion: number;
  size: number;
  difficulty: Difficulty;
  renderer: RendererChoice;
  lang: Lang | null;
  sound: boolean;
  haptics: boolean;
  seenRules: boolean;
}

export const defaultSettings = (): Settings => ({
  schemaVersion: SCHEMA_VERSION, size: 6, difficulty: 'medium', renderer: '3d', lang: null, sound: false, haptics: true, seenRules: false,
});

export const isSettings = (v: unknown): v is Settings =>
  isObj(v) && v.schemaVersion === SCHEMA_VERSION &&
  (SIZES as readonly number[]).includes(v.size as number) &&
  (DIFFICULTIES as readonly string[]).includes(v.difficulty as string) &&
  (v.renderer === '3d' || v.renderer === '2d') &&
  (v.lang === null || v.lang === 'de' || v.lang === 'en') &&
  typeof v.sound === 'boolean' && typeof v.haptics === 'boolean' && typeof v.seenRules === 'boolean';

// ---------- game progress ----------

export interface Progress {
  schemaVersion: number;
  /** Cell per person, −1 = not placed. */
  pos: number[];
  marks: number[];
  struck: number[];
  /** Persons placed by a hint (can't be moved). */
  locked: number[];
  hints: number;
  /** Seconds played. */
  elapsed: number;
  solved: boolean;
}

export const freshProgress = (size: number): Progress => ({
  schemaVersion: SCHEMA_VERSION, pos: new Array(size).fill(-1), marks: [], struck: [], locked: [], hints: 0, elapsed: 0, solved: false,
});

export const isProgress = (size: number) => (v: unknown): v is Progress =>
  isObj(v) && v.schemaVersion === SCHEMA_VERSION &&
  isIntArray(v.pos) && v.pos.length === size && v.pos.every((c) => c >= -1 && c < size * size) &&
  isIntArray(v.marks) && isIntArray(v.struck) && isIntArray(v.locked) &&
  Number.isInteger(v.hints) && typeof v.elapsed === 'number' && typeof v.solved === 'boolean';

export const progressKey = (size: number, difficulty: string, seed: string): string => `game:${size}:${difficulty}:${seed}`;

// ---------- last case & one-time flags ----------

export interface CaseRef { size: number; difficulty: Difficulty; seed: string }

export const isCaseRef = (v: unknown): v is CaseRef =>
  isObj(v) && (SIZES as readonly number[]).includes(v.size as number) &&
  (DIFFICULTIES as readonly string[]).includes(v.difficulty as string) && typeof v.seed === 'string' && v.seed.length <= 40;

/** The case played last (never the tutorial), for the menu's "Continue". */
export const LAST_CASE_KEY = 'last-case';

/** Saved progress of a case, if any. */
export const loadProgress = (c: CaseRef): Progress | null => load(progressKey(c.size, c.difficulty, c.seed), isProgress(c.size));

const isTrue = (v: unknown): v is true => v === true;
/** One-time flags: 'tutorial-done', 'tip-longpress'. */
export const hasFlag = (name: string): boolean => load(`flag:${name}`, isTrue) === true;
export const setFlag = (name: string): void => save(`flag:${name}`, true);
