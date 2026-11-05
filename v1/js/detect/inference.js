// Project focus: hovering (or tapping, on touch) a project card locks a focused detection box onto
// it and opens a small "inference panel" — class, confidence, live latency and an attention heatmap
// whose hottest spot follows your cursor across the card. ARGUS's eye locks onto the card too.
import { addTask } from '../core/loop.js';
import { pointer } from '../core/input.js';
import { env } from '../core/env.js';
import { state } from '../core/bus.js';
import { h, qs, qsa, rand, clamp } from '../core/util.js';

const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function initInference() {
  const cards = qsa('.project-card');
  if (!cards.length) return;

  const heat = h('canvas', { class: 'inf-heat', width: 336, height: 200 });
  const rows = {};
  const row = (k, label) => (rows[k] = h('span', { class: 'inf-v' }), h('div', { class: 'inf-row' }, [h('span', { class: 'inf-k' }, label), rows[k]]));
  const topk = h('div', { class: 'inf-topk' });
  const panel = h('div', { id: 'inference-panel', 'aria-hidden': 'true' }, [
    h('div', { class: 'inf-head' }, [h('span', {}, 'INFERENCE'), h('span', { class: 'inf-model' }, 'argus-v2.6 · int8')]),
    row('cls', 'class'), row('conf', 'confidence'), row('lat', 'latency'), row('trk', 'track'),
    h('div', { class: 'inf-heat-wrap' }, [heat, h('span', { class: 'inf-heat-label' }, 'attention · layer 11')]),
    topk,
  ]);
  const focus = h('div', { id: 'focus-box', 'aria-hidden': 'true' }, [
    h('i', { class: 'c tl' }), h('i', { class: 'c tr' }), h('i', { class: 'c bl' }), h('i', { class: 'c br' }),
    h('i', { class: 'tick t' }), h('i', { class: 'tick r' }), h('i', { class: 'tick b' }), h('i', { class: 'tick l' }),
    h('span', { class: 'focus-label' }),
  ]);
  document.body.append(focus, panel);
  const hctx = heat.getContext('2d');

  let active = null, stop = null, lastStat = 0, layout = null, attn = { x: 0.5, y: 0.3 };

  function open(card, viaTouch) {
    if (active === card) return;
    active = card;
    const domain = qs('.pc-domain', card)?.textContent || 'project';
    const parts = domain.split('·').map((s) => slug(s));
    const tags = qsa('.pc-tag', card).map((t) => slug(t.textContent));
    rows.cls.textContent = `project/${parts[0]}`;
    rows.trk.textContent = `#${String(cards.indexOf(card) + 1).padStart(2, '0')} · locked`;
    const scores = [rand(0.95, 0.99), rand(0.84, 0.93), rand(0.7, 0.84)];
    rows.conf.textContent = scores[0].toFixed(3);
    const labels = [...new Set([...parts, ...tags])].slice(0, 3);
    topk.replaceChildren(...labels.map((l, i) => h('div', { class: 'inf-bar' }, [
      h('span', { class: 'inf-bar-k' }, l), h('span', { class: 'inf-bar-track' }, [h('span', { class: 'inf-bar-fill', style: `width:${(scores[i] * 100).toFixed(0)}%` })]),
      h('span', { class: 'inf-bar-v' }, scores[i].toFixed(2)),
    ])));
    qs('.focus-label', focus).textContent = `project ${scores[0].toFixed(2)}`;
    layout = measure(card);
    focus.classList.add('is-on');
    panel.classList.add('is-on');
    panel.dataset.touch = viaTouch ? '1' : '';
    card.classList.add('is-inferring');
    document.documentElement.classList.add('is-inferring');
    if (!stop) stop = addTask(tick);
  }

  function close() {
    if (!active) return;
    active.classList.remove('is-inferring');
    document.documentElement.classList.remove('is-inferring');
    active = null;
    focus.classList.remove('is-on');
    panel.classList.remove('is-on');
    const argus = window.__argusEntity;
    if (argus && argus.gazeOverride && argus.gazeOverride.__inf) argus.gazeOverride = null;
  }

  // Wireframe of the card's layout (title, description lines, tags) for the heatmap thumbnail.
  function measure(card) {
    const r = card.getBoundingClientRect();
    const rel = (el) => { const b = el.getBoundingClientRect(); return { x: (b.left - r.left) / r.width, y: (b.top - r.top) / r.height, w: b.width / r.width, h: b.height / r.height }; };
    return {
      title: rel(qs('.pc-title', card)),
      desc: rel(qs('.pc-desc', card)),
      tags: qsa('.pc-tag', card).map(rel),
    };
  }

  function tick(t) {
    if (!active) { stop(); stop = null; return; }
    const r = active.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) { close(); return; }
    const pad = 8;
    focus.style.transform = `translate3d(${r.left - pad}px,${r.top - pad}px,0)`;
    focus.style.width = `${r.width + pad * 2}px`;
    focus.style.height = `${r.height + pad * 2}px`;

    // Panel beside the card when there's room, otherwise above/below it.
    const pw = 268, ph = panel.offsetHeight || 300, gap = 18;
    let x, y;
    if (r.right + gap + pw < innerWidth - 12) { x = r.right + gap; y = r.top; }
    else if (r.left - gap - pw > 12) { x = r.left - gap - pw; y = r.top; }
    else { x = clamp(r.left, 12, innerWidth - pw - 12); y = r.bottom + gap + ph < innerHeight ? r.bottom + gap : r.top - gap - ph; }
    panel.style.transform = `translate3d(${x}px,${clamp(y, 80, innerHeight - ph - 12)}px,0)`;

    // Attention follows the cursor inside the card (or wanders on touch).
    const inside = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
    const tx = inside ? (pointer.x - r.left) / r.width : 0.5 + Math.sin(t * 0.0011) * 0.3;
    const ty = inside ? (pointer.y - r.top) / r.height : 0.45 + Math.cos(t * 0.0013) * 0.25;
    attn.x += (tx - attn.x) * 0.15; attn.y += (ty - attn.y) * 0.15;
    active.style.setProperty('--hx', `${(attn.x * 100).toFixed(1)}%`);
    active.style.setProperty('--hy', `${(attn.y * 100).toFixed(1)}%`);
    drawHeat(t);

    const argus = window.__argusEntity;
    if (argus && (!argus.gazeOverride || argus.gazeOverride.__inf)) argus.gazeOverride = { x: r.left + attn.x * r.width, y: r.top + attn.y * r.height, __inf: true };

    if (t - lastStat > 280) {
      lastStat = t;
      rows.lat.textContent = `${rand(9.2, 14.8).toFixed(1)} ms`;
    }
  }

  function drawHeat(t) {
    const W = heat.width, H = heat.height;
    hctx.globalCompositeOperation = 'source-over';
    hctx.fillStyle = '#03070b';
    hctx.fillRect(0, 0, W, H);
    // layout wireframe
    const wire = state.xray ? 'rgba(226,240,248,0.35)' : 'rgba(92,225,255,0.28)';
    hctx.strokeStyle = wire; hctx.lineWidth = 1;
    hctx.strokeRect(6.5, 6.5, W - 13, H - 13);
    const box = (b) => [6 + b.x * (W - 12), 6 + b.y * (H - 12), b.w * (W - 12), b.h * (H - 12)];
    if (layout) {
      const [tx, ty, tw, th] = box(layout.title);
      hctx.fillStyle = wire; hctx.fillRect(tx, ty + th * 0.3, tw * 0.8, Math.max(3, th * 0.35));
      const [dx, dy, dw, dh] = box(layout.desc);
      for (let i = 0; i < 4; i++) hctx.fillRect(dx, dy + (dh / 4) * i + 2, dw * (i === 3 ? 0.6 : 0.95), 2);
      layout.tags.forEach((g) => { const [gx, gy, gw, gh] = box(g); hctx.strokeRect(gx, gy, gw, gh); });
    }
    // heat blobs: the cursor, the title and the tags compete for attention
    hctx.globalCompositeOperation = 'lighter';
    const blob = (x, y, r, a) => {
      const g = hctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,90,40,${0.85 * a})`);
      g.addColorStop(0.35, `rgba(255,190,60,${0.55 * a})`);
      g.addColorStop(0.7, `rgba(40,140,255,${0.25 * a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      hctx.fillStyle = g; hctx.beginPath(); hctx.arc(x, y, r, 0, Math.PI * 2); hctx.fill();
    };
    blob(attn.x * W, attn.y * H, 46, 1);
    if (layout) {
      const [tx, ty, tw, th] = box(layout.title);
      blob(tx + tw * 0.35, ty + th / 2, 34, 0.55 + Math.sin(t * 0.004) * 0.1);
      layout.tags.slice(0, 3).forEach((g, i) => { const [gx, gy, gw, gh] = box(g); blob(gx + gw / 2, gy + gh / 2, 18, 0.35 + 0.1 * Math.sin(t * 0.003 + i)); });
    }
    hctx.globalCompositeOperation = 'source-over';
  }

  cards.forEach((card) => {
    card.append(h('span', { class: 'attn-overlay', 'aria-hidden': 'true' }));
    card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') open(card, false); });
    card.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && active === card) close(); });
    card.addEventListener('focusin', () => open(card, false));
    card.addEventListener('focusout', (e) => { if (!card.contains(e.relatedTarget)) close(); });
  });

  if (!env.finePointer) {
    // Touch: tap a card body to inspect it, tap anywhere else to dismiss. Links still work as links.
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.project-card');
      if (card && !e.target.closest('a')) { active === card ? close() : (close(), open(card, true)); }
      else if (!card) close();
    });
  }
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
