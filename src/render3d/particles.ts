// Tiny one-shot particle bursts (dust puffs). Each burst owns its geometry/material and
// disposes them when it finishes.

import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, NormalBlending, Points, PointsMaterial } from 'three';
import type { Object3D, Texture } from 'three';
import type { Loop } from './loop';

let puffTex: Texture | null = null;
function puffTexture(): Texture {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  puffTex = new CanvasTexture(c);
  return puffTex;
}

export interface BurstOptions {
  count?: number;
  color?: string;
  size?: number;
  speed?: number;
  rise?: number;
  duration?: number;
  glow?: boolean;
}

/** A ring of soft puffs that drift outwards and up, then fade. */
export function burst(parent: Object3D, loop: Loop, x: number, y: number, z: number, o: BurstOptions = {}): void {
  const n = o.count ?? 14, dur = o.duration ?? 0.55, speed = o.speed ?? 0.55, rise = o.rise ?? 0.18;
  const pos = new Float32Array(n * 3);
  const vel: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const v = speed * (0.6 + Math.random() * 0.6);
    vel.push(Math.cos(a) * v, rise * (0.5 + Math.random()), Math.sin(a) * v);
    pos.set([x + Math.cos(a) * 0.12, y + 0.03, z + Math.sin(a) * 0.12], i * 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  const mat = new PointsMaterial({
    map: puffTexture(), color: o.color ?? '#e8dcc2', size: o.size ?? 0.16, sizeAttenuation: true,
    transparent: true, depthWrite: false, opacity: 0.8, blending: o.glow ? AdditiveBlending : NormalBlending,
  });
  const pts = new Points(geo, mat);
  pts.renderOrder = 4;
  parent.add(pts);
  let t = 0;
  loop.add((dt) => {
    t += dt;
    const k = Math.min(1, t / dur);
    const attr = geo.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < n; i++) {
      const damp = 1 - k * 0.7;
      attr.setXYZ(i, attr.getX(i) + vel[i * 3] * dt * damp, attr.getY(i) + vel[i * 3 + 1] * dt * damp, attr.getZ(i) + vel[i * 3 + 2] * dt * damp);
    }
    attr.needsUpdate = true;
    mat.opacity = 0.8 * (1 - k) ** 1.5;
    mat.size = (o.size ?? 0.16) * (1 + k * 1.2);
    if (k >= 1) {
      pts.removeFromParent();
      geo.dispose();
      mat.dispose();
      return false;
    }
    return true;
  });
}
