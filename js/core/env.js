// Capability + preference snapshot taken once at boot. Effects read this to pick a full, lite or static variant.
import { FEATURES } from '../config.js';

const mq = (q) => window.matchMedia(q).matches;
const root = document.documentElement;
const params = new URLSearchParams(location.search);
const disabled = new Set((params.get('no') || '').split(',').map((s) => s.trim()).filter(Boolean));

export const env = {
  reducedMotion: mq('(prefers-reduced-motion: reduce)'),
  finePointer: mq('(hover: hover) and (pointer: fine)'),
  touch: mq('(pointer: coarse)'),
  lowPower: (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4,
  calm: root.classList.contains('calm'),
  get mobile() { return window.innerWidth < 760; },
  get dpr() { return Math.min(window.devicePixelRatio || 1, 2); },
};

/** True when an effect is enabled in config, not disabled via ?no=, and calm mode is off. */
export function enabled(name) {
  return !!FEATURES[name] && !disabled.has(name) && !env.calm;
}
