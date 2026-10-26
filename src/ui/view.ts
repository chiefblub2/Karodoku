// Contract between the app and the board renderers (2D SVG and 3D WebGL).

import type { Accessory, Puzzle } from '../core/model';

export interface CastEntry {
  /** Person index in the puzzle. */
  index: number;
  name: string;
  initial: string;
  hue: number;
  accessory: Accessory | null;
  victim: boolean;
}

export type Tool = number | 'mark';

export interface ViewModel {
  pos: readonly number[];
  marks: ReadonlySet<number>;
  locked: ReadonlySet<number>;
  wrong: ReadonlySet<number>;
  conflicts: ReadonlySet<number>;
  shaded: ReadonlySet<number>;
  tool: Tool;
  /** Last tapped / keyboard-focused cell, −1 for none. */
  selectedCell: number;
  /** Cell under the pointer (for the ghost pawn), −1 for none. */
  hoverCell: number;
  highlightRooms: ReadonlySet<number>;
  highlightPeople: ReadonlySet<number>;
  solved: boolean;
}

export type Intent =
  | { type: 'tap'; cell: number }
  | { type: 'longpress'; cell: number }
  | { type: 'hover'; cell: number }
  /** A room's name plaque was tapped or held: name the room, never place or mark. */
  | { type: 'room'; room: number };

export type Fx =
  | { type: 'placed'; p: number; cell: number; from: number }
  | { type: 'removed'; p: number; cell: number }
  | { type: 'blocked'; cell: number }
  | { type: 'marked'; cell: number; on: boolean }
  | { type: 'wrong'; people: number[] }
  | { type: 'solved'; murderer: number }
  | { type: 'intro'; animate: boolean };

export interface BoardView {
  readonly kind: '2d' | '3d';
  mount(host: HTMLElement): void;
  setPuzzle(pz: Puzzle, cast: CastEntry[]): void;
  update(vm: ViewModel): void;
  fx(f: Fx): void;
  /** Called by the host on resize/orientation change. */
  resize(): void;
  dispose(): void;
  onIntent: (i: Intent) => void;
  /** Average FPS while animating (3D only), for the low-performance fallback. */
  measuredFps?(): number | null;
}
