import type { Strings } from './types';

const OBJ_A = { table: 'a table', plant: 'a plant', shelf: 'a bookshelf', chair: 'a chair', bed: 'a bed', rug: 'a rug', tub: 'the bathtub' } as const;

export const en: Strings = {
  appTagline: 'Murder mystery logic puzzles',
  size: 'Size',
  difficulty: 'Difficulty',
  difficulties: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
  newCase: 'New case',
  newCaseTitle: 'New case',
  startCase: 'Start case',
  daily: 'Daily case',
  dailyShort: 'Today',
  clues: 'Clues',
  furniture: 'Furniture',
  rooms: {
    kitchen: 'Kitchen', library: 'Library', lounge: 'Lounge', dining: 'Dining room', bedroom: 'Bedroom',
    bathroom: 'Bathroom', study: 'Study', conservatory: 'Conservatory', hall: 'Hall', billiard: 'Billiard room',
    cellar: 'Wine cellar', guest: 'Guest room',
  },
  roomIn: {
    kitchen: 'in the kitchen', library: 'in the library', lounge: 'in the lounge', dining: 'in the dining room',
    bedroom: 'in the bedroom', bathroom: 'in the bathroom', study: 'in the study', conservatory: 'in the conservatory',
    hall: 'in the hall', billiard: 'in the billiard room', cellar: 'in the wine cellar', guest: 'in the guest room',
  },
  objects: { chair: 'Chair', bed: 'Bed', rug: 'Rug', tub: 'Bathtub', table: 'Table', plant: 'Plant', shelf: 'Bookshelf' },
  objectCanStand: 'walkable',
  objectBlocks: 'blocked',
  weapons: {
    candlestick: 'a candlestick', rope: 'a rope', dagger: 'a dagger', poison: 'poison',
    revolver: 'a revolver', wrench: 'a wrench', vase: 'a vase', teapot: 'a teapot',
  },
  accessories: {
    bun: 'hair bun', tophat: 'top hat', widehat: 'wide-brim hat', glasses: 'round glasses',
    flatcap: 'flat cap', pearls: 'pearl necklace', toque: 'chef’s hat', feather: 'feather',
  },
  roles: {
    ada: 'Housekeeper', bruno: 'Banker', clara: 'Opera singer', dorian: 'Family doctor',
    emil: 'Gardener', fiona: 'Heiress', gustav: 'Cook', hedda: 'Journalist',
  },
  bios: {
    ada: 'Knows every key in the house – and every secret.',
    bruno: 'Viktor owed him a fortune.',
    clara: 'Was rehearsing arias loudly all evening.',
    dorian: 'Recently prescribed Viktor some odd drops.',
    emil: 'Muddy hands and a loose tongue.',
    fiona: 'Inherits everything – if the will holds.',
    gustav: 'His soufflé collapsed tonight.',
    hedda: 'Is writing an exposé.',
  },
  victimRole: 'Victim',
  victimBio: 'Master of the house. Found dead.',
  actions: { undo: 'Undo', redo: 'Redo', check: 'Check', hint: 'Hint', reset: 'Reset', share: 'Share' },
  mark: 'Note',
  markHint: 'Long-press a cell to toggle an ✕.',
  story: (v, w) => `${v} was murdered with ${w}. Who was alone in the room with him?`,
  generating: 'Preparing the case…',
  blocked: (o) => `Nobody can stand on ${OBJ_A[o]}.`,
  allCorrectSoFar: 'All correct so far!',
  errors: (n) => (n === 1 ? '1 person is misplaced.' : `${n} people are misplaced.`),
  notComplete: 'Everyone is placed – but something is off.',
  hintUsed: (name) => `Hint: ${name} is now in the right place.`,
  noHint: 'No hint needed.',
  copied: 'Copied to clipboard!',
  resetTitle: 'Restart this case?',
  resetText: 'All placements and notes for this case will be cleared.',
  cancel: 'Cancel',
  confirm: 'Restart',
  close: 'Close',
  accuseTitle: 'Whodunit?',
  accuseText: (v) => `Everyone is in place. Who was alone in the room with ${v}?`,
  wrongAccuse: (n) => `It wasn’t ${n}. Who was alone with the victim?`,
  caseClosed: 'Case closed',
  solvedText: (m, v, w) => `${m} murdered ${v} with ${w}.`,
  time: 'Time',
  hintsUsed: 'Hints',
  nextCase: 'Next case',
  shareResult: 'Share result',
  shareText: (id, time, hints) => `🔍 Karodoku ${id}\n⏱ ${time}${hints ? ` · 💡 ${hints}` : ' · no hints'}`,
  rulesTitle: 'How to play',
  rules: [
    'Every <b>row</b> and every <b>column</b> holds exactly <b>one person</b> – the victim counts.',
    'People stand on bare floor, <b>chairs</b>, <b>beds</b>, <b>rugs</b> or in the <b>bathtub</b> – never on <b>tables</b>, <b>plants</b> or <b>bookshelves</b>.',
    'The murderer was <b>alone with the victim</b>: the victim’s room holds exactly one other person.',
    '<b>Next to</b> means directly left, right, above or below; <b>diagonally next to</b> means touching corners.',
    '<b>North</b> means further up, <b>west</b> further left – any distance.',
    'Every case has exactly one solution and needs no guessing.',
  ],
  howTo: 'Pick a person below, then tap a cell. Tap again to remove. Long-press marks an ✕. Tap a clue to highlight its people and rooms.',
  settings: { renderer: 'View', r3d: '3D', r2d: '2D', language: 'Language', sound: 'Sound', haptics: 'Vibration', on: 'On', off: 'Off' },
  lowFps: 'The 3D view is running slowly on this device.',
  switchTo2d: 'Switch to 2D',
  keep3d: 'Keep 3D',
  noWebgl: '3D isn’t supported here – using the 2D view.',
  checked: 'Checked',
  cluesLeft: (n, t) => `${n} of ${t} open`,
  allCluesChecked: 'All clues ticked off',
  cell: (name, room, object, person, marked) =>
    [name, room, object ?? 'bare floor', person ? `${person} is here` : marked ? 'marked' : null].filter(Boolean).join(', '),
  boardLabel: 'Game board',
  updateReady: 'A new version is available.',
  reload: 'Update',
  victim: 'Victim',
  clue(cl) {
    const P = (p: number) => ({ person: p });
    const T = (text: string) => ({ text });
    switch (cl.t) {
      case 'inRoom': return [P(cl.p), T(' was '), { room: cl.r }, T('.')];
      case 'notInRoom': return [P(cl.p), T(' was not '), { room: cl.r }, T('.')];
      case 'onObject': {
        const verb = { chair: ' was sitting on ', bed: ' was lying on ', rug: ' was standing on ', tub: ' was lying in ' }[cl.o as 'chair'];
        return [P(cl.p), T(verb), { object: cl.o, text: OBJ_A[cl.o] }, T('.')];
      }
      case 'onFloor': return [P(cl.p), T(' was standing on the bare floor.')];
      case 'beside': return [P(cl.p), T(' was next to '), { object: cl.o, text: OBJ_A[cl.o] }, T('.')];
      case 'row': return [P(cl.p), T(` was in row ${cl.v + 1}.`)];
      case 'col': return [P(cl.p), T(` was in column ${String.fromCharCode(65 + cl.v)}.`)];
      case 'alone': return [P(cl.p), T(' was alone in a room.')];
      case 'sameRoom': return [P(cl.p), T(' and '), P(cl.q), T(' were in the same room.')];
      case 'diffRoom': return [P(cl.p), T(' and '), P(cl.q), T(' were in different rooms.')];
      case 'north': return [P(cl.p), T(' was north of '), P(cl.q), T('.')];
      case 'west': return [P(cl.p), T(' was west of '), P(cl.q), T('.')];
      case 'diag': return [P(cl.p), T(' was diagonally next to '), P(cl.q), T('.')];
      case 'roomCount':
        if (cl.n === 0) return [T('Nobody was '), { room: cl.r }, T('.')];
        if (cl.n === 1) return [T('Exactly one person was '), { room: cl.r }, T('.')];
        return [T(`Exactly ${cl.n} people were `), { room: cl.r }, T('.')];
    }
  },
};
