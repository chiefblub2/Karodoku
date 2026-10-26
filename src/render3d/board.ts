// Static board: beveled wooden base with coordinates, floors per room, low walls, brass plaques.

import {
  BufferAttribute, BufferGeometry, CanvasTexture, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial,
  PlaneGeometry, Shape, SRGBColorSpace,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Puzzle } from '../core/model';
import { colOf, rowOf } from '../core/model';
import type { Strings } from '../i18n';
import type { Bag } from './bag';
import { FLOOR_TEX_CELLS, baseTopCanvas, floorTexture, plaqueCanvas, woodTexture } from './textures';

export const BASE_MARGIN = 0.62;
export const WALL_H = 0.3;
export const WALL_T = 0.12;

/** World position of a cell centre. */
export function cellCenter(c: number, N: number): { x: number; z: number } {
  return { x: colOf(c, N) - N / 2 + 0.5, z: rowOf(c, N) - N / 2 + 0.5 };
}

function roundedRect(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function buildBase(N: number, bag: Bag): Group {
  const g = new Group();
  const W = N + BASE_MARGIN * 2;
  const depth = 0.32, bevel = 0.08;
  const geo = bag.geo(new ExtrudeGeometry(roundedRect(W - bevel * 2, W - bevel * 2, 0.22), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 8,
  }));
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -depth - bevel - 0.012, 0);
  // Top cap UVs are shape coordinates; remap them to 0..1 over the box.
  const uv = geo.getAttribute('uv') as BufferAttribute;
  const pos = geo.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    if (pos.getY(i) > -0.02) uv.setXY(i, pos.getX(i) / W + 0.5, -pos.getZ(i) / W + 0.5);
  }
  const top = new CanvasTexture(baseTopCanvas(N, BASE_MARGIN));
  top.colorSpace = SRGBColorSpace;
  top.anisotropy = 8;
  const topMat = bag.mat(new MeshStandardMaterial({ map: bag.tex(top), roughness: 0.55, metalness: 0.05 }));
  const sideTex = bag.tex(woodTexture('#4a2814', 'base-side'));
  sideTex.repeat.set(0.5, 0.5);
  const sideMat = bag.mat(new MeshStandardMaterial({ map: sideTex, color: '#b08060', roughness: 0.6 }));
  const mesh = new Mesh(geo, [topMat, sideMat]);
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

/** One mesh per room; UVs in world space so patterns continue across cells. */
function buildFloors(pz: Puzzle, bag: Bag): Group {
  const N = pz.size;
  const g = new Group();
  pz.rooms.forEach((room, r) => {
    const cells = pz.room.flatMap((x, c) => (x === r ? [c] : []));
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    // Per-room texture offset so neighbouring rooms of similar wood don't line up.
    const off = (r * 0.37) % 1;
    cells.forEach((c, i) => {
      const { x, z } = cellCenter(c, N);
      const quad = [[x - 0.5, z - 0.5], [x + 0.5, z - 0.5], [x + 0.5, z + 0.5], [x - 0.5, z + 0.5]];
      for (const [qx, qz] of quad) {
        pos.push(qx, 0, qz);
        uv.push(qx / FLOOR_TEX_CELLS + off, -qz / FLOOR_TEX_CELLS + off);
      }
      const b = i * 4;
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    });
    const geo = bag.geo(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const type = room.type;
    const glossy = type === 'hall' || type === 'kitchen' || type === 'bathroom';
    const mat = bag.mat(new MeshStandardMaterial({
      map: bag.tex(floorTexture(type)),
      roughness: glossy ? 0.32 : type === 'bedroom' || type === 'guest' ? 0.95 : 0.7,
      metalness: 0,
    }));
    const mesh = new Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.userData.room = r;
    g.add(mesh);
  });
  return g;
}

interface Run { horizontal: boolean; line: number; from: number; to: number }

export function wallRuns(pz: Puzzle): Run[] {
  const N = pz.size, runs: Run[] = [];
  for (const horizontal of [true, false]) {
    for (let line = 0; line <= N; line++) {
      let start = -1;
      for (let k = 0; k <= N; k++) {
        let wall = false;
        if (k < N) {
          if (line === 0 || line === N) wall = true;
          else {
            const a = horizontal ? (line - 1) * N + k : k * N + line - 1;
            const b = horizontal ? line * N + k : k * N + line;
            wall = pz.room[a] !== pz.room[b];
          }
        }
        if (wall && start < 0) start = k;
        if (!wall && start >= 0) { runs.push({ horizontal, line, from: start, to: k }); start = -1; }
      }
    }
  }
  return runs;
}

function buildWalls(pz: Puzzle, bag: Bag): Group {
  const N = pz.size;
  const bodies: BufferGeometry[] = [], caps: BufferGeometry[] = [];
  for (const run of wallRuns(pz)) {
    const outer = run.line === 0 || run.line === N;
    const t = outer ? WALL_T * 1.25 : WALL_T;
    const len = run.to - run.from + t;
    // Vertical runs sit a hair lower so overlapping corners never z-fight.
    const h = run.horizontal ? WALL_H : WALL_H - 0.004;
    const mid = (run.from + run.to) / 2 - N / 2;
    const at = run.line - N / 2;
    const body = new RoundedBoxGeometry(run.horizontal ? len : t, h - 0.05, run.horizontal ? t : len, 2, 0.02);
    const cap = new RoundedBoxGeometry(run.horizontal ? len + 0.02 : t + 0.03, 0.06, run.horizontal ? t + 0.03 : len + 0.02, 2, 0.025);
    const x = run.horizontal ? mid : at, z = run.horizontal ? at : mid;
    body.translate(x, (h - 0.05) / 2, z);
    cap.translate(x, h - 0.03, z);
    bodies.push(body);
    caps.push(cap);
  }
  const g = new Group();
  const bodyGeo = bag.geo(mergeGeometries(bodies));
  const capGeo = bag.geo(mergeGeometries(caps));
  bodies.concat(caps).forEach((x) => x.dispose());
  const plaster = bag.mat(new MeshStandardMaterial({ color: '#efe1c4', roughness: 0.92 }));
  const capTex = bag.tex(woodTexture('#5a3219', 'wallcap'));
  capTex.repeat.set(0.6, 0.6);
  const wood = bag.mat(new MeshStandardMaterial({ map: capTex, color: '#c8a080', roughness: 0.5 }));
  const body = new Mesh(bodyGeo, plaster);
  const cap = new Mesh(capGeo, wood);
  for (const m of [body, cap]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  return g;
}

/** Brass plaque on the floor along the north wall of each room's first cell row. */
function buildPlaques(pz: Puzzle, t: Strings, bag: Bag): Group {
  const N = pz.size;
  const g = new Group();
  const seen = new Set<number>();
  for (let c = 0; c < N * N; c++) {
    const r = pz.room[c];
    if (seen.has(r)) continue;
    seen.add(r);
    let run = 1;
    while (colOf(c, N) + run < N && pz.room[c + run] === r && run < 3) run++;
    const w = Math.min(run, 2.6) - 0.22;
    const h = 0.2;
    const tex = new CanvasTexture(plaqueCanvas(t.rooms[pz.rooms[r].type], w / h));
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = bag.mat(new MeshStandardMaterial({ map: bag.tex(tex), roughness: 0.35, metalness: 0.55, transparent: true }));
    const mesh = new Mesh(bag.geo(new PlaneGeometry(w, h)), mat);
    mesh.rotation.x = -Math.PI / 2;
    const { x, z } = cellCenter(c, N);
    mesh.position.set(x - 0.5 + 0.11 + w / 2, 0.004, z - 0.5 + WALL_T / 2 + h / 2 + 0.02);
    mesh.receiveShadow = true;
    mesh.userData.plaque = r;
    g.add(mesh);
  }
  return g;
}

export interface BoardParts { root: Group; floors: Group; plaques: Group; halfExtent: number }

export function buildBoard(pz: Puzzle, t: Strings, bag: Bag): BoardParts {
  const root = new Group();
  const floors = buildFloors(pz, bag);
  const plaques = buildPlaques(pz, t, bag);
  root.add(buildBase(pz.size, bag), floors, buildWalls(pz, bag), plaques);
  return { root, floors, plaques, halfExtent: pz.size / 2 + BASE_MARGIN };
}
