// Split-flap departure board for section titles. Each letter is a real four-part flap (static top and
// bottom halves, plus two hinged leaves) that riffles through characters and lands on the title.
// The original heading text stays in the DOM for screen readers and search; the tiles are decorative.
import { env } from '../core/env.js';
import { h, qsa, sleep } from '../core/util.js';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const FLIP = 62;

function tile(ch, accent) {
  // Letters live in a data attribute (drawn by CSS) so the DOM text stays just the real heading.
  const face = () => h('b', { 'data-c': ch });
  const up = h('span', { class: 'sf-h sf-up' }, face());
  const dn = h('span', { class: 'sf-h sf-dn' }, face());
  const el = h('span', { class: `sf-t${accent ? ' sf-accent' : ''}` }, [up, dn]);
  const set = (part, c) => { part.firstChild.dataset.c = c; };
  let fu, fd;
  return {
    el, target: ch, cur: ch,
    show(c) { [up, dn].forEach((p) => set(p, c)); this.cur = c; },
    arm() {
      fu = h('span', { class: 'sf-h sf-up sf-leaf' }, face());
      fd = h('span', { class: 'sf-h sf-dn sf-leaf' }, face());
      el.append(fu, fd);
    },
    disarm() { fu.remove(); fd.remove(); },
    async flip(next) {
      set(up, next); set(fd, next); set(dn, this.cur); set(fu, this.cur);
      fu.style.visibility = fd.style.visibility = 'visible';
      await fu.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], { duration: FLIP, easing: 'ease-in', fill: 'forwards' }).finished;
      fu.style.visibility = 'hidden';
      await fd.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], { duration: FLIP, easing: 'ease-out', fill: 'forwards' }).finished;
      set(dn, next);
      fd.style.visibility = 'hidden';
      this.cur = next;
    },
  };
}

/** Flatten a heading into words of { ch, accent }, keeping <br> as line breaks. */
function tokens(el) {
  const lines = [[]];
  const walk = (node, accent) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        n.nodeValue.split(/(\s+)/).forEach((part) => {
          if (!part.trim()) return;
          lines[lines.length - 1].push({ text: part, accent });
        });
      } else if (n.nodeName === 'BR') lines.push([]);
      else walk(n, accent || n.nodeName === 'EM' || n.nodeName === 'SPAN');
    });
  };
  walk(el, false);
  return lines.filter((l) => l.length);
}

function build(el) {
  const lines = tokens(el);
  const tiles = [];
  const board = h('span', { class: 'sf-board', 'aria-hidden': 'true' }, lines.map((line) => h('span', { class: 'sf-line' }, line.map((w) => {
    const word = h('span', { class: 'sf-word' });
    [...w.text.toUpperCase()].forEach((c) => {
      const t = tile(c, w.accent);
      tiles.push(t);
      word.append(t.el);
    });
    return word;
  }))));
  const real = h('span', { class: 'sr-only' });
  while (el.firstChild) real.append(el.firstChild);
  el.append(real, board);
  el.classList.add('sf-ready');
  return tiles;
}

async function riffle(tiles) {
  const lite = env.mobile || env.lowPower;
  await Promise.all(tiles.map(async (t, i) => {
    await sleep(i * (lite ? 16 : 26));
    t.arm();
    const steps = lite ? 2 : 3 + ((i * 7) % 4);
    for (let s = 0; s < steps; s++) await t.flip(CHARS[(Math.random() * CHARS.length) | 0]);
    await t.flip(t.target);
    t.disarm();
  }));
}

export function initSplitFlap() {
  const boards = new Map();
  const riffleIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      riffleIO.unobserve(e.target);
      const tiles = boards.get(e.target);
      riffle(tiles).catch(() => tiles.forEach((t) => t.show(t.target)));
    });
  }, { threshold: 0.35 });
  // Boards are built a screen ahead of the viewport, which keeps the initial DOM small.
  const buildIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      buildIO.unobserve(e.target);
      const tiles = build(e.target);
      if (env.reducedMotion) return;
      boards.set(e.target, tiles);
      tiles.forEach((t) => t.show(CHARS[(Math.random() * CHARS.length) | 0]));
      riffleIO.observe(e.target);
    });
  }, { rootMargin: '100% 100% 100% 100%' });
  qsa('main .section-title, .contact-left .big-text').forEach((el) => buildIO.observe(el));
}
