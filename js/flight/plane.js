// The jet. One canvas sits between the sky and the page, so the aircraft and its contrails pass behind
// the content panels and show through the gaps and gutters. The route is a pure function of altitude,
// which makes the whole flight scroll-linked: scroll back and the contrail retracts exactly.
// Also here: the hero takeoff, the HUD pitch ladder, the sonic boom and the fly-by.
import { addTask } from '../core/loop.js';
import { emit, on, state } from '../core/bus.js';
import { env } from '../core/env.js';
import { h, clamp, lerp, rand } from '../core/util.js';
import { flight, CLOUD_DECK, MACH_ONE } from './progress.js';

const TAU = Math.PI * 2;

// Section lanes: [altitude where the plane crosses to the other side]. Crossings sit in the sky gaps.
const CROSSINGS = [0.21, 0.365, 0.535, 0.685, 0.805, 0.915];
const CROSS_HALF = 0.03;

const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Horizontal route position, 0..1 of the lane span. Starts on the left lane, swaps at each crossing. */
function lane(a) {
  let side = 0;
  for (const c of CROSSINGS) {
    const k = smooth(clamp((a - (c - CROSS_HALF)) / (CROSS_HALF * 2), 0, 1));
    side = lerp(side, 1 - side, k);
    if (k < 1) break;
  }
  return side;
}

const FUSELAGE = new Path2D('M0-62C5-52 8-36 8-14L8 44 4 60-4 60-8 44-8-14C-8-36-5-52 0-62Z');
const WING_R = new Path2D('M8-8 66 26 66 33 8 24Z');
const WING_L = new Path2D('M-8-8-66 26-66 33-8 24Z');
const TAIL_R = new Path2D('M6 42 26 56 26 61 5 55Z');
const TAIL_L = new Path2D('M-6 42-26 56-26 61-5 55Z');
const SIDE_JET = new Path2D('M-70 3C-72-2-66-6-54-7L34-8C46-9 60-5 72 1 62 6 46 8 30 8L-52 9C-62 9-69 7-70 3ZM-64-5-74-27-62-27-44-7ZM-16 6 22 7 -6 26-24 26Z');

/** Top-down jet, nose along -y. `bank` -1..1 narrows the wings and shifts their shading. */
export function drawJet(ctx, x, y, rot, s, bank, t, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s * (1 - Math.abs(bank) * 0.34), s);

  // Engine glow, stronger the harder we climb
  const burn = opts.burn == null ? 0.4 : opts.burn;
  ctx.globalCompositeOperation = 'lighter';
  for (const ex of [-26, 26]) {
    const len = 14 + burn * 46 + Math.sin(t * 0.04 + ex) * 3;
    const g = ctx.createLinearGradient(0, 22, 0, 22 + len);
    g.addColorStop(0, 'rgba(255,214,150,0.95)');
    g.addColorStop(0.35, 'rgba(120,200,255,0.55)');
    g.addColorStop(1, 'rgba(92,225,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(ex - 3.5, 22); ctx.lineTo(ex + 3.5, 22); ctx.lineTo(ex, 22 + len); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  const light = bank > 0 ? 1 : 1 - Math.abs(bank) * 0.3;
  const dark = bank < 0 ? 1 : 1 - Math.abs(bank) * 0.3;
  const wing = (k) => `rgb(${Math.round(150 * k)},${Math.round(168 * k)},${Math.round(186 * k)})`;
  ctx.fillStyle = wing(light); ctx.fill(WING_R); ctx.fill(TAIL_R);
  ctx.fillStyle = wing(dark); ctx.fill(WING_L); ctx.fill(TAIL_L);
  ctx.fillStyle = '#5d6f80';
  for (const ex of [-26, 26]) { ctx.beginPath(); ctx.roundRect(ex - 4, 4, 8, 19, 3); ctx.fill(); }
  const body = ctx.createLinearGradient(-8, 0, 8, 0);
  body.addColorStop(0, '#8ea0b0'); body.addColorStop(0.45, '#f2f6f9'); body.addColorStop(1, '#7c8f9f');
  ctx.fillStyle = body; ctx.fill(FUSELAGE);
  ctx.fillStyle = '#0b1a26';
  ctx.beginPath(); ctx.ellipse(0, -44, 3.6, 7, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(92,225,255,0.55)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, 40); ctx.stroke();

  // Nav lights: red port, green starboard, white double strobe
  const strobe = (t % 1300) < 70 || ((t % 1300) > 170 && (t % 1300) < 240);
  ctx.globalCompositeOperation = 'lighter';
  const lamp = (lx, ly, c, r) => {
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, r, 0, TAU); ctx.fill();
  };
  lamp(-65, 29, 'rgba(255,60,70,0.95)', 7);
  lamp(65, 29, 'rgba(60,255,140,0.95)', 7);
  if (strobe) { lamp(-65, 29, 'rgba(255,255,255,1)', 16); lamp(65, 29, 'rgba(255,255,255,1)', 16); lamp(0, 58, 'rgba(255,255,255,0.9)', 12); }
  ctx.restore();
}

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return c;
}

export function initPlane({ sky, hud = true } = {}) {
  const canvas = h('canvas', { id: 'flight-fx', 'aria-hidden': 'true' });
  document.getElementById('sky') ? document.getElementById('sky').after(canvas) : document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const lite = env.mobile || env.lowPower || env.touch;
  const reduced = env.reducedMotion;
  const dot = softDot();
  let W = 0, H = 0, dpr = 1, frame = 0;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 1.5);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  size();
  window.addEventListener('resize', size);

  const scale = () => clamp(W / 1500, 0.46, 0.92);
  const laneXs = () => {
    const gutter = Math.max(0, (W - 1160) / 2);
    const inset = gutter > 90 ? gutter / 2 : Math.max(26, W * 0.07);
    return [inset, W - inset];
  };
  const xAt = (a) => { const [l, r] = laneXs(); return l + (r - l) * lane(a); };
  const planeY = (a) => H * (0.58 + 0.05 * Math.sin(a * 26));

  // The contrail samples the route behind the aircraft. Older points sit lower: the sky falls past us.
  const STEP = 0.0014;
  const SAMPLES = lite ? 70 : 130;
  const fall = () => (H * 0.78) / (SAMPLES * STEP);

  const puffs = [];
  let takeoff = null, flyby = null, lastBoom = -1e9, prevAlt = flight.alt, lastTakeoff = -1e9;

  function drawContrail(alt, px, py, s, color, t) {
    const K = fall();
    const spread = 26 * s;
    // Sample both trails once, then stroke them in a few alpha bands: ~12 strokes a frame, not hundreds.
    const pts = [[], []];
    for (let i = 1; i <= SAMPLES; i++) {
      const a = alt - i * STEP;
      if (a < 0.03) break;
      const age = i / SAMPLES;
      const x0 = xAt(a), x1 = xAt(a + STEP);
      const nx = x1 - x0, ny = -K * STEP;
      const nl = Math.hypot(nx, ny) || 1;
      for (let side = 0; side < 2; side++) {
        const sgn = side ? 1 : -1;
        // Twin trails start at the engines and merge as they age, with a slow turbulent wander.
        const off = sgn * spread * (1 - age * 0.72);
        const wob = reduced ? 0 : Math.sin(a * 240 + t * 0.0006 + sgn) * age * 7;
        pts[side].push(x0 + (-ny / nl) * off + wob, py + (alt - a) * K + (nx / nl) * off);
      }
    }
    const n = pts[0].length / 2;
    if (n < 2) return;
    ctx.lineCap = 'butt'; // round caps would double up into bright beads where the bands meet
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = state.xray || isDay() ? 'source-over' : 'lighter';
    const BANDS = 6;
    for (let bnd = 0; bnd < BANDS; bnd++) {
      const i0 = Math.floor((bnd / BANDS) * (n - 1)), i1 = Math.min(n - 1, Math.ceil(((bnd + 1) / BANDS) * (n - 1)));
      const age = (bnd + 0.5) / BANDS;
      const fade = Math.pow(1 - age, 1.6);
      ctx.beginPath();
      for (const line of pts) {
        ctx.moveTo(line[i0 * 2], line[i0 * 2 + 1]);
        for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(line[i * 2], line[i * 2 + 1]);
      }
      ctx.strokeStyle = `rgba(${color},${(fade * 0.13).toFixed(3)})`;
      ctx.lineWidth = (5 + age * 26) * s * 1.4;
      ctx.stroke();
      ctx.strokeStyle = `rgba(${color},${(fade * 0.62).toFixed(3)})`;
      ctx.lineWidth = (1.6 + age * 3.4) * s * 1.4;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  const isDay = () => document.documentElement.getAttribute('data-theme') === 'light';

  function drawPuffs(dt, color) {
    ctx.globalCompositeOperation = isDay() ? 'source-over' : 'lighter';
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life += dt / p.ttl;
      if (p.life >= 1) { puffs.splice(i, 1); continue; }
      p.y += p.vy * dt; p.x += p.vx * dt;
      const r = p.r * (1 + p.life * 3);
      ctx.globalAlpha = (1 - p.life) * 0.22;
      ctx.drawImage(dot, p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // HUD: pitch ladder, flight-path marker and coordinates that react to the mouse.
  function drawHud(alt, t) {
    const a = clamp((alt - 0.03) / 0.05, 0.12, 1) * (isDay() ? 0.3 : 0.5);
    const c = state.xray ? '226,240,248' : isDay() ? '6,40,70' : '110,235,255';
    const cx = W / 2 + flight.mx * 26, cy = H / 2 + flight.my * 16;
    const roll = flight.mx * 0.2;
    const pitch = flight.my * 70 + flight.rate * 5200;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = `rgba(${c},${a})`;
    ctx.fillStyle = `rgba(${c},${a})`;
    ctx.lineWidth = 1.2;
    ctx.font = '500 10px "DM Mono", monospace';
    ctx.save();
    ctx.rotate(roll);
    ctx.textAlign = 'left';
    for (let d = -30; d <= 30; d += 10) {
      const y = pitch + d * 9;
      if (Math.abs(y) > H * 0.4) continue;
      const w = d === 0 ? 300 : 96;
      const gap = d === 0 ? 60 : 44;
      ctx.setLineDash(d > 0 ? [7, 5] : []);
      ctx.beginPath();
      ctx.moveTo(-gap - w, y); ctx.lineTo(-gap, y); ctx.moveTo(gap, y); ctx.lineTo(gap + w, y);
      if (d !== 0) {
        const tip = d > 0 ? 7 : -7;
        ctx.moveTo(-gap - w, y); ctx.lineTo(-gap - w, y + tip);
        ctx.moveTo(gap + w, y); ctx.lineTo(gap + w, y + tip);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (d !== 0) { ctx.fillText(String(Math.abs(d)), gap + w + 6, y + 3); }
    }
    ctx.restore();
    // Boresight
    ctx.beginPath();
    ctx.moveTo(-26, 0); ctx.lineTo(-10, 0); ctx.lineTo(-5, 7); ctx.lineTo(0, 0); ctx.lineTo(5, 7); ctx.lineTo(10, 0); ctx.lineTo(26, 0);
    ctx.stroke();
    // Roll arc
    ctx.beginPath(); ctx.arc(0, 0, 170, -Math.PI * 0.72, -Math.PI * 0.28); ctx.stroke();
    for (let d = -3; d <= 3; d++) {
      const ang = -Math.PI / 2 + d * 0.17;
      ctx.beginPath(); ctx.moveTo(Math.cos(ang) * 170, Math.sin(ang) * 170); ctx.lineTo(Math.cos(ang) * 178, Math.sin(ang) * 178); ctx.stroke();
    }
    ctx.save(); ctx.rotate(roll);
    ctx.beginPath(); ctx.moveTo(0, -168); ctx.lineTo(-5, -158); ctx.lineTo(5, -158); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // Climb gates: a "highway in the sky" rising off the runway, drawn as detection brackets.
  function drawGates(alt, t) {
    const fade = 1 - clamp(alt / 0.03, 0, 1);
    if (fade <= 0) return;
    const c = isDay() ? '0,92,130' : '110,235,255';
    const N = 7;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'butt';
    for (let i = 0; i < N; i++) {
      const d = ((i + t * 0.00022) % N) / N;       // 0 far … 1 at the windscreen
      const e = d * d * d;
      const hw = 7 + e * 150, hh = hw * 0.62;
      const x = W / 2 + flight.mx * -18 * e;
      const y = H * 0.74 - H * 0.2 * e - d * H * 0.05;
      const a = Math.min(d * 5, 1) * Math.pow(1 - d, 1.4) * 0.8 * fade;
      if (a < 0.02) continue;
      const k = hw * 0.34;
      ctx.strokeStyle = `rgba(${c},${a.toFixed(3)})`;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = x + sx * hw, cy = y + sy * hh;
        ctx.moveTo(cx - sx * k, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - sy * k);
      }
      ctx.stroke();
    }
  }

  // Side-on takeoff run along the horizon, below the hero content so it stays in full view.
  // Plays once after boot and again whenever you come back down to the runway.
  function drawTakeoff(t) {
    const p = (t - takeoff) / 6200;
    if (p >= 1) { takeoff = null; return; }
    const groundY = H * 0.785 - 13;
    const liftAt = 0.5;
    const s = clamp(W / 1400, 0.56, 1.1);
    const at = (k) => {
      const roll = clamp(k / liftAt, 0, 1);
      const air = clamp((k - liftAt) / (1 - liftAt), 0, 1);
      return [-130 + W * 0.56 * roll * roll + (W * 0.72) * air, groundY - Math.pow(air, 1.7) * H * 0.17];
    };
    const [x, y] = at(p);
    const air = clamp((p - liftAt) / (1 - liftAt), 0, 1);
    const pitch = -Math.min(0.2, air * 0.9);
    const roll = clamp(p / liftAt, 0, 1);
    const trail = isDay() ? '255,255,255' : '150,226,255';
    if (air > 0) {
      ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = isDay() ? 'source-over' : 'lighter';
      const BANDS = 5, SEG = 8;
      for (let bnd = 0; bnd < BANDS; bnd++) {
        ctx.beginPath();
        for (let i = 0; i <= SEG; i++) {
          const k = p - (bnd * SEG + i) * 0.006;
          if (k < liftAt - 0.08) break;
          const [qx, qy] = at(k);
          if (i === 0) ctx.moveTo(qx - 62 * s, qy + 8 * s); else ctx.lineTo(qx - 62 * s, qy + 8 * s);
        }
        ctx.strokeStyle = `rgba(${trail},${(0.62 * (1 - bnd / BANDS)).toFixed(3)})`;
        ctx.lineWidth = (2.4 + bnd * 1.7) * s;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.translate(x, y); ctx.rotate(pitch); ctx.scale(s, s);
    if (roll > 0.15) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(-68, 0, -130, 0);
      g.addColorStop(0, 'rgba(255,214,150,0.9)'); g.addColorStop(1, 'rgba(92,225,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-66, -2); ctx.lineTo(-66, 8); ctx.lineTo(-130, 3); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = isDay() ? '#26343f' : '#dfe8ef';
    ctx.fill(SIDE_JET);
    ctx.fillStyle = isDay() ? '#8fd3f0' : '#0b1a26';
    ctx.beginPath(); ctx.ellipse(50, -2, 10, 3, 0.1, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const beacon = (t % 900) < 90;
    if (beacon) { ctx.fillStyle = 'rgba(255,70,80,0.95)'; ctx.beginPath(); ctx.arc(-68, -26, 4, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  addTask((t, dt) => {
    if (state.introActive) return;
    if (lite && (frame++ & 1)) return;
    const step = lite ? dt * 2 : dt;
    const alt = flight.alt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (hud && !lite && !reduced) drawHud(alt, t);
    if (!lite && !reduced) drawGates(alt, t);
    if (takeoff !== null) drawTakeoff(t);

    // The chase plane appears once we've left the ground, climbing in from below the screen.
    const show = clamp((alt - 0.035) / 0.03, 0, 1);
    if (show > 0) {
      const s = scale();
      const px = xAt(alt) + (reduced ? 0 : Math.sin(t * 0.0009) * 5);
      const py = planeY(alt) + (1 - smooth(show)) * H * 0.62 + (reduced ? 0 : Math.cos(t * 0.0012) * 4);
      const K = fall();
      const dx = (xAt(alt + 0.0015) - xAt(alt - 0.0015)) / 0.003;
      const heading = Math.atan2(dx, K);
      const bank = clamp(heading / 1.1, -1, 1);
      const color = state.xray ? '226,240,248' : isDay() ? '255,255,255' : '170,232,255';
      drawContrail(alt, px, py, s, color, t);
      const climb = clamp(Math.abs(flight.rate) * 900, 0, 1);

      if (!reduced && !lite && Math.abs(flight.rate) > 0.00004 && puffs.length < 70) {
        const back = heading + Math.PI;
        puffs.push({
          x: px + Math.sin(back) * 60 * s * -1 + rand(-6, 6), y: py + 52 * s, vx: rand(-0.008, 0.008),
          vy: Math.sign(flight.rate || 1) * 0.1, r: rand(6, 11) * s, life: 0, ttl: rand(700, 1300),
        });
      }
      drawPuffs(step, color);

      // Vapour cone as we punch through Mach 1
      const near = 1 - clamp(Math.abs(alt - MACH_ONE) / 0.02, 0, 1);
      if (near > 0 && !reduced) {
        ctx.save();
        ctx.translate(px, py); ctx.rotate(heading);
        const r = 62 * s * (0.7 + near * 0.6);
        const g = ctx.createRadialGradient(0, 8 * s, r * 0.15, 0, 8 * s, r);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.72, `rgba(235,247,255,${0.5 * near})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(0, 8 * s, r, r * 0.62, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }

      ctx.globalAlpha = show;
      drawJet(ctx, px, py, heading, s, bank, t, { burn: climb });
      ctx.globalAlpha = 1;

      // Crossing events fire only on the way up
      if (!reduced && prevAlt < MACH_ONE && alt >= MACH_ONE && t - lastBoom > 6000) {
        lastBoom = t;
        sky && sky.boom(px, py);
        document.documentElement.classList.add('boom');
        setTimeout(() => document.documentElement.classList.remove('boom'), 420);
        emit('flight:callout', { text: 'MACH 1.0 — SONIC BOOM' });
      }
      if (prevAlt < CLOUD_DECK && alt >= CLOUD_DECK) emit('flight:callout', { text: 'BREAKING THROUGH THE CLOUD DECK' });
    }
    prevAlt = alt;

    // Coming back down to the runway re-arms the takeoff
    if (alt < 0.004 && takeoff === null && !reduced && t - lastTakeoff > 16000 && flight.armed) {
      flight.armed = false;
      lastTakeoff = t; takeoff = t;
    }
    if (alt > 0.05) flight.armed = true;
  });

  const startTakeoff = () => {
    if (reduced || flight.alt > 0.03) return;
    const now = performance.now();
    lastTakeoff = now; takeoff = now;
  };
  on('takeoff', startTakeoff);

  // Fly-by: a three-ship formation screams across on top of everything (Konami / easter egg).
  function flyBy() {
    if (flyby || reduced) return;
    const top = h('canvas', { class: 'flyby-layer', 'aria-hidden': 'true' });
    document.body.append(top);
    const d = Math.min(window.devicePixelRatio || 1, 1.5);
    top.width = innerWidth * d; top.height = innerHeight * d;
    const c = top.getContext('2d');
    const t0 = performance.now();
    const ang = 1.15;
    const s = clamp(innerWidth / 1100, 0.6, 1.25);
    const slots = [[0, 0], [-120, 110], [120, 110]];
    flyby = addTask((t) => {
      const p = (performance.now() - t0) / 2300;
      c.setTransform(d, 0, 0, d, 0, 0);
      c.clearRect(0, 0, innerWidth, innerHeight);
      if (p >= 1) { flyby(); flyby = null; top.remove(); return; }
      const lx = -260 + (innerWidth + 620) * p, ly = innerHeight * 0.92 - (innerHeight * 0.95) * p;
      for (const [ox, oy] of slots) {
        const x = lx + (ox * Math.cos(ang) - oy * Math.sin(ang)) * s;
        const y = ly + (ox * Math.sin(ang) + oy * Math.cos(ang)) * s;
        c.lineCap = 'round';
        for (const side of [-1, 1]) {
          const g = c.createLinearGradient(x, y, x - Math.sin(ang) * 760, y + Math.cos(ang) * 760);
          g.addColorStop(0, 'rgba(190,238,255,0.75)'); g.addColorStop(1, 'rgba(190,238,255,0)');
          c.strokeStyle = g; c.lineWidth = 3.4 * s;
          const sx = x + Math.cos(ang) * side * 24 * s, sy = y + Math.sin(ang) * side * 24 * s;
          c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - Math.sin(ang) * 760, sy + Math.cos(ang) * 760); c.stroke();
        }
        drawJet(c, x, y, ang, s, 0.2, t, { burn: 1 });
      }
    });
  }
  on('flyby', flyBy);

  return { flyBy };
}
