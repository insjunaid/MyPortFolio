// Choreography: where ARGUS lives in each section. On section change it glitch-teleports to the
// new anchor (GSAP ScrollTrigger drives the triggers + a scrubbed float). Anchors are functions, so
// they're re-evaluated every frame and survive resizes; the hero anchor tracks the code window.
import { on, state } from '../core/bus.js';
import { env } from '../core/env.js';
import { qs, clamp } from '../core/util.js';

const NAV = 72;

export function anchorFor(id, index) {
  return () => {
    const vw = innerWidth, vh = innerHeight;
    if (vw < 760) return { x: vw - 44, y: vh - 66, s: 0.25 };
    if (id === 'home') {
      const card = qs('.hero-ide-card');
      const r = card && card.getBoundingClientRect();
      if (r && r.width) {
        return { x: r.left + r.width / 2, y: clamp(r.top - 58, NAV + 70, vh - 120), s: 0.51 };
      }
    }
    const gutter = (vw - Math.min(1160, vw - 2 * clamp(vw * 0.08, 24, 120))) / 2;
    if (gutter >= 118) {
      const right = index % 2 === 1;
      return right
        ? { x: vw - gutter / 2, y: Math.max(NAV + 90, vh * 0.2), s: 0.31 }
        : { x: gutter / 2, y: vh * 0.42, s: 0.31 };
    }
    return { x: vw - 58, y: vh - 118, s: 0.26 };
  };
}

export function initDirector(argus) {
  const sections = [...document.querySelectorAll('main > section[id]')];
  const go = (sec) => {
    if (state.introActive) return;
    argus.teleport(anchorFor(sec.id, sections.indexOf(sec)));
  };

  const ST = window.ScrollTrigger;
  if (window.gsap && ST) {
    window.gsap.registerPlugin(ST);
    sections.forEach((sec) => {
      ST.create({
        trigger: sec, start: 'top 55%', end: 'bottom 55%',
        onToggle: (self) => { if (self.isActive) go(sec); },
      });
      if (!env.reducedMotion) {
        // Scrubbed float: ARGUS drifts gently against the scroll within each section.
        ST.create({
          trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.6,
          onUpdate: (self) => { if (state.sector && state.sector.el === sec) argus.floatY = (0.5 - self.progress) * 36; },
        });
      }
    });
  } else {
    on('sector', ({ el }) => go(el));
  }
}
