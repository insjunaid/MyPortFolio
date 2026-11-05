// The flight model. One number drives the whole site: `flight.alt`, 0 on the runway → 1 at the edge of
// space. Scroll maps to altitude through the real section positions, so each section always sits in the
// same part of the sky however tall the page gets on a given screen.
import { addTask } from '../core/loop.js';
import { pointer } from '../core/input.js';
import { env } from '../core/env.js';
import { clamp, lerp, qsa } from '../core/util.js';

// Altitude at the centre of each section. The cloud deck (~0.36) and Mach 1 (0.54) land in the gaps.
const STOPS = { home: 0, about: 0.14, skills: 0.28, projects: 0.45, experience: 0.62, certifications: 0.75, achievements: 0.86, contact: 0.97 };

export const CLOUD_DECK = 0.36;
export const MACH_ONE = 0.54;
export const KARMAN_FEET = 328084; // the Kármán line, 100 km

export const flight = {
  alt: 0,       // smoothed altitude 0..1
  target: 0,    // raw altitude from scroll
  rate: 0,      // climb rate (alt per frame), signed
  feet: 0,
  mach: 0,
  mx: 0, my: 0, // pointer -1..1, smoothed; used for parallax and the HUD horizon
};

let map = [[0, 0], [1, 1]]; // [scrollY, alt] pairs

function measure() {
  const sections = qsa('main > section[id]');
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const pts = [[0, 0]];
  for (const s of sections) {
    const a = STOPS[s.id];
    if (a === undefined || a === 0) continue;
    const r = s.getBoundingClientRect();
    const y = r.top + window.scrollY + r.height / 2 - innerHeight / 2;
    if (y > pts[pts.length - 1][0] && y < max) pts.push([y, a]);
  }
  pts.push([max, 1]);
  map = pts;
}

function altAt(y) {
  for (let i = 1; i < map.length; i++) {
    if (y <= map[i][0]) {
      const [y0, a0] = map[i - 1], [y1, a1] = map[i];
      return a0 + (a1 - a0) * clamp((y - y0) / (y1 - y0 || 1), 0, 1);
    }
  }
  return 1;
}

export function initFlightModel() {
  measure();
  flight.alt = flight.target = altAt(window.scrollY);
  const ro = new ResizeObserver(() => measure());
  ro.observe(document.body);
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);

  addTask(() => {
    flight.target = altAt(window.scrollY);
    const prev = flight.alt;
    flight.alt = env.reducedMotion ? flight.target : lerp(flight.alt, flight.target, 0.14);
    flight.rate = flight.alt - prev;
    // Altitude grows with the square so the low, busy part of the climb gets more of the scroll.
    flight.feet = Math.round(KARMAN_FEET * Math.pow(flight.alt, 2.2));
    const past = flight.alt - MACH_ONE;
    flight.mach = past < 0 ? flight.alt / MACH_ONE : 1 + past * 2.4 + Math.pow(past / (1 - MACH_ONE), 4) * 21;
    const tx = pointer.inside ? (pointer.x / innerWidth) * 2 - 1 : 0;
    const ty = pointer.inside ? (pointer.y / innerHeight) * 2 - 1 : 0;
    flight.mx = lerp(flight.mx, tx, 0.06);
    flight.my = lerp(flight.my, ty, 0.06);
  });
}
