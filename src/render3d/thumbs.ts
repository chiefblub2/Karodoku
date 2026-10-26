// Legend icons rendered from the real 3D furniture (once per session, offscreen).

import {
  ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, HemisphereLight, OrthographicCamera, Scene, SRGBColorSpace,
  Vector3, WebGLRenderer,
} from 'three';
import type { ObjectType } from '../core/model';
import { OBJECT_TYPES } from '../core/model';
import { Bag } from './bag';
import { buildPiece } from './furniture';

let cache: Partial<Record<ObjectType, string>> | null = null;

export function furnitureThumbnails(size = 96): Partial<Record<ObjectType, string>> {
  if (cache) return cache;
  const out: Partial<Record<ObjectType, string>> = {};
  let renderer: WebGLRenderer | null = null;
  const bag = new Bag();
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size * 2, size * 2, false);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    for (const o of OBJECT_TYPES) {
      const scene = new Scene();
      scene.add(new AmbientLight('#ffe2bd', 0.9), new HemisphereLight('#c8d4ff', '#6a4a30', 0.7));
      const key = new DirectionalLight('#fff0dc', 1.6);
      key.position.set(-3, 6, 4);
      scene.add(key);
      const piece = buildPiece(o, bag, 'thumb');
      piece.rotation.y = 0.5;
      scene.add(piece);
      const box = new Box3().setFromObject(piece);
      const center = box.getCenter(new Vector3());
      const r = box.getSize(new Vector3()).length() / 2;
      const cam = new OrthographicCamera(-r, r, r, -r, 0.1, 50);
      cam.position.copy(center).add(new Vector3(0, Math.sin(0.75) * 10, Math.cos(0.75) * 10));
      cam.lookAt(center);
      renderer.render(scene, cam);
      out[o] = renderer.domElement.toDataURL('image/png');
    }
  } catch {
    // Keep the SVG icons.
  } finally {
    bag.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  cache = out;
  return out;
}
