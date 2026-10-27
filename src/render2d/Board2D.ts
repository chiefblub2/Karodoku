// Lightweight SVG board: used without WebGL, by choice, or when 3D runs too slowly.

import type { Puzzle, RoomType } from '../core/model';
import { colLetter, colOf, isBlocking, rowOf } from '../core/model';
import { plaqueSpot } from '../core/plaque';
import { s } from '../i18n';
import { esc } from '../ui/dom';
import { FURNITURE_SVG, chalkSvg, pawnSvg } from '../ui/icons';
import { attachPointer } from '../ui/pointer';
import type { BoardView, CastEntry, Fx, Intent, ViewModel } from '../ui/view';

/** Flat floor colours per room type (match the 3D floor materials). */
export const FLOOR_2D: Record<RoomType, [string, string]> = {
  library: ['#a0683a', '#8d5a31'], study: ['#c08a52', '#ad7a45'], lounge: ['#b98250', '#a06c3f'],
  kitchen: ['#efe6d2', '#2f3a48'], bathroom: ['#e9eef0', '#5d8fa6'], cellar: ['#8a8378', '#77706a'],
  conservatory: ['#e8e3c4', '#5f8a54'], hall: ['#ece6de', '#cfc5b8'], bedroom: ['#c9a48a', '#b58f75'],
  guest: ['#d8b9a0', '#c4a287'], dining: ['#6b4026', '#5a3420'], billiard: ['#4b3222', '#2e5a3c'],
};

const PAD = 0.55; // board margin in cells (coordinates live here)

export class Board2D implements BoardView {
  readonly kind = '2d' as const;
  onIntent: (i: Intent) => void = () => {};
  private host!: HTMLElement;
  private root!: HTMLDivElement;
  private svg!: SVGSVGElement;
  private layers!: { shade: SVGGElement; hl: SVGGElement; outline: SVGGElement; marks: SVGGElement; pawns: SVGGElement; fx: SVGGElement };
  private pz!: Puzzle;
  private cast: CastEntry[] = [];
  private detach: (() => void) | null = null;

  mount(host: HTMLElement): void {
    this.host = host;
    this.root = document.createElement('div');
    this.root.className = 'board2d';
    host.appendChild(this.root);
  }

  setPuzzle(pz: Puzzle, cast: CastEntry[]): void {
    this.pz = pz;
    this.cast = cast;
    const N = pz.size, W = N + PAD * 2;
    const t = s();
    let floor = '', walls = '', furn = '', coords = '';
    for (let c = 0; c < N * N; c++) {
      const r = rowOf(c, N), k = colOf(c, N);
      const [a, b] = FLOOR_2D[pz.rooms[pz.room[c]].type];
      const checker = (r + k) % 2 === 0;
      const type = pz.rooms[pz.room[c]].type;
      const tiled = type === 'kitchen' || type === 'bathroom' || type === 'conservatory';
      floor += `<rect x="${k}" y="${r}" width="1.002" height="1.002" fill="${tiled ? (checker ? a : b) : a}"/>`;
      if (!tiled) floor += `<path d="M${k} ${r + 0.34}h1M${k} ${r + 0.67}h1" stroke="${b}" stroke-width="0.03"/>`;
      const o = pz.obj[c];
      if (o) furn += `<svg x="${k + 0.06}" y="${r + 0.06}" width="0.88" height="0.88" viewBox="0 0 100 100">${FURNITURE_SVG[o]}</svg>`;
    }
    // Walls on room boundaries and the outer edge.
    const seg = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1}L${x2} ${y2}`;
    for (let c = 0; c < N * N; c++) {
      const r = rowOf(c, N), k = colOf(c, N);
      if (k + 1 < N && pz.room[c] !== pz.room[c + 1]) walls += seg(k + 1, r, k + 1, r + 1);
      if (r + 1 < N && pz.room[c] !== pz.room[c + N]) walls += seg(k, r + 1, k + 1, r + 1);
    }
    for (let i = 0; i < N; i++) {
      coords += `<text x="${i + 0.5}" y="${-PAD / 2}" class="coord">${colLetter(i)}</text>`;
      coords += `<text x="${-PAD / 2}" y="${i + 0.5}" class="coord">${i + 1}</text>`;
    }
    // Room name plaques along the wall `plaqueSpot` picks (bottom-to-top on west/east walls),
    // each over a transparent hit strip so tapping the name shows the room.
    let labels = '';
    pz.rooms.forEach((room, r) => {
      const { side, row, col, len } = plaqueSpot(pz, r);
      const mid = (side === 'W' || side === 'E' ? row : col) + len / 2;
      const name = esc(t.rooms[room.type]);
      const fit = `data-fit="${len - 0.12}"`;
      if (side === 'N' || side === 'S') {
        const y = side === 'N' ? row : row + 0.7;
        labels += `<rect x="${col}" y="${y}" width="${len}" height="0.3" data-room="${r}" class="plaque-hit"/>`;
        labels += `<text x="${mid}" y="${side === 'N' ? row + 0.16 : row + 0.93}" ${fit} class="plaque">${name}</text>`;
      } else {
        const x = side === 'W' ? col : col + 0.7;
        const bx = side === 'W' ? col + 0.16 : col + 0.93;
        labels += `<rect x="${x}" y="${row}" width="0.3" height="${len}" data-room="${r}" class="plaque-hit"/>`;
        labels += `<text x="${bx}" y="${mid}" transform="rotate(-90 ${bx} ${mid})" ${fit} class="plaque">${name}</text>`;
      }
    });

    this.root.innerHTML = `<svg viewBox="${-PAD} ${-PAD} ${W} ${W}" class="board2d-svg" aria-hidden="true">
      <defs><pattern id="shade-hatch" width="0.2" height="0.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="0.2" height="0.2" class="shade-fill"/><path d="M0.1 0v0.2" class="shade-line"/></pattern></defs>
      <rect x="${-PAD}" y="${-PAD}" width="${W}" height="${W}" rx="0.3" class="base"/>
      <g>${floor}</g><g class="hl"></g><g class="furn">${furn}</g><g class="shade"></g>
      <path d="${walls}" class="wall"/><rect x="0" y="0" width="${N}" height="${N}" class="wall outer"/>
      <g class="outline"></g><g class="labels">${labels}</g><g class="coords">${coords}</g>
      <g class="marks"></g><g class="pawns"></g><g class="fx"></g></svg>`;
    this.svg = this.root.querySelector('svg')!;
    const g = (sel: string) => this.svg.querySelector(sel) as SVGGElement;
    this.layers = { shade: g('.shade'), hl: g('.hl'), outline: g('.outline'), marks: g('.marks'), pawns: g('.pawns'), fx: g('.fx') };
    this.detach?.();
    this.detach = attachPointer(this.root, {
      pick: (x, y) => this.pick(x, y),
      pickRoom: (x, y) => this.pickRoom(x, y),
      emit: (i) => this.onIntent(i),
    });
    // Squeeze names that are wider than their stretch of wall.
    this.svg.querySelectorAll<SVGTextElement>('text.plaque').forEach((el) => {
      const max = Number(el.dataset.fit);
      if (el.getComputedTextLength() > max) {
        el.setAttribute('textLength', String(max));
        el.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
    });
  }

  private pickRoom(x: number, y: number): number {
    const hit = document.elementsFromPoint(x, y).find((el) => el instanceof SVGElement && el.dataset.room !== undefined);
    return hit ? Number((hit as SVGElement).dataset.room) : -1;
  }

  private pick(x: number, y: number): number {
    const rect = this.svg.getBoundingClientRect();
    const N = this.pz.size, W = N + PAD * 2;
    const k = Math.floor(((x - rect.left) / rect.width) * W - PAD);
    const r = Math.floor(((y - rect.top) / rect.height) * W - PAD);
    return k >= 0 && r >= 0 && k < N && r < N ? r * N + k : -1;
  }

  update(vm: ViewModel): void {
    const { pz } = this;
    const N = pz.size;
    let shade = '', hl = '', outline = '', marks = '', pawns = '';
    // Ruled-out cells: greyed (saturation blend) and darkened with hatching, furniture included.
    for (const c of vm.shaded) {
      const x = colOf(c, N), y = rowOf(c, N);
      shade += `<rect x="${x}" y="${y}" width="1" height="1" class="shade-grey"/><rect x="${x}" y="${y}" width="1" height="1" class="shade-dark"/>`;
    }
    if (vm.outlineRoom >= 0) {
      let d = '';
      for (let c = 0; c < N * N; c++) {
        if (pz.room[c] !== vm.outlineRoom) continue;
        const x = colOf(c, N), y = rowOf(c, N);
        const out = (r2: number, k2: number) => r2 < 0 || k2 < 0 || r2 >= N || k2 >= N || pz.room[r2 * N + k2] !== vm.outlineRoom;
        if (out(y - 1, x)) d += `M${x} ${y}h1`;
        if (out(y + 1, x)) d += `M${x} ${y + 1}h1`;
        if (out(y, x - 1)) d += `M${x} ${y}v1`;
        if (out(y, x + 1)) d += `M${x + 1} ${y}v1`;
      }
      outline = `<path d="${d}" class="room-outline"/>`;
    }
    for (let c = 0; c < N * N; c++) {
      if (vm.highlightRooms.has(pz.room[c])) hl += `<rect x="${colOf(c, N)}" y="${rowOf(c, N)}" width="1" height="1" class="room-glow"/>`;
    }
    if (vm.selectedCell >= 0) hl += `<rect x="${colOf(vm.selectedCell, N) + 0.04}" y="${rowOf(vm.selectedCell, N) + 0.04}" width="0.92" height="0.92" rx="0.1" class="sel"/>`;
    for (const c of vm.marks) {
      marks += `<path d="M${colOf(c, N) + 0.28} ${rowOf(c, N) + 0.28}l0.44 0.44M${colOf(c, N) + 0.72} ${rowOf(c, N) + 0.28}l-0.44 0.44" class="mark"/>`;
    }
    vm.pos.forEach((c, p) => {
      if (c < 0) return;
      const who = this.cast[p];
      const x = colOf(c, N), y = rowOf(c, N);
      const ring = vm.wrong.has(p) || vm.conflicts.has(p) ? 'ring bad' : vm.locked.has(p) ? 'ring locked' : vm.highlightPeople.has(p) ? 'ring glow' : '';
      if (ring) pawns += `<circle cx="${x + 0.5}" cy="${y + 0.55}" r="0.44" class="${ring}"/>`;
      const art = who.victim ? chalkSvg('') : pawnSvg(who.hue, who.accessory, who.initial, '');
      const cls = `p2d${vm.wrong.has(p) ? ' wobble' : ''}${who.victim ? ' victim' : ''}`;
      pawns += `<svg x="${x + 0.05}" y="${y + 0.02}" width="0.9" height="0.94" class="${cls}">${art}</svg>`;
    });
    const ghostOk = vm.hoverCell >= 0 && !vm.solved && !isBlocking(pz.obj[vm.hoverCell]) && vm.pos.indexOf(vm.hoverCell) < 0;
    if (ghostOk && vm.tool === 'mark' && !vm.marks.has(vm.hoverCell)) {
      const x = colOf(vm.hoverCell, N), y = rowOf(vm.hoverCell, N);
      marks += `<path d="M${x + 0.28} ${y + 0.28}l0.44 0.44M${x + 0.72} ${y + 0.28}l-0.44 0.44" class="mark" opacity="0.4"/>`;
    }
    if (ghostOk && typeof vm.tool === 'number') {
      const who = this.cast[vm.tool];
      if (who) {
        const x = colOf(vm.hoverCell, N), y = rowOf(vm.hoverCell, N);
        const art = who.victim ? chalkSvg('') : pawnSvg(who.hue, who.accessory, who.initial, '');
        pawns += `<g opacity="0.4"><svg x="${x + 0.05}" y="${y + 0.02}" width="0.9" height="0.94">${art}</svg></g>`;
      }
    }
    this.layers.shade.innerHTML = shade;
    this.layers.hl.innerHTML = hl;
    this.layers.outline.innerHTML = outline;
    this.layers.marks.innerHTML = marks;
    this.layers.pawns.innerHTML = pawns;
  }

  fx(f: Fx): void {
    if (f.type === 'blocked') {
      const N = this.pz.size;
      const furn = this.svg.querySelectorAll('.furn > svg');
      // Furniture nodes are emitted in cell order, skipping empty cells.
      let idx = -1;
      for (let c = 0; c <= f.cell; c++) if (this.pz.obj[c]) idx++;
      const el = furn[idx] as SVGElement | undefined;
      if (el) {
        el.style.transformOrigin = `${colOf(f.cell, N) + 0.5}px ${rowOf(f.cell, N) + 0.5}px`;
        el.classList.remove('wiggle');
        void el.getBoundingClientRect();
        el.classList.add('wiggle');
      }
    }
  }

  resize(): void { /* SVG scales by itself */ }

  dispose(): void {
    this.detach?.();
    this.root?.remove();
    void this.host;
  }
}
