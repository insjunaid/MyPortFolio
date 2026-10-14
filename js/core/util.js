export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const qs = (s, root = document) => root.querySelector(s);
export const qsa = (s, root = document) => [...root.querySelectorAll(s)];

export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inCubic: (t) => t * t * t,
};

/** Create an element: h('div', { class: 'x', 'aria-hidden': 'true' }, 'text' | Node | [...]) */
export function h(tag, attrs = {}, children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  if (children != null) [].concat(children).forEach((c) => el.append(c));
  return el;
}

/** Read an "r,g,b" triplet custom property, e.g. cssRgb('--accent-rgb') → [92,225,255] */
export function cssRgb(name, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(name).split(',').map((n) => parseFloat(n) || 0);
}

/** Fake but plausible detector confidence, 2 decimals, biased high. */
export const conf = (min = 0.9, max = 0.995) => (min + Math.random() * (max - min)).toFixed(2);

export const isTyping = (e) => {
  const t = e.target;
  return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
};
