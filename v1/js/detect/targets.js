// What ARGUS "detects" in each section: [selector, label(el, i)]. Order = priority.
// Labels read like a detector's class names; keep them short and lowercase.
const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const text = (el, sel) => (sel ? el.querySelector(sel) : el)?.textContent.trim() || '';

const PREFERRED_SKILLS = ['PyTorch', 'TensorFlow', 'Python', 'CNNs', 'Transformers', 'Docker', 'Scikit-learn', 'Transfer Learning'];

export const RULES = {
  home: [
    ['.hero-name', () => 'engineer'],
    ['.hero-ide-card', () => 'source_code'],
    ['.hero-tagline', () => 'mission_statement'],
    ['.btn-primary', () => 'call_to_action'],
  ],
  about: [
    ['.edu-card', () => 'degree:b.e._cse_ai'],
    ['.about-intro-text', () => 'claim:verified'],
    ['.astat', (el) => `metric:${text(el, '.num')}`],
  ],
  skills: [
    ['.stag', (el) => `skill:${text(el).replace(/\s+/g, '')}`, (els) => {
      const rank = (el) => { const i = PREFERRED_SKILLS.indexOf(text(el)); return i < 0 ? 99 : i; };
      return els.filter((el) => rank(el) < 99).sort((a, b) => rank(a) - rank(b));
    }],
    ['.skill-cat', (el) => `toolkit:${slug(text(el, '.skill-cat-name')).split('_')[0]}`],
  ],
  projects: [
    ['.project-card', (el) => `project:${slug(text(el, '.pc-domain').split('·')[0])}`],
  ],
  experience: [
    ['.exp-card', (el, i) => (i === 0 ? 'role:ai_engineer' : `experience:${slug(text(el, '.exp-title'))}`)],
  ],
  certifications: [
    ['.cert-card', (el) => `certificate:${slug(text(el, '.cert-issuer').split(' ')[0])}`],
  ],
  achievements: [
    ['.ach-card', (el) => `achievement:${slug(text(el, '.ach-title')).split('_')[0]}`],
  ],
  contact: [
    ['.big-text', () => 'invitation'],
    ['.connect-link-row', (el) => `channel:${slug(text(el, '.connect-platform'))}`],
    ['.connect-cta', () => 'call_to_action'],
  ],
};
