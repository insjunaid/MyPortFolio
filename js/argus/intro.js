// First-visit materialization (once per session, skippable with the button or Esc):
// dust → particles assemble into ARGUS while a boot log types → the visitor is "detected" →
// ARGUS flies to its post and the hero decodes in.
import { emit, state } from '../core/bus.js';
import { env } from '../core/env.js';
import { qs, rand, sleep } from '../core/util.js';
import { sampleArgus } from './sprite.js';
import { fly, scatter, cancelAll } from './particles.js';
import { SIZE } from './argus.js';

const LOG = [
  ['> avionics power', 'on'],
  ['> flight controls', 'free'],
  ['> vision core', 'ok'],
  ['> engines 1 + 2', 'stable'],
  ['> crew detected', 'human 0.97', 'hit'],
  ['> tower', 'cleared for takeoff', 'hit'],
];

export async function runIntro(argus, { anchor, onReveal }) {
  const root = document.documentElement;
  const overlay = qs('#intro');
  const log = qs('#intro .boot-log');
  const target = qs('#intro .intro-target');
  const skipBtn = qs('#intro-skip');
  const lite = env.mobile || env.lowPower;

  state.introActive = true;
  if (state.lenis) state.lenis.stop();

  let skipped = false;
  let resolveSkip;
  const skipSignal = new Promise((r) => { resolveSkip = r; });
  const skip = () => { if (skipped) return; skipped = true; cancelAll(); resolveSkip(); };
  const onKey = (e) => { if (e.key === 'Escape') skip(); };
  skipBtn.addEventListener('click', skip);
  window.addEventListener('keydown', onKey);
  const step = (p) => Promise.race([p, skipSignal]);

  // Boot log types in parallel with the assembly.
  const typing = (async () => {
    for (const [text, result, cls] of LOG) {
      if (skipped) return;
      const line = document.createElement('div');
      log.append(line);
      for (let i = 1; i <= text.length; i++) {
        if (skipped) return;
        line.textContent = text.slice(0, i);
        await sleep(lite ? 9 : 13);
      }
      // Pad to the column width that fits this screen (about 6.6px per mono character at 11px).
      const cols = innerWidth < 520 ? Math.floor((innerWidth - 32) / 6.6) : 48;
      const dots = ' ' + '.'.repeat(Math.max(2, cols - text.length - result.length - 2)) + ' ';
      line.append(dots);
      const r = document.createElement('span');
      r.className = cls || 'ok';
      r.textContent = result;
      line.append(r);
      await sleep(lite ? 90 : 150);
    }
  })();

  // Particles condense from the dark into ARGUS at centre stage.
  const unit = SIZE / 200;
  const scale = lite ? 0.55 : 1;
  const cx = innerWidth / 2;
  const cy = innerHeight * (innerWidth < 760 || innerHeight < 700 ? 0.32 : 0.44);
  const px = scale * unit;
  const pts = sampleArgus(px, lite ? 3.4 : 2.5).map((p) => ({ x: cx - 100 * px + p.x, y: cy - 100 * px + p.y, c: p.c, a: p.a }));

  await step(sleep(250));
  if (!skipped) {
    await step(fly(scatter(pts.length, 120), pts, {
      dur: lite ? 1200 : 1500, arc: 220,
      stagger: (i, a, b) => Math.hypot(b.x - cx, b.y - cy) * 2.2 + rand(0, 380),
      wobble: rand(8, 26),
      alpha: (k) => (k < 0.2 ? (k / 0.2) * 0.9 : 0.9 + k * 0.1),
    }));
  }

  if (!skipped) {
    // Ignite: the real ARGUS replaces the particles and its eye powers up.
    argus.appear(cx, cy, scale);
    argus.busy = true;
    argus.power = 0;
    argus.gazeOverride = { x: cx, y: cy + 10 };
    argus.wrap.classList.add('is-materializing');
    const t0 = performance.now();
    await step(new Promise((r) => {
      const ramp = () => {
        const k = Math.min(1, (performance.now() - t0) / 450);
        argus.power = k;
        if (k < 1 && !skipped) requestAnimationFrame(ramp); else r();
      };
      requestAnimationFrame(ramp);
    }));
    argus.wrap.classList.remove('is-materializing');
  }

  await step(typing);
  if (!skipped) {
    // "Subject detected": it looks straight out of the screen at the visitor.
    qs('.intro-target-label', target).textContent = 'human · 0.97';
    target.classList.add('is-on');
    argus.dilate = 1;
    await step(sleep(lite ? 700 : 950));
  }

  // ─── Hand-over ───
  skipBtn.removeEventListener('click', skip);
  window.removeEventListener('keydown', onKey);
  cancelAll();
  try { sessionStorage.setItem('argus:intro', '1'); } catch (e) { /* storage blocked */ }

  const a = anchor();
  if (!argus.visible) argus.appear(a.x, a.y, a.s);
  argus.power = 1;
  argus.gazeOverride = null;
  argus.anchor = anchor;
  argus.busy = false; // it now glides to its post via the anchor follower

  overlay.classList.add('is-leaving');
  skipBtn.blur();
  onReveal && onReveal();
  await sleep(skipped ? 250 : 600);
  root.classList.remove('intro-pending');
  overlay.classList.remove('is-leaving');
  state.introActive = false;
  if (state.lenis) state.lenis.start();
  emit('intro:done', { skipped });
}
