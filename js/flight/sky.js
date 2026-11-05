// The sky: one full-screen fragment shader renders the whole climb — runway and ground, the cloud deck
// you fly through, stratosphere, stars and the curved Earth limb. Rendered below native resolution and
// throttled when nothing is moving. Without WebGL it falls back to a CSS gradient of the same palette.
import { addTask } from '../core/loop.js';
import { on, state } from '../core/bus.js';
import { env } from '../core/env.js';
import { h } from '../core/util.js';
import { flight, CLOUD_DECK } from './progress.js';

// [altitude, zenith, horizon] for night (dark theme) and day (light theme).
const PALETTE = {
  dark: [[0, '#070d1f', '#26304f'], [0.2, '#081430', '#274a7c'], [0.45, '#071028', '#1d3f73'], [0.7, '#040818', '#122a55'], [0.88, '#01030a', '#0a1a3c'], [1, '#000002', '#040b1e']],
  light: [[0, '#5fa8e0', '#fde6c8'], [0.2, '#3f94e0', '#cdeafa'], [0.45, '#1f6fc8', '#a4d6f5'], [0.7, '#0d3f8e', '#5f9fdc'], [0.88, '#041a48', '#1d4a8c'], [1, '#000004', '#071430']],
};

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
const mix3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

function paletteAt(alt, theme) {
  const p = PALETTE[theme];
  for (let i = 1; i < p.length; i++) {
    if (alt <= p[i][0]) {
      const k = (alt - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
      return [mix3(hex(p[i - 1][1]), hex(p[i][1]), k), mix3(hex(p[i - 1][2]), hex(p[i][2]), k)];
    }
  }
  const l = p[p.length - 1];
  return [hex(l[1]), hex(l[2])];
}

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

const frag = (lite) => `
precision highp float;
uniform vec2 uRes; uniform float uTime, uAlt, uDay, uDeck, uBoom;
uniform vec2 uMouse, uBoomAt; uniform vec3 uZen, uHor;

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  for(int i=0;i<${lite ? 3 : 5};i++){ v += a*noise(p); p = p*2.03 + vec2(13.1,7.7); a *= .5; }
  return v;
}
// Soft-edged 1 between a and b, used for crisp but anti-aliased runway paint.
float paintBand(float v, float a, float b, float w){ return smoothstep(a-w,a+w,v)*smoothstep(b+w,b-w,v); }
// Cheaper version for domain warping and shading, where the fine octaves are invisible.
float fbm2(vec2 p){ return .66*noise(p) + .34*noise(p*2.03 + vec2(13.1,7.7)); }

// A cloud sheet: returns density; lit is written with a cheap light-from-above term.
float clouds(vec2 p, float cover, out float lit){
  vec2 w = vec2(fbm2(p*.6 + uTime*.012), fbm2(p*.6 + 5.2 - uTime*.01));
  float n = fbm(p + w*.9);
  float n2 = n + (fbm2(p + w*.9 + vec2(.05,.12)) - fbm2(p + w*.9))*.8;
  float d = smoothstep(1.-cover, 1.-cover+.32, n);
  lit = clamp(.55 + (n - n2)*5.5, 0., 1.);
  return d;
}

vec3 stars(vec2 uv, float t){
  vec3 c = vec3(0.);
  for(int i=0;i<2;i++){
    float s = 120. + float(i)*150.;
    vec2 g = uv*s; vec2 id = floor(g); vec2 f = fract(g)-.5;
    float r = hash(id + float(i)*17.);
    if(r > .975){
      vec2 o = (vec2(hash(id+1.3),hash(id+2.7))-.5)*.7;
      float d = length(f-o);
      float tw = .65 + .35*sin(t*(1.+r*3.) + r*40.);
      c += vec3(.8+.2*r,.88,1.) * smoothstep(.09,.0,d) * tw;
    }
  }
  return c;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5*uRes)/uRes.y;
  float aspect = uRes.x/uRes.y;
  float alt = uAlt;
  vec2 par = uMouse*vec2(.012,.008);

  // Sonic boom: a pressure ring refracts everything it passes.
  if(uBoom > 0. && uBoom < 1.){
    vec2 dv = uv - uBoomAt; float dd = length(dv);
    float ring = exp(-pow((dd - uBoom*1.5)*11.,2.))*(1.-uBoom);
    uv += normalize(dv+1e-4)*ring*.05;
  }

  // Base atmosphere
  float grad = smoothstep(-.55,.6,uv.y);
  vec3 col = mix(uHor, uZen, grad);

  // Sun by day, moon by night, sinking away as we climb past them
  vec2 sp = vec2(.085*aspect, .385 - alt*.3) - par*2.;
  float sd = length(uv-sp);
  vec3 sunC = mix(vec3(.85,.9,1.), vec3(1.,.93,.78), uDay);
  col += sunC*(.022/(sd+.03))*mix(.42,.9,uDay)*(1.-smoothstep(.75,1.,alt)*.5);
  float maria = mix(.82+.18*fbm((uv-sp)*38.), 1., uDay);
  col = mix(col, sunC*maria, smoothstep(.031,.027,sd)*mix(.9,1.,uDay));

  // Stars come out as the air thins (a few even at night on the ground)
  float starAmt = mix(.3*(1.-uDay), 1., smoothstep(.62,.9,alt));
  col += stars(uv + par*.4 + vec2(0.,alt*.07), uTime)*starAmt*clamp(1.2-grad*.1,0.,1.);

  // Cloud deck: a wall of cloud sweeps down the screen as we climb through it
  float below = (alt - uDeck);
  float band = uv.y + below*5.2;              // cloud sits at this height relative to the camera
  float wall = exp(-pow(band/.62,2.));
  float high = smoothstep(.1,.24,alt)*(1.-smoothstep(.70,.82,alt));
  vec3 cloudShade = mix(vec3(.13,.18,.30), vec3(.62,.70,.82), uDay);
  vec3 cloudLight = mix(vec3(.46,.55,.72), vec3(1.,.99,.97), uDay);
  // Uniform branch: the runway and space pay nothing for clouds.
  if(high > .001){
    vec2 cp = (uv + par)*vec2(1.5,2.6);
    float ascent = alt*9.;                     // climbing makes the clouds fall past us
    float lit1, lit2;
    float cover1 = clamp(.34 + wall*.62, 0., .98)*high;
    ${lite ? '' : `float d2 = clouds(cp*.55 + vec2(uTime*.01+3., ascent*.55), clamp(.3 + wall*.55,0.,.95)*high, lit2);
    col = mix(col, mix(cloudShade, cloudLight, lit2), d2*.85);`}
    float d1 = clouds(cp*1.15 + vec2(uTime*.018, ascent), cover1, lit1);
    col = mix(col, mix(cloudShade, cloudLight, lit1), d1*.92);
  }

  // High cirrus streaks in the thin air above the deck
  if(alt > .5 && alt < .86){
    float cir = fbm(vec2(uv.x*1.3 + uTime*.006, uv.y*7. + alt*14.));
    float cirrus = smoothstep(.56,.8,cir)*smoothstep(.5,.6,alt)*(1.-smoothstep(.74,.86,alt));
    col = mix(col, cloudLight, cirrus*.28);
  }

  // ─── The airfield: drops away below us over the first part of the climb ───
  float hor = mix(-.285, -1.5, smoothstep(0.,.11,alt)) - par.y;
  float night = 1.-uDay;
  vec3 neon = mix(vec3(.36,.88,1.), vec3(.03,.42,.6), uDay);
  float field = 1.-smoothstep(.07,.13,alt);

  if(field > 0.){
    float x = uv.x + par.x*1.5;
    float y = uv.y - hor;
    float tx = .33*aspect;

    // Control tower beacon: a slow beam sweeping the sky
    vec2 bv = vec2(x-tx, y-.106);
    float sweep = sin(uTime*.42)*1.15;
    float beam = exp(-pow((atan(bv.x,bv.y)-sweep)*7.,2.))*exp(-length(bv)*1.5)*step(0.,bv.y);
    col += neon*beam*mix(.2,.05,uDay)*field;

    if(y < .14 && y > -.001){
      // Ridgeline, then the city either side of the runway's end
      float ridge = .03 + .055*fbm2(vec2(x*2.3+4.,1.7)) + .012*fbm2(vec2(x*9.,3.1));
      vec3 ridgeC = mix(uHor*.5, mix(uHor,uZen,.35)*.92, uDay);
      col = mix(col, ridgeC, smoothstep(.0015,-.0015,y-ridge));
      float bx = floor(x*74.);
      float bh = (.005 + .036*pow(hash(vec2(bx,2.)),3.))*smoothstep(.15,.3,abs(x));
      vec3 cityC = mix(vec3(.018,.026,.052), mix(uHor,uZen,.5)*.74, uDay);
      float inB = step(y,bh);
      col = mix(col, cityC, inB);
      vec2 wv = vec2(x*430., y*540.);
      float win = step(.8,hash(floor(wv)))*step(.3,fract(wv.x))*step(.35,fract(wv.y))*inB*night;
      col += mix(vec3(1.,.76,.4), neon, step(.86,hash(floor(wv)+3.)))*win*.75;

      // The tower itself, with a lit cab and a red beacon
      float dx = abs(x-tx);
      float shaft = step(dx,.0042 + .0022*step(y,.018))*step(y,.086);
      float cab = step(dx,.0165 - (y-.086)*.32)*step(.086,y)*step(y,.102);
      col = mix(col, cityC*.85, max(shaft,cab));
      col += neon*step(dx,.0128)*step(.0895,y)*step(y,.0975)*mix(.85,.3,uDay);
      float blink = step(.72,fract(uTime*.8));
      col += vec3(1.,.16,.14)*exp(-(pow(x-tx,2.)+pow(y-.108,2.))*90000.)*(.25+blink);
    }
  }

  if(uv.y < hor){
    float dpt = hor-uv.y;
    float height = .055 + alt*2.2;
    float z = height/(dpt+1e-3);
    float wx = (uv.x + par.x*3.)*z;
    float wz = z + alt*520. + uTime*.2;   // a slow roll keeps the field alive; scrolling is the takeoff run
    float ax = abs(wx);
    float fog = exp(-z*.075);
    vec3 far = mix(uHor*1.05, uHor*.9, uDay);

    // Terrain
    vec3 g = mix(vec3(.016,.024,.042), vec3(.33,.43,.29), uDay);
    g *= .75 + fbm(vec2(wx*.35,wz*.35))*.6;
    g += step(.985,hash(floor(vec2(wx*5.,wz*5.))))*night*step(1.2,ax)*vec3(1.,.8,.5)*.8;

    // Synthetic-vision grid: the terrain as a flight computer sees it
    vec2 gc = abs(fract(vec2(wx,wz)*1.6)-.5);
    float wX = .0028*z, wZ = .0021*z*z/height;
    float lx = smoothstep(wX,0.,gc.x)*(1.-smoothstep(.1,.34,wX));
    float lz = smoothstep(wZ,0.,gc.y)*(1.-smoothstep(.1,.34,wZ));
    g += neon*max(lx,lz)*mix(.36,.2,uDay);

    // Wet tarmac: mirrors the sky and the moon, strongest at grazing angles
    float rw = .24;
    float strip = smoothstep(rw+.003*z, rw, ax);
    float fres = pow(1.-clamp(dpt*3.2,0.,1.),2.4);
    float wet = .5 + .5*fbm2(vec2(wx*7.,wz*1.5));
    vec3 asphalt = mix(vec3(.026,.031,.044), vec3(.25,.26,.29), uDay);
    vec3 r = mix(asphalt, mix(uHor,uZen,clamp(dpt*2.4,0.,1.))*mix(.9,.62,uDay), fres*wet*mix(.92,.55,uDay));
    float mirror = exp(-pow((uv.x-sp.x)*(9.+wet*6.),2.))*(.35+fres)*wet;
    r += sunC*mirror*mix(.42,.34,uDay);

    // Paint: centreline, threshold piano keys, touchdown bars, side stripes
    float zz = mod(wz,11.);
    float wa = .0014*z, wb = .0014*z*z/height;   // anti-aliasing widths across and along the runway
    float paint = paintBand(fract(wz*3.2),.52,1.,wb*3.2)*paintBand(ax,-1.,.0085,wa);
    paint = max(paint, paintBand(zz,1.,1.5,wb)*paintBand(fract(wx*27.),.45,1.,wa*27.)*paintBand(ax,.03,rw-.022,wa));
    paint = max(paint, paintBand(zz,2.2,2.55,wb)*paintBand(ax,.055,.12,wa)*paintBand(fract(ax*46.),.4,1.,wa*46.)*.7);
    paint = max(paint, paintBand(ax,rw-.013,rw-.005,wa));
    paint *= smoothstep(.2,.6,z)*(1.-smoothstep(2.4,5.,z));
    r = mix(r, mix(vec3(.66,.76,.82),vec3(.97),uDay), paint*.82);

    g = mix(g, r, strip);
    col = mix(far, g, fog);

    // Lights stay point-sized at every distance, so they're measured in screen space
    float ph = fract(log(z+.3)*.62 - uTime*.5);
    float rabbit = exp(-pow((ph-.5)*7.,2.));            // pulse racing toward the horizon
    float sx = abs(ax-rw-.008)/z;
    float sz = (fract(wz*5.)-.5)/5.*height/(z*z);
    float d2 = sx*sx + sz*sz;
    vec3 lampC = mix(vec3(1.,.84,.56), neon, rabbit);
    vec3 lights = lampC*(exp(-d2/1.3e-5) + .32*exp(-d2/1.6e-4))*(1.+rabbit*2.4)*mix(1.25,.6,uDay);
    float s2 = ax/z, q2 = (fract(wz*7.)-.5)/7.*height/(z*z);
    lights += neon*exp(-(s2*s2+q2*q2)/9e-6)*mix(1.,.3,uDay)*smoothstep(.3,.8,z);
    // Neon edge strips and their reflections in the wet surface
    lights += neon*exp(-pow(abs(ax-rw)/z/.0015,2.))*(.28+rabbit*1.1)*mix(1.,.5,uDay);
    lights += lampC*exp(-pow(sx/.006,2.))*fres*strip*.35*wet;
    col += lights*(.45+.55*fog);
  }

  // Haze on the horizon, and a glow where the runway meets it
  col += uHor*.3*exp(-pow((uv.y-hor)/.05,2.))*(1.-smoothstep(.0,.1,alt));
  col += neon*exp(-length((uv-vec2(-par.x*.3,hor))*vec2(2.4,10.))*3.2)*mix(.5,.16,uDay)*field;

  // Earth limb rising at the top of the climb
  float er = smoothstep(.8,1.,alt);
  if(er > 0.){
    float R = 2.4;
    vec2 ec = vec2(0.+par.x*.5, -R - mix(.9,.205,er));
    float d = length(uv-ec)-R;
    float atm = exp(-max(d,0.)*16.)*(d>0.?1.:0.) ;
    vec3 atmC = vec3(.25,.55,1.);
    col += atmC*atm*.95*er;
    col += vec3(.75,.9,1.)*exp(-abs(d)*90.)*.8*er;
    if(d < 0.){
      vec2 ep = (uv-ec)*vec2(1.,1.5);
      float lat = fbm(ep*2.6 + vec2(uTime*.004,0.));
      float land = smoothstep(.46,.56,fbm(ep*1.3+7.));
      vec3 surf = mix(vec3(.01,.045,.12), vec3(.03,.075,.06), land);
      surf = mix(surf, vec3(.42,.5,.62), smoothstep(.52,.72,lat)*.7);
      float city = step(.992,hash(floor(ep*170.)))*land*(1.-uDay*.6);
      surf += vec3(1.,.75,.4)*city*.75;
      float rimLight = exp(d*7.);
      surf += atmC*rimLight*.35;
      col = mix(col, surf, smoothstep(0.,-.004,d));
    }
  }

  // Boom flash
  if(uBoom > 0. && uBoom < 1.){
    float dd = length(uv-uBoomAt);
    col += vec3(.75,.9,1.)*exp(-pow((dd-uBoom*1.5)*11.,2.))*(1.-uBoom)*.5;
  }

  // Keep everything slightly filmic and dithered so gradients don't band
  col = col/(1.+max(col-1.,0.));
  col += (hash(gl_FragCoord.xy+uTime)-.5)/255.*1.5;
  gl_FragColor = vec4(col,1.);
}`;

export function initSky() {
  const root = document.documentElement;
  const theme = () => (root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  const canvas = h('canvas', { id: 'sky', 'aria-hidden': 'true' });
  document.body.prepend(canvas);
  const lite = env.mobile || env.lowPower || env.touch;
  const css = (alt) => {
    const [z, hz] = paletteAt(alt, theme());
    const c = (a) => `rgb(${a.map((v) => Math.round(v * 255)).join(',')})`;
    root.style.setProperty('--sky-z', c(z));
    root.style.setProperty('--sky-h', c(hz));
  };
  css(flight.alt);

  // The page gradient (same palette) carries the screen until the shader is ready.
  const handle = { boom() {} };
  const fallback = () => {
    canvas.remove();
    addTask(() => { if (Math.abs(flight.rate) > 1e-5) css(flight.alt); });
    on('theme', () => requestAnimationFrame(() => css(flight.alt)));
  };

  // Compiling a shader this size can take a second, so it starts after first paint and never blocks:
  // KHR_parallel_shader_compile lets us poll for completion instead of waiting on it.
  const begin = () => {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: lite ? 'low-power' : 'default' });
    if (!gl) { fallback(); return; }
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    const program = gl.createProgram();
    const add = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(program, s); return s; };
    const shaders = [add(gl.VERTEX_SHADER, VERT), add(gl.FRAGMENT_SHADER, frag(lite))];
    gl.linkProgram(program);
    const stop = addTask(() => {
      if (parallel && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) return;
      stop();
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('[sky]', gl.getProgramInfoLog(program), gl.getShaderInfoLog(shaders[1]));
        fallback();
        return;
      }
      run(gl, program);
    });
  };
  (window.requestIdleCallback || ((f) => setTimeout(f, 250)))(begin, { timeout: 900 });

  function run(gl, program) {
  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = {};
  ['uRes', 'uTime', 'uAlt', 'uDay', 'uDeck', 'uBoom', 'uMouse', 'uBoomAt', 'uZen', 'uHor'].forEach((n) => { u[n] = gl.getUniformLocation(program, n); });

  let dirty = true;
  // Adaptive quality: if frames run long, render the sky at a lower internal resolution.
  // The clouds are soft, so this is nearly invisible and keeps scrolling smooth on weak GPUs.
  const SCALES = lite ? [0.42, 0.3, 0.22] : [0.62, 0.46, 0.34, 0.24];
  let quality = 0, slow = 0, seen = 0;
  function size() {
    const scale = SCALES[quality];
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(2, Math.round(innerWidth * dpr * scale));
    canvas.height = Math.max(2, Math.round(innerHeight * dpr * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    dirty = true;
  }
  size();
  window.addEventListener('resize', size);

  let day = theme() === 'light' ? 1 : 0;
  on('theme', () => { requestAnimationFrame(() => { dirty = true; }); });

  let boomStart = -1, boomX = 0, boomY = 0, last = -1e9;
  const boom = (x, y) => {
    boomStart = performance.now();
    boomX = (x - innerWidth / 2) / innerHeight;
    boomY = (innerHeight / 2 - y) / innerHeight;
  };

  function draw(t) {
    const [z, hz] = paletteAt(flight.alt, theme());
    const b = boomStart < 0 ? -1 : (performance.now() - boomStart) / 1500;
    if (b >= 1) boomStart = -1;
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, env.reducedMotion ? 40 : t / 1000);
    gl.uniform1f(u.uAlt, flight.alt);
    gl.uniform1f(u.uDay, day);
    gl.uniform1f(u.uDeck, CLOUD_DECK);
    gl.uniform1f(u.uBoom, b);
    gl.uniform2f(u.uBoomAt, boomX, boomY);
    gl.uniform2f(u.uMouse, flight.mx, flight.my);
    gl.uniform3f(u.uZen, z[0], z[1], z[2]);
    gl.uniform3f(u.uHor, hz[0], hz[1], hz[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Render on movement; when idle the clouds only need ~20 fps (or nothing under reduced motion).
  addTask((t, dt) => {
    if (state.introActive && !dirty) return;
    if (state.xray) return;
    if (++seen > 20) {
      if (dt > 26) slow++;
      if (seen > 60) {
        if (slow > 24 && quality < SCALES.length - 1) { quality++; size(); }
        seen = 0; slow = 0;
      }
    }
    const targetDay = theme() === 'light' ? 1 : 0;
    const fading = Math.abs(day - targetDay) > 0.002;
    if (fading) day += (targetDay - day) * 0.08;
    const moving = Math.abs(flight.rate) > 1e-5 || boomStart >= 0 || fading;
    const idleGap = env.reducedMotion ? Infinity : lite ? 66 : 48;
    if (!moving && !dirty && t - last < idleGap) return;
    if (lite && moving && t - last < 30) return;
    last = t;
    dirty = false;
    draw(t);
    canvas.classList.add('is-ready');
  });

  handle.boom = boom;
  }

  return handle;
}
