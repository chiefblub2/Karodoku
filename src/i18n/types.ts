import type { Clue } from '../core/clues';
import type { Accessory, Difficulty, ObjectType, RoomType, Weapon } from '../core/model';

export type Lang = 'de' | 'en';

/** A clue rendered as segments, so the UI can style and highlight references. */
export type Segment =
  | { text: string }
  | { person: number }
  | { room: number }
  | { object: ObjectType; text: string };

export interface Strings {
  appTagline: string;
  size: string;
  difficulty: string;
  difficulties: Record<Difficulty, string>;
  newCase: string;
  startCase: string;
  daily: string;
  clues: string;
  furniture: string;
  rooms: Record<RoomType, string>;
  roomIn: Record<RoomType, string>;
  objects: Record<ObjectType, string>;
  objectCanStand: string;
  objectBlocks: string;
  weapons: Record<Weapon, string>;
  /** Weapon names on their own (case strip). */
  weaponNames: Record<Weapon, string>;
  accessories: Record<Accessory, string>;
  roles: Record<string, string>;
  bios: Record<string, string>;
  victimRole: string;
  victimBio: string;
  actions: { undo: string; redo: string; check: string; hint: string; reset: string; share: string; accuse: string };
  mark: string;
  markHint: string;
  story(victim: string, weapon: string): string;
  /** Short case summary for the strip under the header. */
  caseLine(weapon: string): string;
  generating: string;
  blocked(object: ObjectType): string;
  allCorrectSoFar: string;
  errors(n: number): string;
  notComplete: string;
  hintUsed(name: string): string;
  removed(name: string): string;
  noHint: string;
  copied: string;
  resetTitle: string;
  resetText: string;
  cancel: string;
  confirm: string;
  close: string;
  accuseTitle: string;
  accuseText(victim: string): string;
  wrongAccuse(name: string): string;
  caseClosed: string;
  solvedText(murderer: string, victim: string, weapon: string): string;
  time: string;
  hintsUsed: string;
  nextCase: string;
  shareResult: string;
  shareText(id: string, time: string, hints: number): string;
  toMenu: string;
  menu: {
    open: string;
    back: string;
    continue: string;
    continueSub(size: number, difficulty: string, time: string): string;
    tutorialRunning: string;
    dailySub(date: string, size: number, difficulty: string): string;
    dailySolved(time: string): string;
    newCaseSub: string;
    tutorial: string;
    tutorialSub: string;
    recommended: string;
    rulesSub: string;
    settings: string;
    settingsSub: string;
  };
  coach: { steps: [string, string, string]; step(n: number, total: number): string; skip: string; done: string };
  longPressTip: string;
  rulesTitle: string;
  rules: string[];
  howTo: string;
  settings: { renderer: string; r3d: string; r2d: string; language: string; sound: string; haptics: string; on: string; off: string };
  lowFps: string;
  switchTo2d: string;
  keep3d: string;
  noWebgl: string;
  checked: string;
  cluesLeft(n: number, total: number): string;
  allCluesChecked: string;
  cell(name: string, room: string, object: string | null, person: string | null, marked: boolean): string;
  boardLabel: string;
  dockLabel: string;
  updateReady: string;
  reload: string;
  victim: string;
  clue(cl: Clue): Segment[];
}
