// One shared requestAnimationFrame for every effect. Tasks register while they have work to do
// and unregister when idle, so an idle page costs nothing. Nothing runs while the tab is hidden.
const tasks = new Set();
let raf = 0;
let last = 0;

function frame(t) {
  raf = 0;
  const dt = last ? Math.min(64, t - last) : 16.7;
  last = t;
  for (const fn of tasks) {
    try { fn(t, dt); } catch (err) { tasks.delete(fn); console.error('[argus] task removed after error', err); }
  }
  if (tasks.size && !document.hidden) raf = requestAnimationFrame(frame);
}

function kick() {
  if (!raf && tasks.size && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); }
}

/** Run fn(time, dt) every frame. Returns a function that removes it. */
export function addTask(fn) {
  tasks.add(fn);
  kick();
  return () => tasks.delete(fn);
}

document.addEventListener('visibilitychange', kick);
