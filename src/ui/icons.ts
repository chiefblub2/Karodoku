// SVG icons in the toy-dollhouse style (2D board, legend, palette).
// Furniture is drawn top-down on a 100×100 viewBox; pawns are drawn front-on.

import type { Accessory, ObjectType } from '../core/model';

const WOOD = '#8a5a32', WOOD_D = '#5e3a1f', WOOD_L = '#b07a47';

export const FURNITURE_SVG: Record<ObjectType, string> = {
  chair: `<rect x="26" y="34" width="48" height="44" rx="9" fill="${WOOD_L}" stroke="${WOOD_D}" stroke-width="4"/>
    <rect x="22" y="18" width="56" height="14" rx="6" fill="${WOOD}" stroke="${WOOD_D}" stroke-width="4"/>
    <rect x="34" y="42" width="32" height="28" rx="6" fill="#7d2420"/>`,
  bed: `<rect x="18" y="8" width="64" height="84" rx="10" fill="${WOOD}" stroke="${WOOD_D}" stroke-width="4"/>
    <rect x="24" y="14" width="52" height="72" rx="8" fill="#f4ead6"/>
    <rect x="30" y="18" width="40" height="16" rx="7" fill="#fff" stroke="#d9cbb0" stroke-width="2"/>
    <rect x="24" y="48" width="52" height="38" rx="6" fill="#7d2420"/><rect x="24" y="48" width="52" height="7" fill="#9a3b33"/>`,
  rug: `<rect x="14" y="20" width="72" height="60" rx="4" fill="#8e2a24"/>
    <rect x="21" y="27" width="58" height="46" rx="3" fill="none" stroke="#e2b25c" stroke-width="4"/>
    <path d="M50 36 L64 50 L50 64 L36 50Z" fill="#e2b25c"/><path d="M50 43 L57 50 L50 57 L43 50Z" fill="#2f5d3a"/>
    <path d="M14 22v56M10 24v4M10 34v4M10 44v4M10 54v4M10 64v4M10 72v4M90 24v4M90 34v4M90 44v4M90 54v4M90 64v4M90 72v4" stroke="#e8dcc2" stroke-width="3"/>`,
  tub: `<rect x="20" y="10" width="60" height="80" rx="28" fill="#fbfaf6" stroke="#c9c2b4" stroke-width="4"/>
    <rect x="29" y="22" width="42" height="58" rx="20" fill="#bfe0ea"/>
    <circle cx="50" cy="18" r="4" fill="#c99a3e"/>`,
  table: `<rect x="8" y="14" width="84" height="72" rx="12" fill="${WOOD}" stroke="${WOOD_D}" stroke-width="5"/>
    <rect x="16" y="22" width="68" height="56" rx="8" fill="none" stroke="${WOOD_L}" stroke-width="3" opacity=".7"/>
    <circle cx="50" cy="50" r="11" fill="#f2e6c9" stroke="#c99a3e" stroke-width="4"/><circle cx="50" cy="50" r="4" fill="#ffb347"/>`,
  plant: `<circle cx="50" cy="50" r="40" fill="#b5532e" stroke="#7a3219" stroke-width="4"/>
    <g fill="#3f7d3a" stroke="#24521f" stroke-width="2.5">
      <ellipse cx="50" cy="28" rx="11" ry="20"/><ellipse cx="50" cy="72" rx="11" ry="20"/>
      <ellipse cx="28" cy="50" rx="20" ry="11"/><ellipse cx="72" cy="50" rx="20" ry="11"/></g>
    <g fill="#5fa152" stroke="#2f6a29" stroke-width="2"><ellipse cx="36" cy="36" rx="9" ry="15" transform="rotate(-45 36 36)"/>
      <ellipse cx="64" cy="36" rx="9" ry="15" transform="rotate(45 64 36)"/><ellipse cx="36" cy="64" rx="9" ry="15" transform="rotate(45 36 64)"/>
      <ellipse cx="64" cy="64" rx="9" ry="15" transform="rotate(-45 64 64)"/></g><circle cx="50" cy="50" r="7" fill="#8cc472"/>`,
  shelf: `<rect x="6" y="20" width="88" height="60" rx="6" fill="${WOOD_D}"/>
    <rect x="12" y="26" width="76" height="48" fill="#3a2414"/>
    <g><rect x="14" y="28" width="9" height="44" fill="#8e2a24"/><rect x="24" y="32" width="8" height="40" fill="#2f5d3a"/>
    <rect x="33" y="28" width="10" height="44" fill="#c99a3e"/><rect x="44" y="34" width="8" height="38" fill="#2b4a7a"/>
    <rect x="53" y="28" width="9" height="44" fill="#7a3d6b"/><rect x="63" y="30" width="10" height="42" fill="#8e2a24"/>
    <rect x="74" y="34" width="12" height="38" fill="#e8dcc2"/></g>`,
};

export function furnitureIcon(o: ObjectType, cls = 'icon'): string {
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${FURNITURE_SVG[o]}</svg>`;
}

const ACCESSORY_SVG: Record<Accessory, string> = {
  bun: `<circle cx="50" cy="12" r="9" fill="#5a3a22"/><path d="M33 28 Q50 8 67 28 Q60 22 50 22 Q40 22 33 28Z" fill="#5a3a22"/>`,
  tophat: `<rect x="37" y="0" width="26" height="22" rx="2" fill="#1d1a1a"/><rect x="37" y="15" width="26" height="4" fill="#a3271c"/>
    <rect x="28" y="20" width="44" height="6" rx="3" fill="#1d1a1a"/>`,
  widehat: `<ellipse cx="50" cy="22" rx="30" ry="7" fill="#e6cf9c" stroke="#a9874c" stroke-width="2"/>
    <path d="M37 22 Q38 6 50 6 Q62 6 63 22Z" fill="#e6cf9c" stroke="#a9874c" stroke-width="2"/><rect x="37" y="16" width="26" height="4" fill="#a3271c"/>`,
  glasses: `<g fill="none" stroke="#c99a3e" stroke-width="3"><circle cx="43" cy="31" r="6"/><circle cx="57" cy="31" r="6"/><path d="M49 31h2"/></g>`,
  flatcap: `<path d="M33 24 Q34 10 50 10 Q66 10 67 22 L80 26 Q70 30 60 26 L36 27Z" fill="#6b5a45" stroke="#433626" stroke-width="2"/>`,
  pearls: `<g fill="#fffaf0" stroke="#cfc6b5" stroke-width="1"><circle cx="38" cy="48" r="3.2"/><circle cx="43" cy="52" r="3.2"/><circle cx="50" cy="54" r="3.2"/>
    <circle cx="57" cy="52" r="3.2"/><circle cx="62" cy="48" r="3.2"/></g>`,
  toque: `<path d="M36 26 L36 16 Q28 12 33 5 Q38 -1 44 4 Q50 -3 56 4 Q62 -1 67 5 Q72 12 64 16 L64 26Z" fill="#fffdf7" stroke="#cfc6b5" stroke-width="2"/>`,
  feather: `<path d="M60 22 Q74 4 70 -2 Q62 6 58 20Z" fill="#a3271c" stroke="#6e1812" stroke-width="1.5"/><rect x="36" y="20" width="28" height="4" rx="2" fill="#2f5d3a"/>`,
};

/** Front view of a turned wooden pawn with its accessory and initial badge. */
export function pawnSvg(hue: number, accessory: Accessory | null, initial: string, cls = 'pawn-icon'): string {
  const body = `hsl(${hue} 55% 46%)`, dark = `hsl(${hue} 55% 30%)`, light = `hsl(${hue} 60% 62%)`;
  return `<svg class="${cls}" viewBox="0 -4 100 104" aria-hidden="true">
    <ellipse cx="50" cy="92" rx="30" ry="7" fill="${dark}"/>
    <path d="M22 90 Q22 80 34 78 Q40 62 40 50 Q32 46 36 40 L64 40 Q68 46 60 50 Q60 62 66 78 Q78 80 78 90Z" fill="${body}" stroke="${dark}" stroke-width="2.5"/>
    <path d="M42 52 Q44 64 40 76" stroke="${light}" stroke-width="3" fill="none" opacity=".7"/>
    <circle cx="50" cy="29" r="15" fill="${body}" stroke="${dark}" stroke-width="2.5"/>
    <circle cx="45" cy="24" r="4" fill="${light}" opacity=".8"/>
    ${accessory ? ACCESSORY_SVG[accessory] : ''}
    <circle cx="50" cy="69" r="17" fill="#f6ecd6" stroke="${dark}" stroke-width="3"/>
    <text x="50" y="77" text-anchor="middle" font-size="24" font-weight="900" font-family="Georgia,serif" fill="${dark}">${initial}</text>
  </svg>`;
}

/** Chalk outline used for the victim. */
export function chalkSvg(cls = 'pawn-icon'): string {
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="50" cy="20" r="10"/>
    <path d="M42 30 Q36 34 26 44 L18 40 M58 30 Q64 34 76 38 L84 30 M42 30 L44 58 L34 86 M58 30 L56 58 L68 86 M44 58 L56 58"/></g>
    <path d="M76 70 l8 -18 l8 18z" fill="#e2b25c" stroke="#7a5a1c" stroke-width="2"/></svg>`;
}

export const ICONS = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  check: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="m8 11 2 2 4-4"/>',
  hint: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  case: '<path d="M4 7h16v13H4z"/><path d="M9 7V4h6v3"/><path d="M4 12h16"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  mark: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevron: '<path d="m6 15 6-6 6 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  play: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>',
  plus: '<path d="M4 7h16v13H4z"/><path d="M9 7V4h6v3"/><path d="M12 11v6M9 14h6"/>',
  school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/><path d="M22 9v6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  accuse: '<path d="M14 4l6 6"/><path d="M12 6l6 6"/><path d="M15 9l-9 9"/><path d="M3 21h8"/>',
};

export function icon(name: keyof typeof ICONS, cls = 'ui-icon'): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}
