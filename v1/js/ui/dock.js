// Control dock (bottom-left): every mode toggle lives here as a real <button aria-pressed>,
// with its keyboard shortcut shown. Modules register their own buttons via addDockButton().
import { h, isTyping } from '../core/util.js';

let dock;
const hotkeys = new Map();

export function initDock() {
  dock = h('div', { id: 'dock', role: 'toolbar', 'aria-label': 'Site effects' });
  document.body.append(dock);
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
    const fn = hotkeys.get(e.key.toLowerCase());
    if (fn) { e.preventDefault(); fn(); }
  });
  return dock;
}

/**
 * addDockButton({ id, label, key, pressed, title, order, onToggle(next) → boolean|void })
 * onToggle may return the real resulting state (e.g. if the camera permission was denied).
 */
export function addDockButton({ id, label, key, pressed = false, title, order = 0, onToggle, className = '' }) {
  const btn = h('button', {
    type: 'button', id, class: `dock-btn ${className}`, 'aria-pressed': String(pressed),
    title: title || label, style: `order:${order}`,
    'aria-keyshortcuts': key ? key.toUpperCase() : false,
  }, [h('span', { class: 'dock-led', 'aria-hidden': 'true' }), h('span', { class: 'dock-label' }, label)]);
  if (key) btn.append(h('kbd', { 'aria-hidden': 'true' }, key.toUpperCase()));
  const set = (v) => btn.setAttribute('aria-pressed', String(!!v));
  const toggle = async () => {
    const next = btn.getAttribute('aria-pressed') !== 'true';
    const result = await onToggle(next);
    set(result === undefined ? next : result);
  };
  btn.addEventListener('click', toggle);
  if (key) hotkeys.set(key.toLowerCase(), toggle);
  dock.append(btn);
  return { el: btn, set, toggle };
}
