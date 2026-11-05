// Hand-pose → gesture from MediaPipe's 21 hand landmarks. Pure geometry, no extra model.
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** @returns {'open_palm'|'fist'|'pinch'|'peace'|'point'|'unknown'} */
export function classify(lm) {
  const wrist = lm[0];
  const size = d(wrist, lm[9]) || 1e-6; // wrist → middle knuckle: scale reference
  const extended = (tip, pip) => d(wrist, lm[tip]) > d(wrist, lm[pip]) * 1.18;
  const index = extended(8, 6), middle = extended(12, 10), ring = extended(16, 14), pinky = extended(20, 18);
  const pinch = d(lm[4], lm[8]) / size < 0.32;

  if (pinch && !ring && !pinky) return 'pinch';
  if (index && middle && ring && pinky) return 'open_palm';
  if (index && middle && !ring && !pinky) return 'peace';
  if (index && !middle && !ring && !pinky) return 'point';
  if (!index && !middle && !ring && !pinky) return 'fist';
  return 'unknown';
}

/** Debounces a noisy per-frame label: emits only after `frames` consecutive identical readings. */
export function stabilizer(frames = 6) {
  let last = null, count = 0, stable = null;
  return (label) => {
    if (label === last) count++; else { last = label; count = 1; }
    if (count >= frames && stable !== label) { stable = label; return label; }
    return null;
  };
}
