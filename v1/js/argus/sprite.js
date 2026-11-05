// ARGUS is drawn procedurally in a 200×200 unit space: a sleek ovoid sensor head with a wide visor,
// a single tracking eye, two sensor pods and a hover emitter. `xray: true` draws its internal skeleton.
const TAU = Math.PI * 2;
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const BONE = [226, 240, 248];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/**
 * @param {CanvasRenderingContext2D} ctx  already scaled so 1 unit = 1 drawing unit
 * @param {object} s  { t, gx, gy (-1..1 gaze), blink (0..1), tilt (rad), bob (units), eye [r,g,b],
 *                     power (0..1 eye brightness), dilate (0..1), xray, scan (0..1) }
 */
export function drawArgus(ctx, s = {}) {
  const t = s.t || 0;
  const gx = s.gx || 0, gy = s.gy || 0;
  const blink = s.blink || 0;
  const power = s.power == null ? 1 : s.power;
  const eye = s.scan ? mix(s.eye || [92, 225, 255], [255, 181, 71], s.scan) : (s.eye || [92, 225, 255]);
  const cx = 100, cy = 92 + (s.bob || 0);

  ctx.save();
  ctx.translate(100, 100);
  ctx.rotate(s.tilt || 0);
  ctx.translate(-100, -100);

  if (s.xray) { drawSkeleton(ctx, cx, cy, gx, gy, t, eye, power); ctx.restore(); return; }

  // Hover emitter: soft light pool + ring
  const pool = ctx.createRadialGradient(cx, 166, 0, cx, 166, 50);
  pool.addColorStop(0, rgba(eye, 0.32 * power));
  pool.addColorStop(1, rgba(eye, 0));
  ctx.fillStyle = pool;
  ctx.beginPath(); ctx.ellipse(cx, 166, 50, 10, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(eye, 0.4 * power);
  ctx.lineWidth = 1.1;
  const ringR = 24 + Math.sin(t * 0.004) * 2;
  ctx.beginPath(); ctx.ellipse(cx, 150 + (s.bob || 0) * 0.5, ringR, ringR * 0.2, 0, 0, TAU); ctx.stroke();

  // Sensor pods
  for (const side of [-1, 1]) {
    const px = cx + side * 67;
    ctx.strokeStyle = 'rgba(160,200,230,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + side * 56, cy + 2); ctx.lineTo(px - side * 6, cy + 2); ctx.stroke();
    const pg = ctx.createLinearGradient(px, cy - 18, px, cy + 22);
    pg.addColorStop(0, '#1d2833'); pg.addColorStop(1, '#080d13');
    ctx.fillStyle = pg;
    rr(ctx, px - 7, cy - 17, 14, 36, 7); ctx.fill();
    ctx.strokeStyle = rgba(eye, 0.28); ctx.lineWidth = 1; ctx.stroke();
    const led = 0.45 + 0.55 * Math.max(0, Math.sin(t * 0.003 + side * 1.7));
    ctx.fillStyle = rgba(eye, led * power);
    ctx.beginPath(); ctx.arc(px, cy - 6, 2, 0, TAU); ctx.fill();
  }

  // Antenna
  ctx.strokeStyle = 'rgba(170,205,230,0.35)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(cx + 22, cy - 46); ctx.lineTo(cx + 34, cy - 70); ctx.stroke();
  const tip = 0.3 + 0.7 * (Math.sin(t * 0.005) > 0.6 ? 1 : 0.25);
  ctx.fillStyle = rgba(eye, tip * power);
  ctx.beginPath(); ctx.arc(cx + 34, cy - 71, 2.6, 0, TAU); ctx.fill();

  // Head shell
  const shell = ctx.createLinearGradient(0, cy - 52, 0, cy + 48);
  shell.addColorStop(0, '#202c38'); shell.addColorStop(0.55, '#0d141c'); shell.addColorStop(1, '#06090d');
  ctx.fillStyle = shell;
  rr(ctx, cx - 58, cy - 52, 116, 98, [50, 50, 40, 40]); ctx.fill();
  const rim = ctx.createLinearGradient(cx - 58, cy - 52, cx + 58, cy + 46);
  rim.addColorStop(0, rgba(eye, 0.75)); rim.addColorStop(0.45, rgba(eye, 0.12)); rim.addColorStop(1, rgba(eye, 0.3));
  ctx.strokeStyle = rim; ctx.lineWidth = 1.4; ctx.stroke();

  // Specular + panel seams
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath(); ctx.ellipse(cx - 22, cy - 36, 26, 9, -0.25, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(cx, cy - 4, 50, 38, 0, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 30, cy + 34); ctx.lineTo(cx + 30, cy + 34); ctx.stroke();

  // Visor
  const vx = cx - 46, vy = cy - 15, vw = 92, vh = 34;
  rr(ctx, vx, vy, vw, vh, 17);
  ctx.fillStyle = '#010306'; ctx.fill();
  ctx.strokeStyle = rgba(eye, 0.38); ctx.lineWidth = 1; ctx.stroke();
  ctx.save();
  rr(ctx, vx, vy, vw, vh, 17); ctx.clip();
  const sheen = ctx.createLinearGradient(vx, 0, vx + vw, 0);
  sheen.addColorStop(0, rgba(eye, 0.02)); sheen.addColorStop(0.5, rgba(eye, 0.1 * power)); sheen.addColorStop(1, rgba(eye, 0.02));
  ctx.fillStyle = sheen; ctx.fillRect(vx, vy, vw, vh);
  // scanline drifting through the visor
  const sy = vy + ((t * 0.03) % vh);
  ctx.fillStyle = rgba(eye, 0.07 * power); ctx.fillRect(vx, sy, vw, 1.2);

  // The eye
  const ex = cx + gx * 30, ey = cy + 2 + gy * 6;
  const open = Math.max(0.08, 1 - blink);
  const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 30);
  glow.addColorStop(0, rgba(eye, 0.6 * power)); glow.addColorStop(1, rgba(eye, 0));
  ctx.fillStyle = glow; ctx.fillRect(vx, vy, vw, vh);
  ctx.save();
  ctx.translate(ex, ey); ctx.scale(1, open);
  const irisR = 9 + (s.dilate || 0) * 3;
  ctx.strokeStyle = rgba(eye, 0.95 * power); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, irisR, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.4;
  const rot = t * 0.0016;
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * TAU) / 6;
    ctx.strokeStyle = rgba(eye, 0.55 * power);
    ctx.beginPath(); ctx.arc(0, 0, irisR + 4.5, a, a + 0.55); ctx.stroke();
  }
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 5);
  core.addColorStop(0, `rgba(255,255,255,${power})`); core.addColorStop(1, rgba(eye, 0.9 * power));
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(0, 0, 4.2 - (s.dilate || 0) * 1.4, 0, TAU); ctx.fill();
  ctx.restore();
  // lens flare streak
  ctx.fillStyle = rgba(eye, 0.22 * power * open);
  ctx.fillRect(vx, ey - 0.5, vw, 1);
  ctx.restore();

  ctx.restore();
}

// X-ray: bone-white structural view — shell outline, inner frame, servos, wiring, optics.
function drawSkeleton(ctx, cx, cy, gx, gy, t, eye, power) {
  const b = (a) => rgba(BONE, a);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = b(0.85);
  ctx.shadowColor = b(0.6); ctx.shadowBlur = 6;
  rr(ctx, cx - 58, cy - 52, 116, 98, [50, 50, 40, 40]); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = b(0.35); ctx.setLineDash([3, 3]);
  rr(ctx, cx - 48, cy - 42, 96, 78, [40, 40, 32, 32]); ctx.stroke();
  ctx.setLineDash([]);
  // inner frame "spine"
  ctx.strokeStyle = b(0.5);
  ctx.beginPath(); ctx.moveTo(cx, cy - 50); ctx.lineTo(cx, cy - 18); ctx.moveTo(cx, cy + 20); ctx.lineTo(cx, cy + 46); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const y = cy + 24 + i * 5;
    ctx.beginPath(); ctx.moveTo(cx - 14 + i * 2, y); ctx.lineTo(cx + 14 - i * 2, y); ctx.stroke();
  }
  // servos in the pods
  for (const side of [-1, 1]) {
    const px = cx + side * 67;
    ctx.strokeStyle = b(0.7);
    rr(ctx, px - 7, cy - 17, 14, 36, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(px, cy, 5, 0, TAU); ctx.stroke();
    const a = t * 0.004 * side;
    ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * 5, cy + Math.sin(a) * 5); ctx.lineTo(px - Math.cos(a) * 5, cy - Math.sin(a) * 5); ctx.stroke();
    // wiring to the optic block
    ctx.strokeStyle = b(0.35);
    ctx.beginPath(); ctx.moveTo(px - side * 7, cy + 8);
    ctx.bezierCurveTo(cx + side * 40, cy + 30, cx + side * 20, cy + 26, cx + gx * 30, cy + 14); ctx.stroke();
  }
  // circuit traces
  ctx.strokeStyle = b(0.22);
  const traces = [[-40, -30, -20, -30, -20, -20], [40, -30, 22, -30, 22, -22], [-36, 26, -18, 26, -18, 18], [36, 26, 16, 26, 16, 18]];
  for (const tr of traces) {
    ctx.beginPath(); ctx.moveTo(cx + tr[0], cy + tr[1]); ctx.lineTo(cx + tr[2], cy + tr[3]); ctx.lineTo(cx + tr[4], cy + tr[5]); ctx.stroke();
    ctx.fillStyle = b(0.5); ctx.beginPath(); ctx.arc(cx + tr[0], cy + tr[1], 1.4, 0, TAU); ctx.fill();
  }
  // visor housing + optic
  ctx.strokeStyle = b(0.55);
  rr(ctx, cx - 46, cy - 15, 92, 34, 17); ctx.stroke();
  const ex = cx + gx * 30, ey = cy + 2 + gy * 6;
  ctx.strokeStyle = rgba(eye, 0.9 * power); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(ex, ey, 9, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(ex, ey, 14, t * 0.002, t * 0.002 + 4.2); ctx.stroke();
  ctx.fillStyle = rgba(eye, power);
  ctx.beginPath(); ctx.arc(ex, ey, 3, 0, TAU); ctx.fill();
  // antenna + emitter
  ctx.strokeStyle = b(0.5); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx + 22, cy - 46); ctx.lineTo(cx + 34, cy - 70); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + 34, cy - 71, 2.6, 0, TAU); ctx.stroke();
  ctx.setLineDash([2, 4]);
  ctx.beginPath(); ctx.ellipse(cx, 150, 24, 5, 0, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
}

function mix(a, b, k) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));
}

/**
 * Rasterise ARGUS at `scale` (CSS px per unit) and return particle targets in local px (0..200*scale).
 * Dark shell pixels are lifted toward the accent so the silhouette reads when made of light.
 */
export function sampleArgus(scale, step, opts = {}) {
  const size = Math.ceil(200 * scale);
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.scale(scale, scale);
  drawArgus(ctx, { t: 0, power: 1, ...opts });
  const data = ctx.getImageData(0, 0, size, size).data;
  const accent = opts.eye || [92, 225, 255];
  const pts = [];
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const jx = Math.min(size - 1, Math.round(x + Math.random() * step * 0.6));
      const jy = Math.min(size - 1, Math.round(y + Math.random() * step * 0.6));
      const i = (jy * size + jx) * 4;
      const a = data[i + 3];
      if (a < 70) continue;
      let r = data[i], g = data[i + 1], bl = data[i + 2];
      const lum = (r + g + bl) / 3;
      if (lum < 90) { const k = 0.55; r = r + (accent[0] * 0.55 - r) * k; g = g + (accent[1] * 0.55 - g) * k; bl = bl + (accent[2] * 0.6 - bl) * k; }
      pts.push({ x: jx, y: jy, c: `rgb(${r | 0},${g | 0},${bl | 0})`, a: Math.min(1, a / 255) });
    }
  }
  return pts;
}
