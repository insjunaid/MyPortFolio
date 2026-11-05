// ─── ARGUS feature switches ───
// One flag per effect. Set any to `false` to remove that effect completely (its module is never loaded).
// Runtime overrides, handy for debugging or demos:
//   ?fx=off              → calm mode: every decorative effect off (same as the FX button in the dock)
//   ?no=intro,lens,...   → disable specific effects by name for this visit
export const FEATURES = {
  smoothScroll: true, // Lenis inertia scrolling (fine pointers only)
  sky: true,          // WebGL sky: runway, cloud deck, stratosphere, stars, Earth limb
  plane: true,        // the jet, contrails, HUD ladder, takeoff, sonic boom
  altimeter: true,    // side altimeter / progress bar
  splitflap: true,    // split-flap departure-board section titles
  instruments: true,  // stat gauges, skills radar, pilot wings
  missions: true,     // horizontal mission gallery (large screens)
  tilt: true,         // 3D tilt + glow on project cards
  route: true,        // flight-path map for experience
  neuralBg: false,    // the previous neural-network background (the sky replaces it)
  hud: true,          // HUD frame: corners, telemetry, altitude tape
  reticle: true,      // targeting-reticle cursor with lock-on
  magnetic: true,     // magnetic buttons
  scramble: true,     // text-decode reveal on the hero
  intro: true,        // particle materialization + boot log (once per session)
  argus: true,        // the ARGUS entity itself
  detection: true,    // YOLO-style detections while scrolling
  inference: true,    // project hover → focused box + inference panel
  xray: true,         // X-ray mode (hotkey X)
  lens: false,        // X-ray cursor lens (hotkey L); off because it can't follow the sliding mission gallery
  webcam: true,       // opt-in "Let ARGUS see you" (MediaPipe, desktop only)
  easterEgg: true,    // type "hello argus" or the Konami code
};

export const ARGUS = { name: 'ARGUS', version: '2.6' };
