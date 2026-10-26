// App controller: owns settings, the current game, the board view and all HTML UI.

import type { Clue } from '../core/clues';
import { clueRefs } from '../core/clues';
import type { Difficulty, ObjectType, Puzzle } from '../core/model';
import { DIFFICULTIES, OBJECT_TYPES, OCCUPIABLE, SIZES, SUSPECTS, VICTIM_NAME, cellName, colOf, rowOf } from '../core/model';
import { randomSeed } from '../core/rng';
import type { Lang, Segment } from '../i18n';
import { LANGS, detectLang, onLangChange, s, setLang } from '../i18n';
import { GameStore } from '../state/game';
import type { GameEvent } from '../state/game';
import type { Settings } from '../state/persist';
import { defaultSettings, isSettings, load, purgeLegacy, save } from '../state/persist';
import { generatePuzzle } from '../worker/client';
import { $, esc, fmtTime, isDailySeed, reducedMotion, today } from './dom';
import { configureFeedback, play, vibrate } from './feedback';
import { chalkSvg, furnitureIcon, icon, pawnSvg } from './icons';
import { showDialog, toast } from './overlay';
import type { BoardView, CastEntry, Intent, Tool, ViewModel } from './view';
import { createView } from './view-factory';

interface CaseParams { size: number; difficulty: Difficulty; seed: string }

export class App {
  settings: Settings = defaultSettings();
  game: GameStore | null = null;
  pz: Puzzle | null = null;
  cast: CastEntry[] = [];
  view: BoardView | null = null;
  tool: Tool = 0;
  selectedCell = -1;
  hoverCell = -1;
  focusClue = -1;
  private timer = 0;
  private perfAsked = false;
  private webglFailed = false;
  private loadToken = 0;
  private unsub: (() => void) | null = null;

  async start(): Promise<void> {
    purgeLegacy();
    this.settings = load('settings', isSettings) ?? defaultSettings();
    setLang(this.settings.lang ?? detectLang());
    configureFeedback(this.settings);
    onLangChange(() => this.renderAll());
    this.bindStatic();
    this.renderStatic();
    const params = this.readUrl();
    await this.openCase(params, { replaceUrl: true });
    if (!this.settings.seenRules) {
      this.settings.seenRules = true;
      this.saveSettings();
      void this.showRules();
    }
  }

  // ---------- settings & URL ----------

  saveSettings(): void { save('settings', this.settings); }

  readUrl(): CaseParams {
    const q = new URLSearchParams(location.search);
    const n = Number(q.get('n'));
    const d = q.get('d') as Difficulty | null;
    return {
      size: (SIZES as readonly number[]).includes(n) ? n : this.settings.size,
      difficulty: d && DIFFICULTIES.includes(d) ? d : this.settings.difficulty,
      seed: (q.get('s') || today()).slice(0, 40),
    };
  }

  writeUrl(p: CaseParams, replace: boolean): void {
    const url = new URL(location.href);
    url.searchParams.set('n', String(p.size));
    url.searchParams.set('d', p.difficulty);
    url.searchParams.set('s', p.seed);
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
  }

  // ---------- case lifecycle ----------

  async openCase(p: CaseParams, opts: { replaceUrl?: boolean } = {}): Promise<void> {
    const token = ++this.loadToken;
    this.settings.size = p.size;
    this.settings.difficulty = p.difficulty;
    this.saveSettings();
    this.writeUrl(p, !!opts.replaceUrl);
    const loading = $('#loading');
    const slow = window.setTimeout(() => { loading.hidden = false; }, 120);
    $('#loading-text').textContent = s().generating;
    let pz: Puzzle;
    try {
      pz = await generatePuzzle(p);
    } finally {
      clearTimeout(slow);
      loading.hidden = true;
    }
    if (token !== this.loadToken) return;

    this.unsub?.();
    this.pz = pz;
    this.game = new GameStore(pz);
    this.unsub = this.game.subscribe((e) => this.onGameEvent(e));
    this.cast = [
      ...pz.cast.map((si, i) => {
        const x = SUSPECTS[si];
        return { index: i, name: x.name, initial: x.initial, hue: x.hue, accessory: x.accessory, victim: false };
      }),
      { index: pz.size - 1, name: VICTIM_NAME, initial: 'V', hue: 0, accessory: null, victim: true },
    ];
    this.tool = this.firstUnplaced() ?? 0;
    this.selectedCell = -1;
    this.focusClue = -1;
    await this.ensureView();
    this.view!.setPuzzle(pz, this.cast);
    this.view!.fx({ type: 'intro', animate: !this.game.resumed && !reducedMotion() });
    this.renderAll();
    this.startTimer();
    if (this.game.progress.solved) this.refreshView();
    this.watchPerformance();
  }

  /** Offer the 2D view once if the 3D view animates slowly during the first seconds. */
  watchPerformance(): void {
    if (this.perfAsked || this.view?.kind !== '3d') return;
    window.setTimeout(async () => {
      const fps = this.view?.measuredFps?.();
      if (this.perfAsked || fps == null || fps >= 30 || this.view?.kind !== '3d') return;
      this.perfAsked = true;
      const t = s();
      const v = await showDialog({
        title: t.lowFps, body: '',
        actions: [{ label: t.keep3d, value: '' }, { label: t.switchTo2d, primary: true, value: '2d' }],
      });
      if (v === '2d') await this.switchRenderer('2d');
    }, 3500);
  }

  async ensureView(): Promise<void> {
    const want = this.webglFailed ? '2d' : this.settings.renderer;
    if (this.view && this.view.kind === want) return;
    this.view?.dispose();
    const host = $('#board-host');
    const v = await createView(this.webglFailed ? '2d' : want);
    if (v.kind !== want && !this.webglFailed) { this.webglFailed = true; toast(s().noWebgl); }
    v.mount(host);
    v.onIntent = (i) => this.onIntent(i);
    host.querySelector('canvas')?.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.webglFailed = true;
      toast(s().noWebgl);
      void this.switchRenderer('2d');
    }, { once: true });
    this.view = v;
    document.body.dataset.renderer = v.kind;
  }

  async switchRenderer(kind: '2d' | '3d'): Promise<void> {
    if (kind === '3d') this.webglFailed = false;
    this.settings.renderer = kind;
    this.saveSettings();
    if (!this.pz) return;
    await this.ensureView();
    this.view!.setPuzzle(this.pz, this.cast);
    this.view!.fx({ type: 'intro', animate: false });
    this.refreshView();
  }

  startTimer(): void {
    clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      if (document.hidden || !this.game || this.game.progress.solved) return;
      this.game.tick();
    }, 1000);
  }

  firstUnplaced(after = -1): number | null {
    if (!this.game) return null;
    const N = this.game.size;
    for (let k = 1; k <= N; k++) {
      const p = (after + k + N) % N;
      if (this.game.progress.pos[p] < 0) return p;
    }
    return null;
  }

  // ---------- events ----------

  onIntent(i: Intent): void {
    const g = this.game;
    if (!g) return;
    if (i.type === 'hover') {
      this.hoverCell = i.cell;
      this.refreshView();
      return;
    }
    if (g.progress.solved) return;
    this.selectedCell = i.cell;
    this.showRoomBanner(i.cell);
    if (i.type === 'longpress' || this.tool === 'mark') {
      g.toggleMark(i.cell);
      if (i.type === 'longpress') vibrate(15);
      return;
    }
    g.place(this.tool, i.cell);
  }

  onGameEvent(e: GameEvent): void {
    const g = this.game!;
    const t = s();
    switch (e.type) {
      case 'tick': this.renderTimer(); return;
      case 'placed':
        this.view?.fx({ type: 'placed', p: e.p, cell: e.cell, from: e.from });
        play('clack');
        vibrate(10);
        this.tool = this.firstUnplaced(e.p) ?? this.tool;
        this.announce(`${this.cast[e.p].name}: ${cellName(e.cell, g.size)}`);
        break;
      case 'removed':
        this.view?.fx({ type: 'removed', p: e.p, cell: e.cell });
        play('lift');
        break;
      case 'marked': play('mark'); break;
      case 'blocked':
        this.view?.fx({ type: 'blocked', cell: e.cell });
        toast(t.blocked(g.pz.obj[e.cell] as ObjectType));
        vibrate([20, 40, 20]);
        play('error');
        break;
      case 'hint':
        this.view?.fx({ type: 'placed', p: e.p, cell: e.cell, from: -1 });
        toast(t.hintUsed(this.cast[e.p].name));
        this.tool = this.firstUnplaced(e.p) ?? this.tool;
        break;
      case 'check':
        if (e.wrong.length) {
          this.view?.fx({ type: 'wrong', people: e.wrong });
          vibrate([30, 50, 30]);
          play('error');
        }
        toast(e.wrong.length ? t.errors(e.wrong.length) : t.allCorrectSoFar);
        break;
      case 'complete':
        if (e.correct) window.setTimeout(() => void this.accuse(), reducedMotion() ? 0 : 450);
        else toast(t.notComplete);
        break;
      case 'solved':
        this.view?.fx({ type: 'solved', murderer: g.pz.murderer });
        play('stamp');
        vibrate([40, 60, 120]);
        window.setTimeout(() => void this.showResult(), reducedMotion() ? 0 : 1800);
        break;
      case 'reset':
      case 'history':
      case 'struck':
        break;
    }
    this.renderPlayState();
  }

  // ---------- rendering ----------

  viewModel(): ViewModel {
    const g = this.game!;
    const refs = this.focusClue >= 0 ? clueRefs(g.pz.clues[this.focusClue]) : { people: [], rooms: [] };
    return {
      pos: g.progress.pos,
      marks: new Set(g.progress.marks),
      locked: new Set(g.progress.locked),
      wrong: g.wrong,
      conflicts: g.conflicts(),
      shaded: g.shadedCells(),
      tool: this.tool,
      selectedCell: this.selectedCell,
      hoverCell: this.hoverCell,
      highlightRooms: new Set(refs.rooms),
      highlightPeople: new Set(refs.people),
      solved: g.progress.solved,
    };
  }

  refreshView(): void {
    if (this.view && this.game) this.view.update(this.viewModel());
  }

  renderAll(): void {
    this.renderStatic();
    if (!this.game) return;
    const t = s();
    const pz = this.game.pz;
    $('#case-story').textContent = t.story(VICTIM_NAME, t.weapons[pz.weapon]);
    $('#btn-case').innerHTML = `${icon('case')}<span>${isDailySeed(pz.seed) ? t.dailyShort : t.newCase}</span>
      <small>${pz.size}×${pz.size} · ${t.difficulties[pz.difficulty]}</small>`;
    this.renderLegend();
    this.renderPlayState();
  }

  /** Everything that changes with moves. */
  renderPlayState(): void {
    this.renderPalette();
    this.renderClues();
    this.renderActions();
    this.renderTimer();
    this.renderA11yGrid();
    this.refreshView();
  }

  renderStatic(): void {
    const t = s();
    document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => {
      el.textContent = String(t[el.dataset.t as keyof typeof t]);
    });
    $('#btn-rules').innerHTML = icon('help');
    $('#btn-rules').setAttribute('aria-label', t.rulesTitle);
    document.querySelectorAll<HTMLElement>('.side-tab').forEach((b) => {
      b.textContent = b.dataset.tab === 'clues' ? t.clues : t.furniture;
    });
    $('#a11y-grid').setAttribute('aria-label', t.boardLabel);
  }

  renderTimer(): void {
    const g = this.game;
    if (!g) return;
    $('#case-timer').textContent = `${fmtTime(g.progress.elapsed)}${g.progress.solved ? ' ✓' : ''}`;
  }

  renderPalette(): void {
    const g = this.game!;
    const t = s();
    const people = this.focusClue >= 0 ? new Set(clueRefs(g.pz.clues[this.focusClue]).people) : new Set<number>();
    const chips = this.cast.map((c) => {
      const placed = g.progress.pos[c.index] >= 0;
      const cls = ['chip', this.tool === c.index ? 'active' : '', placed ? 'placed' : '', c.victim ? 'victim' : '', people.has(c.index) ? 'glow' : '', g.isLocked(c.index) ? 'locked' : ''].join(' ');
      const art = c.victim ? chalkSvg('chip-art') : pawnSvg(c.hue, c.accessory, c.initial, 'chip-art');
      return `<button type="button" class="${cls}" data-person="${c.index}" style="--ph:${c.hue}" aria-pressed="${this.tool === c.index}"
        aria-label="${esc(c.name)}${c.victim ? ` (${t.victim})` : ''}${placed ? ' ✓' : ''}">${art}<span class="chip-name">${esc(c.name)}</span></button>`;
    });
    chips.push(`<button type="button" class="chip tool${this.tool === 'mark' ? ' active' : ''}" data-person="mark" aria-pressed="${this.tool === 'mark'}"
      aria-label="${esc(t.mark)}"><span class="chip-art mark-art">${icon('mark')}</span><span class="chip-name">${esc(t.mark)}</span></button>`);
    $('#palette').innerHTML = chips.join('');
  }

  segmentsHtml(segs: Segment[]): string {
    const g = this.game!;
    const t = s();
    return segs.map((seg) => {
      if ('person' in seg) {
        const c = this.cast[seg.person];
        return `<b class="ref-person${c.victim ? ' victim' : ''}" style="--ph:${c.hue}">${esc(c.name)}</b>`;
      }
      if ('room' in seg) return `<span class="ref-room">${esc(t.roomIn[g.pz.rooms[seg.room].type])}</span>`;
      if ('object' in seg) return `<span class="ref-object">${esc(seg.text)}</span>`;
      return esc(seg.text);
    }).join('');
  }

  clueHtml(cl: Clue, i: number): string {
    const g = this.game!;
    const t = s();
    const struck = g.progress.struck.includes(i);
    return `<li class="clue${struck ? ' struck' : ''}${this.focusClue === i ? ' focus' : ''}" data-clue="${i}">
      <button type="button" class="clue-text" data-focus="${i}" aria-pressed="${this.focusClue === i}">${this.segmentsHtml(t.clue(cl))}</button>
      <button type="button" class="clue-check" data-strike="${i}" aria-pressed="${struck}" aria-label="${esc(t.checked)}">✓</button>
      <span class="stamp" aria-hidden="true">${esc(t.checked)}</span></li>`;
  }

  renderClues(): void {
    const g = this.game!;
    const t = s();
    const html = g.pz.clues.map((cl, i) => this.clueHtml(cl, i)).join('');
    $('#side-clues').innerHTML = html;
    $('#sheet-clues').innerHTML = html;
    const open = g.pz.clues.map((_, i) => i).filter((i) => !g.progress.struck.includes(i));
    const first = this.focusClue >= 0 ? this.focusClue : open[0];
    $('#clue-bar').innerHTML = `<span class="clue-count">${t.clues} · ${open.length ? t.cluesLeft(open.length, g.pz.clues.length) : t.allCluesChecked}</span>
      <span class="clue-preview">${first !== undefined ? this.segmentsHtml(t.clue(g.pz.clues[first])) : ''}</span>${icon('chevron', 'ui-icon chevron')}`;
  }

  renderLegend(): void {
    const g = this.game!;
    const t = s();
    const present = new Set(g.pz.obj.filter(Boolean));
    const html = OBJECT_TYPES.filter((o) => present.has(o)).map((o) => {
      const ok = OCCUPIABLE.has(o);
      return `<li class="${ok ? 'ok' : 'no'}">${furnitureIcon(o, 'legend-icon')}<span>${esc(t.objects[o])}</span>
        <span class="legend-tag">${ok ? '✓ ' + esc(t.objectCanStand) : '✕ ' + esc(t.objectBlocks)}</span></li>`;
    }).join('');
    $('#side-legend').innerHTML = html;
    $('#sheet-legend').innerHTML = html;
  }

  renderActions(): void {
    const g = this.game!;
    const a = s().actions;
    const btn = (id: string, ic: Parameters<typeof icon>[0], label: string, disabled = false) =>
      `<button type="button" class="action" data-action="${id}" ${disabled ? 'disabled' : ''}>${icon(ic)}<span>${esc(label)}</span></button>`;
    const solved = g.progress.solved;
    $('#actions').innerHTML = [
      btn('undo', 'undo', a.undo, !g.canUndo() || solved),
      btn('redo', 'redo', a.redo, !g.canRedo() || solved),
      btn('check', 'check', a.check, solved),
      btn('hint', 'hint', a.hint, solved),
      btn('reset', 'reset', a.reset),
      btn('share', 'share', a.share),
    ].join('');
  }

  renderA11yGrid(): void {
    const g = this.game!;
    const t = s();
    const N = g.size;
    const grid = $('#a11y-grid');
    const focusedIdx = Number(document.activeElement?.getAttribute('data-cell') ?? -1);
    let html = '';
    for (let r = 0; r < N; r++) {
      html += '<div role="row">';
      for (let k = 0; k < N; k++) {
        const c = r * N + k;
        const o = g.pz.obj[c];
        const p = g.personAt(c);
        const label = t.cell(cellName(c, N), t.rooms[g.pz.rooms[g.pz.room[c]].type], o ? t.objects[o] : null, p >= 0 ? this.cast[p].name : null, g.progress.marks.includes(c));
        const tab = c === Math.max(0, this.selectedCell) ? 0 : -1;
        html += `<button role="gridcell" type="button" data-cell="${c}" tabindex="${tab}" aria-label="${esc(label)}"></button>`;
      }
      html += '</div>';
    }
    grid.innerHTML = html;
    if (focusedIdx >= 0) grid.querySelector<HTMLElement>(`[data-cell="${focusedIdx}"]`)?.focus();
  }

  showRoomBanner(cell: number): void {
    const g = this.game!;
    const t = s();
    const o = g.pz.obj[cell];
    const el = $('#room-banner');
    el.innerHTML = `<b>${esc(t.rooms[g.pz.rooms[g.pz.room[cell]].type])}</b> · ${cellName(cell, g.size)}${o ? ` · ${esc(t.objects[o])}` : ''}`;
    el.classList.add('show');
    clearTimeout((el as unknown as { _t: number })._t);
    (el as unknown as { _t: number })._t = window.setTimeout(() => el.classList.remove('show'), 1600);
  }

  announce(msg: string): void { $('#live').textContent = msg; }

  // ---------- dialogs ----------

  async showRules(): Promise<void> {
    const t = s();
    await showDialog({
      title: t.rulesTitle,
      body: `<ol class="rules">${t.rules.map((r) => `<li>${r}</li>`).join('')}</ol><p class="howto">${esc(t.howTo)}</p>`,
      actions: [{ label: t.close, primary: true, value: 'ok' }],
    });
  }

  async accuse(): Promise<void> {
    const g = this.game!;
    const t = s();
    if (g.progress.solved) return;
    const list = this.cast.filter((c) => !c.victim).map((c) =>
      `<button type="button" class="chip" data-accuse="${c.index}" style="--ph:${c.hue}">${pawnSvg(c.hue, c.accessory, c.initial, 'chip-art')}<span class="chip-name">${esc(c.name)}</span></button>`).join('');
    await showDialog({
      title: t.accuseTitle,
      body: `<p class="accuse-text">${esc(t.accuseText(VICTIM_NAME))}</p><div class="accuse-list">${list}</div>`,
      className: 'accuse',
      setup: (d, close) => {
        d.querySelectorAll<HTMLButtonElement>('[data-accuse]').forEach((b) => {
          b.onclick = () => {
            const p = Number(b.dataset.accuse);
            if (g.accuse(p)) close('ok');
            else {
              d.querySelector('.accuse-text')!.textContent = t.wrongAccuse(this.cast[p].name);
              b.disabled = true;
              vibrate([30, 50, 30]);
              play('error');
            }
          };
        });
      },
    });
  }

  shareSummary(): string {
    const g = this.game!;
    const t = s();
    const pz = g.pz;
    const id = `${isDailySeed(pz.seed) ? pz.seed : '#' + pz.seed} · ${pz.size}×${pz.size} ${t.difficulties[pz.difficulty]}`;
    const N = pz.size;
    // Emoji floor plan: the victim's room in red, the rest neutral.
    const vr = pz.room[pz.solution[N - 1]];
    let grid = '';
    for (let r = 0; r < N; r++) {
      for (let k = 0; k < N; k++) grid += pz.room[r * N + k] === vr ? '🟥' : (pz.room[r * N + k] % 2 ? '🟫' : '🟨');
      grid += '\n';
    }
    return `${t.shareText(id, fmtTime(g.progress.elapsed), g.progress.hints)}\n${grid}${this.shareUrl()}`;
  }

  shareUrl(): string { return location.href; }

  async showResult(): Promise<void> {
    const g = this.game!;
    const t = s();
    const m = this.cast[g.pz.murderer];
    const choice = await showDialog({
      title: t.caseClosed,
      className: 'result',
      body: `<div class="result-hero">${pawnSvg(m.hue, m.accessory, m.initial, 'result-pawn')}</div>
        <p>${esc(t.solvedText(m.name, VICTIM_NAME, t.weapons[g.pz.weapon]))}</p>
        <dl class="result-stats"><div><dt>${esc(t.time)}</dt><dd>${fmtTime(g.progress.elapsed)}</dd></div>
        <div><dt>${esc(t.hintsUsed)}</dt><dd>${g.progress.hints}</dd></div></dl>`,
      actions: [{ label: t.shareResult, value: 'share' }, { label: t.nextCase, primary: true, value: 'next' }],
    });
    if (choice === 'share') await this.share(true);
    if (choice === 'next') await this.openCase({ size: g.size, difficulty: g.pz.difficulty, seed: randomSeed() });
  }

  async share(result = false): Promise<void> {
    const text = result ? this.shareSummary() : `${s().story(VICTIM_NAME, s().weapons[this.game!.pz.weapon])}\n${this.shareUrl()}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Karodoku', text });
      else { await navigator.clipboard.writeText(text); toast(s().copied); }
    } catch { /* cancelled */ }
  }

  async confirmReset(): Promise<void> {
    const t = s();
    const v = await showDialog({
      title: t.resetTitle, body: `<p>${esc(t.resetText)}</p>`,
      actions: [{ label: t.cancel, value: '' }, { label: t.confirm, primary: true, value: 'reset' }],
    });
    if (v === 'reset') {
      this.game!.reset();
      this.tool = 0;
    }
  }

  async showCaseSheet(): Promise<void> {
    const t = s();
    const st = this.settings;
    const seg = (name: string, options: [string, string][], value: string) =>
      `<div class="seg" role="radiogroup" data-name="${name}">${options.map(([v, l]) =>
        `<button type="button" role="radio" data-value="${v}" aria-checked="${v === value}">${esc(l)}</button>`).join('')}</div>`;
    const body = `
      <label class="field"><span>${esc(t.size)}</span>${seg('size', SIZES.map((n) => [String(n), `${n}×${n}`]), String(st.size))}</label>
      <label class="field"><span>${esc(t.difficulty)}</span>${seg('difficulty', DIFFICULTIES.map((d) => [d, t.difficulties[d]]), st.difficulty)}</label>
      <div class="sheet-buttons"><button type="button" class="btn primary" data-go="new">${esc(t.startCase)}</button>
        <button type="button" class="btn" data-go="daily">${esc(t.daily)} · ${today()}</button></div>
      <hr>
      <label class="field"><span>${esc(t.settings.renderer)}</span>${seg('renderer', [['3d', t.settings.r3d], ['2d', t.settings.r2d]], st.renderer)}</label>
      <label class="field"><span>${esc(t.settings.language)}</span>${seg('lang', LANGS.map((l) => [l, l === 'de' ? 'Deutsch' : 'English']), (st.lang ?? detectLang()))}</label>
      <label class="field"><span>${esc(t.settings.sound)}</span>${seg('sound', [['1', t.settings.on], ['0', t.settings.off]], st.sound ? '1' : '0')}</label>
      <label class="field"><span>${esc(t.settings.haptics)}</span>${seg('haptics', [['1', t.settings.on], ['0', t.settings.off]], st.haptics ? '1' : '0')}</label>`;
    const pick = { size: st.size, difficulty: st.difficulty };
    const v = await showDialog({
      title: t.newCaseTitle, body, className: 'sheet',
      setup: (d, close) => {
        d.querySelectorAll<HTMLElement>('.seg').forEach((group) => {
          group.addEventListener('click', (e) => {
            const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-value]');
            if (!b) return;
            group.querySelectorAll('[data-value]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
            const val = b.dataset.value!;
            switch (group.dataset.name) {
              case 'size': pick.size = Number(val); break;
              case 'difficulty': pick.difficulty = val as Difficulty; break;
              case 'renderer': void this.switchRenderer(val as '2d' | '3d'); break;
              case 'lang': this.settings.lang = val as Lang; this.saveSettings(); setLang(val as Lang); break;
              case 'sound': this.settings.sound = val === '1'; this.saveSettings(); configureFeedback(this.settings); play('clack'); break;
              case 'haptics': this.settings.haptics = val === '1'; this.saveSettings(); configureFeedback(this.settings); vibrate(20); break;
            }
          });
        });
        d.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => { b.onclick = () => close(b.dataset.go!); });
      },
    });
    if (v === 'new') await this.openCase({ ...pick, seed: randomSeed() });
    else if (v === 'daily') await this.openCase({ ...pick, seed: today() });
  }

  async showBio(p: number): Promise<void> {
    const t = s();
    const c = this.cast[p];
    const id = c.victim ? null : SUSPECTS[this.game!.pz.cast[p]].id;
    await showDialog({
      title: c.name,
      className: 'bio',
      body: `<div class="bio-art">${c.victim ? chalkSvg('result-pawn') : pawnSvg(c.hue, c.accessory, c.initial, 'result-pawn')}</div>
        <p class="bio-role">${esc(id ? t.roles[id] : t.victimRole)}${c.accessory ? ` · ${esc(t.accessories[c.accessory])}` : ''}</p>
        <p>${esc(id ? t.bios[id] : t.victimBio)}</p>`,
      actions: [{ label: t.close, primary: true, value: '' }],
    });
  }

  // ---------- static bindings ----------

  bindStatic(): void {
    $('#btn-rules').onclick = () => void this.showRules();
    $('#btn-case').onclick = () => void this.showCaseSheet();
    $('#case-strip').onclick = () => {
      const el = $('#case-strip');
      const open = el.getAttribute('aria-expanded') !== 'true';
      el.setAttribute('aria-expanded', String(open));
    };

    // Palette: tap selects, long-press shows the character bio.
    const palette = $('#palette');
    let pressTimer = 0, pressed = false;
    palette.addEventListener('pointerdown', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-person]');
      if (!chip || chip.dataset.person === 'mark') return;
      pressed = false;
      pressTimer = window.setTimeout(() => { pressed = true; vibrate(10); void this.showBio(Number(chip.dataset.person)); }, 450);
    });
    const clearPress = () => clearTimeout(pressTimer);
    palette.addEventListener('pointerup', clearPress);
    palette.addEventListener('pointercancel', clearPress);
    palette.addEventListener('pointerleave', clearPress);
    palette.addEventListener('contextmenu', (e) => e.preventDefault());
    palette.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-person]');
      if (!chip || pressed) return;
      this.tool = chip.dataset.person === 'mark' ? 'mark' : Number(chip.dataset.person);
      play('tick');
      this.renderPalette();
      this.refreshView();
    });

    $('#actions').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
      if (!b || !this.game) return;
      switch (b.dataset.action) {
        case 'undo': this.game.undo(); break;
        case 'redo': this.game.redo(); break;
        case 'check': this.game.check(); break;
        case 'hint': if (this.game.hint() === null) toast(s().noHint); break;
        case 'reset': void this.confirmReset(); break;
        case 'share': void this.share(this.game.progress.solved); break;
      }
    });

    // Clues: tap text = highlight references, tap ✓ = tick off.
    const onClueClick = (e: Event) => {
      const el = e.target as HTMLElement;
      const strike = el.closest<HTMLElement>('[data-strike]');
      if (strike && this.game) {
        this.game.toggleStrike(Number(strike.dataset.strike));
        play('stamp');
        vibrate(12);
        return;
      }
      const focus = el.closest<HTMLElement>('[data-focus]');
      if (focus) {
        const i = Number(focus.dataset.focus);
        this.focusClue = this.focusClue === i ? -1 : i;
        this.renderPlayState();
      }
    };
    $('#side-clues').addEventListener('click', onClueClick);
    $('#sheet-clues').addEventListener('click', onClueClick);

    const sheet = $('#clue-sheet');
    $('#clue-bar').onclick = () => {
      const open = !sheet.classList.contains('open');
      sheet.classList.toggle('open', open);
      $('#clue-bar').setAttribute('aria-expanded', String(open));
    };
    document.querySelectorAll<HTMLElement>('.side-tabs').forEach((tabs) => {
      tabs.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
        if (!b) return;
        const panel = tabs.parentElement!;
        tabs.querySelectorAll('.side-tab').forEach((x) => x.classList.toggle('active', x === b));
        panel.querySelector<HTMLElement>('.clue-list')!.hidden = b.dataset.tab !== 'clues';
        panel.querySelector<HTMLElement>('.legend')!.hidden = b.dataset.tab !== 'legend';
      });
    });

    // Accessible grid: arrows move, Enter places, Space marks.
    const grid = $('#a11y-grid');
    grid.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
      if (b) this.onIntent({ type: 'tap', cell: Number(b.dataset.cell) });
    });
    grid.addEventListener('focusin', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
      if (b && this.game) { this.selectedCell = Number(b.dataset.cell); this.hoverCell = this.selectedCell; this.refreshView(); }
    });
    grid.addEventListener('keydown', (e) => {
      if (!this.game) return;
      const N = this.game.size;
      const c = Math.max(0, this.selectedCell);
      let r = rowOf(c, N), k = colOf(c, N);
      const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (moves[e.key]) {
        e.preventDefault();
        r = Math.min(N - 1, Math.max(0, r + moves[e.key][0]));
        k = Math.min(N - 1, Math.max(0, k + moves[e.key][1]));
        this.selectedCell = r * N + k;
        this.renderA11yGrid();
        grid.querySelector<HTMLElement>(`[data-cell="${this.selectedCell}"]`)?.focus();
      } else if (e.key === ' ') {
        e.preventDefault();
        this.onIntent({ type: 'longpress', cell: c });
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!this.game || document.querySelector('dialog[open]')) return;
      if ((e.target as HTMLElement).closest('input, select, textarea')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) this.game.redo(); else this.game.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); this.game.redo(); return; }
      if (mod || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= this.cast.length) { this.tool = n - 1; this.renderPalette(); this.refreshView(); }
      else if (e.key === 'x' || e.key === 'X') { this.tool = 'mark'; this.renderPalette(); this.refreshView(); }
    });

    window.addEventListener('popstate', () => void this.openCase(this.readUrl(), { replaceUrl: true }));
    window.addEventListener('resize', () => this.view?.resize());
    window.addEventListener('pagehide', () => this.game?.persist());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.game?.persist(); });
  }
}
