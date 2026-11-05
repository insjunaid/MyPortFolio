// ─── Boot ───
// Core site behaviour always runs. Each effect is gated by config.js / ?no= / calm mode and picks a
// lighter variant on touch, small or low-power devices, or a static one under prefers-reduced-motion.
import { env, enabled } from './core/env.js';
import { addTask } from './core/loop.js';
import { sampleScroll } from './core/input.js';
import { emit, state } from './core/bus.js';
import { loadCss } from './core/util.js';
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

  // Every module starts downloading now, in parallel; each is only awaited where it's used.
  // (A chain of sequential imports would cost one network round trip each.)
  const fine = env.finePointer, moving = !env.reducedMotion;
  const want = (flag, load, extra = true) => (enabled(flag) && extra ? load() : null);
  const mod = {
    scroll: want('smoothScroll', () => import('./effects/smooth-scroll.js'), fine && moving),
    model: env.calm ? null : import('./flight/progress.js'),
    sky: want('sky', () => import('./flight/sky.js')),
    plane: want('plane', () => import('./flight/plane.js')),
    altimeter: want('altimeter', () => import('./flight/altimeter.js')),
    flap: want('splitflap', () => import('./flight/splitflap.js')),
    instruments: want('instruments', () => import('./flight/instruments.js')),
    layout: env.calm ? null : import('./flight/layout.js'),
    neural: want('neuralBg', () => import('./effects/neural-bg.js')),
    hud: want('hud', () => import('./effects/hud.js'), fine),
    reticle: want('reticle', () => import('./effects/cursor.js'), fine),
    magnetic: want('magnetic', () => import('./effects/magnetic.js'), fine && moving),
    xray: want('xray', () => import('./xray/xray.js')),
    lens: want('lens', () => import('./xray/lens.js'), fine),
    webcam: want('webcam', () => import('./webcam/webcam.js'), fine && !env.mobile && !!navigator.mediaDevices),
    detector: want('detection', () => import('./detect/detector.js')),
    egg: want('easterEgg', () => import('./egg.js')),
    inference: want('inference', () => import('./detect/inference.js')),
  };

  // Effect stylesheets load here (not in <head>) so they never block first paint.
  const css = [];
  if (enabled('argus') || enabled('easterEgg')) css.push('css/argus.css');
  if (enabled('detection') || enabled('inference') || enabled('easterEgg')) css.push('css/detect.css');
  if (enabled('xray') || enabled('lens')) css.push('css/xray.css');
  const cssReady = Promise.all(css.map(loadCss));

  if (mod.scroll) await (await mod.scroll).initSmoothScroll();

  // The flight: altitude model first, then everything that reads it.
  if (mod.model) (await mod.model).initFlightModel();
  const sky = mod.sky ? (await mod.sky).initSky() : null;
  if (mod.plane) (await mod.plane).initPlane({ sky, hud: fine });
  if (mod.altimeter) (await mod.altimeter).initAltimeter();
  if (mod.flap) (await mod.flap).initSplitFlap();
  if (mod.instruments) {
    const { initGauges, initRadar, initWings } = await mod.instruments;
    initGauges(); initRadar(); initWings();
  }
  if (mod.layout) {
    const layout = await mod.layout;
    if (enabled('missions')) layout.initMissions();
    if (enabled('tilt') && fine && moving) layout.initTilt();
    if (enabled('route')) layout.initRoute();
  }
  if (mod.neural) (await mod.neural).initNeuralBg({ still: env.reducedMotion });
  if (mod.hud) (await mod.hud).initHud();
  if (mod.reticle) (await mod.reticle).initReticle();
  if (mod.magnetic) (await mod.magnetic).initMagnetic();

  await cssReady;
  if (mod.xray) (await mod.xray).initXray();
  if (mod.lens) (await mod.lens).initLens();
  if (mod.webcam) (await mod.webcam).initWebcam();
  if (mod.detector) (await mod.detector).initDetector();
  if (mod.egg) (await mod.egg).initEgg();
  if (mod.inference) (await mod.inference).initInference();

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
  setTimeout(() => emit('takeoff'), 900);
};

async function bootArgus(sections, introWanted) {
  const intro = introWanted ? import('./argus/intro.js') : null;
  const [{ createArgus }, { initDirector, anchorFor }] = await Promise.all([
    import('./argus/argus.js'), import('./argus/director.js'),
  ]);
  const argus = createArgus();
  window.__argusEntity = argus;
  if (introWanted) state.introActive = true; // claim the stage before ScrollTrigger fires
  await initDirector(argus);

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
    const { runIntro } = await intro;
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
