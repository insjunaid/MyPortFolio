// Lenis inertia scrolling, driven by the shared loop and wired into ScrollTrigger.
// Anchor links (nav, skip link, CTAs) are routed through Lenis so they glide instead of jumping.
import { addTask } from '../core/loop.js';
import { state } from '../core/bus.js';
import { loadScript } from '../core/util.js';

export async function initSmoothScroll() {
  await loadScript('vendor/lenis.min.js').catch(() => {});
  if (!window.Lenis) return null;
  const lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 0.95 });
  state.lenis = lenis;
  addTask((t) => lenis.raf(t));

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented) return;
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: id === '#main' ? 0 : -8, duration: 1.4 });
    history.replaceState(null, '', id);
    // Move keyboard focus with the scroll so Tab continues from the new section.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
  return lenis;
}
