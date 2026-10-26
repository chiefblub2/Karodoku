// Texts in German and English, including clue phrasing.

const ROOMS = {
  de: {
    kitchen: ['Küche', 'in der Küche'],
    library: ['Bibliothek', 'in der Bibliothek'],
    lounge: ['Salon', 'im Salon'],
    dining: ['Speisesaal', 'im Speisesaal'],
    bedroom: ['Schlafzimmer', 'im Schlafzimmer'],
    bathroom: ['Bad', 'im Bad'],
    study: ['Arbeitszimmer', 'im Arbeitszimmer'],
    conservatory: ['Wintergarten', 'im Wintergarten'],
    hall: ['Halle', 'in der Halle'],
    billiard: ['Billardzimmer', 'im Billardzimmer'],
    cellar: ['Weinkeller', 'im Weinkeller'],
    guest: ['Gästezimmer', 'im Gästezimmer'],
  },
  en: {
    kitchen: ['Kitchen', 'in the kitchen'],
    library: ['Library', 'in the library'],
    lounge: ['Lounge', 'in the lounge'],
    dining: ['Dining room', 'in the dining room'],
    bedroom: ['Bedroom', 'in the bedroom'],
    bathroom: ['Bathroom', 'in the bathroom'],
    study: ['Study', 'in the study'],
    conservatory: ['Conservatory', 'in the conservatory'],
    hall: ['Hall', 'in the hall'],
    billiard: ['Billiard room', 'in the billiard room'],
    cellar: ['Wine cellar', 'in the wine cellar'],
    guest: ['Guest room', 'in the guest room'],
  },
};

const ON_OBJECT = {
  de: { chair: 'saß auf einem Stuhl', bed: 'lag auf einem Bett', carpet: 'stand auf einem Teppich', tub: 'lag in der Badewanne' },
  en: { chair: 'was sitting on a chair', bed: 'was lying on a bed', carpet: 'was standing on a rug', tub: 'was lying in the bathtub' },
};

const BESIDE = {
  de: { table: 'einem Tisch', plant: 'einer Pflanze', shelf: 'einem Regal' },
  en: { table: 'a table', plant: 'a plant', shelf: 'a bookshelf' },
};

const WEAPONS = {
  de: { candlestick: 'einem Kerzenleuchter', rope: 'einem Seil', dagger: 'einem Dolch', poison: 'Gift', revolver: 'einem Revolver', wrench: 'einer Rohrzange', vase: 'einer Vase', teapot: 'einer Teekanne' },
  en: { candlestick: 'a candlestick', rope: 'a rope', dagger: 'a dagger', poison: 'poison', revolver: 'a revolver', wrench: 'a wrench', vase: 'a vase', teapot: 'a teapot' },
};

export const OBJECT_NAMES = {
  de: { chair: 'Stuhl', bed: 'Bett', carpet: 'Teppich', tub: 'Badewanne', table: 'Tisch', plant: 'Pflanze', shelf: 'Regal' },
  en: { chair: 'Chair', bed: 'Bed', carpet: 'Rug', tub: 'Bathtub', table: 'Table', plant: 'Plant', shelf: 'Bookshelf' },
};

const UI = {
  de: {
    tagline: 'Mordrätsel im Murdoku-Stil',
    size: 'Größe', difficulty: 'Schwierigkeit',
    easy: 'Leicht', medium: 'Mittel', hard: 'Schwer',
    newPuzzle: 'Neues Rätsel', daily: 'Tagesrätsel',
    clues: 'Hinweise', rooms: 'Räume', furniture: 'Möbel',
    check: 'Prüfen', hint: 'Tipp', undo: 'Zurück', reset: 'Neu starten', share: 'Teilen',
    marker: 'Notiz', eraser: 'Löschen',
    story: (v, w) => `${v} wurde mit ${w} ermordet aufgefunden. Platziere alle Personen und finde heraus, wer allein mit ${v} im Raum war.`,
    generating: 'Rätsel wird erstellt…',
    blocked: 'Hier kann niemand stehen.',
    allCorrectSoFar: 'Bisher alles richtig!',
    errors: (n) => (n === 1 ? '1 Person steht falsch.' : `${n} Personen stehen falsch.`),
    notComplete: 'Alle Personen platziert – aber etwas stimmt noch nicht.',
    hintUsed: (name) => `Tipp: ${name} wurde platziert.`,
    noHint: 'Kein Tipp mehr nötig.',
    copied: 'Link kopiert!',
    confirmReset: 'Fortschritt für dieses Rätsel löschen?',
    accuseTitle: 'Wer ist die Mörderin oder der Mörder?',
    accuseText: (v) => `Alle Personen stehen richtig. Wer war allein mit ${v} im Raum?`,
    solvedTitle: 'Fall gelöst! 🎉',
    solvedText: (m, v, w, time, hints) => `${m} hat ${v} mit ${w} ermordet. Zeit: ${time}${hints ? ` · Tipps: ${hints}` : ''}.`,
    wrongAccuse: (n) => `${n} war es nicht. Wer war mit dem Opfer allein?`,
    close: 'Schließen', another: 'Nächstes Rätsel',
    victim: 'Opfer',
    rulesTitle: 'Spielregeln',
    rules: [
      'In jeder <b>Zeile</b> und jeder <b>Spalte</b> steht genau <b>eine Person</b> (das Opfer zählt mit).',
      'Personen können auf freiem Boden, <b>Stühlen</b>, <b>Betten</b>, <b>Teppichen</b> und in der <b>Badewanne</b> sein – aber nie auf <b>Tischen</b>, <b>Pflanzen</b> oder <b>Regalen</b>.',
      'Der Täter oder die Täterin war <b>allein mit dem Opfer</b> im selben Raum: Im Raum des Opfers ist genau eine weitere Person.',
      '<b>Neben</b> heißt direkt waagerecht oder senkrecht angrenzend. <b>Diagonal neben</b> heißt schräg angrenzend.',
      '<b>Nördlich</b> heißt weiter oben, <b>westlich</b> weiter links (egal wie weit).',
      'Jedes Rätsel hat genau eine Lösung und ist ohne Raten lösbar.',
    ],
    howTo: 'Bedienung: Person unten antippen, dann ein Feld antippen. Nochmal tippen entfernt sie. Mit ✕ markierst du Felder, auf denen niemand sein kann. Hinweise kannst du antippen, um sie abzuhaken.',
  },
  en: {
    tagline: 'Murder mystery logic puzzles in Murdoku style',
    size: 'Size', difficulty: 'Difficulty',
    easy: 'Easy', medium: 'Medium', hard: 'Hard',
    newPuzzle: 'New puzzle', daily: 'Daily puzzle',
    clues: 'Clues', rooms: 'Rooms', furniture: 'Furniture',
    check: 'Check', hint: 'Hint', undo: 'Undo', reset: 'Restart', share: 'Share',
    marker: 'Note', eraser: 'Erase',
    story: (v, w) => `${v} was found murdered with ${w}. Place everyone and find out who was alone in the room with ${v}.`,
    generating: 'Generating puzzle…',
    blocked: 'Nobody can stand here.',
    allCorrectSoFar: 'All correct so far!',
    errors: (n) => (n === 1 ? '1 person is misplaced.' : `${n} people are misplaced.`),
    notComplete: 'Everyone is placed – but something is not right yet.',
    hintUsed: (name) => `Hint: ${name} has been placed.`,
    noHint: 'No hint needed.',
    copied: 'Link copied!',
    confirmReset: 'Clear your progress on this puzzle?',
    accuseTitle: 'Who is the murderer?',
    accuseText: (v) => `Everyone is in the right place. Who was alone in the room with ${v}?`,
    solvedTitle: 'Case closed! 🎉',
    solvedText: (m, v, w, time, hints) => `${m} murdered ${v} with ${w}. Time: ${time}${hints ? ` · Hints: ${hints}` : ''}.`,
    wrongAccuse: (n) => `It wasn't ${n}. Who was alone with the victim?`,
    close: 'Close', another: 'Next puzzle',
    victim: 'Victim',
    rulesTitle: 'How to play',
    rules: [
      'Every <b>row</b> and every <b>column</b> contains exactly <b>one person</b> (including the victim).',
      'People can be on bare floor, <b>chairs</b>, <b>beds</b>, <b>rugs</b> and in the <b>bathtub</b> – never on <b>tables</b>, <b>plants</b> or <b>bookshelves</b>.',
      'The murderer was <b>alone with the victim</b>: the victim’s room contains exactly one other person.',
      '<b>Next to</b> means directly left, right, above or below. <b>Diagonally next to</b> means touching corners.',
      '<b>North</b> means further up, <b>west</b> means further left (any distance).',
      'Every puzzle has exactly one solution and can be solved without guessing.',
    ],
    howTo: 'Controls: tap a person below, then tap a cell. Tap again to remove. Use ✕ to mark cells where nobody can be. Tap clues to tick them off.',
  },
};

let lang = 'de';
export function getLang() { return lang; }
export function setLang(l) { lang = UI[l] ? l : 'de'; document.documentElement.lang = lang; }
export function t(key, ...args) {
  const v = UI[lang][key];
  return typeof v === 'function' ? v(...args) : v;
}
export function roomName(type) { return ROOMS[lang][type][0]; }
export function weaponName(w) { return WEAPONS[lang][w]; }
export function objectName(o) { return OBJECT_NAMES[lang][o]; }

export function clueText(cl, pz, names) {
  const P = (i) => `<b class="pn" style="--ph:${names[i].hue}">${names[i].name}</b>`;
  const room = (r) => ROOMS[lang][pz.rooms[r].type][1];
  const de = lang === 'de';
  switch (cl.t) {
    case 'inRoom': return de ? `${P(cl.p)} war ${room(cl.r)}.` : `${P(cl.p)} was ${room(cl.r)}.`;
    case 'notInRoom': return de ? `${P(cl.p)} war nicht ${room(cl.r)}.` : `${P(cl.p)} was not ${room(cl.r)}.`;
    case 'onObject': return `${P(cl.p)} ${ON_OBJECT[lang][cl.o]}.`;
    case 'onFloor': return de ? `${P(cl.p)} stand auf blankem Boden.` : `${P(cl.p)} was standing on the bare floor.`;
    case 'beside': return de ? `${P(cl.p)} war neben ${BESIDE.de[cl.o]}.` : `${P(cl.p)} was next to ${BESIDE.en[cl.o]}.`;
    case 'row': return de ? `${P(cl.p)} war in Zeile ${cl.v + 1}.` : `${P(cl.p)} was in row ${cl.v + 1}.`;
    case 'col': return de ? `${P(cl.p)} war in Spalte ${String.fromCharCode(65 + cl.v)}.` : `${P(cl.p)} was in column ${String.fromCharCode(65 + cl.v)}.`;
    case 'alone': return de ? `${P(cl.p)} war allein in einem Raum.` : `${P(cl.p)} was alone in a room.`;
    case 'sameRoom': return de ? `${P(cl.p)} und ${P(cl.q)} waren im selben Raum.` : `${P(cl.p)} and ${P(cl.q)} were in the same room.`;
    case 'diffRoom': return de ? `${P(cl.p)} und ${P(cl.q)} waren in verschiedenen Räumen.` : `${P(cl.p)} and ${P(cl.q)} were in different rooms.`;
    case 'north': return de ? `${P(cl.p)} war nördlich von ${P(cl.q)}.` : `${P(cl.p)} was north of ${P(cl.q)}.`;
    case 'west': return de ? `${P(cl.p)} war westlich von ${P(cl.q)}.` : `${P(cl.p)} was west of ${P(cl.q)}.`;
    case 'diag': return de ? `${P(cl.p)} war diagonal neben ${P(cl.q)}.` : `${P(cl.p)} was diagonally next to ${P(cl.q)}.`;
  }
  return JSON.stringify(cl);
}
