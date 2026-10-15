// Easter egg — type "hello argus", enter the Konami code, or poke ARGUS 5 times quickly.
// ARGUS dissolves into particle typography, the whole viewport gets a detection storm, then it
// reassembles. Reduced motion gets the words and detections without the particle show.
import { emit, on, state } from './core/bus.js';
import { env } from './core/env.js';
import { h, isTyping, qsa, sleep, pick } from './core/util.js';

const SECRET = 'helloargus';
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
const STORM = [
  ['h1, h2, .big-text', 'heading'], ['.project-card', 'project'], ['.skill-cat', 'skill_group'], ['.exp-card', 'experience'],
  ['.cert-card', 'certificate'], ['.ach-card', 'achievement'], ['.astat', 'metric'], ['.stag, .pc-tag', 'tag'],
  ['p', 'text_block'], ['a, button', 'interactive'], ['.hero-ide-card', 'source_code'], ['img', 'logo'],
];

export function initEgg() {
  let typed = '', konami = [], running = false, pokes = [];

  window.addEventListener('keydown', (e) => {
    if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    konami = [...konami, k].slice(-KONAMI.length);
    if (konami.join() === KONAMI.join()) { konami = []; trigger('konami'); return; }
    // A space mid-phrase ("hello argus") must not page-scroll.
    if (k === ' ' && typed.length >= 2 && SECRET.startsWith(typed.slice(-Math.min(typed.length, 5)))) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (!/^[a-z]$/.test(k)) return;
    typed = (typed + k).slice(-SECRET.length);
    // While the visitor is mid-way through the phrase, swallow the keys so hotkeys (L = lens) don't fire.
    const progress = [...Array(SECRET.length).keys()].reverse().find((n) => n >= 2 && typed.endsWith(SECRET.slice(0, n + 1)));
    if (progress !== undefined) e.stopImmediatePropagation();
    if (typed.endsWith(SECRET)) { typed = ''; trigger('phrase'); }
  }, true);

  on('argus:poke', () => {
    const now = performance.now();
    pokes = [...pokes.filter((t) => now - t < 3000), now];
    if (pokes.length >= 5) { pokes = []; trigger('poke'); }
  });

  async function trigger(source) {
    if (running || state.introActive) return;
    running = true;
    const argus = window.__argusEntity;
    emit('argus:say', {
      text: source === 'poke' ? 'Okay, okay! You found my secret. Initiating full-spectrum analysis…' : 'Hello, human. Initiating full-spectrum analysis…',
      hold: 3800,
    });
    storm();
    // Let any in-flight teleport land first.
    for (let i = 0; i < 30 && argus && argus.busy; i++) await sleep(50);
    if (!env.reducedMotion && argus && argus.visible) await particleShow(argus);
    toast(source === 'konami' ? 'Konami code accepted · ARGUS-OPS clearance granted' : 'Easter egg found · ARGUS approves of your curiosity');
    running = false;
  }

  async function storm() {
    const { detect } = await import('./detect/detector.js');
    const seen = new Set();
    const picks = [];
    for (const [sel, label] of STORM) {
      for (const el of qsa(sel)) {
        if (seen.has(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.bottom < 80 || r.top > innerHeight - 20 || r.right < 0 || r.left > innerWidth) continue;
        if (el.closest('#dock, #hud, #argus, #vision-panel, #inference-panel')) continue;
        seen.add(el);
        picks.push([el, label]);
      }
    }
    const max = env.mobile ? 10 : 26;
    picks.sort(() => Math.random() - 0.5).slice(0, max).forEach(([el, label], i) => {
      setTimeout(() => detect(el, label, { hold: 2600 + Math.random() * 1200 }), i * 45);
    });
  }

  async function particleShow(argus) {
    const [{ fly, sampleText }, { sampleArgus }, { SIZE }] = await Promise.all([
      import('./argus/particles.js'), import('./argus/sprite.js'), import('./argus/argus.js'),
    ]);
    await document.fonts.load('800 120px Syne').catch(() => {});
    const lite = env.mobile || env.lowPower;
    const step = lite ? 5 : 4;
    const unit = (SIZE / 200) * argus.s;
    const color = () => (Math.random() < 0.12 ? '#ffb547' : pick(['#5ce1ff', '#8ab4ff', '#bff3ff']));
    const ox = argus.x - 100 * unit, oy = argus.y + argus.floatY - 100 * unit;
    const home = sampleArgus(unit, lite ? 3 : 2.4, { xray: state.xray }).map((p) => ({ x: ox + p.x, y: oy + p.y, c: p.c, a: p.a }));
    const word = (text) => {
      const s = sampleText(text, { font: `800 ${lite ? 90 : 150}px Syne, sans-serif`, step, maxWidth: innerWidth * 0.84 });
      const x0 = (innerWidth - s.w) / 2, y0 = (innerHeight - s.h) / 2;
      return s.pts.map((p) => ({ x: x0 + p.x, y: y0 + p.y, c: color(), a: 0.95 }));
    };
    const a = word('HELLO,\nHUMAN');
    const b = word('BUILT BY\nJUNAID');

    const veil = h('div', { class: 'egg-veil', 'aria-hidden': 'true' });
    document.body.append(veil);
    requestAnimationFrame(() => veil.classList.add('is-on'));
    argus.busy = true;
    argus.visible = false;
    argus.wrap.classList.remove('is-visible');
    await fly(home, a, { dur: 1100, arc: 260, stagger: (i) => (i % 40) * 6 });
    await fly(a, a, { dur: 1300, arc: 0, wobble: 2.5, stagger: () => 0 });
    await fly(a, b, { dur: 1000, arc: 140, stagger: () => Math.random() * 200 });
    await fly(b, b, { dur: 1300, arc: 0, wobble: 2.5, stagger: () => 0 });
    const anchor = argus.anchor ? argus.anchor() : { x: argus.x, y: argus.y, s: argus.s };
    const u2 = (SIZE / 200) * anchor.s;
    const back = sampleArgus(u2, lite ? 3 : 2.4, { xray: state.xray })
      .map((p) => ({ x: anchor.x - 100 * u2 + p.x, y: anchor.y - 100 * u2 + p.y, c: p.c, a: p.a }));
    veil.classList.remove('is-on');
    setTimeout(() => veil.remove(), 500);
    await fly(b, back, { dur: 1100, arc: 220, stagger: () => Math.random() * 260 });
    Object.assign(argus, { x: anchor.x, y: anchor.y, s: anchor.s, visible: true, busy: false });
    argus.place();
    argus.wrap.classList.add('is-visible', 'is-materializing');
    setTimeout(() => argus.wrap.classList.remove('is-materializing'), 420);
    await sleep(100);
  }

  function toast(text) {
    const el = h('div', { class: 'egg-toast', role: 'status' }, [h('span', { class: 'egg-badge' }, 'ACHIEVEMENT'), text]);
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add('is-on'));
    setTimeout(() => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 400); }, 4200);
  }
}
