// Procedural furniture. Every piece is a list of parts (geometry + material + local matrix);
// identical parts across the board are drawn with one InstancedMesh each.
//
// Readability rule: blocking objects (table, plant, shelf) are tall, solid and cast long
// shadows; occupiable ones (chair, bed, rug, tub) are low and open.

import {
  BufferGeometry, Color, CylinderGeometry, DoubleSide, Euler, Group, InstancedMesh, LatheGeometry, Material, Matrix4,
  MeshStandardMaterial, PlaneGeometry, Quaternion, SphereGeometry, TorusGeometry, Vector2, Vector3, CanvasTexture,
  SRGBColorSpace, ConeGeometry, BoxGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ObjectType, Puzzle } from '../core/model';
import { colOf, rowOf } from '../core/model';
import { makeRng } from '../core/rng';
import type { Rng } from '../core/rng';
import type { Bag } from './bag';
import { cellCenter } from './board';
import { rugCanvas, spinesCanvas, woodTexture, feltTexture } from './textures';

/** Height a pawn stands at / a mark floats at, per object. */
export const SURFACE: Record<ObjectType | 'none', number> = {
  none: 0, rug: 0.022, chair: 0.215, bed: 0.255, tub: 0.07, table: 0.56, plant: 0.4, shelf: 0.86,
};
export const surfaceOf = (o: ObjectType | null): number => SURFACE[o ?? 'none'];

interface Part { geo: string; mat: string; m: Matrix4; shadow?: boolean }

const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): Matrix4 =>
  new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz)), new Vector3(sx, sy, sz));

/** Shared geometry/material library for one puzzle. */
class Library {
  geos = new Map<string, BufferGeometry>();
  mats = new Map<string, Material>();
  constructor(private bag: Bag) {}

  geo(key: string, make: () => BufferGeometry): string {
    if (!this.geos.has(key)) this.geos.set(key, this.bag.geo(make()));
    return key;
  }
  mat(key: string, make: () => Material): string {
    if (!this.mats.has(key)) this.mats.set(key, this.bag.mat(make()));
    return key;
  }
}

const std = (o: ConstructorParameters<typeof MeshStandardMaterial>[0]) => new MeshStandardMaterial(o);

function woodMat(lib: Library, bag: Bag, key: string, base: string, tint = '#ffffff', roughness = 0.55): string {
  return lib.mat(`wood:${key}`, () => {
    const t = bag.tex(woodTexture(base, key));
    t.repeat.set(0.5, 0.5);
    return std({ map: t, color: tint, roughness });
  });
}

// ---------- pieces ----------

function chair(lib: Library, bag: Bag): Part[] {
  const wood = woodMat(lib, bag, 'chair', '#8a5530');
  const cushion = lib.mat('cushion', () => std({ map: bag.tex(feltTexture('#8e2a24', 'cushion')), roughness: 0.95 }));
  const seat = lib.geo('chair-seat', () => new RoundedBoxGeometry(0.5, 0.06, 0.48, 2, 0.025));
  const pad = lib.geo('chair-pad', () => new RoundedBoxGeometry(0.42, 0.04, 0.4, 2, 0.02));
  const leg = lib.geo('chair-leg', () => new CylinderGeometry(0.025, 0.02, 0.18, 6));
  const back = lib.geo('chair-back', () => new RoundedBoxGeometry(0.5, 0.3, 0.05, 2, 0.022));
  const rail = lib.geo('chair-rail', () => new CylinderGeometry(0.02, 0.02, 0.24, 6));
  const parts: Part[] = [
    { geo: seat, mat: wood, m: M(0, 0.17, 0.02) },
    { geo: pad, mat: cushion, m: M(0, 0.205, 0.03) },
    { geo: back, mat: wood, m: M(0, 0.38, -0.2, -0.12) },
  ];
  for (const [x, z] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.2], [0.2, 0.2]]) parts.push({ geo: leg, mat: wood, m: M(x, 0.08, z) });
  for (const x of [-0.2, 0.2]) parts.push({ geo: rail, mat: wood, m: M(x, 0.27, -0.21, -0.12) });
  return parts;
}

function bed(lib: Library, bag: Bag, rng: Rng): Part[] {
  const wood = woodMat(lib, bag, 'bed', '#6e3d1f');
  const linen = lib.mat('linen', () => std({ color: '#f3ead8', roughness: 0.9 }));
  const blanketColor = rng.pick(['#7d2420', '#2f5d3a', '#2b4a7a']);
  const blanket = lib.mat(`blanket:${blanketColor}`, () => std({ map: bag.tex(feltTexture(blanketColor, 'blanket' + blanketColor)), roughness: 0.95 }));
  const frame = lib.geo('bed-frame', () => new RoundedBoxGeometry(0.78, 0.14, 0.9, 2, 0.03));
  const head = lib.geo('bed-head', () => new RoundedBoxGeometry(0.8, 0.36, 0.07, 2, 0.03));
  const foot = lib.geo('bed-foot', () => new RoundedBoxGeometry(0.8, 0.2, 0.06, 2, 0.025));
  const mattress = lib.geo('bed-mattress', () => new RoundedBoxGeometry(0.7, 0.09, 0.82, 3, 0.04));
  const pillow = lib.geo('bed-pillow', () => new RoundedBoxGeometry(0.5, 0.07, 0.16, 3, 0.035));
  const cover = lib.geo('bed-cover', () => new RoundedBoxGeometry(0.72, 0.06, 0.46, 3, 0.03));
  const fold = lib.geo('bed-fold', () => new RoundedBoxGeometry(0.72, 0.05, 0.12, 3, 0.025));
  return [
    { geo: frame, mat: wood, m: M(0, 0.1, 0.02) },
    { geo: head, mat: wood, m: M(0, 0.2, -0.43) },
    { geo: foot, mat: wood, m: M(0, 0.12, 0.46) },
    { geo: mattress, mat: linen, m: M(0, 0.21, 0.02) },
    { geo: pillow, mat: linen, m: M(0, 0.27, -0.28) },
    { geo: cover, mat: blanket, m: M(0, 0.25, 0.17) },
    { geo: fold, mat: blanket, m: M(0, 0.29, -0.04) },
  ];
}

function tub(lib: Library, _bag: Bag): Part[] {
  const enamel = lib.mat('enamel', () => std({ color: '#fbf8f0', roughness: 0.25 }));
  const water = lib.mat('water', () => std({ color: '#9fd0dc', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 }));
  const brass = lib.mat('brass', () => std({ color: '#c99a3e', roughness: 0.3, metalness: 0.9 }));
  const shell = lib.geo('tub-shell', () => {
    // Lathe profile of an oval tub, scaled to an oval below.
    const pts = [new Vector2(0, 0), new Vector2(0.24, 0.0), new Vector2(0.29, 0.05), new Vector2(0.31, 0.17), new Vector2(0.33, 0.22),
      new Vector2(0.3, 0.23), new Vector2(0.27, 0.19), new Vector2(0.24, 0.06), new Vector2(0, 0.06)];
    const g = new LatheGeometry(pts, 32);
    g.scale(1, 1, 1.42);
    return g;
  });
  const surface = lib.geo('tub-water', () => { const g = new CylinderGeometry(0.26, 0.26, 0.01, 28); g.scale(1, 1, 1.38); return g; });
  const foot = lib.geo('tub-foot', () => new SphereGeometry(0.04, 10, 8));
  const tap = lib.geo('tub-tap', () => new TorusGeometry(0.05, 0.014, 6, 12, Math.PI));
  const parts: Part[] = [
    { geo: shell, mat: enamel, m: M(0, 0.04, 0) },
    { geo: surface, mat: water, m: M(0, 0.18, 0) },
    { geo: tap, mat: brass, m: M(0, 0.28, -0.42, 0, 0, 0) },
  ];
  for (const [x, z] of [[-0.18, -0.3], [0.18, -0.3], [-0.18, 0.3], [0.18, 0.3]]) parts.push({ geo: foot, mat: brass, m: M(x, 0.035, z) });
  return parts;
}

function rug(lib: Library, bag: Bag, rng: Rng): Part[] {
  const variant = rng.int(0, 2);
  const mat = lib.mat(`rug:${variant}`, () => {
    const t = new CanvasTexture(rugCanvas('rug' + variant));
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return std({ map: bag.tex(t), roughness: 0.98 });
  });
  const fringeMat = lib.mat('fringe', () => std({ color: '#efe2c4', roughness: 1 }));
  const body = lib.geo('rug-body', () => new RoundedBoxGeometry(0.82, 0.022, 0.66, 1, 0.01));
  const fringe = lib.geo('rug-fringe', () => new BoxGeometry(0.012, 0.006, 0.07));
  const parts: Part[] = [{ geo: body, mat, m: M(0, 0.011, 0), shadow: false }];
  for (let i = 0; i < 9; i++) {
    const x = -0.36 + i * 0.09;
    parts.push({ geo: fringe, mat: fringeMat, m: M(x, 0.006, -0.36), shadow: false }, { geo: fringe, mat: fringeMat, m: M(x, 0.006, 0.36), shadow: false });
  }
  return parts;
}

function table(lib: Library, bag: Bag, rng: Rng): Part[] {
  const wood = woodMat(lib, bag, 'table', '#7a4524', '#ffffff', 0.45);
  const top = lib.geo('table-top', () => new RoundedBoxGeometry(0.86, 0.07, 0.74, 3, 0.03));
  const apron = lib.geo('table-apron', () => new RoundedBoxGeometry(0.74, 0.08, 0.62, 2, 0.02));
  const leg = lib.geo('table-leg', () => new LatheGeometry([new Vector2(0, 0), new Vector2(0.035, 0), new Vector2(0.03, 0.12),
    new Vector2(0.045, 0.2), new Vector2(0.03, 0.3), new Vector2(0.04, 0.46), new Vector2(0, 0.46)], 8));
  const parts: Part[] = [
    { geo: top, mat: wood, m: M(0, 0.5, 0) },
    { geo: apron, mat: wood, m: M(0, 0.43, 0) },
  ];
  for (const [x, z] of [[-0.35, -0.28], [0.35, -0.28], [-0.35, 0.28], [0.35, 0.28]]) parts.push({ geo: leg, mat: wood, m: M(x, 0, z) });
  // Something on top.
  const what = rng.pick(['candle', 'candle', 'book', 'teapot']);
  if (what === 'candle') {
    const brass = lib.mat('brass', () => std({ color: '#c99a3e', roughness: 0.3, metalness: 0.9 }));
    const wax = lib.mat('wax', () => std({ color: '#f4ecd8', roughness: 0.7, emissive: new Color('#3a2a10') }));
    const flame = lib.mat('flame', () => std({ color: '#ffd27a', emissive: new Color('#ffae3a'), emissiveIntensity: 2.2, roughness: 1 }));
    parts.push(
      { geo: lib.geo('candle-dish', () => new CylinderGeometry(0.09, 0.1, 0.02, 16)), mat: brass, m: M(0.12, 0.545, 0.06) },
      { geo: lib.geo('candle-wax', () => new CylinderGeometry(0.03, 0.03, 0.16, 10)), mat: wax, m: M(0.12, 0.63, 0.06) },
      { geo: lib.geo('candle-flame', () => { const g = new SphereGeometry(0.025, 8, 6); g.scale(1, 1.8, 1); return g; }), mat: flame, m: M(0.12, 0.735, 0.06), shadow: false },
    );
  } else if (what === 'book') {
    const c1 = lib.mat('book-red', () => std({ color: '#8e2a24', roughness: 0.7 }));
    const c2 = lib.mat('book-green', () => std({ color: '#2f5d3a', roughness: 0.7 }));
    const pages = lib.mat('pages', () => std({ color: '#efe6cf', roughness: 0.9 }));
    const b = lib.geo('book', () => new RoundedBoxGeometry(0.26, 0.05, 0.19, 1, 0.01));
    const p = lib.geo('book-pages', () => new BoxGeometry(0.24, 0.035, 0.18));
    parts.push(
      { geo: b, mat: c1, m: M(-0.1, 0.56, 0.05, 0, 0.3) }, { geo: p, mat: pages, m: M(-0.095, 0.56, 0.05, 0, 0.3) },
      { geo: b, mat: c2, m: M(-0.08, 0.61, 0.04, 0, -0.2) }, { geo: p, mat: pages, m: M(-0.075, 0.61, 0.04, 0, -0.2) },
    );
  } else {
    const china = lib.mat('china', () => std({ color: '#f3f0ea', roughness: 0.25 }));
    const blue = lib.mat('china-blue', () => std({ color: '#2b4a7a', roughness: 0.3 }));
    parts.push(
      { geo: lib.geo('teapot', () => new LatheGeometry([new Vector2(0, 0), new Vector2(0.07, 0), new Vector2(0.1, 0.05), new Vector2(0.09, 0.11),
        new Vector2(0.05, 0.14), new Vector2(0.015, 0.165), new Vector2(0, 0.17)], 18)), mat: china, m: M(0.05, 0.535, 0) },
      { geo: lib.geo('teapot-spout', () => new ConeGeometry(0.02, 0.12, 8)), mat: china, m: M(0.17, 0.62, 0, 0, 0, -0.9) },
      { geo: lib.geo('teapot-band', () => new TorusGeometry(0.098, 0.012, 6, 20)), mat: blue, m: M(0.05, 0.585, 0, Math.PI / 2) },
    );
  }
  return parts;
}

function plant(lib: Library, _bag: Bag, rng: Rng): Part[] {
  const clay = lib.mat('terracotta', () => std({ color: '#b5532e', roughness: 0.85 }));
  const soil = lib.mat('soil', () => std({ color: '#3b2516', roughness: 1 }));
  const leafA = lib.mat('leaf-a', () => std({ color: '#3f7d3a', roughness: 0.6, side: DoubleSide }));
  const leafB = lib.mat('leaf-b', () => std({ color: '#5fa152', roughness: 0.6, side: DoubleSide }));
  const pot = lib.geo('pot', () => new LatheGeometry([new Vector2(0, 0), new Vector2(0.17, 0), new Vector2(0.2, 0.05), new Vector2(0.25, 0.27),
    new Vector2(0.29, 0.29), new Vector2(0.29, 0.33), new Vector2(0.25, 0.33), new Vector2(0.24, 0.3), new Vector2(0, 0.3)], 24));
  const dirt = lib.geo('soil', () => new CylinderGeometry(0.24, 0.24, 0.02, 20));
  const leaf = lib.geo('leaf', () => {
    // A long curved leaf: a sphere flattened and stretched, base at the origin.
    const g = new SphereGeometry(0.1, 10, 6);
    g.scale(0.55, 0.12, 1.7);
    g.translate(0, 0, 0.17);
    return g;
  });
  const parts: Part[] = [
    { geo: pot, mat: clay, m: M(0, 0, 0) },
    { geo: dirt, mat: soil, m: M(0, 0.3, 0) },
  ];
  // Layered rosette: outer leaves droop low, inner leaves stand tall.
  const tiers = [{ n: 7, tilt: -0.25, y: 0.33, s: 1.15 }, { n: 6, tilt: -0.75, y: 0.36, s: 1.0 }, { n: 5, tilt: -1.15, y: 0.4, s: 0.85 }];
  tiers.forEach((tier, ti) => {
    const ph = rng.next() * Math.PI;
    for (let i = 0; i < tier.n; i++) {
      const yaw = ph + (i / tier.n) * Math.PI * 2;
      parts.push({ geo: leaf, mat: ti % 2 ? leafB : leafA, m: M(0, tier.y, 0, tier.tilt, yaw, 0, tier.s) });
    }
  });
  return parts;
}

function shelf(lib: Library, bag: Bag, rng: Rng): Part[] {
  const wood = woodMat(lib, bag, 'shelf', '#4a2814', '#d0a888', 0.5);
  const variant = rng.int(0, 2);
  const spines = lib.mat(`spines:${variant}`, () => {
    const t = new CanvasTexture(spinesCanvas('spines' + variant));
    t.colorSpace = SRGBColorSpace;
    return std({ map: bag.tex(t), roughness: 0.75 });
  });
  const side = lib.geo('shelf-side', () => new RoundedBoxGeometry(0.06, 0.84, 0.36, 2, 0.02));
  const board = lib.geo('shelf-board', () => new RoundedBoxGeometry(0.84, 0.05, 0.36, 2, 0.02));
  const back = lib.geo('shelf-back', () => new BoxGeometry(0.8, 0.8, 0.03));
  const crown = lib.geo('shelf-crown', () => new RoundedBoxGeometry(0.94, 0.06, 0.42, 2, 0.025));
  const books = lib.geo('shelf-books', () => new PlaneGeometry(0.76, 0.2));
  const z = -0.26; // backed against the north side of the cell, books face the camera
  const parts: Part[] = [
    { geo: side, mat: wood, m: M(-0.42, 0.42, z) }, { geo: side, mat: wood, m: M(0.42, 0.42, z) },
    { geo: back, mat: wood, m: M(0, 0.42, z - 0.165) },
    { geo: crown, mat: wood, m: M(0, 0.86, z) },
  ];
  for (const y of [0.03, 0.29, 0.56]) parts.push({ geo: board, mat: wood, m: M(0, y, z) });
  for (const y of [0.16, 0.42, 0.69]) parts.push({ geo: books, mat: spines, m: M(0, y, z + 0.12), shadow: false });
  // Books lying on top (visible from above).
  const red = lib.mat('book-red', () => std({ color: '#8e2a24', roughness: 0.7 }));
  const blue = lib.mat('book-blue', () => std({ color: '#2b4a7a', roughness: 0.7 }));
  const b = lib.geo('book', () => new RoundedBoxGeometry(0.26, 0.05, 0.19, 1, 0.01));
  parts.push({ geo: b, mat: red, m: M(-0.18, 0.915, z, 0, 0.2) }, { geo: b, mat: blue, m: M(0.16, 0.915, z + 0.02, 0, -0.35) });
  return parts;
}

const BUILDERS: Record<ObjectType, (lib: Library, bag: Bag, rng: Rng) => Part[]> = { chair, bed, tub, rug, table, plant, shelf };

// ---------- placement ----------

/** Pick a yaw for a piece: chairs face a neighbouring table, beds put their head against a wall. */
function orientation(pz: Puzzle, c: number, rng: Rng): number {
  const N = pz.size, o = pz.obj[c]!;
  const r = rowOf(c, N), k = colOf(c, N);
  const dirs: [number, number, number][] = [[-1, 0, 0], [0, 1, -Math.PI / 2], [1, 0, Math.PI], [0, -1, Math.PI / 2]]; // north, east, south, west → yaw
  const inside = (rr: number, kk: number) => rr >= 0 && kk >= 0 && rr < N && kk < N;
  const wallTo = (dr: number, dk: number) => !inside(r + dr, k + dk) || pz.room[(r + dr) * N + k + dk] !== pz.room[c];
  if (o === 'chair') {
    // The backrest is on the local −z side; a chair "faces" +z.
    for (const [dr, dk, yaw] of dirs) {
      if (inside(r + dr, k + dk) && pz.obj[(r + dr) * N + k + dk] === 'table' && !wallTo(dr, dk)) return yaw + Math.PI;
    }
    return rng.pick([0, Math.PI / 2, -Math.PI / 2]);
  }
  if (o === 'bed' || o === 'tub') {
    for (const [dr, dk, yaw] of dirs) if (wallTo(dr, dk)) return yaw;
    return 0;
  }
  if (o === 'shelf') {
    // Prefer backing onto a north/east/west wall so the spines face the camera.
    for (const [dr, dk, yaw] of [dirs[0], dirs[1], dirs[3]]) if (wallTo(dr, dk)) return yaw;
    return 0;
  }
  if (o === 'plant') return rng.next() * Math.PI * 2;
  if (o === 'rug') return rng.next() < 0.5 ? 0 : Math.PI / 2;
  return rng.next() < 0.5 ? 0 : Math.PI;
}

export interface FurnitureInstance { mesh: InstancedMesh; index: number; base: Matrix4 }

export interface FurnitureParts {
  root: Group;
  /** Instance handles per cell (for wiggle animations). */
  byCell: Map<number, FurnitureInstance[]>;
  /** World positions of candle flames (for the flickering point lights). */
  candles: Vector3[];
}

export function buildFurniture(pz: Puzzle, bag: Bag): FurnitureParts {
  const N = pz.size;
  const lib = new Library(bag);
  const groups = new Map<string, { geo: string; mat: string; shadow: boolean; items: { cell: number; m: Matrix4 }[] }>();
  const candles: Vector3[] = [];
  for (let c = 0; c < N * N; c++) {
    const o = pz.obj[c];
    if (!o) continue;
    const rng = makeRng(`${pz.seed}:furn:${c}`);
    const parts = BUILDERS[o](lib, bag, rng);
    const { x, z } = cellCenter(c, N);
    const place = M(x, 0, z, 0, orientation(pz, c, rng), 0);
    for (const p of parts) {
      const key = `${p.geo}|${p.mat}`;
      if (!groups.has(key)) groups.set(key, { geo: p.geo, mat: p.mat, shadow: p.shadow ?? true, items: [] });
      const world = place.clone().multiply(p.m);
      groups.get(key)!.items.push({ cell: c, m: world });
      if (p.geo === 'candle-flame') candles.push(new Vector3().setFromMatrixPosition(world));
    }
  }
  const root = new Group();
  const byCell = new Map<number, FurnitureInstance[]>();
  for (const g of groups.values()) {
    const mesh = new InstancedMesh(lib.geos.get(g.geo)!, lib.mats.get(g.mat)!, g.items.length);
    g.items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      if (!byCell.has(it.cell)) byCell.set(it.cell, []);
      byCell.get(it.cell)!.push({ mesh, index: i, base: it.m });
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = g.shadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
  return { root, byCell, candles };
}

/** Render a single furniture piece standalone (for legend thumbnails). */
export function buildPiece(o: ObjectType, bag: Bag, seed = 'legend'): Group {
  const lib = new Library(bag);
  const g = new Group();
  for (const p of BUILDERS[o](lib, bag, makeRng(seed))) {
    const mesh = new InstancedMesh(lib.geos.get(p.geo)!, lib.mats.get(p.mat)!, 1);
    mesh.setMatrixAt(0, p.m);
    mesh.castShadow = true;
    g.add(mesh);
  }
  return g;
}
