// Toasts, styled dialogs and bottom sheets (no confirm()/alert()).

import { s } from '../i18n';
import { esc, reducedMotion } from './dom';
import { icon } from './icons';

let toastTimer = 0;
export function toast(msg: string, ms = 2400): void {
  const el = document.getElementById('toast')!;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
}

export interface DialogAction { label: string; primary?: boolean; value: string }

export interface DialogOptions {
  title: string;
  body?: string | Node;
  actions?: DialogAction[];
  className?: string;
  /** Called after render, e.g. to wire custom buttons; may call close(value). */
  setup?(dialog: HTMLDialogElement, close: (value: string) => void): void;
}

/** Show a styled modal dialog; resolves with the chosen action value ('' if dismissed). */
export function showDialog(opt: DialogOptions): Promise<string> {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = `dialog ${opt.className ?? ''}`;
    d.innerHTML = `<button class="dialog-x" type="button" aria-label="${esc(s().close)}">${icon('close')}</button>
      <h2>${esc(opt.title)}</h2><div class="dialog-body"></div><div class="dialog-actions"></div>`;
    const body = d.querySelector('.dialog-body')!;
    if (typeof opt.body === 'string') body.innerHTML = opt.body;
    else if (opt.body) body.appendChild(opt.body);
    const actions = d.querySelector('.dialog-actions')!;
    for (const a of opt.actions ?? []) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn${a.primary ? ' primary' : ''}`;
      b.textContent = a.label;
      b.onclick = () => close(a.value);
      actions.appendChild(b);
    }
    let done = false;
    const close = (value: string) => {
      if (done) return;
      done = true;
      d.classList.add('closing');
      setTimeout(() => { d.close(); d.remove(); }, reducedMotion() ? 0 : 160);
      resolve(value);
    };
    d.querySelector<HTMLButtonElement>('.dialog-x')!.onclick = () => close('');
    d.addEventListener('cancel', (e) => { e.preventDefault(); close(''); });
    d.addEventListener('click', (e) => { if (e.target === d) close(''); });
    document.body.appendChild(d);
    opt.setup?.(d, close);
    d.showModal();
  });
}

export function closeAllDialogs(): void {
  document.querySelectorAll('dialog[open]').forEach((d) => (d as HTMLDialogElement).close());
}
