// Service worker registration with an "update available" prompt.

import { registerSW } from 'virtual:pwa-register';
import { s } from '../i18n';

export function setupPwa(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const update = registerSW({
    onNeedRefresh() {
      const el = document.createElement('div');
      el.className = 'update-banner';
      el.setAttribute('role', 'status');
      const t = s();
      el.innerHTML = `<span></span><button type="button" class="btn primary"></button><button type="button" class="btn" aria-label="${t.close}">✕</button>`;
      el.querySelector('span')!.textContent = t.updateReady;
      const [go, close] = el.querySelectorAll('button');
      go.textContent = t.reload;
      go.onclick = () => void update(true);
      close.onclick = () => el.remove();
      document.body.appendChild(el);
    },
  });
}
