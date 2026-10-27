// The game menu (home screen): markup only; App wires the behaviour.

import type { Difficulty } from '../core/model';
import { DIFFICULTIES, SIZES } from '../core/model';
import { s } from '../i18n';
import { esc } from './dom';
import { icon } from './icons';

export interface MenuModel {
  /** A case (or the tutorial) is running behind the menu: show a close button, Esc and Back return to it. */
  canClose: boolean;
  /** "Continue" row, null when there is nothing to continue. */
  resume: { title: string; sub: string } | null;
  daily: { sub: string; solved: boolean };
  pick: { size: number; difficulty: Difficulty };
  /** First launch: point at the tutorial. */
  recommendTutorial: boolean;
  brand: string;
}

/** Segmented control (radio group) used in the menu and the settings dialog. */
export function segHtml(name: string, label: string, options: [string, string][], value: string): string {
  const id = `seg-${name}`;
  return `<div class="field"><span id="${id}">${esc(label)}</span><div class="seg" role="radiogroup" aria-labelledby="${id}" data-name="${name}">${options.map(([v, l]) =>
    `<button type="button" role="radio" data-value="${v}" aria-checked="${v === value}">${esc(l)}</button>`).join('')}</div></div>`;
}

const row = (action: string, ic: Parameters<typeof icon>[0], title: string, sub: string, extra = '', badge = '') =>
  `<button type="button" class="menu-row${extra}" data-menu="${action}">${icon(ic, 'ui-icon menu-icon')}
    <span class="menu-text"><span class="menu-title">${esc(title)}</span><span class="menu-sub">${esc(sub)}</span></span>${badge}</button>`;

export function menuHtml(m: MenuModel): string {
  const t = s();
  const rows: string[] = [];
  if (m.resume) rows.push(row('continue', 'play', m.resume.title, m.resume.sub, ' primary'));
  rows.push(row('daily', 'calendar', t.daily, m.daily.sub, m.daily.solved ? ' solved' : ''));
  rows.push(`<div class="menu-card" role="group" aria-labelledby="menu-new-title">
    <div class="menu-row static">${icon('plus', 'ui-icon menu-icon')}<span class="menu-text"><span class="menu-title" id="menu-new-title">${esc(t.newCase)}</span>
      <span class="menu-sub">${esc(t.menu.newCaseSub)}</span></span></div>
    ${segHtml('size', t.size, SIZES.map((n) => [String(n), `${n}×${n}`]), String(m.pick.size))}
    ${segHtml('difficulty', t.difficulty, DIFFICULTIES.map((d) => [d, t.difficulties[d]]), m.pick.difficulty)}
    <button type="button" class="btn primary menu-start" data-menu="new">${esc(t.startCase)}</button></div>`);
  rows.push(row('tutorial', 'school', t.menu.tutorial, t.menu.tutorialSub, m.recommendTutorial ? ' recommended' : '',
    m.recommendTutorial ? `<span class="menu-badge">${esc(t.menu.recommended)}</span>` : ''));
  rows.push(row('rules', 'help', t.rulesTitle, t.menu.rulesSub));
  rows.push(row('settings', 'gear', t.menu.settings, t.menu.settingsSub));
  return `<div class="menu-panel">
    <header class="menu-head">${m.brand}<div><h2 id="menu-title">Karodoku</h2><p class="menu-tag">${esc(t.appTagline)}</p></div>
      ${m.canClose ? `<button type="button" class="dialog-x menu-x" data-menu="close" aria-label="${esc(t.menu.back)}">${icon('close')}</button>` : ''}</header>
    <nav class="menu-list" aria-label="${esc(t.menu.open)}">${rows.join('')}</nav></div>`;
}
