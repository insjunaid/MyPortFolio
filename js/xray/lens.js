// X-ray lens: a circular window that follows the cursor and shows a live clone of the page rendered in
// the *opposite* mode — X-ray while browsing normally, plain sight while X-ray mode is on.
// The window and the clone only move by transforms, so following the cursor stays on the compositor.
import { addTask } from '../core/loop.js';
import { on, state } from '../core/bus.js';
import { pointer, scroll } from '../core/input.js';
import { addDockButton } from '../ui/dock.js';
import { h, qsa } from '../core/util.js';

const R = 86;

export function initLens() {
  let enabled = true;
  try { enabled = localStorage.getItem('argus:lens') !== '0'; } catch (e) { /* storage blocked */ }
  let win = null, doc = null, ring = null, tag = null, navClone = null, stop = null, dirty = true;
  let x = pointer.x, y = pointer.y;

  function build() {
    if (!win) {
      doc = h('div', { class: 'lens-doc', 'aria-hidden': 'true', inert: true });
      win = h('div', { id: 'xray-lens', 'aria-hidden': 'true' }, [doc]);
      tag = h('span', { class: 'lens-tag' });
      ring = h('div', { class: 'lens-ring', 'aria-hidden': 'true' }, [tag]);
      document.documentElement.style.setProperty('--lens-d', `${R * 2}px`);
      document.body.append(win, ring);
    }
    // Fresh clone of the page content (nav + main + footer). Decorative only: inert + aria-hidden.
    const parts = ['body > nav', 'main', 'body > footer'].map((s) => document.querySelector(s)).filter(Boolean);
    doc.replaceChildren(...parts.map((el) => el.cloneNode(true)));
    qsa('.scramble-layer, .attn-overlay', doc).forEach((el) => el.remove());
    qsa('.is-scrambling, .is-inferring', doc).forEach((el) => el.classList.remove('is-scrambling', 'is-inferring'));
    qsa('a, button, [tabindex]', doc).forEach((el) => el.setAttribute('tabindex', '-1'));
    navClone = doc.querySelector('nav');
    if (navClone) navClone.style.position = 'absolute';
    doc.style.width = `${document.documentElement.clientWidth}px`;
    skin();
    dirty = false;
  }

  function skin() {
    if (!doc) return;
    doc.classList.toggle('xr', !state.xray);
    doc.classList.toggle('xr-off', state.xray);
    tag.textContent = state.xray ? 'VISIBLE · λ 550nm' : 'X-RAY · 120 kVp';
  }

  function show(v) {
    if (!win) return;
    win.classList.toggle('is-on', v);
    ring.classList.toggle('is-on', v);
  }

  function tick() {
    const active = enabled && pointer.inside && !state.introActive && !pointer.keyboard;
    if (!active) { show(false); return; }
    if (dirty) build();
    show(true);
    x += (pointer.x - x) * 0.35;
    y += (pointer.y - y) * 0.35;
    const lx = x - R, ly = y - R;
    win.style.transform = `translate3d(${lx}px,${ly}px,0)`;
    ring.style.transform = `translate3d(${lx}px,${ly}px,0)`;
    doc.style.transform = `translate3d(${-lx}px,${-ly - scroll.y}px,0)`;
    if (navClone) navClone.style.top = `${scroll.y}px`;
  }

  const start = () => { if (!stop) stop = addTask(tick); };
  const halt = () => { if (stop) { stop(); stop = null; } show(false); };

  // Build lazily on the first real mouse movement, so it never costs anything for touch or bots.
  window.addEventListener('pointermove', function first(e) {
    if (e.pointerType !== 'mouse') return;
    window.removeEventListener('pointermove', first);
    if (enabled) start();
  });

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { dirty = true; }, 200); });
  on('xray', skin);
  // Content that changes after load (decoded headings, revealed sections) → refresh the clone.
  on('intro:done', () => { setTimeout(() => { dirty = true; }, 1500); });

  addDockButton({
    id: 'lens-toggle', label: 'Lens', key: 'l', order: 3, pressed: enabled,
    title: 'X-ray lens that follows your cursor',
    onToggle: (next) => {
      enabled = next;
      try { localStorage.setItem('argus:lens', next ? '1' : '0'); } catch (e) { /* storage blocked */ }
      if (next) start(); else halt();
      return next;
    },
  });
}
