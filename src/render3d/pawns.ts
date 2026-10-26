// Turned wooden pawns with one unique accessory each, the victim's chalk outline, ring decals.

import {
  CanvasTexture, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Group, LatheGeometry, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector2,
  AdditiveBlending, BoxGeometry, Object3D,
} from 'three';
import type { Material } from 'three';
import type { Accessory } from '../core/model';
import type { CastEntry } from '../ui/view';
import type { Bag } from './bag';
import { badgeCanvas, chalkCanvas, evidenceCanvas, ringCanvas } from './textures';

export const PAWN_HEIGHT = 0.62;

function std(bag: Bag, o: ConstructorParameters<typeof MeshStandardMaterial>[0]): MeshStandardMaterial {
  return bag.mat(new MeshStandardMaterial(o));
}

function mesh(geo: Mesh['geometry'], mat: Material, x = 0, y = 0, z = 0, cast = true): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

/** Lathe profile of the pawn body (base, skirt, waist, collar). */
const BODY_PROFILE = [
  [0, 0], [0.25, 0], [0.27, 0.02], [0.27, 0.05], [0.24, 0.07], [0.2, 0.09], [0.17, 0.14], [0.13, 0.24], [0.105, 0.33],
  [0.095, 0.38], [0.15, 0.4], [0.155, 0.415], [0.12, 0.43], [0.08, 0.44], [0, 0.44],
].map(([x, y]) => new Vector2(x, y));
const HEAD_Y = 0.52, HEAD_R = 0.11;

export class PawnFactory {
  private body: LatheGeometry;
  private head: SphereGeometry;
  constructor(private bag: Bag) {
    this.body = bag.geo(new LatheGeometry(BODY_PROFILE, 32));
    this.head = bag.geo(new SphereGeometry(HEAD_R, 24, 16));
  }

  pawn(c: CastEntry): Group {
    const bag = this.bag;
    const g = new Group();
    g.name = `pawn-${c.index}`;
    const paint = std(bag, { color: new Color().setHSL(c.hue / 360, 0.55, 0.42), roughness: 0.42, metalness: 0.02 });
    const inner = new Group(); // animated (hop/squash/wobble) separately from the placement transform
    inner.name = 'inner';
    g.add(inner);
    inner.add(mesh(this.body, paint), mesh(this.head, paint, 0, HEAD_Y, 0));
    // Initial badge on the sloped front, tilted up towards the camera.
    const badgeTex = new CanvasTexture(badgeCanvas(c.initial, c.hue));
    badgeTex.colorSpace = SRGBColorSpace;
    const badge = mesh(bag.geo(new CircleGeometry(0.075, 24)), std(bag, { map: bag.tex(badgeTex), roughness: 0.6 }), 0, 0.2, 0.162, false);
    badge.rotation.x = -0.42;
    inner.add(badge);
    if (c.accessory) inner.add(this.accessory(c.accessory));
    return g;
  }

  private accessory(a: Accessory): Object3D {
    const bag = this.bag;
    const g = new Group();
    const y = HEAD_Y;
    switch (a) {
      case 'bun': {
        const hair = std(bag, { color: '#4a2c17', roughness: 0.8 });
        const cap = mesh(bag.geo(new SphereGeometry(HEAD_R * 1.06, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)), hair, 0, y, -0.005);
        cap.rotation.x = -0.25;
        g.add(cap, mesh(bag.geo(new SphereGeometry(0.06, 16, 12)), hair, 0, y + 0.1, -0.05));
        break;
      }
      case 'tophat': {
        const black = std(bag, { color: '#1c1a1a', roughness: 0.45 });
        const band = std(bag, { color: '#a3271c', roughness: 0.6 });
        g.add(
          mesh(bag.geo(new CylinderGeometry(0.17, 0.17, 0.015, 28)), black, 0, y + 0.075, 0),
          mesh(bag.geo(new CylinderGeometry(0.09, 0.085, 0.17, 24)), black, 0, y + 0.165, 0),
          mesh(bag.geo(new CylinderGeometry(0.091, 0.091, 0.03, 24)), band, 0, y + 0.1, 0),
        );
        break;
      }
      case 'widehat': {
        const straw = std(bag, { color: '#e6cf9c', roughness: 0.85 });
        const ribbon = std(bag, { color: '#a3271c', roughness: 0.6 });
        g.add(
          mesh(bag.geo(new CylinderGeometry(0.25, 0.26, 0.016, 32)), straw, 0, y + 0.06, 0),
          mesh(bag.geo(new SphereGeometry(0.105, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), straw, 0, y + 0.06, 0),
          mesh(bag.geo(new CylinderGeometry(0.107, 0.107, 0.03, 20)), ribbon, 0, y + 0.08, 0),
        );
        break;
      }
      case 'glasses': {
        const brass = std(bag, { color: '#d4a645', roughness: 0.25, metalness: 0.9 });
        const ring = bag.geo(new TorusGeometry(0.045, 0.011, 8, 20));
        const l = mesh(ring, brass, -0.05, y + 0.01, HEAD_R - 0.005), r = mesh(ring, brass, 0.05, y + 0.01, HEAD_R - 0.005);
        l.rotation.x = r.rotation.x = -0.35;
        const bridge = mesh(bag.geo(new BoxGeometry(0.03, 0.01, 0.01)), brass, 0, y + 0.02, HEAD_R + 0.005);
        // A neat side parting so the head reads from above too.
        const hair = std(bag, { color: '#d9d2c3', roughness: 0.8 });
        const cap = mesh(bag.geo(new SphereGeometry(HEAD_R * 1.05, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42)), hair, 0, y, -0.01);
        g.add(l, r, bridge, cap);
        break;
      }
      case 'flatcap': {
        const tweed = std(bag, { color: '#6b5a45', roughness: 0.95 });
        const crown = mesh(bag.geo(new SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), tweed, 0, y + 0.03, -0.01);
        crown.scale.set(1, 0.55, 1.1);
        const visor = mesh(bag.geo(new CylinderGeometry(0.1, 0.1, 0.014, 20, 1, false, -Math.PI / 2, Math.PI)), tweed, 0, y + 0.04, 0.07);
        visor.scale.set(1.1, 1, 0.9);
        visor.rotation.x = 0.15;
        g.add(crown, visor);
        break;
      }
      case 'pearls': {
        const pearl = std(bag, { color: '#fffaf0', roughness: 0.2, metalness: 0.1 });
        const geo = bag.geo(new SphereGeometry(0.024, 10, 8));
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          g.add(mesh(geo, pearl, Math.cos(a) * 0.145, 0.415 + Math.sin(a) * 0.01, Math.sin(a) * 0.145, false));
        }
        const hair = std(bag, { color: '#b8862e', roughness: 0.7 });
        const cap = mesh(bag.geo(new SphereGeometry(HEAD_R * 1.06, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6)), hair, 0, y, -0.01);
        g.add(cap);
        break;
      }
      case 'toque': {
        const white = std(bag, { color: '#fffdf6', roughness: 0.75 });
        g.add(mesh(bag.geo(new CylinderGeometry(0.1, 0.105, 0.09, 24)), white, 0, y + 0.1, 0));
        const puff = bag.geo(new SphereGeometry(0.075, 14, 10));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          g.add(mesh(puff, white, Math.cos(a) * 0.065, y + 0.19, Math.sin(a) * 0.065));
        }
        g.add(mesh(puff, white, 0, y + 0.22, 0));
        break;
      }
      case 'feather': {
        const band = std(bag, { color: '#2f5d3a', roughness: 0.6 });
        const red = std(bag, { color: '#c0281c', roughness: 0.55, side: DoubleSide });
        g.add(mesh(bag.geo(new TorusGeometry(HEAD_R * 0.98, 0.018, 8, 28)), band, 0, y + 0.03, 0));
        const f = mesh(bag.geo((() => { const s = new SphereGeometry(0.06, 12, 8); s.scale(0.45, 2.6, 0.12); return s; })()), red, 0.06, y + 0.2, -0.04);
        f.rotation.z = -0.5;
        f.rotation.x = -0.25;
        g.add(f);
        break;
      }
    }
    for (const m of g.children) if (m instanceof Mesh) m.castShadow = true;
    return g;
  }

  /** The victim: chalk outline decal and a yellow evidence marker. */
  victim(): Group {
    const bag = this.bag;
    const g = new Group();
    g.name = 'victim';
    const inner = new Group();
    inner.name = 'inner';
    g.add(inner);
    const chalkTex = new CanvasTexture(chalkCanvas());
    chalkTex.colorSpace = SRGBColorSpace;
    const outline = new Mesh(bag.geo(new PlaneGeometry(0.92, 0.92)), bag.mat(new MeshBasicMaterial({ map: bag.tex(chalkTex), transparent: true, depthWrite: false, opacity: 0.95 })));
    outline.rotation.x = -Math.PI / 2;
    outline.position.y = 0.006;
    outline.name = 'chalk';
    inner.add(outline);
    // Evidence tent marker in the corner.
    const evTex = new CanvasTexture(evidenceCanvas());
    evTex.colorSpace = SRGBColorSpace;
    const yellow = std(bag, { color: '#f2c230', roughness: 0.5 });
    const cone = mesh(bag.geo(new ConeGeometry(0.07, 0.15, 4)), yellow, 0.33, 0.075, 0.3);
    cone.rotation.y = Math.PI / 4;
    const plate = mesh(bag.geo(new PlaneGeometry(0.07, 0.07)), std(bag, { map: bag.tex(evTex), roughness: 0.5 }), 0.33, 0.07, 0.355, false);
    plate.rotation.x = -0.45;
    inner.add(cone, plate);
    return g;
  }
}

/** Flat glowing ring decal used under pawns (conflict, wrong, highlight). */
export function ringDecal(bag: Bag, color: string, size = 0.82): Mesh {
  const tex = bag.tex(new CanvasTexture(ringCanvas()));
  const m = new Mesh(bag.geo(new PlaneGeometry(size, size)), bag.mat(new MeshBasicMaterial({
    map: tex, color, transparent: true, depthWrite: false, blending: AdditiveBlending,
  })));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}

/** Brass ring and a small padlock for hint-locked pawns. */
export function lockDecor(bag: Bag): Group {
  const g = new Group();
  const brass = std(bag, { color: '#d0a040', roughness: 0.28, metalness: 0.9 });
  const ring = mesh(bag.geo(new TorusGeometry(0.29, 0.018, 8, 40)), brass, 0, 0.02, 0);
  ring.rotation.x = Math.PI / 2;
  const body = mesh(bag.geo(new BoxGeometry(0.08, 0.065, 0.035)), brass, 0.25, 0.08, 0.2);
  const shackle = mesh(bag.geo(new TorusGeometry(0.026, 0.008, 6, 16, Math.PI)), brass, 0.25, 0.112, 0.2);
  g.add(ring, body, shackle);
  return g;
}

/** Semi-transparent copy used as the placement ghost. */
export function ghostOf(src: Group, bag: Bag): Group {
  const g = src.clone(true);
  const mat = bag.mat(new MeshStandardMaterial({ color: '#fff4d8', transparent: true, opacity: 0.38, depthWrite: false, roughness: 0.6 }));
  g.traverse((o) => {
    if (o instanceof Mesh) { o.material = mat; o.castShadow = false; }
  });
  return g;
}

