// ─── ARGUS feature switches ───
// One flag per effect. Set any to `false` to remove that effect completely (its module is never loaded).
// Runtime overrides, handy for debugging or demos:
//   ?fx=off              → calm mode: every decorative effect off (same as the FX button in the dock)
//   ?no=intro,lens,...   → disable specific effects by name for this visit
export const FEATURES = {
  smoothScroll: true, // Lenis inertia scrolling (fine pointers only)
  neuralBg: true,     // living neural-network background
  hud: true,          // HUD frame: corners, telemetry, altitude tape
  reticle: true,      // targeting-reticle cursor with lock-on
  magnetic: true,     // magnetic buttons
  scramble: true,     // text-decode reveals on headings
  intro: true,        // particle materialization + boot log (once per session)
  argus: true,        // the ARGUS entity itself
  detection: true,    // YOLO-style detections while scrolling
  inference: true,    // project hover → focused box + inference panel
  xray: true,         // X-ray mode (hotkey X)
  lens: true,         // X-ray lens that follows the cursor (hotkey L)
  webcam: true,       // opt-in "Let ARGUS see you" (MediaPipe, desktop only)
  easterEgg: true,    // type "hello argus" or the Konami code
};

export const ARGUS = { name: 'ARGUS', version: '2.6' };
