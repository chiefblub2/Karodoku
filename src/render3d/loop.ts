// Render-on-demand loop: frames are drawn only while something animates (tweens, particles,
// pulsing rings, candle flicker). Idle otherwise; fully paused while the page is hidden.

export type Animator = (dt: number, time: number) => boolean; // return false when finished

export class Loop {
  private animators = new Set<Animator>();
  private raf = 0;
  private last = 0;
  private dirty = false;
  private frameTimes: number[] = [];
  private measuring = true;
  readonly start = performance.now();

  constructor(private draw: () => void) {
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = (): void => {
    if (document.hidden) { cancelAnimationFrame(this.raf); this.raf = 0; }
    else { this.last = 0; this.invalidate(); }
  };

  /** Draw one more frame. */
  invalidate(): void {
    this.dirty = true;
    this.schedule();
  }

  add(a: Animator): () => void {
    this.animators.add(a);
    this.schedule();
    return () => this.animators.delete(a);
  }

  has(a: Animator): boolean { return this.animators.has(a); }

  private schedule(): void {
    if (this.raf || document.hidden) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.raf = 0;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    if (this.measuring && this.animators.size) {
      this.frameTimes.push(dt);
      if (this.frameTimes.length > 240) this.measuring = false;
    }
    const t = (now - this.start) / 1000;
    for (const a of [...this.animators]) if (!a(dt, t)) this.animators.delete(a);
    this.draw();
    this.dirty = false;
    if (this.animators.size) this.schedule();
    else this.last = 0;
  };

  get isDirty(): boolean { return this.dirty; }

  /** Average FPS over the animated frames seen so far (null until enough samples). */
  fps(): number | null {
    // Skip the first frames (shader compilation, texture uploads).
    const xs = this.frameTimes.slice(10);
    if (xs.length < 40) return null;
    const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
    return 1 / avg;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.animators.clear();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}

// ---------- tweens ----------

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t: number) => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  outElastic: (t: number) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  inQuad: (t: number) => t * t,
};

/** Run fn(progress) from 0→1 over `duration` seconds on the loop. Resolves when done. */
export function tween(loop: Loop, duration: number, fn: (k: number) => void, easing: (t: number) => number = ease.outCubic): { cancel(): void; done: Promise<void> } {
  let elapsed = 0, cancelled = false;
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  if (duration <= 0) { fn(1); loop.invalidate(); resolve(); return { cancel() {}, done }; }
  const remove = loop.add((dt) => {
    if (cancelled) { resolve(); return false; }
    elapsed += dt;
    const k = Math.min(1, elapsed / duration);
    fn(easing(k));
    if (k >= 1) { resolve(); return false; }
    return true;
  });
  return { cancel() { cancelled = true; remove(); resolve(); }, done };
}
