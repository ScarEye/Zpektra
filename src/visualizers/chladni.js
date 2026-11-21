import * as THREE from 'three';
import { Visualizer } from './base.js';

// Free-plate Chladni mode. Nodal lines are where this is near zero.
// The displacement in _integrate() is this expression, evaluated in the unit disc.
const PI = Math.PI;

// Simple figures first, denser filigree later. Every pair has n < m, so a
// straight morph between two of them never passes through the flat n = m plate.
const MODES = [
  [1, 2], [1, 3], [2, 3], [1, 4], [2, 4], [3, 4],
  [1, 5], [2, 5], [3, 5], [4, 5],
  [2, 6], [3, 6], [4, 6], [5, 6],
  [3, 7], [4, 7], [5, 7],
  [4, 8], [5, 8], [6, 8],
];

const OPEN_MODE = 2;
const GRAINS = 14000;
const SETTLE_STEPS = 70;

const sandVert = `
  uniform float uSize;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize;
  }
`;

const sandFrag = `
  precision highp float;
  uniform vec3 uColor;
  uniform float uAct;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.05, length(d));
    if (a < 0.01) discard;
    vec3 col = uColor * a * (1.05 + 0.45 * uAct);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Chladni extends Visualizer {
  build() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);
    this.scene.background = new THREE.Color('#05060a');
    this.radius = 0.94;

    this.n = MODES[OPEN_MODE][0];
    this.m = MODES[OPEN_MODE][1];
    this.modeIndex = OPEN_MODE;
    this.pendingIndex = OPEN_MODE;
    this.pendingTime = 0;
    this.holdTime = 0;
    this.centroid = OPEN_MODE / (MODES.length - 1);
    this.scatter = 0;
    this.sensitivity = 1;
    this.time = 0;

    this._fit(window.innerWidth, window.innerHeight);

    this.state = new Float32Array(GRAINS * 4);
    this._fillDisc();
    for (let i = 0; i < SETTLE_STEPS; i++) this._integrate(1 / 60, 5.5, 0, 0);

    this.positions = new Float32Array(GRAINS * 3);
    this._writePositions(0, 0);

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    geo.setAttribute('position', this.posAttr);
    geo.computeBoundingSphere();

    const pixelRatio = this.renderer.getPixelRatio ? this.renderer.getPixelRatio() : 1;
    this.sandUniforms = {
      uSize: { value: 4.2 * Math.max(1, pixelRatio) },
      uColor: { value: this._sandColor(this.palette.primary) },
      uAct: { value: 0.4 },
    };
    const sand = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.sandUniforms,
        vertexShader: sandVert,
        fragmentShader: sandFrag,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    sand.frustumCulled = false;
    this.scene.add(sand);
  }

  setSensitivity(value) {
    const n = Number(value);
    this.sensitivity = Math.min(1, Math.max(0, Number.isFinite(n) ? n : 1));
  }

  frame(reactor, dt) {
    const sens = this.sensitivity;
    this._updateMode(reactor, dt, sens);

    // Pull stays strong so the figure holds. Sensitivity only adds a faint shimmer.
    const drive = 3.2 + sens * 1.6;
    const jitter = reactor.activity * reactor.treble * sens * 0.05;
    this._integrate(dt, drive, 0, jitter);

    this.sandUniforms.uAct.value = 0.5 + reactor.activity * 0.5;
    this._writePositions(0, 0);
  }

  resize(w, h) {
    if (!this.camera.isOrthographicCamera) return;
    const prev = this.radius || 1;
    this._fit(w, h);
    if (!this.state) return;
    const k = this.radius / prev;
    if (Math.abs(k - 1) < 0.001) return;
    for (let i = 0; i < GRAINS; i++) {
      this.state[i * 4] *= k;
      this.state[i * 4 + 1] *= k;
    }
  }

  onPalette(p) {
    if (!this.sandUniforms) return;
    this.sandUniforms.uColor.value.copy(this._sandColor(p.primary));
  }

  _sandColor(color) {
    const c = color.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(hsl.h, Math.max(0.45, hsl.s), Math.max(0.62, hsl.l));
    return c;
  }

  _fit(w, h) {
    const aspect = w / Math.max(1, h);
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
    this.radius = 0.96 * Math.min(aspect, 1);
  }

  _fillDisc() {
    const s = this.state;
    const reach = this.radius * 0.98;
    for (let i = 0; i < GRAINS; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * reach;
      s[i * 4] = Math.cos(a) * r;
      s[i * 4 + 1] = Math.sin(a) * r;
      s[i * 4 + 2] = 0;
      s[i * 4 + 3] = 0;
    }
  }

  _updateMode(reactor, dt, sens) {
    const spectrum = reactor.spectrum;
    if (spectrum && spectrum.length && reactor.activity > 0.05) {
      let num = 0;
      let den = 0;
      let peak = 0;
      let peakV = 0;
      for (let i = 0; i < spectrum.length; i++) {
        const v = spectrum[i];
        num += v * i;
        den += v;
        if (v > peakV) {
          peakV = v;
          peak = i;
        }
      }
      if (den > 0.03) {
        const centroid = num / den / (spectrum.length - 1);
        const peakN = peak / (spectrum.length - 1);
        const bright = reactor.treble / (reactor.bass + reactor.treble + 0.04);
        const target = Math.min(1, Math.max(0, centroid * 0.35 + peakN * 0.25 + bright * 0.4));
        const follow = 1 - Math.exp(-dt * (2 + sens * 6));
        this.centroid += (target - this.centroid) * follow;

        const scaled = this.centroid * (MODES.length - 1);
        const gap = 1.15 - sens * 0.7;
        if (Math.abs(scaled - this.modeIndex) > gap) {
          const next = Math.round(Math.min(MODES.length - 1, Math.max(0, scaled)));
          if (next !== this.pendingIndex) {
            this.pendingIndex = next;
            this.pendingTime = 0;
          }
          this.pendingTime += dt;
          if (this.pendingTime > 0.55 - sens * 0.3) {
            this.modeIndex = next;
            this.pendingTime = 0;
          }
        } else {
          this.pendingIndex = this.modeIndex;
          this.pendingTime = 0;
        }
      }
    }

    const mode = MODES[this.modeIndex];
    const ease = 1 - Math.exp(-dt * (1.6 + sens * 2.6));
    this.n += (mode[0] - this.n) * ease;
    this.m += (mode[1] - this.m) * ease;
    if (Math.abs(this.n - mode[0]) < 0.015 && Math.abs(this.m - mode[1]) < 0.015) {
      this.n = mode[0];
      this.m = mode[1];
    }
  }

  _integrate(dt, drive, scatter, jitter) {
    const npi = this.n * PI;
    const mpi = this.m * PI;
    const s = this.state;
    const invR = 1 / this.radius;
    const damp = Math.exp(-dt * 11);
    const accelDt = drive * 0.22 * dt;
    const scatterDt = scatter > 0.001 ? scatter * dt * 220 : 0;
    const jitterDt = jitter > 0.001 ? jitter * dt * 6 : 0;
    const maxR = this.radius * 0.985;
    const maxR2 = maxR * maxR;

    for (let i = 0; i < GRAINS; i++) {
      const o = i * 4;
      let x = s[o];
      let y = s[o + 1];
      let vx = s[o + 2];
      let vy = s[o + 3];

      const px = x * invR;
      const py = y * invR;
      const nx = npi * px;
      const my = mpi * py;
      const mx = mpi * px;
      const ny = npi * py;
      const cnx = Math.cos(nx);
      const snx = Math.sin(nx);
      const cmy = Math.cos(my);
      const smy = Math.sin(my);
      const cmx = Math.cos(mx);
      const smx = Math.sin(mx);
      const cny = Math.cos(ny);
      const sny = Math.sin(ny);
      const u = cnx * cmy - cmx * cny;
      const dux = (-npi * snx * cmy + mpi * smx * cny) * invR;
      const duy = (-mpi * cnx * smy + npi * cmx * sny) * invR;

      let fx = -u * dux;
      let fy = -u * duy;
      const fl2 = fx * fx + fy * fy;
      if (fl2 > 256) {
        const k = 16 / Math.sqrt(fl2);
        fx *= k;
        fy *= k;
      }

      vx += fx * accelDt;
      vy += fy * accelDt;
      if (scatterDt) {
        vx += (Math.random() - 0.5) * scatterDt;
        vy += (Math.random() - 0.5) * scatterDt;
      }
      if (jitterDt) {
        vx += (Math.random() - 0.5) * jitterDt;
        vy += (Math.random() - 0.5) * jitterDt;
      }

      vx *= damp;
      vy *= damp;

      x += vx * dt;
      y += vy * dt;

      const r2 = x * x + y * y;
      if (r2 > maxR2) {
        const r = Math.sqrt(r2);
        const k = maxR / r;
        x *= k;
        y *= k;
        const vr = (vx * x + vy * y) / maxR;
        if (vr > 0) {
          vx -= vr * (x / maxR) * 1.35;
          vy -= vr * (y / maxR) * 1.35;
        }
      }

      s[o] = x;
      s[o + 1] = y;
      s[o + 2] = vx;
      s[o + 3] = vy;
    }
  }

  _writePositions(sx, sy) {
    const s = this.state;
    const p = this.positions;
    for (let i = 0; i < GRAINS; i++) {
      const o = i * 4;
      const d = i * 3;
      p[d] = s[o] + sx;
      p[d + 1] = s[o + 1] + sy;
      p[d + 2] = 0;
    }
    if (this.posAttr) this.posAttr.needsUpdate = true;
  }
}
