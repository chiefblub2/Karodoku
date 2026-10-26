import { de } from './de';
import { en } from './en';
import type { Lang, Strings } from './types';

export type { Lang, Segment, Strings } from './types';

const ALL: Record<Lang, Strings> = { de, en };
let current: Lang = 'de';
const listeners = new Set<() => void>();

export const LANGS: Lang[] = ['de', 'en'];
export const lang = (): Lang => current;
export const s = (): Strings => ALL[current];

export function detectLang(): Lang {
  return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function setLang(l: Lang): void {
  current = ALL[l] ? l : 'de';
  document.documentElement.lang = current;
  listeners.forEach((fn) => fn());
}

export function onLangChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function stringsFor(l: Lang): Strings {
  return ALL[l];
}
