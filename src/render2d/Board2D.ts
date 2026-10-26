// Lightweight SVG board: used without WebGL, by choice, or when 3D runs too slowly.

import type { Puzzle, RoomType } from '../core/model';
import { colLetter, colOf, isBlocking, rowOf } from '../core/model';
import { s } from '../i18n';
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
  private layers!: { shade: SVGGElement; hl: SVGGElement; marks: SVGGElement; pawns: SVGGElement; fx: SVGGElement };
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
    // Room name plaques on the first cell of each room.
    const seen = new Set<number>();
    let labels = '';
    for (let c = 0; c < N * N; c++) {
      const r = pz.room[c];
      if (seen.has(r)) continue;
      seen.add(r);
      labels += `<text x="${colOf(c, N) + 0.06}" y="${rowOf(c, N) + 0.15}" class="plaque">${t.rooms[pz.rooms[r].type]}</text>`;
    }

    this.root.innerHTML = `<svg viewBox="${-PAD} ${-PAD} ${W} ${W}" class="board2d-svg" aria-hidden="true">
      <rect x="${-PAD}" y="${-PAD}" width="${W}" height="${W}" rx="0.3" class="base"/>
      <g>${floor}</g><g class="shade"></g><g class="hl"></g><g class="furn">${furn}</g>
      <path d="${walls}" class="wall"/><rect x="0" y="0" width="${N}" height="${N}" class="wall outer"/>
      <g class="labels">${labels}</g><g class="coords">${coords}</g>
      <g class="marks"></g><g class="pawns"></g><g class="fx"></g></svg>`;
    this.svg = this.root.querySelector('svg')!;
    const g = (sel: string) => this.svg.querySelector(sel) as SVGGElement;
    this.layers = { shade: g('.shade'), hl: g('.hl'), marks: g('.marks'), pawns: g('.pawns'), fx: g('.fx') };
    this.detach?.();
    this.detach = attachPointer(this.root, { pick: (x, y) => this.pick(x, y), emit: (i) => this.onIntent(i) });
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
    let shade = '', hl = '', marks = '', pawns = '';
    for (const c of vm.shaded) shade += `<rect x="${colOf(c, N)}" y="${rowOf(c, N)}" width="1" height="1"/>`;
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
    if (typeof vm.tool === 'number' && vm.hoverCell >= 0 && !isBlocking(pz.obj[vm.hoverCell]) && vm.pos.indexOf(vm.hoverCell) < 0) {
      const who = this.cast[vm.tool];
      if (who) {
        const x = colOf(vm.hoverCell, N), y = rowOf(vm.hoverCell, N);
        const art = who.victim ? chalkSvg('') : pawnSvg(who.hue, who.accessory, who.initial, '');
        pawns += `<g opacity="0.4"><svg x="${x + 0.05}" y="${y + 0.02}" width="0.9" height="0.94">${art}</svg></g>`;
      }
    }
    this.layers.shade.innerHTML = shade;
    this.layers.hl.innerHTML = hl;
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
