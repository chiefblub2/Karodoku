// Puzzle vocabulary: furniture, rooms, the cast, and the puzzle data shape.

import type { Clue } from './clues';

export const OBJECT_TYPES = ['chair', 'bed', 'rug', 'tub', 'table', 'plant', 'shelf'] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

/** People may stand, sit or lie on these… */
export const OCCUPIABLE: ReadonlySet<ObjectType> = new Set(['chair', 'bed', 'rug', 'tub']);
/** …but never on these. */
export const BLOCKING: ReadonlySet<ObjectType> = new Set(['table', 'plant', 'shelf']);

export const isOccupiable = (o: ObjectType | null): boolean => o === null || OCCUPIABLE.has(o);
export const isBlocking = (o: ObjectType | null): boolean => o !== null && BLOCKING.has(o);

export const ROOM_TYPES = [
  'kitchen', 'library', 'lounge', 'dining', 'bedroom', 'bathroom',
  'study', 'conservatory', 'hall', 'billiard', 'cellar', 'guest',
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

/** Rooms sharing a floor family look alike, so neighbouring rooms never share one. */
export const FLOOR_FAMILY: Record<RoomType, string> = {
  library: 'parquet', study: 'parquet', lounge: 'parquet',
  kitchen: 'tiles', bathroom: 'tiles',
  cellar: 'stone', conservatory: 'garden', hall: 'marble',
  bedroom: 'soft', guest: 'soft', dining: 'dark', billiard: 'billiard',
};

export interface Room { type: RoomType }

export const SIZES = [5, 6, 7, 8] as const;
export type Size = (typeof SIZES)[number];
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const WEAPONS = ['candlestick', 'rope', 'dagger', 'poison', 'revolver', 'wrench', 'vase', 'teapot'] as const;
export type Weapon = (typeof WEAPONS)[number];

export type Accessory = 'bun' | 'tophat' | 'widehat' | 'glasses' | 'flatcap' | 'pearls' | 'toque' | 'feather';

export interface Suspect {
  id: string;
  name: string;
  initial: string;
  hue: number;
  accessory: Accessory;
}

/** The full cast; a puzzle of size N uses N−1 of them plus the victim. */
export const SUSPECTS: readonly Suspect[] = [
  { id: 'ada', name: 'Ada', initial: 'A', hue: 200, accessory: 'bun' },
  { id: 'bruno', name: 'Bruno', initial: 'B', hue: 352, accessory: 'tophat' },
  { id: 'clara', name: 'Clara', initial: 'C', hue: 135, accessory: 'widehat' },
  { id: 'dorian', name: 'Dorian', initial: 'D', hue: 32, accessory: 'glasses' },
  { id: 'emil', name: 'Emil', initial: 'E', hue: 268, accessory: 'flatcap' },
  { id: 'fiona', name: 'Fiona', initial: 'F', hue: 318, accessory: 'pearls' },
  { id: 'gustav', name: 'Gustav', initial: 'G', hue: 178, accessory: 'toque' },
  { id: 'hedda', name: 'Hedda', initial: 'H', hue: 52, accessory: 'feather' },
];
export const VICTIM_NAME = 'Viktor';

export interface Puzzle {
  size: number;
  seed: string;
  difficulty: Difficulty;
  /** Room index per cell (row-major). */
  room: number[];
  rooms: Room[];
  /** Furniture per cell. */
  obj: (ObjectType | null)[];
  /** Suspect index (into SUSPECTS) for persons 0..size-2; person size-1 is the victim. */
  cast: number[];
  clues: Clue[];
  /** Cell per person (the victim is last). */
  solution: number[];
  /** Person index of the murderer. */
  murderer: number;
  weapon: Weapon;
  /** Hardest reasoning level the logic solver needed (1 = direct deductions, 2 = what-if). */
  level: number;
}

export const victimIndex = (pz: { size: number }): number => pz.size - 1;
export const rowOf = (c: number, n: number): number => Math.floor(c / n);
export const colOf = (c: number, n: number): number => c % n;
export const colLetter = (c: number): string => String.fromCharCode(65 + c);
export const cellName = (c: number, n: number): string => `${colLetter(colOf(c, n))}${rowOf(c, n) + 1}`;
