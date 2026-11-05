// HUD frame: viewport corner brackets, a sector readout and live telemetry. Desktop only (CSS).
import { addTask } from '../core/loop.js';
import { on } from '../core/bus.js';
import { pointer } from '../core/input.js';
import { h } from '../core/util.js';

const pad = (n, l = 4) => String(Math.max(0, Math.round(n))).padStart(l, '0');

export function initHud() {
  const sector = h('span', { class: 'hud-sector' }, 'SECTOR 01 · HOME');
  const coords = h('span', { class: 'hud-coords' }, 'x 0000 · y 0000');
  const fps = h('span', { class: 'hud-fps' }, '60 fps');
  const root = h('div', { id: 'hud', 'aria-hidden': 'true' }, [
    h('i', { class: 'hud-corner tl' }), h('i', { class: 'hud-corner tr' }),
    h('i', { class: 'hud-corner bl' }), h('i', { class: 'hud-corner br' }),
    h('div', { class: 'hud-top' }, [h('span', { class: 'hud-live' }, 'ARGUS'), sector]),
    h('div', { class: 'hud-bottom' }, [coords, fps]),
  ]);
  document.body.append(root);

  on('sector', ({ index, name }) => { sector.textContent = `SECTOR ${pad(index + 1, 2)} · ${name}`; });

  let acc = 0, frames = 0, last = 0;
  addTask((t, dt) => {
    acc += dt; frames++;
    if (t - last < 125) return;
    last = t;
    coords.textContent = `x ${pad(pointer.x)} · y ${pad(pointer.y)}`;
    if (acc > 500) { fps.textContent = `${Math.min(120, Math.round((frames * 1000) / acc))} fps`; acc = 0; frames = 0; }
  });
}
