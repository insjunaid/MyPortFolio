// Tracks which section ("sector") sits under the middle of the viewport and broadcasts changes.
import { emit, state } from './bus.js';
import { qsa } from './util.js';

export const SECTOR_NAMES = {
  home: 'HOME', about: 'ABOUT', skills: 'SKILLS', projects: 'PROJECTS', experience: 'EXPERIENCE',
  certifications: 'CREDENTIALS', achievements: 'ACHIEVEMENTS', contact: 'CONTACT',
};

export function initSections() {
  const sections = qsa('main > section[id]');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const index = sections.indexOf(e.target);
      if (state.sector && state.sector.el === e.target) continue;
      state.sector = { id: e.target.id, index, el: e.target, name: SECTOR_NAMES[e.target.id] || e.target.id.toUpperCase() };
      emit('sector', state.sector);
    }
  }, { rootMargin: '-48% 0px -48% 0px' });
  sections.forEach((s) => io.observe(s));
  return sections;
}
