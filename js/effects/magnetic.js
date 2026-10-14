// Magnetic buttons: the button leans toward the cursor while it's near, then springs back.
// Uses the independent `translate` property so it composes with each button's own hover transform.
import { qsa } from '../core/util.js';

const SELECTOR = '.btn-primary, .btn-outline, .connect-cta, #theme-toggle, .social-icon, .dock-btn, .intro-skip';

export function initMagnetic(root = document) {
  qsa(SELECTOR, root).forEach((el) => {
    if (el.__magnetic) return;
    el.__magnetic = true;
    el.classList.add('magnetic');
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const max = Math.min(10, r.width * 0.12);
      el.style.translate = `${(dx * max).toFixed(1)}px ${(dy * max * 0.8).toFixed(1)}px`;
    });
    el.addEventListener('pointerleave', () => { el.style.translate = ''; });
  });
}
