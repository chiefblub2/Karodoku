import type { Strings } from './types';

const OBJ_ACC = { table: 'einem Tisch', plant: 'einer Pflanze', shelf: 'einem Regal', chair: 'einem Stuhl', bed: 'einem Bett', rug: 'einem Teppich', tub: 'der Badewanne' } as const;

export const de: Strings = {
  appTagline: 'Logische Mordrätsel',
  size: 'Größe',
  difficulty: 'Schwierigkeit',
  difficulties: { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' },
  newCase: 'Neuer Fall',
  newCaseTitle: 'Neuer Fall',
  startCase: 'Fall starten',
  daily: 'Tagesfall',
  dailyShort: 'Heute',
  clues: 'Hinweise',
  furniture: 'Möbel',
  rooms: {
    kitchen: 'Küche', library: 'Bibliothek', lounge: 'Salon', dining: 'Speisesaal', bedroom: 'Schlafzimmer',
    bathroom: 'Bad', study: 'Arbeitszimmer', conservatory: 'Wintergarten', hall: 'Halle', billiard: 'Billardzimmer',
    cellar: 'Weinkeller', guest: 'Gästezimmer',
  },
  roomIn: {
    kitchen: 'in der Küche', library: 'in der Bibliothek', lounge: 'im Salon', dining: 'im Speisesaal',
    bedroom: 'im Schlafzimmer', bathroom: 'im Bad', study: 'im Arbeitszimmer', conservatory: 'im Wintergarten',
    hall: 'in der Halle', billiard: 'im Billardzimmer', cellar: 'im Weinkeller', guest: 'im Gästezimmer',
  },
  objects: { chair: 'Stuhl', bed: 'Bett', rug: 'Teppich', tub: 'Badewanne', table: 'Tisch', plant: 'Pflanze', shelf: 'Regal' },
  objectCanStand: 'begehbar',
  objectBlocks: 'blockiert',
  weapons: {
    candlestick: 'einem Kerzenleuchter', rope: 'einem Seil', dagger: 'einem Dolch', poison: 'Gift',
    revolver: 'einem Revolver', wrench: 'einer Rohrzange', vase: 'einer Vase', teapot: 'einer Teekanne',
  },
  weaponNames: {
    candlestick: 'Kerzenleuchter', rope: 'Seil', dagger: 'Dolch', poison: 'Gift',
    revolver: 'Revolver', wrench: 'Rohrzange', vase: 'Vase', teapot: 'Teekanne',
  },
  accessories: {
    bun: 'Haarknoten', tophat: 'Zylinder', widehat: 'breiter Hut', glasses: 'runde Brille',
    flatcap: 'Schiebermütze', pearls: 'Perlenkette', toque: 'Kochmütze', feather: 'Feder',
  },
  roles: {
    ada: 'Haushälterin', bruno: 'Bankier', clara: 'Opernsängerin', dorian: 'Hausarzt',
    emil: 'Gärtner', fiona: 'Erbin', gustav: 'Koch', hedda: 'Journalistin',
  },
  bios: {
    ada: 'Kennt jeden Schlüssel im Haus – und jedes Geheimnis.',
    bruno: 'Viktor schuldete ihm ein Vermögen.',
    clara: 'Probte heute Abend lautstark Arien.',
    dorian: 'Verschrieb Viktor zuletzt seltsame Tropfen.',
    emil: 'Hat erdige Hände und ein loses Mundwerk.',
    fiona: 'Erbt alles – falls das Testament gilt.',
    gustav: 'Sein Soufflé fiel heute in sich zusammen.',
    hedda: 'Schreibt an einer Enthüllungsgeschichte.',
  },
  victimRole: 'Opfer',
  victimBio: 'Hausherr. Wurde tot aufgefunden.',
  actions: { undo: 'Zurück', redo: 'Vor', check: 'Prüfen', hint: 'Tipp', reset: 'Neu', share: 'Teilen' },
  mark: 'Notiz',
  markHint: 'Feld lange drücken setzt oder entfernt ein ✕.',
  story: (v, w) => `${v} wurde mit ${w} ermordet. Wer war allein mit ihm im Raum?`,
  caseLine: (w) => `Tatwaffe: ${w} · Wer war’s?`,
  generating: 'Fall wird vorbereitet…',
  blocked: (o) => `Auf ${OBJ_ACC[o]} kann niemand stehen.`,
  allCorrectSoFar: 'Bisher alles richtig!',
  errors: (n) => (n === 1 ? '1 Person steht falsch.' : `${n} Personen stehen falsch.`),
  notComplete: 'Alle platziert – aber etwas stimmt noch nicht.',
  hintUsed: (name) => `Tipp: ${name} steht jetzt richtig.`,
  removed: (name) => `${name} vom Brett genommen.`,
  noHint: 'Kein Tipp mehr nötig.',
  copied: 'In die Zwischenablage kopiert!',
  resetTitle: 'Fall neu starten?',
  resetText: 'Alle Platzierungen und Notizen dieses Falls werden gelöscht.',
  cancel: 'Abbrechen',
  confirm: 'Neu starten',
  close: 'Schließen',
  accuseTitle: 'Wer war es?',
  accuseText: (v) => `Alle stehen richtig. Wer war allein mit ${v} im Raum?`,
  wrongAccuse: (n) => `${n} war es nicht. Wer war mit dem Opfer allein?`,
  caseClosed: 'Fall gelöst',
  solvedText: (m, v, w) => `${m} hat ${v} mit ${w} ermordet.`,
  time: 'Zeit',
  hintsUsed: 'Tipps',
  nextCase: 'Nächster Fall',
  shareResult: 'Ergebnis teilen',
  shareText: (id, time, hints) => `🔍 Karodoku ${id}\n⏱ ${time}${hints ? ` · 💡 ${hints}` : ' · ohne Tipps'}`,
  rulesTitle: 'Spielregeln',
  rules: [
    'In jeder <b>Zeile</b> und jeder <b>Spalte</b> steht genau <b>eine Person</b> – das Opfer zählt mit.',
    'Personen stehen auf freiem Boden, <b>Stühlen</b>, <b>Betten</b>, <b>Teppichen</b> oder in der <b>Badewanne</b> – nie auf <b>Tischen</b>, <b>Pflanzen</b> oder <b>Regalen</b>.',
    'Der Täter oder die Täterin war <b>allein mit dem Opfer</b>: Im Raum des Opfers steht genau eine weitere Person.',
    '<b>Neben</b> heißt direkt waagerecht oder senkrecht angrenzend, <b>diagonal neben</b> heißt schräg angrenzend.',
    '<b>Nördlich</b> heißt weiter oben, <b>westlich</b> weiter links – egal wie weit.',
    'Jeder Fall hat genau eine Lösung und ist ohne Raten lösbar.',
  ],
  howTo: 'Person unten wählen, dann ein Feld antippen. Person auf dem Brett antippen entfernt sie. Lange drücken setzt ein ✕. Hinweise antippen hebt Personen und Räume hervor.',
  settings: { renderer: 'Darstellung', r3d: '3D', r2d: '2D', language: 'Sprache', sound: 'Töne', haptics: 'Vibration', on: 'An', off: 'Aus' },
  lowFps: 'Die 3D-Ansicht läuft auf diesem Gerät langsam.',
  switchTo2d: 'Zu 2D wechseln',
  keep3d: '3D behalten',
  noWebgl: '3D wird hier nicht unterstützt – 2D-Ansicht aktiv.',
  checked: 'Geprüft',
  cluesLeft: (n, t) => `${n} von ${t} offen`,
  allCluesChecked: 'Alle Hinweise abgehakt',
  cell: (name, room, object, person, marked) =>
    [name, room, object ?? 'freier Boden', person ? `${person} steht hier` : marked ? 'markiert' : null].filter(Boolean).join(', '),
  boardLabel: 'Spielbrett',
  dockLabel: 'Hinweise und Werkzeuge',
  updateReady: 'Neue Version verfügbar.',
  reload: 'Aktualisieren',
  victim: 'Opfer',
  clue(cl) {
    const P = (p: number) => ({ person: p });
    const T = (text: string) => ({ text });
    switch (cl.t) {
      case 'inRoom': return [P(cl.p), T(' war '), { room: cl.r }, T('.')];
      case 'notInRoom': return [P(cl.p), T(' war nicht '), { room: cl.r }, T('.')];
      case 'onObject': {
        const verb = { chair: ' saß auf ', bed: ' lag auf ', rug: ' stand auf ', tub: ' lag in ' }[cl.o as 'chair'];
        return [P(cl.p), T(verb), { object: cl.o, text: OBJ_ACC[cl.o] }, T('.')];
      }
      case 'onFloor': return [P(cl.p), T(' stand auf blankem Boden.')];
      case 'beside': return [P(cl.p), T(' war neben '), { object: cl.o, text: OBJ_ACC[cl.o] }, T('.')];
      case 'row': return [P(cl.p), T(` war in Zeile ${cl.v + 1}.`)];
      case 'col': return [P(cl.p), T(` war in Spalte ${String.fromCharCode(65 + cl.v)}.`)];
      case 'alone': return [P(cl.p), T(' war allein in einem Raum.')];
      case 'sameRoom': return [P(cl.p), T(' und '), P(cl.q), T(' waren im selben Raum.')];
      case 'diffRoom': return [P(cl.p), T(' und '), P(cl.q), T(' waren in verschiedenen Räumen.')];
      case 'north': return [P(cl.p), T(' war nördlich von '), P(cl.q), T('.')];
      case 'west': return [P(cl.p), T(' war westlich von '), P(cl.q), T('.')];
      case 'diag': return [P(cl.p), T(' war diagonal neben '), P(cl.q), T('.')];
      case 'roomCount': {
        if (cl.n === 0) return [T('Niemand war '), { room: cl.r }, T('.')];
        if (cl.n === 1) return [T('Genau eine Person war '), { room: cl.r }, T('.')];
        return [T(`Genau ${cl.n} Personen waren `), { room: cl.r }, T('.')];
      }
    }
  },
};
