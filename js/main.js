// ─── Boot ───
// Core site behaviour always runs. Each effect is gated by config.js / ?no= / calm mode and picks a
// lighter variant on touch, small or low-power devices, or a static one under prefers-reduced-motion.
import { env, enabled } from './core/env.js';
import { addTask } from './core/loop.js';
import { sampleScroll } from './core/input.js';
import { initSections } from './core/sections.js';
import { initSite } from './site.js';
import { initDock, addDockButton } from './ui/dock.js';

window.__argus = true;
const root = document.documentElement;
if (env.reducedMotion) root.classList.add('reduced-motion');
if (env.finePointer) root.classList.add('fine-pointer');

initSite();
addTask(sampleScroll);

const boot = async () => {
  initDock();
  addDockButton({
    id: 'fx-toggle', label: 'FX', key: 'f', order: 9, pressed: !env.calm,
    title: 'Visual effects on/off (calm mode)',
    onToggle: (next) => {
      try { localStorage.setItem('argus:calm', next ? '0' : '1'); } catch (e) { /* storage blocked */ }
      const url = new URL(location.href);
      url.searchParams.delete('fx');
      location.replace(url);
      return next;
    },
  });

  if (enabled('smoothScroll') && env.finePointer && !env.reducedMotion) {
    const { initSmoothScroll } = await import('./effects/smooth-scroll.js');
    initSmoothScroll();
  }

  if (enabled('neuralBg')) {
    const { initNeuralBg } = await import('./effects/neural-bg.js');
    initNeuralBg({ still: env.reducedMotion });
  }

  if (enabled('hud') && env.finePointer) (await import('./effects/hud.js')).initHud();
  if (enabled('reticle') && env.finePointer) (await import('./effects/cursor.js')).initReticle();
  if (enabled('magnetic') && env.finePointer && !env.reducedMotion) (await import('./effects/magnetic.js')).initMagnetic();
  if (enabled('scramble') && !env.reducedMotion) (await import('./effects/scramble.js')).initHeadingScramble();

  // Sections last, so every listener above hears the first 'sector' event.
  initSections();

  // The intro module isn't wired in yet; never leave the page covered.
  root.classList.remove('intro-pending');
};

boot().catch((err) => console.error('[argus] boot failed', err));

console.log(
  '%c ARGUS %c vision core online — try typing "hello argus" on the page.',
  'background:#5ce1ff;color:#021016;font-weight:700;padding:2px 6px;border-radius:3px',
  'color:#5ce1ff',
);
