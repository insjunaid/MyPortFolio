// ─── Boot ───
// Core site behaviour always runs. Each effect is gated by config.js / ?no= / calm mode and picks a
// lighter variant on touch, small or low-power devices, or a static one under prefers-reduced-motion.
import { env, enabled } from './core/env.js';
import { addTask } from './core/loop.js';
import { sampleScroll } from './core/input.js';
import { state } from './core/bus.js';
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
  const sections = initSections();

  const introWanted = root.classList.contains('intro-pending') && enabled('intro') && enabled('argus');
  try {
    if (enabled('argus')) await bootArgus(sections, introWanted);
  } catch (err) {
    console.error('[argus] entity failed to boot', err);
  } finally {
    // Whatever happens, never leave the page covered by the intro.
    root.classList.remove('intro-pending');
    state.introActive = false;
    if (state.lenis) state.lenis.start();
  }
};

async function bootArgus(sections, introWanted) {
  const [{ createArgus }, { initDirector, anchorFor }] = await Promise.all([
    import('./argus/argus.js'), import('./argus/director.js'),
  ]);
  const argus = createArgus();
  window.__argusEntity = argus;
  if (introWanted) state.introActive = true; // claim the stage before ScrollTrigger fires
  initDirector(argus);

  // The section under the middle of the viewport right now (scroll may be restored on reload).
  const mid = innerHeight / 2;
  const current = sections.find((s) => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; }) || sections[0];
  const anchor = anchorFor(current.id, sections.indexOf(current));

  const decodeHero = async () => {
    if (!enabled('scramble') || env.reducedMotion) return;
    const { scramble } = await import('./effects/scramble.js');
    scramble(document.querySelector('.hero-label'), { duration: 700 });
    scramble(document.querySelector('.hero-name'), { duration: 1100, delay: 120 });
    scramble(document.querySelector('.hero-tagline'), { duration: 900, delay: 260 });
  };

  if (introWanted) {
    const { runIntro } = await import('./argus/intro.js');
    await runIntro(argus, { anchor, onReveal: decodeHero });
  } else {
    const a = anchor();
    argus.appear(a.x, a.y, a.s);
    argus.anchor = anchor;
    argus.wrap.classList.add('is-materializing');
    setTimeout(() => argus.wrap.classList.remove('is-materializing'), 420);
  }
}

boot().catch((err) => console.error('[argus] boot failed', err));

console.log(
  '%c ARGUS %c vision core online — try typing "hello argus" on the page.',
  'background:#5ce1ff;color:#021016;font-weight:700;padding:2px 6px;border-radius:3px',
  'color:#5ce1ff',
);
