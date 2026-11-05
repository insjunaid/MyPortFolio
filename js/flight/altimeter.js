// Side altimeter: rises as you scroll, so it doubles as the progress bar. Marks the real layers of the
// climb and shows live altitude and Mach. Also owns the short flight-deck callouts.
import { addTask } from '../core/loop.js';
import { on } from '../core/bus.js';
import { h } from '../core/util.js';
import { flight, CLOUD_DECK, MACH_ONE } from './progress.js';

const MARKS = [[0, 'RUNWAY'], [CLOUD_DECK, 'CLOUD DECK'], [MACH_ONE, 'MACH 1'], [0.72, 'STRATOSPHERE'], [1, 'KÁRMÁN LINE']];

export function initAltimeter() {
  const feet = h('b', { class: 'alt-ft' }, '0');
  const mach = h('span', { class: 'alt-mach' }, 'M 0.00');
  const bug = h('div', { class: 'alt-bug' });
  const read = h('span', { class: 'alt-read' }, [feet, h('i', {}, ' FT'), mach]);
  const fill = h('div', { class: 'alt-fill' });
  const scale = h('div', { class: 'alt-scale' });
  const rail = h('div', { class: 'alt-rail' }, [scale, fill, bug,
    ...MARKS.map(([a, label]) => h('span', { class: 'alt-mark', style: `bottom:${a * 100}%`, 'data-a': a }, label))]);
  document.body.append(h('div', { id: 'altimeter', 'aria-hidden': 'true' }, [rail, read]));

  const call = h('div', { id: 'flight-callout', role: 'status' });
  document.body.append(call);
  let hide;
  on('flight:callout', ({ text }) => {
    call.textContent = text;
    call.classList.add('is-on');
    clearTimeout(hide);
    hide = setTimeout(() => call.classList.remove('is-on'), 2200);
  });

  const marks = [...rail.querySelectorAll('.alt-mark')];
  let last = -1;
  addTask((t) => {
    const a = flight.alt;
    bug.style.bottom = `${a * 100}%`;
    fill.style.transform = `scaleY(${a})`;
    scale.style.backgroundPositionY = `${a * 900}px`;
    if (t - last < 90) return;
    last = t;
    feet.textContent = flight.feet.toLocaleString('en-US');
    mach.textContent = `M ${flight.mach.toFixed(2)}`;
    // Layer names only show as the bug goes past them, so the rail stays clean.
    marks.forEach((m) => m.classList.toggle('is-near', Math.abs(a - parseFloat(m.dataset.a)) < 0.045));
  });
}
