// Cockpit instruments: analogue gauges for the About stats, the radar scope in Skills, the wings on the
// certification badges. Numbers and labels stay in the HTML; these only add the instrument around them.
import { addTask } from '../core/loop.js';
import { env } from '../core/env.js';
import { qs, qsa, cssRgb } from '../core/util.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

// Dial range per stat, in page order: projects, certifications, CGPA, tools.
const DIAL_MAX = [15, 10, 10, 30];
const SWEEP = 270;

export function initGauges() {
  const stats = qsa('.astat');
  stats.forEach((stat, i) => {
    const value = parseFloat(qs('.num', stat).textContent) || 0;
    const max = DIAL_MAX[i] || value * 1.4;
    const dial = svg('svg', { class: 'gauge', viewBox: '0 0 120 120', 'aria-hidden': 'true' });
    const polar = (r, deg) => {
      const a = ((deg + 135) * Math.PI) / 180; // 0° of sweep sits at the lower left
      return [60 + r * Math.cos(a), 60 + r * Math.sin(a)];
    };
    for (let k = 0; k <= 30; k++) {
      const major = k % 5 === 0;
      const [x1, y1] = polar(major ? 44 : 48, (k / 30) * SWEEP);
      const [x2, y2] = polar(53, (k / 30) * SWEEP);
      dial.append(svg('line', { x1, y1, x2, y2, class: major ? 'g-major' : 'g-minor' }));
    }
    const [ax, ay] = polar(53, 0), [bx, by] = polar(53, (value / max) * SWEEP);
    const arc = svg('path', { d: `M${ax} ${ay}A53 53 0 ${(value / max) * SWEEP > 180 ? 1 : 0} 1 ${bx} ${by}`, class: 'g-arc', pathLength: 1 });
    dial.append(arc);
    const needle = svg('g', { class: 'g-needle' });
    needle.append(svg('path', { d: 'M60 66 L58.4 60 L60 18 L61.6 60 Z' }), svg('circle', { cx: 60, cy: 60, r: 4.5 }));
    dial.append(needle);
    // Needle rests at 0 of the sweep; CSS springs it to --deg when the gauge comes into view.
    stat.style.setProperty('--deg', `${(value / max) * SWEEP - 135}deg`);
    stat.prepend(dial);
  });

  if (env.reducedMotion) { stats.forEach((s) => s.classList.add('is-live')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-live'); io.unobserve(e.target); } });
  }, { threshold: 0.5 });
  stats.forEach((s) => io.observe(s));
}

// Spreads a skill's position deterministically so the scope looks the same on every visit.
const seeded = (s) => {
  let v = 2166136261;
  for (const c of s) v = Math.imul(v ^ c.charCodeAt(0), 16777619);
  return ((v >>> 0) % 1000) / 1000;
};

export function initRadar() {
  const host = qs('.radar');
  if (!host) return;
  document.documentElement.classList.add('has-radar');
  const canvas = qs('canvas', host);
  const ctx = canvas.getContext('2d');
  const cats = qsa('.skill-cat');
  const blips = [];
  cats.forEach((cat, ci) => {
    const a0 = (ci / cats.length) * Math.PI * 2;
    const a1 = ((ci + 1) / cats.length) * Math.PI * 2;
    qsa('.stag', cat).forEach((tag) => {
      const name = tag.textContent.trim();
      const blip = {
        name, cat: ci, tag,
        a: a0 + (0.12 + seeded(name) * 0.76) * (a1 - a0),
        r: 0.28 + seeded(name + 'r') * 0.62,
        lit: 0,
      };
      blips.push(blip);
      tag.addEventListener('pointerenter', () => { hot = blip; });
      tag.addEventListener('pointerleave', () => { hot = null; });
    });
    cat.addEventListener('pointerenter', () => { hotCat = ci; });
    cat.addEventListener('pointerleave', () => { hotCat = -1; });
  });

  let hot = null, hotCat = -1, size = 0, dpr = 1, visible = false, sweep = -Math.PI / 2;
  let rgb = cssRgb('--accent-rgb');
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = host.clientWidth;
    canvas.width = canvas.height = Math.round(size * dpr);
    if (env.reducedMotion) draw(0);
  };
  new ResizeObserver(resize).observe(host);
  resize();

  function draw(dt) {
    const c = `${rgb[0]},${rgb[1]},${rgb[2]}`;
    const R = size / 2 - 6, cx = size / 2, cy = size / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(2,12,18,0.92)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(${c},0.26)`;
    ctx.lineWidth = 1;
    for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(cx, cy, (R * k) / 4, 0, 7); ctx.stroke(); }
    for (let k = 0; k < cats.length; k++) {
      const a = (k / cats.length) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
    }
    if (hotCat >= 0) {
      const a0 = (hotCat / cats.length) * Math.PI * 2, a1 = ((hotCat + 1) / cats.length) * Math.PI * 2;
      ctx.fillStyle = `rgba(${c},0.12)`;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
    }
    if (!env.reducedMotion) {
      sweep = (sweep + dt * 0.0012) % (Math.PI * 2);
      if (ctx.createConicGradient) {
        const g = ctx.createConicGradient(sweep, cx, cy);
        g.addColorStop(0, `rgba(${c},0)`);
        g.addColorStop(0.75, `rgba(${c},0)`);
        g.addColorStop(0.998, `rgba(${c},0.42)`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      }
      ctx.strokeStyle = `rgba(${c},0.95)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); ctx.stroke();
    }
    ctx.font = `500 ${Math.max(10, size * 0.026)}px "DM Mono", monospace`;
    for (const b of blips) {
      const ang = ((b.a - sweep) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (ang > Math.PI * 2 - 0.09) b.lit = 1;
      b.lit = env.reducedMotion ? 0.8 : Math.max(0.14, b.lit - dt * 0.00034);
      const x = cx + Math.cos(b.a) * b.r * R, y = cy + Math.sin(b.a) * b.r * R;
      const on = hot === b || hotCat === b.cat;
      const a = on ? 1 : b.lit;
      ctx.fillStyle = hot === b ? `rgba(255,181,71,${a})` : `rgba(${c},${a})`;
      ctx.beginPath(); ctx.arc(x, y, hot === b ? 5 : 2.6 + b.lit * 1.6, 0, 7); ctx.fill();
      if (b.lit > 0.6 || on) {
        ctx.strokeStyle = `rgba(${c},${a * 0.45})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 7 + (1 - b.lit) * 11, 0, 7); ctx.stroke();
      }
      if (hot === b || (b.lit > 0.72 && size > 320)) {
        ctx.fillStyle = hot === b ? '#ffb547' : `rgba(${c},${b.lit})`;
        const right = x < cx;
        ctx.textAlign = right ? 'left' : 'right';
        ctx.fillText(b.name, x + (right ? 9 : -9), y + 3);
      }
    }
    ctx.strokeStyle = `rgba(${c},0.5)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
  }

  if (env.reducedMotion) { draw(0); return; }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) rgb = cssRgb('--accent-rgb');
  }).observe(host);
  addTask((t, dt) => { if (visible) draw(dt); });
}

export function initWings() {
  const wing = (flip) => {
    const el = svg('svg', { class: `wing${flip ? ' wing-r' : ''}`, viewBox: '0 0 96 40', 'aria-hidden': 'true' });
    // Stacked feathers fanning out from the medallion; the right wing is the same art mirrored inside the SVG.
    const g = svg('g', flip ? { transform: 'translate(96 0) scale(-1 1)' } : {});
    [[0, 92], [7, 80], [14, 68], [21, 56], [28, 44]].forEach(([y, len]) => {
      g.append(svg('path', { d: `M96 ${y + 4}L${96 - len} ${y}Q${96 - len - 5} ${y + 3} ${96 - len + 3} ${y + 6}L96 ${y + 10}Z` }));
    });
    el.append(g);
    return el;
  };
  qsa('.cert-card').forEach((card) => {
    const icon = qs('.cert-icon', card);
    const crest = document.createElement('div');
    crest.className = 'cert-crest';
    icon.before(crest);
    crest.append(wing(false), icon, wing(true));
  });
}
