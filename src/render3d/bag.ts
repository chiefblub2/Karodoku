// Tracks GPU resources created for one puzzle so they can all be disposed together.

import type { BufferGeometry, Material, Object3D, Texture } from 'three';
import { Mesh } from 'three';

export class Bag {
  private geos = new Set<BufferGeometry>();
  private mats = new Set<Material>();
  private texs = new Set<Texture>();

  geo<T extends BufferGeometry>(g: T): T { this.geos.add(g); return g; }
  mat<T extends Material>(m: T): T {
    this.mats.add(m);
    for (const v of Object.values(m)) if (v && (v as Texture).isTexture) this.texs.add(v as Texture);
    return m;
  }
  tex<T extends Texture>(t: T): T { this.texs.add(t); return t; }

  /** Register everything reachable from an object. */
  track(root: Object3D): void {
    root.traverse((o) => {
      if (o instanceof Mesh) {
        this.geo(o.geometry);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => this.mat(m));
      }
    });
  }

  dispose(): void {
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.texs.forEach((t) => t.dispose());
    this.geos.clear();
    this.mats.clear();
    this.texs.clear();
  }
}
