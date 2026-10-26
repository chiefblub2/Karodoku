// WebGL board view: a wooden toy dollhouse at night.

import {
  ACESFilmicToneMapping, AmbientLight, CanvasTexture, CatmullRomCurve3, Color, DirectionalLight, Group, HemisphereLight,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PCFSoftShadowMap, Plane, PlaneGeometry,
  PointLight, Quaternion, Raycaster, Scene, SpotLight, SRGBColorSpace, TubeGeometry, Vector2, Vector3, WebGLRenderer,
  AdditiveBlending,
} from 'three';
import type { Puzzle } from '../core/model';
import { isBlocking } from '../core/model';
import { s } from '../i18n';
import { reducedMotion } from '../ui/dom';
import { attachPointer } from '../ui/pointer';
import type { BoardView, CastEntry, Fx, Intent, ViewModel } from '../ui/view';
import { Bag } from './bag';
import { buildBoard, cellCenter } from './board';
import type { BoardParts } from './board';
import { CameraRig } from './camera';
import { buildFurniture, surfaceOf } from './furniture';
import type { FurnitureParts } from './furniture';
import { Loop, ease, tween } from './loop';
import { burst } from './particles';
import { PawnFactory, ghostOf, lockDecor, ringDecal } from './pawns';
import { markCanvas, setMaxAnisotropy, softSquareCanvas } from './textures';

const RING = { conflict: '#ff3b2f', wrong: '#ff3b2f', glow: '#ffcf6a' } as const;

interface PawnState { group: Group; inner: Group; ring: Mesh; lock: Group; cell: number }

export class Board3D implements BoardView {
  readonly kind = '3d' as const;
  onIntent: (i: Intent) => void = () => {};

  private host!: HTMLElement;
  private renderer!: WebGLRenderer;
  private scene = new Scene();
  private rig = new CameraRig();
  private loop!: Loop;
  private resizeObs: ResizeObserver | null = null;
  private detachPointer: (() => void) | null = null;

  // Per-puzzle state
  private bag = new Bag();
  private world = new Group();
  private pz: Puzzle | null = null;
  private cast: CastEntry[] = [];
  private board: BoardParts | null = null;
  private furniture: FurnitureParts | null = null;
  private pawns = new Map<number, PawnState>();
  private ghosts = new Map<number, Group>();
  private ghost: Group | null = null;
  private shade!: InstancedMesh;
  private glow!: InstancedMesh;
  private marks!: InstancedMesh;
  private sel!: Mesh;
  private candles: PointLight[] = [];
  private moon!: DirectionalLight;
  private spot: SpotLight | null = null;
  private vm: ViewModel | null = null;
  private pulse = 0;
  private flickerTimer = 0;
  private flickerUntil = 0;
  private animatingPawns = new Set<number>();
  private markPop = new Map<number, number>();

  // Gestures
  private touches = new Map<number, { x: number; y: number }>();
  private pinch: { dist: number; zoom: number; mid: { x: number; y: number }; pan: { x: number; z: number } } | null = null;
  private dragPan: { x: number; y: number; pan: { x: number; z: number } } | null = null;
  private gestureBusy = false;

  mount(host: HTMLElement): void {
    this.host = host;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    setMaxAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    const canvas = this.renderer.domElement;
    canvas.className = 'board3d';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    host.classList.add('night');

    this.loop = new Loop(() => this.draw());
    this.scene.add(this.world);
    this.setupLights();

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
    this.detachPointer = attachPointer(canvas, {
      pick: (x, y) => this.pick(x, y),
      emit: (i) => { this.wake(); this.onIntent(i); },
      busy: () => this.gestureBusy,
    });
    this.bindGestures(canvas);
    this.resize();
  }

  // ---------- scene setup ----------

  private setupLights(): void {
    const ambient = new AmbientLight('#ffd9a8', 0.5);
    const hemi = new HemisphereLight('#8fa6d8', '#5a3a22', 0.55);
    this.moon = new DirectionalLight('#cfdcff', 1.9);
    this.moon.position.set(-6, 11, -4);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(1024, 1024);
    this.moon.shadow.bias = -0.0006;
    this.moon.shadow.normalBias = 0.02;
    this.moon.shadow.radius = 4;
    // A warm key from the south so the camera-facing sides aren't flat.
    const fill = new DirectionalLight('#ffcc96', 0.55);
    fill.position.set(3, 6, 9);
    this.scene.add(ambient, hemi, this.moon, this.moon.target, fill);
  }

  setPuzzle(pz: Puzzle, cast: CastEntry[]): void {
    this.clearPuzzle();
    this.pz = pz;
    this.cast = cast;
    const N = pz.size;
    const bag = this.bag;

    this.board = buildBoard(pz, s(), bag);
    this.furniture = buildFurniture(pz, bag);
    this.world.add(this.board.root, this.furniture.root);

    // Moon shadow camera tightly around the board.
    const e = this.board.halfExtent + 0.4;
    const sc = this.moon.shadow.camera;
    sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 1; sc.far = 40;
    sc.updateProjectionMatrix();

    // Candle lights on (up to three) table candles.
    for (const p of this.furniture.candles.slice(0, 3)) {
      const l = new PointLight('#ffa64a', 0.8, 3.2, 1.6);
      l.position.copy(p).add(new Vector3(0, 0.3, 0));
      l.userData.base = l.intensity;
      this.candles.push(l);
      this.world.add(l);
    }

    // Overlays.
    const plane = bag.geo(new PlaneGeometry(1, 1));
    plane.rotateX(-Math.PI / 2);
    this.shade = new InstancedMesh(plane, bag.mat(new MeshBasicMaterial({ color: '#0b0603', transparent: true, opacity: 0.24, depthWrite: false })), N * N);
    this.shade.position.y = 0.003;
    this.shade.renderOrder = 1;
    this.glow = new InstancedMesh(plane, bag.mat(new MeshBasicMaterial({ color: '#ffc861', transparent: true, opacity: 0.3, depthWrite: false, blending: AdditiveBlending })), N * N);
    this.glow.position.y = 0.004;
    this.glow.renderOrder = 1;
    const markTex = bag.tex(new CanvasTexture(markCanvas()));
    markTex.colorSpace = SRGBColorSpace;
    this.marks = new InstancedMesh(plane, bag.mat(new MeshBasicMaterial({ map: markTex, transparent: true, depthWrite: false })), N * N);
    this.marks.renderOrder = 3;
    const selTex = bag.tex(new CanvasTexture(softSquareCanvas()));
    this.sel = new Mesh(plane, bag.mat(new MeshBasicMaterial({ map: selTex, color: '#ffe2a0', transparent: true, depthWrite: false, blending: AdditiveBlending })));
    this.sel.position.y = 0.006;
    this.sel.visible = false;
    for (const m of [this.shade, this.glow, this.marks]) { m.count = 0; m.frustumCulled = false; }
    this.world.add(this.shade, this.glow, this.marks, this.sel);

    // Pawns (hidden until placed).
    const factory = new PawnFactory(bag);
    for (const c of cast) {
      const group = c.victim ? factory.victim() : factory.pawn(c);
      const inner = group.getObjectByName('inner') as Group;
      const ring = ringDecal(bag, RING.glow, c.victim ? 1 : 0.84);
      ring.position.y = 0.035;
      ring.visible = false;
      const lock = lockDecor(bag);
      lock.visible = false;
      group.add(ring, lock);
      group.visible = false;
      this.world.add(group);
      this.pawns.set(c.index, { group, inner, ring, lock, cell: -1 });
      if (!c.victim) this.ghosts.set(c.index, ghostOf(group, bag));
      else this.ghosts.set(c.index, (() => { const g = factory.victim(); g.traverse((o) => { if (o instanceof Mesh) { (o.material as MeshBasicMaterial).transparent = true; (o.material as MeshBasicMaterial).opacity = 0.35; } }); return g; })());
    }
    for (const g of this.ghosts.values()) {
      g.visible = false;
      g.traverse((o) => { if (o instanceof Mesh) o.castShadow = false; });
      this.world.add(g);
    }
    this.bag.track(this.world);

    this.rig.setBoard(this.board.halfExtent);
    this.resize();
    this.startFlicker();
    this.loop.invalidate();
  }

  private clearPuzzle(): void {
    this.spot?.removeFromParent();
    this.spot?.dispose();
    this.spot = null;
    for (const l of this.candles) { l.removeFromParent(); l.dispose(); }
    this.candles = [];
    this.world.clear();
    this.pawns.clear();
    this.ghosts.clear();
    this.ghost = null;
    this.animatingPawns.clear();
    this.bag.dispose();
    this.bag = new Bag();
    this.vm = null;
    this.rig.blend = 0;
    this.rig.yaw = 0;
  }

  // ---------- state → scene ----------

  update(vm: ViewModel): void {
    if (!this.pz) return;
    this.vm = vm;
    const pz = this.pz, N = pz.size;
    const mat = new Matrix4();

    // Shaded free cells.
    let n = 0;
    for (const c of vm.shaded) {
      const { x, z } = cellCenter(c, N);
      this.shade.setMatrixAt(n++, mat.makeTranslation(x, 0, z));
    }
    this.shade.count = n;
    this.shade.instanceMatrix.needsUpdate = true;

    // Highlighted rooms.
    n = 0;
    for (let c = 0; c < N * N; c++) {
      if (!vm.highlightRooms.has(pz.room[c])) continue;
      const { x, z } = cellCenter(c, N);
      this.glow.setMatrixAt(n++, mat.makeTranslation(x, 0, z));
    }
    this.glow.count = n;
    this.glow.instanceMatrix.needsUpdate = true;

    // Marks float just above whatever is in the cell.
    n = 0;
    for (const c of vm.marks) {
      const { x, z } = cellCenter(c, N);
      const sc = 0.62 * (this.markPop.get(c) ?? 1);
      this.marks.setMatrixAt(n++, mat.compose(new Vector3(x, surfaceOf(pz.obj[c]) + 0.012, z), new Quaternion(), new Vector3(sc, 1, sc)));
    }
    this.marks.count = n;
    this.marks.instanceMatrix.needsUpdate = true;

    // Selected cell.
    if (vm.selectedCell >= 0) {
      const { x, z } = cellCenter(vm.selectedCell, N);
      this.sel.position.set(x, 0.006, z);
      this.sel.visible = true;
    } else this.sel.visible = false;

    // Pawns.
    for (const [p, st] of this.pawns) {
      const cell = vm.pos[p];
      if (!this.animatingPawns.has(p)) {
        st.group.visible = cell >= 0;
        if (cell >= 0) this.placeAt(st, cell);
      }
      st.cell = cell;
      const bad = vm.wrong.has(p) || vm.conflicts.has(p);
      const glow = vm.highlightPeople.has(p);
      st.ring.visible = cell >= 0 && (bad || glow);
      (st.ring.material as MeshBasicMaterial).color.set(bad ? RING.conflict : RING.glow);
      st.lock.visible = cell >= 0 && vm.locked.has(p) && !this.cast[p].victim;
    }

    // Ghost of the selected person on the hovered cell.
    if (this.ghost) this.ghost.visible = false;
    const tool = vm.tool;
    const hc = vm.hoverCell;
    if (typeof tool === 'number' && hc >= 0 && !vm.solved && !isBlocking(pz.obj[hc]) && vm.pos.indexOf(hc) < 0) {
      this.ghost = this.ghosts.get(tool) ?? null;
      if (this.ghost) {
        const { x, z } = cellCenter(hc, N);
        this.ghost.position.set(x, surfaceOf(pz.obj[hc]), z);
        this.ghost.visible = true;
      }
    }

    this.ensurePulse();
    this.loop.invalidate();
  }

  private placeAt(st: PawnState, cell: number): void {
    const N = this.pz!.size;
    const { x, z } = cellCenter(cell, N);
    st.group.position.set(x, surfaceOf(this.pz!.obj[cell]), z);
  }

  /** Pulsing rings / room glow need continuous frames while visible. */
  private ensurePulse(): void {
    const needs = () => {
      if (!this.vm) return false;
      return this.vm.highlightRooms.size > 0 || this.vm.conflicts.size > 0 || this.vm.wrong.size > 0 || this.vm.highlightPeople.size > 0;
    };
    if (!needs() || this.pulse) return;
    const reduce = reducedMotion();
    this.pulse = 1;
    this.loop.add((_dt, t) => {
      if (!needs()) { this.pulse = 0; this.loop.invalidate(); return false; }
      const k = reduce ? 0.75 : 0.5 + 0.5 * Math.sin(t * 5);
      (this.glow.material as MeshBasicMaterial).opacity = 0.16 + 0.22 * k;
      for (const st of this.pawns.values()) {
        if (!st.ring.visible) continue;
        (st.ring.material as MeshBasicMaterial).opacity = 0.55 + 0.45 * k;
        st.ring.scale.setScalar(0.95 + 0.1 * k);
      }
      return true;
    });
  }

  // ---------- effects ----------

  fx(f: Fx): void {
    if (!this.pz) return;
    const reduce = reducedMotion();
    this.wake();
    switch (f.type) {
      case 'intro': {
        this.rig.yaw = -0.5;
        if (!f.animate || reduce) { this.rig.blend = 0; this.rig.update(); this.loop.invalidate(); break; }
        this.rig.blend = 1;
        void tween(this.loop, 1.2, (k) => { this.rig.blend = 1 - k; this.rig.update(); }, ease.inOutCubic);
        break;
      }
      case 'placed': {
        const st = this.pawns.get(f.p);
        if (!st) break;
        st.group.visible = true;
        const N = this.pz.size;
        const to = cellCenter(f.cell, N), toY = surfaceOf(this.pz.obj[f.cell]);
        this.placeAt(st, f.cell);
        if (reduce) break;
        this.animatingPawns.add(f.p);
        const inner = st.inner, group = st.group;
        const victim = this.cast[f.p].victim;
        // Moving from another cell: arc across; new placement: drop in from above.
        const from = f.from >= 0 ? { ...cellCenter(f.from, N), y: surfaceOf(this.pz.obj[f.from]) } : null;
        const dur = from ? 0.46 : 0.4;
        let dusted = false;
        void tween(this.loop, dur, (k) => {
          const air = 0.72; // fraction of the time spent in the air
          if (k < air) {
            const a = k / air;
            if (from) {
              group.position.set(from.x + (to.x - from.x) * a, from.y + (toY - from.y) * a, from.z + (to.z - from.z) * a);
              inner.position.y = Math.sin(a * Math.PI) * 0.55;
            } else {
              inner.position.y = (1 - a * a) * 0.75;
            }
            // Stretch while flying.
            const st2 = victim ? 0 : 0.14 * Math.sin(a * Math.PI * 0.9);
            inner.scale.set(1 - st2 * 0.5, 1 + st2, 1 - st2 * 0.5);
          } else {
            if (!dusted) {
              dusted = true;
              group.position.set(to.x, toY, to.z);
              burst(this.world, this.loop, to.x, toY, to.z, victim ? { color: '#ffffff', count: 10 } : {});
            }
            const b = (k - air) / (1 - air);
            const squash = victim ? 0 : Math.sin(b * Math.PI) * 0.24 * (1 - b * 0.3);
            inner.position.y = 0;
            inner.scale.set(1 + squash * 0.55, 1 - squash, 1 + squash * 0.55);
          }
        }, ease.linear).done.then(() => {
          inner.position.y = 0;
          inner.scale.set(1, 1, 1);
          this.animatingPawns.delete(f.p);
          if (this.vm && this.vm.pos[f.p] >= 0) this.placeAt(st, this.vm.pos[f.p]);
          this.loop.invalidate();
        });
        break;
      }
      case 'removed': {
        const st = this.pawns.get(f.p);
        if (!st || reduce) break;
        st.group.visible = true;
        this.animatingPawns.add(f.p);
        const inner = st.inner;
        void tween(this.loop, 0.28, (k) => {
          inner.position.y = Math.sin(k * Math.PI * 0.5) * 0.45;
          inner.scale.setScalar(1 - k * 0.85);
        }, ease.inQuad).done.then(() => {
          inner.position.y = 0;
          inner.scale.setScalar(1);
          this.animatingPawns.delete(f.p);
          st.group.visible = !!this.vm && this.vm.pos[f.p] >= 0;
          this.loop.invalidate();
        });
        break;
      }
      case 'marked': {
        if (!f.on || reduce) break;
        this.markPop.set(f.cell, 0);
        void tween(this.loop, 0.26, (k) => { this.markPop.set(f.cell, k); if (this.vm) this.update(this.vm); }, ease.outBack)
          .done.then(() => this.markPop.delete(f.cell));
        break;
      }
      case 'blocked': this.wiggle(f.cell); break;
      case 'wrong': {
        for (const p of f.people) {
          const st = this.pawns.get(p);
          if (!st || reduce) continue;
          void tween(this.loop, 0.7, (k) => { st.inner.rotation.z = Math.sin(k * Math.PI * 6) * 0.25 * (1 - k); }, ease.linear);
        }
        break;
      }
      case 'solved': this.solved(f.murderer); break;
    }
  }

  private wiggle(cell: number): void {
    const items = this.furniture?.byCell.get(cell);
    if (!items || reducedMotion()) return;
    const { x, z } = cellCenter(cell, this.pz!.size);
    const pivot = new Matrix4();
    const tmp = new Matrix4();
    void tween(this.loop, 0.45, (k) => {
      const a = Math.sin(k * Math.PI * 5) * 0.09 * (1 - k);
      pivot.makeTranslation(x, 0, z).multiply(tmp.makeRotationZ(a)).multiply(new Matrix4().makeTranslation(-x, 0, -z));
      for (const it of items) {
        it.mesh.setMatrixAt(it.index, new Matrix4().multiplyMatrices(pivot, it.base));
        it.mesh.instanceMatrix.needsUpdate = true;
      }
    }, ease.linear);
  }

  private solved(murderer: number): void {
    const pz = this.pz!, N = pz.size;
    const m = this.pawns.get(murderer)!;
    const v = this.pawns.get(N - 1)!;
    // Spotlight on the murderer.
    const spot = new SpotLight('#fff1c8', 0, 12, 0.32, 0.5, 1.2);
    const mp = m.group.position;
    spot.position.set(mp.x, 7, mp.z + 1.5);
    spot.target.position.copy(mp);
    spot.castShadow = false;
    this.world.add(spot, spot.target);
    this.spot = spot;
    // Red string from the murderer's head to the chalk outline.
    const a = mp.clone().add(new Vector3(0, 0.6, 0));
    const b = v.group.position.clone().add(new Vector3(0, 0.03, 0));
    const mid = a.clone().lerp(b, 0.5).add(new Vector3(0, 0.35, 0));
    const curve = new CatmullRomCurve3([a, mid, b]);
    const tube = new Mesh(this.bag.geo(new TubeGeometry(curve, 48, 0.012, 6)), this.bag.mat(new MeshStandardMaterial({ color: '#c0281c', roughness: 0.6, emissive: new Color('#4a0a05') })));
    tube.castShadow = true;
    this.world.add(tube);
    const reduce = reducedMotion();
    tube.geometry.setDrawRange(0, reduce ? Infinity : 0);
    const total = tube.geometry.index ? tube.geometry.index.count : 0;
    this.rig.yaw = -0.45;
    if (!reduce) {
      // The murderer gives a guilty little jump once the camera has settled.
      window.setTimeout(() => {
        void tween(this.loop, 0.5, (k) => {
          m.inner.position.y = Math.sin(k * Math.PI) * 0.3;
          m.inner.rotation.y = k * Math.PI * 2;
        }, ease.outCubic).done.then(() => { m.inner.position.y = 0; m.inner.rotation.y = 0; this.loop.invalidate(); });
        burst(this.world, this.loop, mp.x, mp.y + 0.1, mp.z, { color: '#ffd277', glow: true, count: 18, speed: 0.8, rise: 0.6, duration: 0.8 });
      }, 1300);
    }
    void tween(this.loop, reduce ? 0 : 1.4, (k) => {
      this.rig.blend = k;
      this.rig.update();
      spot.intensity = 60 * k;
      for (const l of this.candles) l.intensity = (l.userData.base as number) * (1 - 0.5 * k);
      tube.geometry.setDrawRange(0, Math.floor(total * Math.min(1, k * 1.3)));
    }, ease.inOutCubic);
  }

  // ---------- candle flicker (throttled, stops when idle) ----------

  private wake(): void {
    this.flickerUntil = performance.now() + 30_000;
    this.startFlicker();
  }

  private startFlicker(): void {
    if (this.flickerTimer || reducedMotion() || !this.candles.length) return;
    this.flickerUntil = Math.max(this.flickerUntil, performance.now() + 30_000);
    this.flickerTimer = window.setInterval(() => {
      if (document.hidden) return;
      if (performance.now() > this.flickerUntil) { clearInterval(this.flickerTimer); this.flickerTimer = 0; return; }
      const t = performance.now() / 1000;
      this.candles.forEach((l, i) => {
        const base = l.userData.base as number;
        l.intensity = base * (0.82 + 0.12 * Math.sin(t * 7.3 + i * 2) + 0.08 * Math.sin(t * 13.1 + i));
      });
      this.loop.invalidate();
    }, 80);
  }

  // ---------- input ----------

  private raycaster = new Raycaster();
  private ground = new Plane(new Vector3(0, 1, 0), 0);

  private pick(clientX: number, clientY: number): number {
    if (!this.pz) return -1;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.rig.camera);
    const hit = new Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return -1;
    const N = this.pz.size;
    const k = Math.floor(hit.x + N / 2), r = Math.floor(hit.z + N / 2);
    return k >= 0 && r >= 0 && k < N && r < N ? r * N + k : -1;
  }

  private bindGestures(el: HTMLElement): void {
    const zoomable = () => (this.pz?.size ?? 0) >= 7;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2 && zoomable()) {
        const [a, b] = [...this.touches.values()];
        this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.rig.zoom, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pan: { ...this.rig.pan } };
        this.gestureBusy = true;
      } else if (this.touches.size === 1 && this.rig.zoom > 1.01) {
        this.dragPan = { x: e.clientX, y: e.clientY, pan: { ...this.rig.pan } };
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.touches.has(e.pointerId)) return;
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const upp = this.rig.unitsPerPixel(el.clientWidth);
      if (this.pinch && this.touches.size === 2) {
        const [a, b] = [...this.touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.rig.zoom = Math.min(2.6, Math.max(1, this.pinch.zoom * (d / this.pinch.dist)));
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.rig.pan.x = this.pinch.pan.x - (mid.x - this.pinch.mid.x) * upp;
        this.rig.pan.z = this.pinch.pan.z - (mid.y - this.pinch.mid.y) * upp;
        this.rig.clampPan();
        this.rig.update();
        this.loop.invalidate();
      } else if (this.dragPan && this.touches.size === 1) {
        const dx = e.clientX - this.dragPan.x, dy = e.clientY - this.dragPan.y;
        if (Math.hypot(dx, dy) > 10) {
          this.rig.pan.x = this.dragPan.pan.x - dx * upp;
          this.rig.pan.z = this.dragPan.pan.z - dy * upp;
          this.rig.clampPan();
          this.rig.update();
          this.loop.invalidate();
        }
      }
    });
    const end = (e: PointerEvent) => {
      this.touches.delete(e.pointerId);
      if (this.touches.size < 2) this.pinch = null;
      if (this.touches.size === 0) {
        this.dragPan = null;
        // Keep swallowing the tap that ends a pinch.
        setTimeout(() => { this.gestureBusy = false; }, 0);
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      if (!zoomable()) return;
      e.preventDefault();
      this.rig.zoom = Math.min(2.6, Math.max(1, this.rig.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      this.rig.clampPan();
      this.rig.update();
      this.loop.invalidate();
    }, { passive: false });
  }

  // ---------- frame ----------

  resize(): void {
    if (!this.renderer) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.rig.setViewport(w, h);
    this.loop?.invalidate();
  }

  private draw(): void {
    this.renderer.render(this.scene, this.rig.camera);
  }

  measuredFps(): number | null { return this.loop.fps(); }

  /** For screenshots/tests: render synchronously. */
  renderNow(): void { this.draw(); }

  dispose(): void {
    clearInterval(this.flickerTimer);
    this.clearPuzzle();
    this.loop.dispose();
    this.resizeObs?.disconnect();
    this.detachPointer?.();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.host.classList.remove('night');
  }
}

