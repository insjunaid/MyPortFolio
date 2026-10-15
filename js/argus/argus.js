// ARGUS — the entity. Owns its canvas, gaze, blink, idle curiosity, speech bubble and the
// glitch-teleport between positions. Where it goes is decided by director.js.
import { addTask } from '../core/loop.js';
import { emit, on, state } from '../core/bus.js';
import { pointer, scroll } from '../core/input.js';
import { env } from '../core/env.js';
import { h, clamp, lerp, rand, pick, cssRgb } from '../core/util.js';
import { drawArgus, sampleArgus } from './sprite.js';
import { fly } from './particles.js';
import { QUIPS, CURIOUS } from './lines.js';

export const SIZE = 340;           // canvas CSS size; 1 drawing unit = SIZE/200 px at scale 1
const UNIT = SIZE / 200;

export function createArgus() {
  const canvas = h('canvas', { class: 'argus-canvas', 'aria-hidden': 'true' });
  const hit = h('button', {
    id: 'argus-hit', type: 'button', class: 'argus-hit',
    'aria-label': 'ARGUS, the AI that lives in this page. Activate to hear what it says.',
  });
  const wrap = h('div', { id: 'argus' }, [canvas, hit]);
  const bubble = h('div', { id: 'argus-bubble', role: 'status', 'aria-live': 'polite' });
  document.body.append(wrap, bubble);
  const ctx = canvas.getContext('2d');

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.height = Math.round(SIZE * dpr);
  wrap.style.width = wrap.style.height = canvas.style.width = canvas.style.height = SIZE + 'px';

  // Public, tweenable state. x/y = screen position of ARGUS's centre, s = scale.
  const self = {
    x: innerWidth / 2, y: innerHeight / 2, s: 1,
    floatY: 0,          // scroll-scrubbed float offset (director)
    anchor: null,       // function returning {x,y,s} — re-evaluated every frame
    visible: false,
    busy: false,        // true while teleporting or in a scripted sequence
    power: 1, dilate: 0, scan: 0,
    gazeOverride: null, // {x,y} screen point (webcam face, scan target…)
    wrap, canvas, bubble,
  };

  let gx = 0, gy = 0, tilt = 0, blink = 0, nextBlink = performance.now() + 2500;
  let curious = false, curiousSaid = false, eye = cssRgb('--accent-rgb'), lastQuip = -1;
  const lite = env.mobile || env.lowPower;
  let frameN = 0;

  on('theme', () => requestAnimationFrame(() => { eye = cssRgb('--accent-rgb'); }));

  function render(t) {
    ctx.setTransform(dpr * UNIT, 0, 0, dpr * UNIT, 0, 0);
    ctx.clearRect(0, 0, 200, 200);
    drawArgus(ctx, {
      t, gx, gy, blink, tilt, eye, xray: state.xray,
      bob: env.reducedMotion ? 0 : Math.sin(t * 0.0016) * 3,
      power: self.power, dilate: self.dilate, scan: self.scan,
    });
  }

  function place() {
    wrap.style.transform = `translate3d(${self.x - SIZE / 2}px,${self.y + self.floatY - SIZE / 2}px,0) scale(${self.s})`;
  }

  addTask((t) => {
    if (!self.visible) return;
    // On touch screens ARGUS fades back while the visitor scrolls, so it never blocks reading.
    if (!env.finePointer) wrap.classList.toggle('is-dim', Math.abs(scroll.velocity) > 0.8);
    if (lite && (frameN++ & 1)) return;

    // Follow the anchor (unless curious, teleporting or scripted).
    const now = performance.now();
    const still = now - pointer.lastMove > 3200 && pointer.inside && !state.introActive && !state.visionOpen;
    if (self.anchor && !self.busy) {
      const a = self.anchor();
      let tx = a.x, ty = a.y;
      if (still && !env.reducedMotion && !lite && !self.gazeOverride) {
        // Curiosity: drift toward the resting cursor, stopping at a polite distance.
        const dx = pointer.x - a.x, dy = pointer.y - a.y, d = Math.hypot(dx, dy) || 1;
        const keep = 150;
        if (d > keep) { tx = pointer.x - (dx / d) * keep; ty = pointer.y - (dy / d) * keep; }
        if (!curious) { curious = true; curiousSaid = false; }
        if (!curiousSaid && now - pointer.lastMove > 6500) { curiousSaid = true; say(pick(CURIOUS), 2200); }
      } else curious = false;
      const k = curious ? 0.018 : 0.12;
      self.x = lerp(self.x, clamp(tx, 50, innerWidth - 50), env.reducedMotion ? 1 : k);
      self.y = lerp(self.y, clamp(ty, 90, innerHeight - 60), env.reducedMotion ? 1 : k);
      self.s = lerp(self.s, a.s, env.reducedMotion ? 1 : 0.12);
    }

    // Gaze: the eye tracks the cursor (or an override such as a webcam face or scan target).
    const target = self.gazeOverride || (pointer.inside ? pointer : { x: self.x, y: self.y + 200 });
    const ngx = clamp((target.x - self.x) / (innerWidth * 0.3), -1, 1);
    const ngy = clamp((target.y - self.y) / (innerHeight * 0.3), -1, 1);
    gx = lerp(gx, ngx, 0.14); gy = lerp(gy, ngy, 0.14);
    tilt = lerp(tilt, gx * 0.09, 0.08);
    self.dilate = lerp(self.dilate, curious ? 1 : 0, 0.05);

    if (now > nextBlink) { blink = 1; nextBlink = now + rand(2600, 6200); }
    blink = Math.max(0, blink - 0.12);

    place();
    render(t);
  });

  function say(text, hold) {
    bubble.textContent = '';
    bubble.classList.add('is-on');
    bubble.dataset.side = self.x > innerWidth / 2 ? 'left' : 'right';
    positionBubble();
    let i = 0;
    clearInterval(say._typing); clearTimeout(say._hide);
    const write = () => { bubble.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(say._typing); };
    if (env.reducedMotion) bubble.textContent = text; else say._typing = setInterval(write, 22);
    say._hide = setTimeout(() => bubble.classList.remove('is-on'), hold || 3200 + text.length * 45);
  }
  function positionBubble() {
    const left = bubble.dataset.side === 'left';
    const r = 0.36 * SIZE * self.s + 6;
    bubble.style.left = left ? '' : `${Math.min(innerWidth - 16, self.x + r)}px`;
    bubble.style.right = left ? `${Math.max(16, innerWidth - (self.x - r))}px` : '';
    bubble.style.top = `${clamp(self.y - 0.2 * SIZE * self.s - 30, 80, innerHeight - 120)}px`;
  }
  addTask(() => { if (bubble.classList.contains('is-on')) positionBubble(); });

  hit.addEventListener('click', () => {
    let i;
    do { i = (Math.random() * QUIPS.length) | 0; } while (i === lastQuip && QUIPS.length > 1);
    lastQuip = i;
    say(QUIPS[i]);
    emit('argus:poke');
  });
  on('argus:say', ({ text, hold }) => say(text, hold));

  /** Show ARGUS instantly at a position (used after the intro hands over). */
  function appear(x, y, s) {
    self.x = x; self.y = y; self.s = s;
    self.visible = true;
    wrap.classList.add('is-visible');
    place(); render(performance.now());
  }

  let pending = null;
  /** Glitch → dissolve into particles → stream to the anchor → rematerialize. */
  async function teleport(anchorFn) {
    if (state.introActive) { self.anchor = anchorFn; return; }
    if (self.busy) { pending = anchorFn; return; }
    const to = anchorFn();
    if (Math.hypot(to.x - self.x, to.y - self.y) < 30) { self.anchor = anchorFn; return; }
    self.busy = true;
    self.anchor = anchorFn;
    if (env.reducedMotion) {
      wrap.classList.remove('is-visible');
      await wait(220);
      Object.assign(self, { x: to.x, y: to.y, s: to.s });
      place(); wrap.classList.add('is-visible');
    } else {
      wrap.classList.add('is-glitching');
      await wait(200);
      const step = lite ? 3.2 : 2.4;
      const fromS = self.s * UNIT, toS = to.s * UNIT;
      const opts = { gx, gy, xray: state.xray, eye };
      const src = sampleArgus(fromS, step, opts).map((p) => ({ x: self.x - 100 * fromS + p.x, y: self.y + self.floatY - 100 * fromS + p.y, c: p.c, a: p.a }));
      const dst = sampleArgus(toS, step, opts).map((p) => ({ x: to.x - 100 * toS + p.x, y: to.y - 100 * toS + p.y, c: p.c, a: p.a }));
      wrap.classList.remove('is-glitching', 'is-visible');
      self.visible = false;
      const dist = Math.hypot(to.x - self.x, to.y - self.y);
      await fly(src, dst, {
        dur: clamp(dist * 0.9, 520, 950), arc: clamp(dist * 0.25, 40, 180),
        stagger: (i, a) => (a.x - (self.x - 100 * fromS)) * 1.4 + rand(0, 120),
      });
      const a = anchorFn();
      Object.assign(self, { x: a.x, y: a.y, s: a.s, visible: true });
      place();
      wrap.classList.add('is-visible', 'is-materializing');
      setTimeout(() => wrap.classList.remove('is-materializing'), 420);
    }
    self.busy = false;
    if (pending) { const p = pending; pending = null; teleport(p); }
  }

  const blinkNow = () => { blink = 1; };
  Object.assign(self, { say, appear, teleport, render, place, blinkNow });
  return self;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
