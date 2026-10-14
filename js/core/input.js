// Shared pointer + scroll telemetry. One listener each, read by every effect.
export const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  inside: false,
  lastMove: performance.now(),
  keyboard: false, // true after Tab navigation, false after the next pointer move
};

export const scroll = {
  y: window.scrollY,
  velocity: 0, // px per frame, smoothed
};

let lastY = window.scrollY;

window.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.inside = true;
  pointer.keyboard = false;
  pointer.lastMove = performance.now();
}, { passive: true });

document.documentElement.addEventListener('pointerleave', () => { pointer.inside = false; });
window.addEventListener('blur', () => { pointer.inside = false; });
window.addEventListener('keydown', (e) => { if (e.key === 'Tab') pointer.keyboard = true; });

window.addEventListener('scroll', () => { scroll.y = window.scrollY; }, { passive: true });

/** Called once per frame by main.js so velocity decays smoothly even when scrolling stops. */
export function sampleScroll() {
  const y = window.scrollY;
  scroll.velocity += ((y - lastY) - scroll.velocity) * 0.2;
  lastY = y;
  scroll.y = y;
}
