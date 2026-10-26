// Procedural canvas textures, cached per key. Everything is painted in code.

import { CanvasTexture, ClampToEdgeWrapping, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Texture } from 'three';
import type { RoomType } from '../core/model';
import { makeRng } from '../core/rng';
import type { Rng } from '../core/rng';

type Ctx = CanvasRenderingContext2D;

const canvasCache = new Map<string, HTMLCanvasElement>();
let maxAnisotropy = 4;
export function setMaxAnisotropy(n: number): void { maxAnisotropy = n; }

function canvas(w: number, h = w): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Get (or paint once) a cached canvas. */
function cached(key: string, paint: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = canvasCache.get(key);
  if (!c) canvasCache.set(key, (c = paint()));
  return c;
}

/** A fresh GPU texture for a cached canvas (textures are disposed per puzzle, canvases stay). */
export function texture(key: string, paint: () => HTMLCanvasElement, opts: { repeat?: boolean; srgb?: boolean } = {}): Texture {
  const t = new CanvasTexture(cached(key, paint));
  t.wrapS = t.wrapT = opts.repeat ? RepeatWrapping : ClampToEdgeWrapping;
  if (opts.srgb !== false) t.colorSpace = SRGBColorSpace;
  t.anisotropy = maxAnisotropy;
  t.minFilter = LinearMipmapLinearFilter;
  return t;
}

// ---------- noise helpers ----------

function valueNoise(rng: Rng, size: number): (x: number, y: number) => number {
  const g = new Float32Array(size * size).map(() => rng.next());
  const at = (x: number, y: number) => g[((y % size) + size) % size * size + (((x % size) + size) % size)];
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Paint a wood-grain fill into a rect (grain runs along x when horizontal). */
function woodRect(ctx: Ctx, x: number, y: number, w: number, h: number, base: string, rng: Rng, horizontal = true, contrast = 1): void {
  const [r, g, b] = hexToRgb(base);
  const shade = (rng.next() - 0.5) * 26 * contrast;
  ctx.fillStyle = `rgb(${r + shade},${g + shade * 0.8},${b + shade * 0.6})`;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const len = horizontal ? w : h, across = horizontal ? h : w;
  const lines = Math.max(3, Math.round(across / 2.2));
  for (let i = 0; i < lines; i++) {
    const off = (i + rng.next() * 0.6) * (across / lines);
    const dark = rng.next() < 0.5;
    ctx.strokeStyle = dark ? `rgba(40,20,5,${0.10 + rng.next() * 0.14 * contrast})` : `rgba(255,230,190,${0.05 + rng.next() * 0.07 * contrast})`;
    ctx.lineWidth = 0.6 + rng.next() * 1.4;
    ctx.beginPath();
    const amp = 0.6 + rng.next() * 1.6, freq = 0.01 + rng.next() * 0.03, ph = rng.next() * 6;
    for (let s = 0; s <= len; s += 4) {
      const d = off + Math.sin(s * freq + ph) * amp;
      if (horizontal) { if (s === 0) ctx.moveTo(x + s, y + d); else ctx.lineTo(x + s, y + d); }
      else { if (s === 0) ctx.moveTo(x + d, y + s); else ctx.lineTo(x + d, y + s); }
    }
    ctx.stroke();
  }
  // Occasional knot.
  if (rng.next() < 0.25) {
    const kx = x + rng.next() * w, ky = y + rng.next() * h;
    const grd = ctx.createRadialGradient(kx, ky, 0, kx, ky, Math.min(w, h) * 0.3);
    grd.addColorStop(0, 'rgba(50,25,8,.45)');
    grd.addColorStop(1, 'rgba(50,25,8,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function bevelEdges(ctx: Ctx, x: number, y: number, w: number, h: number, a = 0.35): void {
  ctx.strokeStyle = `rgba(20,8,0,${a})`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  ctx.strokeStyle = `rgba(255,235,200,${a * 0.35})`;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h - 2); ctx.lineTo(x + 2, y + 2); ctx.lineTo(x + w - 2, y + 2);
  ctx.stroke();
}

function speckle(ctx: Ctx, size: number, rng: Rng, n: number, color: string, maxR = 1.2): void {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(rng.next() * size, rng.next() * size, 0.3 + rng.next() * maxR, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Soft felt fuzz: many faint short strokes. */
function felt(ctx: Ctx, size: number, rng: Rng, light: string, dark: string, n = 9000): void {
  for (let i = 0; i < n; i++) {
    ctx.strokeStyle = rng.next() < 0.5 ? light : dark;
    ctx.lineWidth = 0.7;
    const x = rng.next() * size, y = rng.next() * size, a = rng.next() * Math.PI, l = 1 + rng.next() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

// ---------- floors (each texture spans 2×2 cells) ----------

export const FLOOR_TEX_CELLS = 2;
const FS = 512;

function herringbone(base: string, seed: string, P = 32): HTMLCanvasElement {
  // Staircases of a horizontal (2P×P) and a vertical (P×2P) plank; bands repeat every (−2P, 2P).
  // The lattice contains (4P, 0) and (0, 4P), so the texture tiles when 4P divides its size.
  const [c, ctx] = canvas(FS);
  const span = Math.ceil(FS / P) + 4;
  for (let b = -span; b <= span; b++) {
    for (let k = -span; k <= span * 2; k++) {
      const x0 = k * P - 2 * b * P, y0 = k * P + 2 * b * P;
      if (x0 > FS + 2 * P || y0 > FS + 2 * P || x0 < -4 * P || y0 < -4 * P) continue;
      // Seed each plank by its wrapped position so planks crossing the seam match their twin.
      const key = `${seed}:${mod(x0, FS)}:${mod(y0, FS)}`;
      woodRect(ctx, x0, y0, 2 * P, P, base, makeRng(key + 'h'), true);
      bevelEdges(ctx, x0, y0, 2 * P, P);
      woodRect(ctx, x0 + 2 * P, y0 - P, P, 2 * P, base, makeRng(key + 'v'), false);
      bevelEdges(ctx, x0 + 2 * P, y0 - P, P, 2 * P);
    }
  }
  return c;
}

function planks(base: string, seed: string, rows = 6, contrast = 1): HTMLCanvasElement {
  const [c, ctx] = canvas(FS);
  const rng = makeRng(seed);
  const h = FS / rows;
  for (let r = 0; r < rows; r++) {
    // Widths that sum to exactly FS, starting at a random offset; planks are drawn cyclically.
    const widths: number[] = [];
    let total = 0;
    while (total < FS) {
      let w = FS * (0.35 + rng.next() * 0.45);
      if (FS - total - w < FS * 0.15) w = FS - total;
      widths.push(w);
      total += w;
    }
    let x = rng.next() * FS;
    for (const w of widths) {
      const key = `${seed}:${r}:${Math.round(x)}`;
      for (const px of [x, x - FS]) {
        if (px + w <= 0 || px >= FS) continue;
        woodRect(ctx, px, r * h, w, h, base, makeRng(key), true, contrast);
        bevelEdges(ctx, px, r * h, w, h, 0.4);
      }
      x = (x + w) % FS;
    }
  }
  return c;
}

function basketWeave(a: string, b: string, seed: string): HTMLCanvasElement {
  const [c, ctx] = canvas(FS);
  const rng = makeRng(seed);
  const B = FS / 4; // 2 blocks per cell
  for (let by = 0; by < 4; by++) {
    for (let bx = 0; bx < 4; bx++) {
      const horiz = (bx + by) % 2 === 0;
      for (let k = 0; k < 3; k++) {
        const base = k === 1 ? b : a;
        if (horiz) { woodRect(ctx, bx * B, by * B + (k * B) / 3, B, B / 3, base, rng, true); bevelEdges(ctx, bx * B, by * B + (k * B) / 3, B, B / 3, 0.45); }
        else { woodRect(ctx, bx * B + (k * B) / 3, by * B, B / 3, B, base, rng, false); bevelEdges(ctx, bx * B + (k * B) / 3, by * B, B / 3, B, 0.45); }
      }
    }
  }
  return c;
}

function checker(a: string, b: string, perCell: number, seed: string, grout = '#c9bfae'): HTMLCanvasElement {
  const [c, ctx] = canvas(FS);
  const rng = makeRng(seed);
  const n = perCell * FLOOR_TEX_CELLS, t = FS / n;
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, FS, FS);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const col = (x + y) % 2 ? b : a;
      const [r, g, bl] = hexToRgb(col);
      const v = (rng.next() - 0.5) * 10;
      ctx.fillStyle = `rgb(${r + v},${g + v},${bl + v})`;
      const gap = 2.5;
      ctx.beginPath();
      ctx.roundRect(x * t + gap / 2, y * t + gap / 2, t - gap, t - gap, 3);
      ctx.fill();
      // Glaze highlight.
      const grd = ctx.createLinearGradient(x * t, y * t, x * t + t, y * t + t);
      grd.addColorStop(0, 'rgba(255,255,255,.16)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0)');
      grd.addColorStop(1, 'rgba(0,0,0,.10)');
      ctx.fillStyle = grd;
      ctx.fill();
    }
  }
  speckle(ctx, FS, rng, 500, 'rgba(0,0,0,.06)', 0.8);
  return c;
}

function conservatoryTiles(seed: string): HTMLCanvasElement {
  const [c, ctx] = canvas(FS);
  const rng = makeRng(seed);
  ctx.fillStyle = '#efe7cf';
  ctx.fillRect(0, 0, FS, FS);
  const n = 4, t = FS / n;
  // Cream squares with green diamonds at the corners (classic encaustic look).
  for (let y = 0; y <= n; y++) {
    for (let x = 0; x <= n; x++) {
      ctx.fillStyle = '#4e7d45';
      ctx.beginPath();
      const cx = x * t, cy = y * t, d = t * 0.32;
      ctx.moveTo(cx, cy - d); ctx.lineTo(cx + d, cy); ctx.lineTo(cx, cy + d); ctx.lineTo(cx - d, cy); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2f5d3a';
      ctx.beginPath();
      ctx.arc(cx, cy, d * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(80,70,50,.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath(); ctx.moveTo(i * t, 0); ctx.lineTo(i * t, FS); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * t); ctx.lineTo(FS, i * t); ctx.stroke();
  }
  // A few fallen leaves.
  for (let i = 0; i < 5; i++) {
    const x = 30 + rng.next() * (FS - 60), y = 30 + rng.next() * (FS - 60), a = rng.next() * Math.PI * 2, s = 9 + rng.next() * 7;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = rng.next() < 0.5 ? '#6d9b3e' : '#a3842e';
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,50,10,.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s * 1.3, 0); ctx.stroke();
    ctx.restore();
  }
  speckle(ctx, FS, rng, 400, 'rgba(60,50,20,.07)');
  return c;
}

function flagstones(seed: string): HTMLCanvasElement {
  const [c, ctx] = canvas(FS);
  const rng = makeRng(seed);
  ctx.fillStyle = '#3a342e';
  ctx.fillRect(0, 0, FS, FS);
  const noise = valueNoise(rng, 32);
  // Irregular stones on a jittered grid; tiles seamlessly because the grid wraps.
  const n = 5, t = FS / n;
  const jitter = Array.from({ length: (n + 1) * (n + 1) }, () => [(rng.next() - 0.5) * t * 0.35, (rng.next() - 0.5) * t * 0.35]);
  const pt = (i: number, j: number) => {
    const [dx, dy] = jitter[(j % n) * (n + 1) + (i % n)];
    return [i * t + dx, j * t + dy];
  };
  for (let j = -1; j <= n; j++) {
    for (let i = -1; i <= n; i++) {
      const ii = (i + n) % n, jj = (j + n) % n;
      const ox = (i - ii) * t, oy = (j - jj) * t;
      const ps = [pt(ii, jj), pt(ii + 1, jj), pt(ii + 1, jj + 1), pt(ii, jj + 1)];
      const v = 92 + rng.next() * 40;
      ctx.fillStyle = `rgb(${v + 6},${v},${v - 8})`;
      ctx.beginPath();
      ps.forEach(([x, y], k) => {
        const cx = (ps[0][0] + ps[2][0]) / 2, cy = (ps[0][1] + ps[2][1]) / 2;
        const px = x + ox + (cx - x) * 0.05, py = y + oy + (cy - y) * 0.05;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
    }
  }
  const img = ctx.getImageData(0, 0, FS, FS);
  for (let y = 0; y < FS; y++) {
    for (let x = 0; x < FS; x++) {
      const k = (y * FS + x) * 4;
      const nv = (noise(x / 16, y / 16) - 0.5) * 40 + (rng.next() - 0.5) * 14;
      img.data[k] += nv; img.data[k + 1] += nv; img.data[k + 2] += nv;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function marble(seed: string): HTMLCanvasElement {
  const [c, ctx] = canvas(FS);
  const rng = makeRng(seed);
  const noise = valueNoise(rng, 64);
  const img = ctx.createImageData(FS, FS);
  for (let y = 0; y < FS; y++) {
    for (let x = 0; x < FS; x++) {
      let n = 0, amp = 1, f = 1 / 64;
      for (let o = 0; o < 4; o++) { n += noise(x * f, y * f) * amp; amp *= 0.5; f *= 2; }
      const vein = Math.abs(Math.sin((x * 0.012 + y * 0.02 + n * 4) * Math.PI));
      const v = 236 - (1 - vein) ** 6 * 90 - n * 8;
      const k = (y * FS + x) * 4;
      img.data[k] = v; img.data[k + 1] = v - 3; img.data[k + 2] = v - 8; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Large tiles with dark cabochons at the corners.
  const t = FS / 2;
  ctx.strokeStyle = 'rgba(70,60,50,.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * t, 0); ctx.lineTo(i * t, FS); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * t); ctx.lineTo(FS, i * t); ctx.stroke();
  }
  for (let y = 0; y <= 2; y++) {
    for (let x = 0; x <= 2; x++) {
      const d = 26;
      ctx.fillStyle = '#26221e';
      ctx.beginPath();
      ctx.moveTo(x * t, y * t - d); ctx.lineTo(x * t + d, y * t); ctx.lineTo(x * t, y * t + d); ctx.lineTo(x * t - d, y * t); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#b88a3a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  return c;
}

function softWood(base: string, feltLight: string, feltDark: string, seed: string): HTMLCanvasElement {
  const c = planks(base, seed, 4, 0.5);
  const ctx = c.getContext('2d')!;
  felt(ctx, FS, makeRng(seed + 'f'), feltLight, feltDark);
  return c;
}

function billiardFloor(seed: string): HTMLCanvasElement {
  const c = planks('#4a2c19', seed, 8, 1.1);
  const ctx = c.getContext('2d')!;
  // Green inlay stripes along plank rows.
  ctx.fillStyle = '#2c5a3b';
  for (let r = 0; r < 8; r += 4) ctx.fillRect(0, r * (FS / 8) - 3, FS, 6);
  ctx.fillStyle = 'rgba(200,170,90,.55)';
  for (let r = 0; r < 8; r += 4) { ctx.fillRect(0, r * (FS / 8) - 4, FS, 1); ctx.fillRect(0, r * (FS / 8) + 3, FS, 1); }
  return c;
}

export function floorCanvas(type: RoomType): HTMLCanvasElement {
  return cached(`floor:${type}`, () => {
    switch (type) {
      case 'library': return herringbone('#7a3f22', 'lib');
      case 'lounge': return herringbone('#b5793e', 'lounge');
      case 'study': return planks('#9c6a3c', 'study', 5);
      case 'dining': return basketWeave('#4a2a17', '#5d3820', 'dining');
      case 'kitchen': return checker('#efe6d0', '#273241', 2, 'kitchen');
      case 'bathroom': return checker('#f4f6f4', '#6f9cb0', 3, 'bath', '#d5dbd8');
      case 'cellar': return flagstones('cellar');
      case 'conservatory': return conservatoryTiles('cons');
      case 'hall': return marble('hall');
      case 'bedroom': return softWood('#c49a82', 'rgba(255,220,220,.10)', 'rgba(120,60,60,.10)', 'bed');
      case 'guest': return softWood('#a9a37f', 'rgba(230,240,210,.12)', 'rgba(60,70,40,.10)', 'guest');
      case 'billiard': return billiardFloor('billiard');
    }
  });
}

export function floorTexture(type: RoomType): Texture {
  return texture(`floor:${type}`, () => floorCanvas(type), { repeat: true });
}

// ---------- wood for furniture / base ----------

export function woodTexture(base: string, key: string): Texture {
  return texture(`wood:${key}:${base}`, () => planks(base, key, 3, 0.8), { repeat: true });
}

/** Board-game box top: walnut frame with burned-in coordinates, transparent board area. */
export function baseTopCanvas(N: number, margin: number): HTMLCanvasElement {
  return cached(`basetop:${N}:${margin}`, () => {
    const W = N + margin * 2;
    const px = 1024;
    const u = px / W;
    const [c, ctx] = canvas(px);
    const rng = makeRng('base' + N);
    // Concentric frame planks (mitred look).
    const band = margin * u;
    woodRect(ctx, 0, 0, px, band, '#5a3219', rng, true, 1.1);
    woodRect(ctx, 0, px - band, px, band, '#5a3219', rng, true, 1.1);
    woodRect(ctx, 0, 0, band, px, '#55301a', rng, false, 1.1);
    woodRect(ctx, px - band, 0, band, px, '#55301a', rng, false, 1.1);
    ctx.strokeStyle = 'rgba(20,8,0,.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(band, band); ctx.moveTo(px, 0); ctx.lineTo(px - band, band);
    ctx.moveTo(0, px); ctx.lineTo(band, px - band); ctx.moveTo(px, px); ctx.lineTo(px - band, px - band);
    ctx.stroke();
    // Brass inlay line around the board.
    ctx.strokeStyle = '#c69a45';
    ctx.lineWidth = Math.max(2, u * 0.035);
    ctx.strokeRect(band - u * 0.12, band - u * 0.12, N * u + u * 0.24, N * u + u * 0.24);
    // Burned coordinates on all four sides.
    ctx.fillStyle = '#e9d4a8';
    ctx.font = `700 ${Math.round(u * 0.36)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = u * 0.04;
    ctx.shadowOffsetY = u * 0.02;
    for (let i = 0; i < N; i++) {
      const pos = band + (i + 0.5) * u;
      const letter = String.fromCharCode(65 + i);
      ctx.fillText(letter, pos, band * 0.48);
      ctx.fillText(letter, pos, px - band * 0.48);
      ctx.fillText(String(i + 1), band * 0.5, pos);
      ctx.fillText(String(i + 1), px - band * 0.5, pos);
    }
    return c;
  });
}

// ---------- decals ----------

export function markCanvas(): HTMLCanvasElement {
  return cached('mark', () => {
    const [c, ctx] = canvas(128);
    const rng = makeRng('mark');
    ctx.lineCap = 'round';
    // Two painted brush strokes.
    for (const [x1, y1, x2, y2] of [[26, 24, 102, 104], [102, 26, 26, 102]]) {
      for (let k = 0; k < 6; k++) {
        ctx.strokeStyle = `rgba(${170 + rng.next() * 30},${28 + rng.next() * 12},${22},${0.55 + rng.next() * 0.3})`;
        ctx.lineWidth = 10 - k * 1.2;
        ctx.beginPath();
        ctx.moveTo(x1 + (rng.next() - 0.5) * 5, y1 + (rng.next() - 0.5) * 5);
        ctx.quadraticCurveTo(64 + (rng.next() - 0.5) * 10, 64 + (rng.next() - 0.5) * 10, x2 + (rng.next() - 0.5) * 5, y2 + (rng.next() - 0.5) * 5);
        ctx.stroke();
      }
    }
    return c;
  });
}

export function ringCanvas(): HTMLCanvasElement {
  return cached('ring', () => {
    const [c, ctx] = canvas(128);
    const g = ctx.createRadialGradient(64, 64, 34, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return c;
  });
}

export function softSquareCanvas(): HTMLCanvasElement {
  return cached('softsquare', () => {
    const [c, ctx] = canvas(128);
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 7;
    ctx.shadowColor = 'white';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(12, 12, 104, 104, 16);
    ctx.stroke();
    return c;
  });
}

/** Chalk body outline (white on transparent). */
export function chalkCanvas(): HTMLCanvasElement {
  return cached('chalk', () => {
    const [c, ctx] = canvas(256);
    const rng = makeRng('chalk');
    const path = (draw: () => void) => {
      for (let k = 0; k < 4; k++) {
        ctx.save();
        ctx.translate((rng.next() - 0.5) * 2.5, (rng.next() - 0.5) * 2.5);
        ctx.strokeStyle = `rgba(255,255,255,${0.35 + rng.next() * 0.35})`;
        ctx.lineWidth = 3 + rng.next() * 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        draw();
        ctx.stroke();
        ctx.restore();
      }
    };
    // Sprawled figure, head at top-left.
    path(() => ctx.arc(92, 52, 22, 0, Math.PI * 2));
    path(() => {
      ctx.moveTo(110, 68); ctx.bezierCurveTo(130, 80, 150, 92, 166, 96); // shoulder → right arm
      ctx.lineTo(214, 70); ctx.lineTo(222, 82); ctx.lineTo(172, 112);
      ctx.bezierCurveTo(168, 140, 162, 160, 166, 176); // right side → hip
      ctx.lineTo(214, 220); ctx.lineTo(204, 232); ctx.lineTo(150, 190); // right leg
      ctx.lineTo(118, 236); ctx.lineTo(104, 228); ctx.lineTo(126, 176); // left leg
      ctx.bezierCurveTo(112, 150, 98, 124, 84, 110); // left side
      ctx.lineTo(36, 132); ctx.lineTo(30, 118); ctx.lineTo(78, 86); // left arm
      ctx.bezierCurveTo(82, 78, 90, 74, 98, 72);
    });
    // Chalk dust.
    speckle(ctx, 256, rng, 260, 'rgba(255,255,255,.16)', 1.4);
    return c;
  });
}

/** Brass plaque with an engraved room name. */
export function plaqueCanvas(text: string, aspect: number): HTMLCanvasElement {
  return cached(`plaque:${text}:${aspect.toFixed(2)}`, () => {
    const h = 64, w = Math.round(h * aspect);
    const [c, ctx] = canvas(w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f1d58c');
    g.addColorStop(0.45, '#c9a04b');
    g.addColorStop(1, '#8f6a26');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(1, 1, w - 2, h - 2, 10);
    ctx.fill();
    ctx.strokeStyle = '#6b4c17';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#5a3d0e';
    for (const x of [10, w - 10]) { ctx.beginPath(); ctx.arc(x, h / 2, 3, 0, Math.PI * 2); ctx.fill(); }
    let size = 40;
    ctx.font = `700 ${size}px Georgia, serif`;
    while (ctx.measureText(text).width > w - 34 && size > 14) { size -= 2; ctx.font = `700 ${size}px Georgia, serif`; }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,240,200,.6)';
    ctx.fillText(text, w / 2, h / 2 + 2);
    ctx.fillStyle = '#3d2706';
    ctx.fillText(text, w / 2, h / 2);
    return c;
  });
}

/** Round badge with a suspect's initial (for the pawn base). */
export function badgeCanvas(initial: string, hue: number): HTMLCanvasElement {
  return cached(`badge:${initial}:${hue}`, () => {
    const [c, ctx] = canvas(128);
    ctx.fillStyle = '#f6ecd6';
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `hsl(${hue} 50% 28%)`;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = `hsl(${hue} 55% 26%)`;
    ctx.font = '800 82px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, 64, 70);
    return c;
  });
}

/** Evidence marker number plate. */
export function evidenceCanvas(): HTMLCanvasElement {
  return cached('evidence', () => {
    const [c, ctx] = canvas(128);
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#1b1b1b';
    ctx.font = '900 92px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', 64, 70);
    return c;
  });
}

/** Book spines for the bookcase: a strip of coloured spines. */
export function spinesCanvas(seed: string): HTMLCanvasElement {
  return cached(`spines:${seed}`, () => {
    const [c, ctx] = canvas(256, 64);
    const rng = makeRng(seed);
    const colours = ['#8e2a24', '#2f5d3a', '#c99a3e', '#2b4a7a', '#6d3a62', '#e8dcc2', '#5a3219', '#a3271c'];
    let x = 0;
    while (x < 256) {
      const w = 10 + rng.next() * 14, h = 40 + rng.next() * 24;
      ctx.fillStyle = rng.pick(colours);
      ctx.fillRect(x, 64 - h, w - 1.5, h);
      ctx.fillStyle = 'rgba(255,230,160,.6)';
      ctx.fillRect(x + 2, 64 - h + 6, w - 5.5, 2);
      ctx.fillRect(x + 2, 64 - 8, w - 5.5, 2);
      x += w;
    }
    return c;
  });
}

export function feltTexture(color: string, key: string): Texture {
  return texture(`felt:${key}`, () => {
    const [c, ctx] = canvas(128);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 128);
    felt(ctx, 128, makeRng(key), 'rgba(255,255,255,.08)', 'rgba(0,0,0,.10)', 2500);
    return c;
  }, { repeat: true });
}

export function rugCanvas(seed: string): HTMLCanvasElement {
  return cached(`rug:${seed}`, () => {
    const [c, ctx] = canvas(256, 192);
    const rng = makeRng(seed);
    const palettes = [['#8e2a24', '#e2b25c', '#2f5d3a', '#f3e6c8'], ['#2b4a7a', '#e2b25c', '#8e2a24', '#efe2c4'], ['#2f5d3a', '#d8a54a', '#7a2a2a', '#efe2c4']];
    const [field, border, accent, light] = rng.pick(palettes);
    ctx.fillStyle = border;
    ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = field;
    ctx.fillRect(14, 14, 228, 164);
    ctx.strokeStyle = light;
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 22, 212, 148);
    // Central medallion.
    ctx.fillStyle = border;
    ctx.beginPath(); ctx.moveTo(128, 46); ctx.lineTo(186, 96); ctx.lineTo(128, 146); ctx.lineTo(70, 96); ctx.closePath(); ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.moveTo(128, 64); ctx.lineTo(166, 96); ctx.lineTo(128, 128); ctx.lineTo(90, 96); ctx.closePath(); ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.arc(128, 96, 9, 0, Math.PI * 2); ctx.fill();
    // Corner motifs.
    for (const [x, y] of [[40, 40], [216, 40], [40, 152], [216, 152]]) {
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
    }
    felt(ctx, 256, rng, 'rgba(255,255,255,.07)', 'rgba(0,0,0,.08)', 3000);
    return c;
  });
}
