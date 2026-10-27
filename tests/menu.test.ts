// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generate } from '../src/core/generator';
import type { BoardView } from '../src/ui/view';

// Puzzles are generated in-process instead of in a worker, and the board is a stand-in.
vi.mock('../src/worker/client', () => ({ generatePuzzle: async (p: Parameters<typeof generate>[0]) => generate(p) }));
vi.mock('../src/ui/view-factory', () => ({
  createView: async (kind: '2d' | '3d'): Promise<BoardView> => ({
    kind, onIntent: () => {}, mount() {}, setPuzzle() {}, update() {}, fx() {}, resize() {}, dispose() {}, anchor: () => null,
  }),
}));

const { App } = await import('../src/ui/app');
type AppT = InstanceType<typeof App>;

const BODY = readFileSync(resolve(__dirname, '../index.html'), 'utf8').match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script[\s\S]*?<\/script>/g, '');
const SETTINGS = { schemaVersion: 2, size: 6, difficulty: 'medium', renderer: '2d', lang: 'en', sound: false, haptics: false, seenRules: true };

// Window/document listeners of earlier Apps would otherwise react to later tests.
let added: [EventTarget, string, EventListenerOrEventListenerObject][] = [];
for (const target of [window, document] as EventTarget[]) {
  const orig = target.addEventListener.bind(target);
  target.addEventListener = (type: string, fn: EventListenerOrEventListenerObject, o?: boolean | AddEventListenerOptions) => {
    added.push([target, type, fn]);
    orig(type, fn, o);
  };
}

beforeEach(() => {
  document.body.innerHTML = BODY;
  localStorage.clear();
  localStorage.setItem('karodoku2:settings', JSON.stringify(SETTINGS));
  history.replaceState(null, '', '/');
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  // jsdom lacks modal dialogs.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.open = false; };
});
afterEach(() => {
  for (const [t, type, fn] of added) t.removeEventListener(type, fn);
  added = [];
  vi.useRealTimers();
});

async function launch(url = '/'): Promise<AppT> {
  history.replaceState(null, '', url);
  const app = new App();
  await app.start();
  return app;
}
const menuOpen = () => document.querySelector<HTMLDialogElement>('#menu')!.open;
const click = (sel: string) => document.querySelector<HTMLElement>(sel)!.click();
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('game menu', () => {
  it('is the home screen when launched without URL parameters', async () => {
    const app = await launch('/');
    expect(menuOpen()).toBe(true);
    expect(app.game).toBeNull();
    expect(document.querySelector('[data-menu=continue]')).toBeNull();
    // First launch: the tutorial is recommended, and there is nothing to close back to.
    expect(document.querySelector('[data-menu=tutorial]')!.classList.contains('recommended')).toBe(true);
    expect(document.querySelector('[data-menu=close]')).toBeNull();
  });

  it('is skipped by a shared case link', async () => {
    const app = await launch('/?n=6&d=medium&s=abc');
    expect(menuOpen()).toBe(false);
    expect(app.game!.pz).toMatchObject({ size: 6, difficulty: 'medium', seed: 'abc' });
  });

  it('offers "Continue" only for a saved unsolved case, and resumes it with its time', async () => {
    let app = await launch('/?n=5&d=easy&s=cont');
    const g = app.game!;
    g.place(0, g.pz.solution[0]);
    for (let i = 0; i < 42; i++) g.tick();
    g.persist();

    app = await launch('/');
    expect(menuOpen()).toBe(true);
    expect(document.querySelector('[data-menu=continue]')!.textContent).toContain('0:42');
    click('[data-menu=continue]');
    await vi.waitFor(() => expect(app.game).not.toBeNull());
    expect(menuOpen()).toBe(false);
    expect(app.game!.pz.seed).toBe('cont');
    expect(app.game!.progress.elapsed).toBe(42);
    expect(app.game!.progress.pos[0]).toBe(g.pz.solution[0]);

    // Once solved there is nothing to continue.
    app.game!.progress.solved = true;
    app.game!.persist();
    await launch('/');
    expect(document.querySelector('[data-menu=continue]')).toBeNull();
  });

  it('runs the tutorial without touching a real case’s saved progress', async () => {
    const app = await launch('/?n=6&d=medium&s=real');
    const g = app.game!;
    g.place(1, g.pz.solution[1]);
    g.tick();
    app.openMenu();
    const before = { ...localStorage };

    click('[data-menu=tutorial]');
    await vi.waitFor(() => expect(app.mode).toBe('tutorial'));
    expect(document.querySelector('#coach')!.hasAttribute('hidden')).toBe(false);
    const t = app.game!;
    // Step 1: place someone; step 2: mark an ✕; step 3: pick a clue.
    const free = [...Array(25).keys()].filter((c) => !t.pz.obj[c] && !t.pz.solution.includes(c));
    app.onIntent({ type: 'tap', cell: t.pz.solution[0] });
    expect(app.tutorialStep).toBe(1);
    app.onIntent({ type: 'longpress', cell: free[0] });
    expect(app.tutorialStep).toBe(2);
    t.tick();
    click('#sheet-clues [data-focus="0"]');
    expect(app.mode).toBe('none');
    expect(menuOpen()).toBe(true);

    const after = { ...localStorage };
    for (const k of Object.keys(after)) if (k.includes(':game:')) expect(after[k]).toBe(before[k]);
    expect(Object.keys(after).some((k) => k.includes('tutorial') && k.includes(':game:'))).toBe(false);
    expect(after['karodoku2:last-case']).toBe(before['karodoku2:last-case']);
    // The real case is still the one to continue.
    expect(document.querySelector('[data-menu=continue]')).not.toBeNull();
  });

  it('pauses the timer while open and resumes it on the way back', async () => {
    const app = await launch('/?n=5&d=easy&s=timer');
    vi.useFakeTimers();
    app.startTimer();
    vi.advanceTimersByTime(3000);
    expect(app.game!.progress.elapsed).toBe(3);
    click('#btn-menu');
    expect(menuOpen()).toBe(true);
    expect(history.state).toMatchObject({ menu: true });
    vi.advanceTimersByTime(5000);
    expect(app.game!.progress.elapsed).toBe(3);
    // Esc returns to the running case (through history.back(), which jsdom runs on a real timer).
    vi.useRealTimers();
    document.querySelector('#menu')!.dispatchEvent(new Event('cancel', { cancelable: true }));
    await vi.waitFor(() => expect(menuOpen()).toBe(false));
    expect(history.state?.menu).toBeFalsy();
    vi.useFakeTimers();
    app.startTimer();
    vi.advanceTimersByTime(2000);
    expect(app.game!.progress.elapsed).toBe(5);
  });
});

describe('accusation', () => {
  it('stays reachable after the dialog is dismissed', async () => {
    const app = await launch('/?n=5&d=easy&s=accuse');
    const g = app.game!;
    vi.useFakeTimers();
    g.pz.solution.forEach((c, p) => { if (g.progress.pos[p] !== c) g.place(p, c); });
    vi.advanceTimersByTime(500);
    const dlg = document.querySelector<HTMLDialogElement>('dialog.accuse')!;
    expect(dlg).not.toBeNull();
    dlg.querySelector<HTMLElement>('.dialog-x')!.click();
    vi.advanceTimersByTime(200);
    vi.useRealTimers();
    await flush();
    expect(document.querySelector('dialog.accuse')).toBeNull();
    expect(g.progress.solved).toBe(false);
    expect(document.querySelector('[data-action=accuse]')).not.toBeNull();

    click('[data-action=accuse]');
    await flush();
    document.querySelector<HTMLElement>(`dialog.accuse [data-accuse="${g.pz.murderer}"]`)!.click();
    expect(g.progress.solved).toBe(true);
    expect(document.querySelector('[data-action=accuse]')).toBeNull();
  });
});

describe('long-press tip', () => {
  it('shows once, the first time the ✕ chip is picked outside the tutorial', async () => {
    await launch('/?n=5&d=easy&s=tip');
    const toast = document.querySelector('#toast')!;
    click('#palette [data-person="mark"]');
    expect(toast.textContent).toMatch(/long-press/);
    toast.textContent = '';
    click('#palette [data-person="0"]');
    click('#palette [data-person="mark"]');
    expect(toast.textContent).toBe('');
  });
});
