// Living neural-network background. Nodes sit in loose feed-forward layers; "forward passes" travel
// left→right as pulses along the edges. The cursor acts as an input activation (nearby neurons fire),
// and scroll velocity raises the firing rate and bends the field.
import { addTask } from '../core/loop.js';
import { on, state } from '../core/bus.js';
import { pointer, scroll } from '../core/input.js';
import { env } from '../core/env.js';
import { rand, cssRgb, h } from '../core/util.js';

export function initNeuralBg({ still = false } = {}) {
  const canvas = h('canvas', { id: 'neural-bg', 'aria-hidden': 'true' });
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let nodes = [], edges = [], out = [], pulses = [];
  let rgb = [92, 225, 255];
  let flowY = 0, nextPass = 0, frame = 0;
  const lite = env.mobile || env.lowPower;

  const readColor = () => { rgb = cssRgb('--net-rgb'); };

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const layers = W < 760 ? 4 : W < 1200 ? 6 : 8;
    const perLayer = Math.max(4, Math.round(H / (lite ? 150 : 115)));
    nodes = []; edges = []; out = [];
    for (let l = 0; l < layers; l++) {
      const count = perLayer + ((l % 2) ? -1 : 0);
      for (let j = 0; j < count; j++) {
        nodes.push({
          l, ax: W * (l + 0.5) / layers + rand(-W / layers * 0.28, W / layers * 0.28),
          ay: H * (j + 0.5) / count + rand(-30, 30), x: 0, y: 0, ph: rand(Math.PI * 2), act: 0,
        });
      }
    }
    nodes.forEach((n, i) => {
      n.x = n.ax; n.y = n.ay; out[i] = [];
      const next = nodes.map((m, k) => [m, k]).filter(([m]) => m.l === n.l + 1)
        .sort((a, b) => Math.abs(a[0].ay - n.ay) - Math.abs(b[0].ay - n.ay)).slice(0, lite ? 2 : 3);
      next.forEach(([, k]) => { out[i].push(edges.length); edges.push([i, k]); });
    });
    pulses = [];
    if (still) draw(0);
  }

  function fire(i, strength = 1) {
    const n = nodes[i];
    n.act = Math.min(1, n.act + strength);
    const outs = out[i];
    if (!outs.length || pulses.length > (lite ? 40 : 90)) return;
    const k = outs[(Math.random() * outs.length) | 0];
    pulses.push({ e: k, t: 0, v: rand(0.012, 0.022), s: strength });
  }

  function update(t, dt) {
    const k = dt / 16.7;
    const vel = scroll.velocity;
    flowY += ((-vel * 0.9) - flowY) * 0.06;
    flowY = Math.max(-60, Math.min(60, flowY));

    // Spontaneous forward passes; scrolling makes the network "think harder".
    const rate = 1700 / (1 + Math.min(4, Math.abs(vel) * 0.08));
    if (t > nextPass) {
      const inputs = nodes.reduce((a, n, i) => (n.l === 0 ? a.concat(i) : a), []);
      fire(inputs[(Math.random() * inputs.length) | 0], 0.9);
      nextPass = t + rate * rand(0.6, 1.3);
    }

    const px = pointer.x, py = pointer.y, R = 170;
    nodes.forEach((n, i) => {
      n.x = n.ax + Math.sin(t * 0.00021 + n.ph) * 14;
      n.y = n.ay + Math.cos(t * 0.00017 + n.ph * 1.3) * 11 + flowY * (0.4 + (n.l % 3) * 0.3);
      if (pointer.inside && !lite) {
        const dx = px - n.x, dy = py - n.y, d = Math.hypot(dx, dy);
        if (d < R) {
          const p = 1 - d / R;
          n.x += dx * p * 0.12; n.y += dy * p * 0.12;
          if (p > 0.55 && n.act < 0.3 && Math.random() < 0.06 * k) fire(i, 0.8);
          n.act = Math.max(n.act, p * 0.55);
        }
      }
      n.act *= Math.pow(0.955, k);
    });

    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += p.v * k;
      if (p.t >= 1) {
        const target = edges[p.e][1];
        pulses.splice(i, 1);
        if (Math.random() < 0.82) fire(target, p.s * 0.92); else nodes[target].act = Math.min(1, nodes[target].act + 0.6);
      }
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const [r, g, b] = rgb;
    const col = (a) => `rgba(${r},${g},${b},${a})`;

    // Base wiring in a single path (one stroke call), then the excited edges on top.
    ctx.lineWidth = 1;
    ctx.strokeStyle = col(0.055);
    ctx.beginPath();
    for (const [a, c] of edges) { ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[c].x, nodes[c].y); }
    ctx.stroke();
    for (const [a, c] of edges) {
      const e = (nodes[a].act + nodes[c].act) * 0.5;
      if (e < 0.08) continue;
      ctx.strokeStyle = col(e * 0.32);
      ctx.beginPath(); ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[c].x, nodes[c].y); ctx.stroke();
    }

    for (const n of nodes) {
      ctx.fillStyle = col(0.18 + n.act * 0.7);
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.5 + n.act * 2.6, 0, Math.PI * 2); ctx.fill();
      if (n.act > 0.35) {
        ctx.strokeStyle = col(n.act * 0.25);
        ctx.beginPath(); ctx.arc(n.x, n.y, 5 + n.act * 9, 0, Math.PI * 2); ctx.stroke();
      }
    }

    ctx.lineCap = 'round';
    for (const p of pulses) {
      const [a, c] = edges[p.e], A = nodes[a], C = nodes[c];
      const t0 = Math.max(0, p.t - 0.12);
      ctx.strokeStyle = col(0.75 * p.s);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(A.x + (C.x - A.x) * t0, A.y + (C.y - A.y) * t0);
      ctx.lineTo(A.x + (C.x - A.x) * p.t, A.y + (C.y - A.y) * p.t);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  readColor();
  build();
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 150); });
  const recolor = () => requestAnimationFrame(() => { readColor(); if (still) draw(); });
  on('theme', recolor);
  on('xray', recolor);

  if (still) return;
  addTask((t, dt) => {
    if (state.introActive) return;
    // Mobile / low-power: 30 fps is plenty for an ambient layer.
    if (lite && (frame++ & 1)) return;
    update(t, lite ? dt * 2 : dt);
    draw();
  });
}
