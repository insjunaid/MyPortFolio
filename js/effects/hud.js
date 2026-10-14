// HUD frame: viewport corner brackets, a sector readout, live telemetry and an aerospace-style
// "altitude tape" on the right edge that doubles as the scroll-progress indicator. Desktop only (CSS).
import { addTask } from '../core/loop.js';
import { on } from '../core/bus.js';
import { pointer, scroll } from '../core/input.js';
import { h } from '../core/util.js';

const pad = (n, l = 4) => String(Math.max(0, Math.round(n))).padStart(l, '0');

export function initHud() {
  const sector = h('span', { class: 'hud-sector' }, 'SECTOR 01 · HOME');
  const coords = h('span', { class: 'hud-coords' }, 'x 0000 · y 0000');
  const fps = h('span', { class: 'hud-fps' }, '60 fps');
  const tapeScale = h('div', { class: 'hud-tape-scale' });
  const altLabel = h('span', { class: 'hud-alt-label' }, 'ALT 000');
  const root = h('div', { id: 'hud', 'aria-hidden': 'true' }, [
    h('i', { class: 'hud-corner tl' }), h('i', { class: 'hud-corner tr' }),
    h('i', { class: 'hud-corner bl' }), h('i', { class: 'hud-corner br' }),
    h('div', { class: 'hud-top' }, [h('span', { class: 'hud-live' }, 'ARGUS'), sector]),
    h('div', { class: 'hud-bottom' }, [coords, fps]),
    h('div', { class: 'hud-tape' }, [h('div', { class: 'hud-tape-track' }, [tapeScale]), h('div', { class: 'hud-alt' }, [altLabel])]),
  ]);
  document.body.append(root);

  on('sector', ({ index, name }) => { sector.textContent = `SECTOR ${pad(index + 1, 2)} · ${name}`; });

  let acc = 0, frames = 0, last = 0;
  addTask((t, dt) => {
    acc += dt; frames++;
    // Text readouts at ~8 Hz; the tape moves every frame (transform only).
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = scroll.y / max;
    tapeScale.style.transform = `translate3d(0,${(-scroll.y * 0.25) % 40}px,0)`;
    altLabel.parentElement.style.transform = `translate3d(0,${progress * (window.innerHeight * 0.5 - 24)}px,0)`;
    if (t - last < 125) return;
    last = t;
    altLabel.textContent = `ALT ${pad(progress * 100, 3)}`;
    coords.textContent = `x ${pad(pointer.x)} · y ${pad(pointer.y)}`;
    if (acc > 500) { fps.textContent = `${Math.min(120, Math.round((frames * 1000) / acc))} fps`; acc = 0; frames = 0; }
  });
}
