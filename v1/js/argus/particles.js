// Full-screen particle layer used for materialization, teleports and the easter egg.
// It only exists in the frame loop while a flight is running; otherwise it costs nothing.
import { addTask } from '../core/loop.js';
import { h, rand, ease } from '../core/util.js';

let canvas, ctx, stop = null, dpr = 1;
const flights = new Set();

function ensure() {
  if (!canvas) {
    canvas = h('canvas', { id: 'fx-layer', 'aria-hidden': 'true' });
    document.body.append(canvas);
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', size);
  }
  size();
}

function size() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
}

function frame(t) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.globalCompositeOperation = 'lighter';
  for (const f of flights) {
    if (!f.start) f.start = t;
    const el = t - f.start;
    let alive = false;
    for (const p of f.ps) {
      const k = Math.min(1, Math.max(0, (el - p.d) / f.dur));
      if (k < 1) alive = true;
      const e = f.ease(k);
      const u = 1 - e;
      // quadratic bezier from (sx,sy) via control (qx,qy) to (ex,ey) + a decaying wobble
      const wob = Math.sin(el * 0.004 + p.ph) * p.w * u;
      const x = u * u * p.sx + 2 * u * e * p.qx + e * e * p.ex + wob;
      const y = u * u * p.sy + 2 * u * e * p.qy + e * e * p.ey + wob * 0.6;
      const alpha = f.alpha(k, p) * p.a;
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.c;
      ctx.fillRect(x, y, p.s, p.s);
    }
    if (!alive || el > f.dur + f.maxDelay + 50) {
      flights.delete(f);
      f.resolve();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (!flights.size) { stop(); stop = null; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}

/**
 * Fly particles from `from[i]` to `to[i]` (screen coords). Arrays may differ in length: the shorter
 * one is cycled. Returns a promise that resolves when every particle has landed.
 * opts: { dur, stagger(i,p)→ms, arc (bezier bulge px), wobble, size, alpha(k,p), ease }
 */
export function fly(from, to, opts = {}) {
  ensure();
  const n = Math.max(from.length, to.length);
  const dur = opts.dur || 900;
  const ps = new Array(n);
  let maxDelay = 0;
  for (let i = 0; i < n; i++) {
    const a = from[i % from.length], b = to[i % to.length];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const arc = opts.arc == null ? 120 : opts.arc;
    const d = opts.stagger ? opts.stagger(i, a, b) : rand(0, 250);
    maxDelay = Math.max(maxDelay, d);
    ps[i] = {
      sx: a.x, sy: a.y, ex: b.x, ey: b.y,
      qx: mx + rand(-arc, arc), qy: my + rand(-arc, arc) * 0.7,
      d, ph: rand(Math.PI * 2), w: opts.wobble == null ? rand(4, 14) : opts.wobble,
      c: b.c || a.c || '#5ce1ff', a: b.a || a.a || 1,
      s: opts.size || (Math.random() < 0.15 ? 2.2 : 1.4),
    };
  }
  return new Promise((resolve) => {
    flights.add({
      ps, dur, maxDelay, resolve, start: 0,
      ease: opts.ease || ease.inOutCubic,
      alpha: opts.alpha || ((k) => (k < 0.08 ? k / 0.08 : 1)),
    });
    if (!stop) stop = addTask(frame);
  });
}

/** Land every running flight immediately (used when the intro is skipped). */
export function cancelAll() {
  for (const f of flights) { flights.delete(f); f.resolve(); }
  if (ctx) ctx.clearRect(0, 0, innerWidth, innerHeight);
}

/** Random points scattered across (and slightly beyond) the viewport. */
export function scatter(n, margin = 60) {
  return Array.from({ length: n }, () => ({ x: rand(-margin, innerWidth + margin), y: rand(-margin, innerHeight + margin) }));
}

/** Points placed on a rasterised text string, for particle typography. */
export function sampleText(text, { font = '800 120px Syne, sans-serif', step = 4, maxWidth = innerWidth * 0.86 } = {}) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d', { willReadFrequently: true });
  x.font = font;
  const lines = text.split('\n');
  const lh = parseInt(font.match(/(\d+)px/)[1], 10) * 1.05;
  let w = Math.max(...lines.map((l) => x.measureText(l).width));
  const scale = Math.min(1, maxWidth / w);
  c.width = Math.ceil(w * scale) + 8; c.height = Math.ceil(lh * lines.length * scale) + 8;
  x.scale(scale, scale);
  x.font = font; x.fillStyle = '#fff'; x.textBaseline = 'top';
  lines.forEach((l, i) => x.fillText(l, (w - x.measureText(l).width) / 2 + 4, i * lh + 4));
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const pts = [];
  for (let y = 0; y < c.height; y += step) for (let xx = 0; xx < c.width; xx += step) {
    if (d[(y * c.width + xx) * 4 + 3] > 128) pts.push({ x: xx, y });
  }
  return { pts, w: c.width, h: c.height };
}
