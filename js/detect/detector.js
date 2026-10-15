// Live "object detection" on the page itself. When ARGUS arrives in a section it sweeps a scan line
// down the viewport; as the line passes real elements, YOLO-style boxes snap onto them (tracking
// getBoundingClientRect every frame), jitter like real detections, then fade out.
import { addTask } from '../core/loop.js';
import { on, state } from '../core/bus.js';
import { env } from '../core/env.js';
import { h, rand, conf, qsa } from '../core/util.js';
import { RULES } from './targets.js';

const NAV = 72;
const HOLD = 2600;
const COOLDOWN = 14000;

let layer, scanEl, scanLabel;
const boxes = new Set();
const lastScan = new Map();
let stopTask = null;

function ensureLayer() {
  if (layer) return;
  scanLabel = h('span', { class: 'scan-label' });
  scanEl = h('div', { class: 'scan-line' }, [scanLabel]);
  layer = h('div', { id: 'detect-layer', 'aria-hidden': 'true' }, [scanEl]);
  document.body.append(layer);
}

function inView(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > NAV + 20 && r.top < innerHeight - 30 && r.left < innerWidth && r.right > 0;
}

/** Pick up to `max` visible targets in a section, following the rule priorities. */
function collect(section, max) {
  const rules = RULES[section.id] || [];
  const out = [];
  const perRule = rules.length > 1 ? Math.ceil(max / 2) + 1 : max;
  for (const [sel, label, order] of rules) {
    let els = qsa(sel, section).filter(inView);
    if (order) els = order(els);
    els.slice(0, perRule).forEach((el) => {
      if (out.length < max) out.push({ el, label: label(el, qsa(sel, section).indexOf(el)) });
    });
  }
  return out;
}

/** Spawn one detection box that tracks `el`. */
export function detect(el, label, { hold = HOLD, score = conf(0.9, 0.995), cls = '' } = {}) {
  ensureLayer();
  const lab = h('span', { class: 'det-label' }, `${label} ${score}`);
  const inner = h('div', { class: 'det-in' }, [h('i', { class: 'c tl' }), h('i', { class: 'c tr' }), h('i', { class: 'c bl' }), h('i', { class: 'c br' }), lab]);
  const box = h('div', { class: `det ${cls}` }, [inner]);
  layer.append(box);
  const b = { el, box, lab, label, score: parseFloat(score), born: performance.now(), hold, jx: 0, jy: 0, jw: 0, jh: 0, next: 0 };
  boxes.add(b);
  if (!stopTask) stopTask = addTask(track);
  return b;
}

function track(t) {
  const now = performance.now();
  for (const b of boxes) {
    const age = now - b.born;
    if (age > b.hold && !b.out) { b.out = true; b.box.classList.add('is-out'); }
    if (age > b.hold + 450 || !b.el.isConnected) { b.box.remove(); boxes.delete(b); continue; }
    const r = b.el.getBoundingClientRect();
    if (!env.reducedMotion && now > b.next) {
      // Real detectors wobble frame to frame: nudge the box and the score a little.
      b.jx = rand(-1.6, 1.6); b.jy = rand(-1.6, 1.6); b.jw = rand(-2.5, 2.5); b.jh = rand(-2.5, 2.5);
      b.next = now + rand(70, 160);
      const s = Math.min(0.994, Math.max(0.5, b.score + rand(-0.012, 0.012)));
      b.lab.textContent = `${b.label} ${s.toFixed(2)}`;
    }
    const pad = 5;
    b.box.style.transform = `translate3d(${r.left - pad + b.jx}px,${r.top - pad + b.jy}px,0)`;
    b.box.style.width = `${r.width + pad * 2 + b.jw}px`;
    b.box.style.height = `${r.height + pad * 2 + b.jh}px`;
  }
  if (!boxes.size) { stopTask(); stopTask = null; }
}

/** Sweep the scan line through the visible part of a section and detect as it passes. */
export function scan(section, { force = false, max } = {}) {
  const now = performance.now();
  if (!force && lastScan.has(section.id) && now - lastScan.get(section.id) < COOLDOWN) return;
  lastScan.set(section.id, now);
  ensureLayer();
  const lite = env.mobile || env.lowPower;
  const targets = collect(section, max || (lite ? 3 : 6));
  if (!targets.length) return;
  const argus = window.__argusEntity;

  const r = section.getBoundingClientRect();
  const y0 = Math.max(NAV, r.top), y1 = Math.min(innerHeight, r.bottom);
  if (env.reducedMotion || y1 - y0 < 60) {
    targets.forEach((tg, i) => setTimeout(() => detect(tg.el, tg.label), i * 60));
    return;
  }

  const dur = 1100;
  const t0 = performance.now();
  const pending = targets.map((tg) => ({ ...tg, y: (() => { const b = tg.el.getBoundingClientRect(); return b.top + b.height / 2; })() }));
  const ms = rand(9.5, 14.5).toFixed(1);
  scanLabel.textContent = `ARGUS · scanning ${section.id} · ${targets.length} obj · ${ms} ms`;
  scanEl.classList.add('is-on');
  if (argus) argus.scan = 1;

  const stop = addTask(() => {
    const k = Math.min(1, (performance.now() - t0) / dur);
    const e = 1 - Math.pow(1 - k, 2);
    const y = y0 + (y1 - y0) * e;
    scanEl.style.transform = `translate3d(0,${y}px,0)`;
    if (argus) argus.gazeOverride = { x: innerWidth / 2, y };
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].y <= y + 4) { detect(pending[i].el, pending[i].label); pending.splice(i, 1); }
    }
    if (k >= 1) {
      stop();
      pending.forEach((p) => detect(p.el, p.label));
      scanEl.classList.remove('is-on');
      if (argus) { argus.scan = 0; argus.gazeOverride = null; }
    }
  });
}

export function clearDetections() {
  for (const b of boxes) b.box.remove();
  boxes.clear();
}

export function initDetector() {
  ensureLayer();
  // Scan after ARGUS has had time to teleport into the new section.
  let timer;
  const queue = (el, delay) => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!state.introActive && state.sector && state.sector.el === el) scan(el); }, delay);
  };
  on('sector', ({ el }) => queue(el, env.reducedMotion ? 300 : 1250));
  on('intro:done', () => state.sector && queue(state.sector.el, 700));
}
