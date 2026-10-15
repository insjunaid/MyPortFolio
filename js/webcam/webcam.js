// "Let ARGUS see you" — strictly opt-in webcam mode. Nothing happens until the visitor opens the
// panel AND presses Start AND grants permission. MediaPipe Tasks Vision (face + hand landmarks) is
// only downloaded at that moment and runs fully in the browser; frames never leave the device.
// Closing the panel stops every track, closes the models and releases the camera.
import { addTask } from '../core/loop.js';
import { emit, state } from '../core/bus.js';
import { addDockButton } from '../ui/dock.js';
import { h, qs, qsa, loadCss } from '../core/util.js';
import { classify, stabilizer } from './gestures.js';

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
const MODELS = {
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  hand: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
};
const GESTURE_TEXT = {
  open_palm: 'open palm → scrolling', fist: 'fist → stop', pinch: 'pinch → open project',
  peace: 'peace → x-ray', point: 'pointing', unknown: '',
};


export function initWebcam() {
  let panel, canvas, ctx, statusEl, startBtn, msgEl;
  let stream = null, video = null, face = null, hand = null, vision = null, stopLoop = null;
  let open = false, running = false, starting = false;
  let scrolling = false, lastXray = 0, frame = 0, fps = 0, fpsAcc = 0, fpsN = 0, lastT = 0, lastVideoTime = -1;
  let faceRes = null, handRes = null, gestureLabel = '';
  const stable = stabilizer(6);

  async function buildPanel() {
    await loadCss('css/vision.css');
    canvas = h('canvas', { class: 'vision-canvas', width: 320, height: 240, 'aria-hidden': 'true' });
    statusEl = h('div', { class: 'vision-status' }, 'camera off');
    msgEl = h('p', { class: 'vision-msg', role: 'status' });
    startBtn = h('button', { type: 'button', class: 'vision-start' }, 'Start camera');
    startBtn.addEventListener('click', () => (running ? stop() : start()));
    const close = h('button', { type: 'button', class: 'vision-close', 'aria-label': 'Close ARGUS vision' }, '×');
    close.addEventListener('click', () => dock.toggle());
    panel = h('section', { id: 'vision-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'vision-title' }, [
      h('header', { class: 'vision-head' }, [h('h2', { id: 'vision-title' }, 'ARGUS vision'), close]),
      h('div', { class: 'vision-view' }, [canvas, h('span', { class: 'vision-idle', 'aria-hidden': 'true' }, 'NO SIGNAL')]),
      statusEl,
      h('p', { class: 'vision-privacy' }, [h('strong', {}, 'Runs 100% on your device. '), 'Nothing is recorded or uploaded. The camera turns off when you close this panel.']),
      h('ul', { class: 'vision-legend' }, [
        h('li', {}, '✋ open palm — scroll'), h('li', {}, '✊ fist — stop'),
        h('li', {}, '🤏 pinch — open project'), h('li', {}, '✌️ peace — X-ray'),
      ]),
      msgEl,
      startBtn,
    ]);
    ctx = canvas.getContext('2d');
    document.body.append(panel);
  }

  async function start() {
    if (running || starting) return;
    starting = true;
    msgEl.textContent = '';
    startBtn.disabled = true;
    statusEl.textContent = 'requesting camera permission…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    } catch (err) {
      starting = false;
      startBtn.disabled = false;
      statusEl.textContent = 'camera off';
      msgEl.textContent = err && err.name === 'NotAllowedError'
        ? 'Permission denied. ARGUS respects that — everything else on the site still works.'
        : 'No camera available.';
      return;
    }
    if (!open) { release(); starting = false; return; } // closed while the prompt was up
    video = h('video', { playsinline: true, muted: true, autoplay: true });
    video.srcObject = stream;
    await video.play().catch(() => {});

    statusEl.textContent = 'loading vision models (~10 MB, first time only)…';
    try {
      const mp = await import(/* webpackIgnore: true */ `${MP}/vision_bundle.mjs`);
      vision = vision || await mp.FilesetResolver.forVisionTasks(`${MP}/wasm`);
      // GPU (WebGL) delegate first; fall back to CPU where WebGL is unavailable.
      const make = (Task, model, extra) => {
        const opts = (delegate) => ({ baseOptions: { modelAssetPath: model, delegate }, runningMode: 'VIDEO', ...extra });
        return Task.createFromOptions(vision, opts('GPU')).catch(() => Task.createFromOptions(vision, opts('CPU')));
      };
      [face, hand] = await Promise.all([
        make(mp.FaceLandmarker, MODELS.face, { numFaces: 1, outputFaceBlendshapes: true }),
        make(mp.HandLandmarker, MODELS.hand, { numHands: 1 }),
      ]);
      panel.__tess = mp.FaceLandmarker.FACE_LANDMARKS_TESSELATION;
      panel.__handLinks = mp.HandLandmarker.HAND_CONNECTIONS;
    } catch (err) {
      console.error('[argus] vision models failed', err);
      msgEl.textContent = 'Could not load the vision models. Check your connection and try again.';
      release();
      starting = false;
      startBtn.disabled = false;
      statusEl.textContent = 'camera off';
      return;
    }
    if (!open) { release(); starting = false; return; }
    starting = false;
    running = true;
    startBtn.disabled = false;
    startBtn.textContent = 'Stop camera';
    panel.classList.add('is-live');
    msgEl.textContent = 'Camera on. Tracking runs locally.';
    emit('argus:say', { text: 'I see you. Hello, human. (Locally. I promise.)', hold: 3500 });
    stopLoop = addTask(loop);
  }

  function loop(t) {
    if (!video || video.readyState < 2) return;
    fpsAcc += t - (lastT || t); lastT = t; fpsN++;
    if (fpsAcc > 500) { fps = Math.round((fpsN * 1000) / fpsAcc); fpsAcc = 0; fpsN = 0; }
    // Alternate the two models frame by frame; skip frames the camera hasn't refreshed.
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const ts = performance.now();
      if (frame++ & 1) handRes = hand.detectForVideo(video, ts);
      else faceRes = face.detectForVideo(video, ts);
      react();
    }
    draw();
    if (scrolling) {
      const y = window.scrollY + 3.2;
      if (state.lenis) state.lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
      if (window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2) scrolling = false;
    }
  }

  function react() {
    const argus = window.__argusEntity;
    const f = faceRes && faceRes.faceLandmarks && faceRes.faceLandmarks[0];
    if (argus) {
      if (f) {
        // Mirror: the visitor's right is the screen's left. Nose tip = landmark 1.
        const nose = f[1];
        argus.gazeOverride = { x: (1 - nose.x) * innerWidth, y: nose.y * innerHeight, __cam: true };
        const bs = faceRes.faceBlendshapes && faceRes.faceBlendshapes[0];
        if (bs) {
          const s = (n) => (bs.categories.find((c) => c.categoryName === n) || {}).score || 0;
          if (s('eyeBlinkLeft') > 0.55 && s('eyeBlinkRight') > 0.55) argus.blinkNow && argus.blinkNow();
          panel.__smile = (s('mouthSmileLeft') + s('mouthSmileRight')) / 2;
        }
      } else if (argus.gazeOverride && argus.gazeOverride.__cam) argus.gazeOverride = null;
    }

    const lm = handRes && handRes.landmarks && handRes.landmarks[0];
    const g = lm ? classify(lm) : 'none';
    gestureLabel = lm ? g : '';
    const changed = stable(g);
    if (!changed) return;
    if (changed === 'open_palm') scrolling = true;
    else if (changed === 'fist' || changed === 'none') scrolling = false;
    else if (changed === 'pinch') { scrolling = false; openNearestProject(); }
    else if (changed === 'peace' && performance.now() - lastXray > 2500) {
      lastXray = performance.now();
      qs('#xray-toggle') && qs('#xray-toggle').click();
    }
  }

  function openNearestProject() {
    const cards = qsa('.project-card');
    if (!cards.length) return;
    const mid = innerHeight / 2;
    const best = cards
      .map((c) => ({ c, d: Math.abs(c.getBoundingClientRect().top + c.offsetHeight / 2 - mid) }))
      .sort((a, b) => a.d - b.d)[0].c;
    const link = qs('a', best);
    best.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Focus (not click): browsers block pop-ups without a real click, and focus lets Enter open it.
    setTimeout(() => link && link.focus({ preventScroll: true }), 500);
    emit('argus:say', { text: `Pinch detected. Project locked: ${qs('.pc-title', best).textContent}. Press Enter to open.`, hold: 4200 });
  }

  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W, 0); ctx.scale(-1, 1); // mirror like a selfie view
    ctx.filter = 'grayscale(1) brightness(0.45) contrast(1.2)';
    ctx.drawImage(video, 0, 0, W, H);
    ctx.filter = 'none';
    const f = faceRes && faceRes.faceLandmarks && faceRes.faceLandmarks[0];
    if (f) {
      ctx.strokeStyle = 'rgba(92,225,255,0.5)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (const { start, end } of panel.__tess) {
        ctx.moveTo(f[start].x * W, f[start].y * H); ctx.lineTo(f[end].x * W, f[end].y * H);
      }
      ctx.stroke();
      box(bounds(f, W, H), `face ${(0.95 + Math.random() * 0.04).toFixed(2)}${panel.__smile > 0.5 ? ' · smile' : ''}`);
    }
    const lm = handRes && handRes.landmarks && handRes.landmarks[0];
    if (lm) {
      ctx.strokeStyle = 'rgba(255,181,71,0.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (const { start, end } of panel.__handLinks) { ctx.moveTo(lm[start].x * W, lm[start].y * H); ctx.lineTo(lm[end].x * W, lm[end].y * H); }
      ctx.stroke();
      ctx.fillStyle = '#ffb547';
      for (const p of lm) { ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 1.8, 0, Math.PI * 2); ctx.fill(); }
      box(bounds(lm, W, H), `hand:${gestureLabel}`);
    }
    ctx.restore();
    if (frame % 8) return; // status text at a readable rate
    const g = GESTURE_TEXT[gestureLabel] || '';
    statusEl.textContent = `${f ? 'face locked' : 'searching…'}${g ? ' · ' + g : ''} · ${fps} fps`;
  }

  function bounds(pts, W, H) {
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    return [x0 * W - 6, y0 * H - 6, (x1 - x0) * W + 12, (y1 - y0) * H + 12];
  }

  // Labels are drawn un-mirrored so the text reads correctly.
  function box([x, y, w, hh], label) {
    const c = 9;
    ctx.strokeStyle = '#5ce1ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
    ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
    ctx.moveTo(x, y + hh - c); ctx.lineTo(x, y + hh); ctx.lineTo(x + c, y + hh);
    ctx.moveTo(x + w - c, y + hh); ctx.lineTo(x + w, y + hh); ctx.lineTo(x + w, y + hh - c);
    ctx.stroke();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const lx = canvas.width - (x + w);
    ctx.font = '500 10px "DM Mono", monospace';
    const tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = '#ffb547'; ctx.fillRect(lx, Math.max(0, y - 15), tw, 14);
    ctx.fillStyle = '#1a1000'; ctx.fillText(label, lx + 4, Math.max(0, y - 15) + 10.5);
    ctx.restore();
  }

  function release() {
    if (stopLoop) { stopLoop(); stopLoop = null; }
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    stream = null;
    if (video) { video.pause(); video.srcObject = null; video = null; }
    if (face) { face.close(); face = null; }
    if (hand) { hand.close(); hand = null; }
    faceRes = handRes = null;
    scrolling = false;
    running = false;
    const argus = window.__argusEntity;
    if (argus && argus.gazeOverride && argus.gazeOverride.__cam) argus.gazeOverride = null;
    if (panel) {
      panel.classList.remove('is-live');
      startBtn.textContent = 'Start camera';
      statusEl.textContent = 'camera off';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  const stop = () => release();

  const dock = addDockButton({
    id: 'vision-toggle', label: 'ARGUS vision', key: 'v', order: 1, className: 'dock-vision',
    title: 'Let ARGUS see you (webcam, opt-in, runs locally)',
    onToggle: async (next) => {
      open = next;
      state.visionOpen = next;
      if (next) {
        if (!panel) await buildPanel();
        panel.classList.add('is-open');
        startBtn.focus({ preventScroll: true });
      } else {
        release();
        if (panel) panel.classList.remove('is-open');
      }
      return next;
    },
  });

  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) dock.toggle(); });
  window.addEventListener('pagehide', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) scrolling = false; });
}
