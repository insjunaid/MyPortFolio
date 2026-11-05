// Tiny event bus so effects can talk without importing each other.
// Events: 'sector' {id,index,el} · 'theme' {dark} · 'xray' {on} · 'argus:say' {text} · 'argus:gaze' {x,y}
//         'intro:done' · 'takeoff' · 'flyby' · 'flight:callout' {text} · 'argus:poke'
const target = new EventTarget();

export function emit(name, detail) {
  target.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on(name, fn) {
  const h = (e) => fn(e.detail);
  target.addEventListener(name, h);
  return () => target.removeEventListener(name, h);
}

/** Shared mutable state that several modules read (cheap alternative to a store). */
export const state = {
  introActive: false,
  xray: false,
  sector: null,
  lenis: null,
  visionOpen: false,
};
