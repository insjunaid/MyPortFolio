// The site's original behaviours (theme toggle, scroll reveal, active nav, typewriter), modernised.
// These always run, even in calm mode or with every effect disabled.
import { emit, on } from './core/bus.js';
import { env } from './core/env.js';
import { qsa } from './core/util.js';

export function initSite() {
  // ─── Theme toggle ───
  const btn = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const setTheme = (dark) => {
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    btn.textContent = dark ? '☀' : '☾';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    emit('theme', { dark });
  };
  btn.addEventListener('click', () => setTheme(root.getAttribute('data-theme') !== 'dark'));
  btn.setAttribute('aria-label', 'Switch to light theme');

  // ─── Scroll reveal ───
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.1 });
  qsa('.fade-up').forEach((el) => io.observe(el));

  // ─── Active nav link ───
  const links = qsa('.nav-links a');
  on('sector', ({ id }) => {
    links.forEach((l) => {
      const active = l.getAttribute('href') === '#' + id;
      l.classList.toggle('is-active', active);
      if (active) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
    });
  });

  initTypewriter();
}

function initTypewriter() {
  const words = ['AI Engineer', 'Computer Vision', 'Deep Learning', 'Agentic AI', 'Machine Learning', 'Data Science'];
  const el = document.getElementById('typewriter-text');
  if (!el) return;
  el.setAttribute('aria-live', 'off');
  el.parentElement.setAttribute('aria-label', 'Focus areas: ' + words.join(', '));

  if (env.reducedMotion) {
    let i = 0;
    el.textContent = words[0];
    setInterval(() => { if (!document.hidden) el.textContent = words[(i = (i + 1) % words.length)]; }, 2600);
    return;
  }

  let wordIndex = 0, charIndex = 0, deleting = false;
  (function type() {
    const word = words[wordIndex];
    let wait;
    if (deleting) { el.textContent = word.substring(0, --charIndex); wait = 50; }
    else { el.textContent = word.substring(0, ++charIndex); wait = 120; }
    if (!deleting && charIndex === word.length) { wait = 2000; deleting = true; }
    else if (deleting && charIndex === 0) { deleting = false; wordIndex = (wordIndex + 1) % words.length; wait = 400; }
    setTimeout(type, wait);
  })();
}
