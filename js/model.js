// Shared puzzle vocabulary: furniture, rooms and people.

// People may stand/sit/lie on these…
export const OCCUPIABLE = new Set(['chair', 'bed', 'carpet', 'tub']);
// …but never on these.
export const BLOCKING = new Set(['table', 'plant', 'shelf']);

export const ROOM_TYPES = [
  'kitchen', 'library', 'lounge', 'dining', 'bedroom', 'bathroom',
  'study', 'conservatory', 'hall', 'billiard', 'cellar', 'guest',
];

// Furniture pools per room type (repeated entries = higher weight).
export function occupiablePool(type) {
  if (type === 'bedroom' || type === 'guest') return ['bed', 'bed', 'carpet', 'chair'];
  if (type === 'bathroom') return ['tub', 'carpet'];
  return ['chair', 'chair', 'carpet'];
}

export function blockingPool(type) {
  switch (type) {
    case 'library':
    case 'study': return ['shelf', 'shelf', 'table', 'plant'];
    case 'conservatory': return ['plant', 'plant', 'plant', 'table'];
    case 'kitchen':
    case 'dining': return ['table', 'table', 'plant', 'shelf'];
    case 'billiard': return ['table', 'table', 'shelf'];
    case 'bathroom': return ['plant', 'shelf'];
    default: return ['table', 'plant', 'shelf'];
  }
}

export const SUSPECTS = ['Anna', 'Bruno', 'Clara', 'Dieter', 'Emil', 'Frieda', 'Gustav', 'Helga'];
export const VICTIM = 'Viktor';
export const PERSON_HUES = [205, 340, 140, 30, 265, 175, 10, 55];

export const SIZES = [5, 6, 7, 8];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
