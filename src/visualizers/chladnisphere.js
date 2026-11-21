import * as THREE from 'three';
import { Visualizer } from './base.js';

// Same free-plate figure as the circular plate, evaluated on x/y.
// Grains are constrained to the sphere, so the front reads as the circle
// and the lines wrap the ball when you orbit.
const PI = Math.PI;

const MODES = [
  [1, 2], [1, 3], [2, 3], [1, 4], [2, 4], [3, 4],
  [1, 5], [2, 5], [3, 5], [4, 5],
  [2, 6], [3, 6], [4, 6], [5, 6],
  [3, 7], [4, 7], [5, 7],
  [4, 8], [5, 8], [6, 8],
];

const OPEN_MODE = 2;
const GRAINS = 28000;
const SETTLE_STEPS = 150;
const RADIUS = 1.58;

const sandVert = `
  uniform float uSize;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uSize * (2.5 / max(0.45, -mv.z)), 1.0, 14.0);
  }
`;

const sandFrag = `
  precision highp float;
  uniform vec3 uColor;
  uniform float uAct;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.08, length(d));
    if (a < 0.01) discard;
    vec3 col = uColor * a * (1.05 + 0.45 * uAct);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const rimVert = `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const rimFrag = `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uCam;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 view = normalize(uCam - vW);
    float fres = pow(1.0 - abs(dot(normalize(vN), view)), 2.6);
    gl_FragColor = vec4(uColor, fres * 0.22);
  }
`;

export class ChladniSphere extends Visualizer {
  build() {
    this.interactive = true;
    this.camera.near = 0.4;
    this.camera.far = 30;
    this.camera.position.set(0.35, 0.72, 3.85);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.scene.background = new THREE.Color('#05060a');
    this.radius = RADIUS;

    this.n = MODES[OPEN_MODE][0];
    this.m = MODES[OPEN_MODE][1];
    this.modeIndex = OPEN_MODE;
    this.pendingIndex = OPEN_MODE;
    this.pendingTime = 0;
    this.centroid = OPEN_MODE / (MODES.length - 1);
    this.sensitivity = 1;

    this.state = new Float32Array(GRAINS * 6);
    this._fillSphere();
    for (let i = 0; i < SETTLE_STEPS; i++) this._integrate(1 / 60, 7, 0);

    this.positions = new Float32Array(GRAINS * 3);
    this._writePositions();

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 0.992, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x05060a })
    );
    this.scene.add(shell);

    const pixelRatio = this.renderer.getPixelRatio ? this.renderer.getPixelRatio() : 1;
    this.rimUniforms = {
      uColor: { value: this._sandColor(this.palette.primary) },
      uCam: { value: this.camera.position.clone() },
    };
    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 1.004, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: this.rimUniforms,
        vertexShader: rimVert,
        fragmentShader: rimFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.scene.add(rim);

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    geo.setAttribute('position', this.posAttr);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), this.radius * 1.08);

    this.sandUniforms = {
      uSize: { value: 8.5 * Math.max(1, pixelRatio) },
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
        depthTest: true,
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

    const drive = 3.2 + sens * 1.6;
    const jitter = reactor.activity * reactor.treble * sens * 0.05;
    this._integrate(dt, drive, jitter);

    this.sandUniforms.uAct.value = 0.5 + reactor.activity * 0.5;
    this.rimUniforms.uCam.value.copy(this.camera.position);
    this._writePositions();
  }

  onPalette(p) {
    const color = this._sandColor(p.primary);
    if (this.sandUniforms) this.sandUniforms.uColor.value.copy(color);
    if (this.rimUniforms) this.rimUniforms.uColor.value.copy(color);
  }

  _sandColor(color) {
    const c = color.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(hsl.h, Math.max(0.45, hsl.s), Math.max(0.62, hsl.l));
    return c;
  }

  _fillSphere() {
    const s = this.state;
    const r = this.radius;
    for (let i = 0; i < GRAINS; i++) {
      const y = Math.random() * 2 - 1;
      const ang = Math.random() * PI * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const o = i * 6;
      s[o] = Math.cos(ang) * ring * r;
      s[o + 1] = y * r;
      s[o + 2] = Math.sin(ang) * ring * r;
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

  _integrate(dt, drive, jitter) {
    const npi = this.n * PI;
    const mpi = this.m * PI;
    const s = this.state;
    const invR = 1 / this.radius;
    const damp = Math.exp(-dt * 11);
    const accelDt = drive * 0.22 * dt;
    const jitterDt = jitter > 0.001 ? jitter * dt * 6 : 0;
    const radius = this.radius;

    for (let i = 0; i < GRAINS; i++) {
      const o = i * 6;
      let x = s[o];
      let y = s[o + 1];
      let z = s[o + 2];
      let vx = s[o + 3];
      let vy = s[o + 4];
      let vz = s[o + 5];

      const px = x * invR;
      const py = y * invR;
      const cnx = Math.cos(npi * px);
      const snx = Math.sin(npi * px);
      const cmy = Math.cos(mpi * py);
      const smy = Math.sin(mpi * py);
      const cmx = Math.cos(mpi * px);
      const smx = Math.sin(mpi * px);
      const cny = Math.cos(npi * py);
      const sny = Math.sin(npi * py);
      const u = cnx * cmy - cmx * cny;
      const dux = (-npi * snx * cmy + mpi * smx * cny) * invR;
      const duy = (-mpi * cnx * smy + npi * cmx * sny) * invR;

      let fx = -u * dux;
      let fy = -u * duy;
      let fz = 0;
      const nx = px;
      const ny = py;
      const nz = z * invR;
      const rad = fx * nx + fy * ny;
      fx -= rad * nx;
      fy -= rad * ny;
      fz -= rad * nz;

      const fl2 = fx * fx + fy * fy + fz * fz;
      if (fl2 > 256) {
        const k = 16 / Math.sqrt(fl2);
        fx *= k;
        fy *= k;
        fz *= k;
      }

      vx += fx * accelDt;
      vy += fy * accelDt;
      vz += fz * accelDt;
      if (jitterDt) {
        vx += (Math.random() - 0.5) * jitterDt;
        vy += (Math.random() - 0.5) * jitterDt;
        vz += (Math.random() - 0.5) * jitterDt;
      }

      vx *= damp;
      vy *= damp;
      vz *= damp;

      x += vx * dt;
      y += vy * dt;
      z += vz * dt;

      const len = Math.hypot(x, y, z) || 1;
      const snap = radius / len;
      x *= snap;
      y *= snap;
      z *= snap;

      const vr = (vx * x + vy * y + vz * z) * invR;
      vx -= vr * x * invR;
      vy -= vr * y * invR;
      vz -= vr * z * invR;

      s[o] = x;
      s[o + 1] = y;
      s[o + 2] = z;
      s[o + 3] = vx;
      s[o + 4] = vy;
      s[o + 5] = vz;
    }
  }

  _writePositions() {
    const s = this.state;
    const p = this.positions;
    for (let i = 0; i < GRAINS; i++) {
      const o = i * 6;
      const d = i * 3;
      p[d] = s[o];
      p[d + 1] = s[o + 1];
      p[d + 2] = s[o + 2];
    }
    if (this.posAttr) this.posAttr.needsUpdate = true;
  }
}
