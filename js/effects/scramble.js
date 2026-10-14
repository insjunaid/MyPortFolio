// Text-decode reveal. The real text keeps its layout (just hidden for a moment) while an
// absolutely-positioned overlay cycles glyphs and resolves left→right, so there is zero layout shift
// and screen readers only ever see the real text.
import { addTask } from '../core/loop.js';
import { qsa } from '../core/util.js';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/\\[]{}';

export function scramble(el, { duration = 900, delay = 0 } = {}) {
  if (!el || el.__scrambling) return Promise.resolve();
  el.__scrambling = true;
  let src = el.querySelector(':scope > .scramble-src');
  if (!src) {
    src = document.createElement('span');
    src.className = 'scramble-src';
    while (el.firstChild) src.append(el.firstChild);
    el.append(src);
  }
  const layer = src.cloneNode(true);
  layer.className = 'scramble-layer';
  layer.setAttribute('aria-hidden', 'true');
  el.append(layer);
  el.classList.add('is-scrambling');

  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  const items = [];
  let total = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    items.push({ node: n, text: n.nodeValue });
    total += n.nodeValue.length;
  }
  // Each character gets its own resolve time: a left→right sweep plus a little noise.
  let idx = 0;
  items.forEach((it) => {
    it.at = [...it.text].map(() => (idx++ / Math.max(1, total)) * duration * 0.7 + Math.random() * duration * 0.3);
  });

  return new Promise((resolve) => {
    let start = 0, tick = 0;
    const stop = addTask((t) => {
      if (!start) start = t + delay;
      const el2 = t - start;
      if (el2 < 0 || (tick++ & 1)) return; // ~30 fps glyph churn reads better than 60
      let done = true;
      for (const it of items) {
        let s = '';
        for (let i = 0; i < it.text.length; i++) {
          const ch = it.text[i];
          if (ch === ' ' || ch === '\n' || el2 >= it.at[i]) s += ch;
          else { s += GLYPHS[(Math.random() * GLYPHS.length) | 0]; done = false; }
        }
        it.node.nodeValue = s;
      }
      if (done) {
        stop();
        layer.remove();
        el.classList.remove('is-scrambling');
        el.__scrambling = false;
        resolve();
      }
    });
  });
}

/** Decode section headings the first time they scroll into view. */
export function initHeadingScramble() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      scramble(e.target, { duration: 850, delay: 120 });
    });
  }, { threshold: 0.6 });
  qsa('main section:not(#home) .section-title, .contact-left .big-text').forEach((el) => io.observe(el));
}
