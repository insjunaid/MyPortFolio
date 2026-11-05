// X-Ray mode (dock button or hotkey X): the page becomes a radiograph — bone-white on black, with
// the layout skeleton (boxes, grid, DOM tags) exposed. ARGUS switches to its skeleton render too.
import { emit, state } from '../core/bus.js';
import { env } from '../core/env.js';
import { addDockButton } from '../ui/dock.js';
import { h } from '../core/util.js';

export function setXray(on) {
  const root = document.documentElement;
  if (on === state.xray) return on;
  const apply = () => {
    root.classList.toggle('xr', on);
    state.xray = on;
    emit('xray', { on });
  };
  if (env.reducedMotion) apply();
  else {
    const flash = h('div', { class: 'xr-flash', 'aria-hidden': 'true' });
    document.body.append(flash);
    setTimeout(apply, 160);
    setTimeout(() => flash.remove(), 600);
  }
  const live = document.getElementById('xr-status');
  if (live) live.textContent = on ? 'X-ray mode on' : 'X-ray mode off';
  return on;
}

export function initXray() {
  document.body.append(h('span', { id: 'xr-status', class: 'sr-only', role: 'status' }));
  const btn = addDockButton({
    id: 'xray-toggle', label: 'X-Ray', key: 'x', order: 2,
    title: 'X-ray mode: see the page the way ARGUS does',
    onToggle: (next) => setXray(next),
  });
  return btn;
}
