// Targeting-reticle cursor. Free-floating it's a small crosshair; over anything interactive the four
// corner brackets "lock on" to the element's bounds with a class label, like a tracker acquiring a target.
// The same brackets also frame keyboard focus, so Tab users get a HUD focus ring.
import { addTask } from '../core/loop.js';
import { pointer } from '../core/input.js';
import { env } from '../core/env.js';
import { h, lerp } from '../core/util.js';

const TARGETS = [
  ['.project-card', 'project'], ['.exp-card', 'experience'], ['.cert-card', 'credential'],
  ['.ach-card', 'achievement'], ['.skill-cat', 'skill_group'], ['.astat', 'metric'],
  ['.edu-card', 'degree'], ['.hero-ide-card', 'source_code'], ['#argus-hit', 'ARGUS'],
  ['.dock-btn', 'control'], ['button', 'action'], ['a', 'link'], ['input, textarea', 'input'],
];
const SELECTOR = TARGETS.map(([s]) => s).join(',');

function classify(el) {
  for (const [s, label] of TARGETS) if (el.matches(s)) return label;
  return 'object';
}

export function initReticle() {
  const corners = [0, 1, 2, 3].map((i) => h('i', { class: `rt-c rt-c${i}` }));
  const dot = h('i', { class: 'rt-dot' });
  const label = h('span', { class: 'rt-label' });
  const root = h('div', { id: 'reticle', 'aria-hidden': 'true' }, [...corners, dot, label]);
  document.body.append(root);
  document.documentElement.classList.add('has-reticle');

  let target = null, kind = '';
  const box = { x: pointer.x - 14, y: pointer.y - 14, w: 28, h: 28 };
  const dotPos = { x: pointer.x, y: pointer.y };
  const snap = env.reducedMotion ? 1 : 0.24;

  const setTarget = (el) => {
    if (el === target) return;
    target = el;
    kind = el ? classify(el) : '';
    root.classList.toggle('is-locked', !!el);
    label.textContent = el ? `LOCK · ${kind}` : '';
  };

  document.addEventListener('pointerover', (e) => setTarget(e.target.closest(SELECTOR)));
  document.addEventListener('focusin', (e) => { if (pointer.keyboard) setTarget(e.target.closest(SELECTOR) || e.target); });
  document.addEventListener('focusout', () => { if (pointer.keyboard) setTarget(null); });

  addTask(() => {
    root.classList.toggle('is-hidden', !pointer.inside && !pointer.keyboard);
    let tx, ty, tw, th;
    if (target && target.isConnected) {
      const r = target.getBoundingClientRect();
      const pad = r.width > 240 ? 6 : 5;
      tx = r.left - pad; ty = r.top - pad; tw = r.width + pad * 2; th = r.height + pad * 2;
    } else {
      if (target) setTarget(null);
      const s = 26;
      tx = pointer.x - s / 2; ty = pointer.y - s / 2; tw = s; th = s;
    }
    box.x = lerp(box.x, tx, snap); box.y = lerp(box.y, ty, snap);
    box.w = lerp(box.w, tw, snap); box.h = lerp(box.h, th, snap);
    dotPos.x = pointer.x; dotPos.y = pointer.y;

    const { x, y, w, h: hh } = box;
    corners[0].style.transform = `translate3d(${x}px,${y}px,0)`;
    corners[1].style.transform = `translate3d(${x + w}px,${y}px,0)`;
    corners[2].style.transform = `translate3d(${x}px,${y + hh}px,0)`;
    corners[3].style.transform = `translate3d(${x + w}px,${y + hh}px,0)`;
    dot.style.transform = `translate3d(${dotPos.x}px,${dotPos.y}px,0)`;
    label.style.transform = `translate3d(${x}px,${y - 18}px,0)`;
  });
}
