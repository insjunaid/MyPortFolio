// Scroll-linked layouts: the horizontal mission gallery, the 3D project tilt and the flight-path map.
import { addTask } from '../core/loop.js';
import { state } from '../core/bus.js';
import { env } from '../core/env.js';
import { clamp, qs, qsa } from '../core/util.js';

/**
 * Missions: on large screens the project files slide past horizontally while the page scrolls.
 * It's a CSS sticky stage with a transformed track, so there's no scroll-jacking: the scrollbar, wheel,
 * keyboard and find-in-page all keep working. Everything else gets a normal stacked grid.
 */
export function initMissions() {
  const section = qs('#projects');
  const pin = qs('.missions-pin', section);
  const track = qs('.mission-track', section);
  if (!section || !pin || !track) return;
  const root = document.documentElement;
  const wanted = () => env.finePointer && !env.reducedMotion && innerWidth >= 1024 && innerHeight >= 620;
  let travel = 0, top = 0, on = false;

  function measure() {
    on = wanted();
    root.classList.toggle('missions-h', on);
    if (!on) { section.style.height = ''; track.style.transform = ''; return; }
    travel = Math.max(0, track.scrollWidth - innerWidth + 120);
    section.style.height = `${innerHeight + travel}px`;
    top = section.getBoundingClientRect().top + window.scrollY;
  }
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  document.fonts && document.fonts.ready.then(measure);

  addTask(() => {
    if (!on) return;
    const k = clamp((window.scrollY - top) / (travel || 1), 0, 1);
    track.style.transform = `translate3d(${-k * travel}px,0,0)`;
  });

  // Tabbing to an off-screen mission scrolls the page to the point where that card is on stage.
  section.addEventListener('focusin', (e) => {
    if (!on) return;
    const card = e.target.closest('.project-card');
    if (!card) return;
    const y = top + clamp(card.offsetLeft - 120, 0, travel);
    if (state.lenis) state.lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
    pin.scrollLeft = 0;
  });
}

/** 3D tilt and a glow that follows the cursor across each mission file. */
export function initTilt() {
  qsa('.project-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${((x - 0.5) * 11).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${((0.5 - y) * 9).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

/** Flight path: a route curves through each job's waypoint and draws itself as you scroll. */
export function initRoute() {
  const host = qs('.exp-timeline');
  const svgEl = qs('.route-map', host);
  if (!host || !svgEl) return;
  const path = qs('.route-line', svgEl);
  const base = qs('.route-base', svgEl);
  const jet = qs('.route-jet', svgEl);
  const items = qsa('.exp-item', host);
  let len = 0, stops = [];

  function layout() {
    const box = host.getBoundingClientRect();
    const W = box.width, H = box.height;
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const narrow = W < 760;
    // Each waypoint sits on the card's inner edge; the route swings out between them.
    // Offsets, not rects: the items may still be mid-reveal, and rects would include that animation.
    const pts = items.map((item) => {
      const pin = qs('.exp-pin', item);
      return [item.offsetLeft + pin.offsetLeft + pin.offsetWidth / 2, item.offsetTop + pin.offsetTop + pin.offsetHeight / 2];
    });
    const startX = narrow ? pts[0][0] : W / 2;
    let d = `M${startX} 0`;
    let px = startX, py = 0;
    pts.concat([[narrow ? pts[0][0] : W / 2, H]]).forEach(([x, y], i) => {
      const swing = narrow ? (i % 2 ? 8 : -6) : (i % 2 ? -1 : 1) * W * 0.09;
      const my = (y - py) * 0.5;
      d += `C${px + swing} ${py + my} ${x + swing} ${y - my} ${x} ${y}`;
      px = x; py = y;
    });
    path.setAttribute('d', d);
    base.setAttribute('d', d);
    len = path.getTotalLength();
    path.style.strokeDasharray = `${len} ${len}`;
    // How far along the route each waypoint lies, found by walking the curve.
    stops = pts.map(([x, y]) => {
      let best = 0, bd = 1e9;
      for (let s = 0; s <= len; s += 12) {
        const q = path.getPointAtLength(s);
        const dd = Math.hypot(q.x - x, q.y - y);
        if (dd < bd) { bd = dd; best = s; }
      }
      return best / len;
    });
    update(true);
  }

  let shown = -1;
  function update(force) {
    const r = host.getBoundingClientRect();
    const k = env.reducedMotion ? 1 : clamp((innerHeight * 0.62 - r.top) / r.height, 0, 1);
    if (!force && Math.abs(k - shown) < 0.0005) return;
    shown = k;
    path.style.strokeDashoffset = `${len * (1 - k)}`;
    const p = path.getPointAtLength(len * k);
    const q = path.getPointAtLength(Math.min(len, len * k + 2));
    const deg = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI + 90;
    jet.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${deg})`);
    items.forEach((item, i) => item.classList.toggle('is-reached', k >= stops[i] - 0.004));
  }

  new ResizeObserver(layout).observe(host);
  layout();
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
  addTask(() => { if (visible) update(false); });
}
