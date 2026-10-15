import * as THREE from 'three';
import { Visualizer } from './base.js';

const TILES = 14;
const PITCH = 3.8;
const POINTS = 64;
const RUNGS = 16;
const SPAN = TILES * PITCH;
const TAU = Math.PI * 2;

const strandVert = `
attribute float aAmp;
attribute float aSide;
varying float vAmp;
varying float vSide;
void main() {
  vAmp = aAmp;
  vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const strandFrag = `
precision highp float;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uAct;
uniform float uHit;
varying float vAmp;
varying float vSide;
void main() {
  float core = pow(1.0 - abs(vSide), 1.15);
  vec3 col = mix(uColor, uAccent, uHit * 0.35 * vAmp);
  col *= 0.62 + 0.38 * vAmp;
  float alpha = core * uAct * (0.62 + 0.38 * vAmp);
  gl_FragColor = vec4(col, alpha);
}
`;

const rungVert = `
attribute vec3 aColor;
attribute float aAmp;
attribute float aSide;
varying vec3 vColor;
varying float vAmp;
varying float vSide;
void main() {
  vColor = aColor;
  vAmp = aAmp;
  vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const rungFrag = `
precision highp float;
uniform vec3 uAccent;
uniform float uAct;
uniform float uHit;
varying vec3 vColor;
varying float vAmp;
varying float vSide;
void main() {
  float core = pow(1.0 - abs(vSide), 1.1);
  vec3 col = mix(vColor, uAccent, uHit * 0.35 * vAmp);
  col *= 0.7 + 0.4 * vAmp;
  float alpha = core * uAct * (0.66 + 0.34 * vAmp);
  gl_FragColor = vec4(col, alpha);
}
`;

function sampleSpectrum(spectrum, t) {
  const n = spectrum ? spectrum.length : 0;
  if (!n) return 0;
  const x = Math.min(1, Math.max(0, t)) * (n - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = spectrum[i] || 0;
  const b = spectrum[Math.min(n - 1, i + 1)] || 0;
  return a + (b - a) * f;
}

function ribbonIndices(tiles, points) {
  const idx = new Uint32Array(tiles * (points - 1) * 6);
  let k = 0;
  for (let t = 0; t < tiles; t++) {
    for (let i = 0; i < points - 1; i++) {
      const a = (t * points + i) * 2;
      idx[k++] = a;
      idx[k++] = a + 1;
      idx[k++] = a + 2;
      idx[k++] = a + 1;
      idx[k++] = a + 3;
      idx[k++] = a + 2;
    }
  }
  return idx;
}

function rungIndices(count) {
  const idx = new Uint32Array(count * 6);
  let k = 0;
  for (let i = 0; i < count; i++) {
    const a = i * 4;
    idx[k++] = a;
    idx[k++] = a + 1;
    idx[k++] = a + 2;
    idx[k++] = a + 1;
    idx[k++] = a + 3;
    idx[k++] = a + 2;
  }
  return idx;
}

function strandMaterial(color, accent) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uAccent: { value: accent },
      uAct: { value: 1 },
      uHit: { value: 0 },
    },
    vertexShader: strandVert,
    fragmentShader: strandFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export class Dna extends Visualizer {
  build() {
    this.interactive = true;
    this.spin = 0;
    this.bases = new Float64Array(TILES);
    for (let i = 0; i < TILES; i++) this.bases[i] = -SPAN * 0.5 + i * PITCH;

    const samples = TILES * POINTS;
    this.centersA = new Float32Array(samples * 3);
    this.centersB = new Float32Array(samples * 3);
    this.spec = new Float32Array(samples);
    this.norm = new Float32Array(samples);

    this.colorA = this.palette.primary.clone();
    this.colorB = this.palette.secondary.clone();
    this.accent = this.palette.accent.clone();

    const strandVerts = samples * 2;
    this.posA = new Float32Array(strandVerts * 3);
    this.posB = new Float32Array(strandVerts * 3);
    this.ampA = new Float32Array(strandVerts);
    this.ampB = new Float32Array(strandVerts);
    this.sideA = new Float32Array(strandVerts);
    this.sideB = new Float32Array(strandVerts);
    for (let i = 0; i < samples; i++) {
      this.sideA[i * 2] = -1;
      this.sideA[i * 2 + 1] = 1;
      this.sideB[i * 2] = -1;
      this.sideB[i * 2 + 1] = 1;
    }

    this.matA = strandMaterial(this.colorA, this.accent);
    this.matB = strandMaterial(this.colorB, this.accent);
    this.meshA = this._ribbon(this.posA, this.ampA, this.sideA, this.matA);
    this.meshB = this._ribbon(this.posB, this.ampB, this.sideB, this.matB);
    this.scene.add(this.meshA, this.meshB);

    const rungCount = TILES * RUNGS;
    const rungVerts = rungCount * 4;
    this.rungPos = new Float32Array(rungVerts * 3);
    this.rungCol = new Float32Array(rungVerts * 3);
    this.rungAmp = new Float32Array(rungVerts);
    this.rungSide = new Float32Array(rungVerts);
    for (let i = 0; i < rungCount; i++) {
      const o = i * 4;
      this.rungSide[o] = -1;
      this.rungSide[o + 1] = 1;
      this.rungSide[o + 2] = -1;
      this.rungSide[o + 3] = 1;
    }
    const rungGeo = new THREE.BufferGeometry();
    this.rungPosAttr = new THREE.BufferAttribute(this.rungPos, 3);
    this.rungColAttr = new THREE.BufferAttribute(this.rungCol, 3);
    this.rungAmpAttr = new THREE.BufferAttribute(this.rungAmp, 1);
    this.rungPosAttr.setUsage(THREE.DynamicDrawUsage);
    this.rungColAttr.setUsage(THREE.DynamicDrawUsage);
    this.rungAmpAttr.setUsage(THREE.DynamicDrawUsage);
    rungGeo.setAttribute('position', this.rungPosAttr);
    rungGeo.setAttribute('aColor', this.rungColAttr);
    rungGeo.setAttribute('aAmp', this.rungAmpAttr);
    rungGeo.setAttribute('aSide', new THREE.BufferAttribute(this.rungSide, 1));
    rungGeo.setIndex(new THREE.BufferAttribute(rungIndices(rungCount), 1));
    this.matRung = new THREE.ShaderMaterial({
      uniforms: {
        uAccent: { value: this.accent },
        uAct: { value: 1 },
        uHit: { value: 0 },
      },
      vertexShader: rungVert,
      fragmentShader: rungFrag,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.rungs = new THREE.Mesh(rungGeo, this.matRung);
    this.rungs.frustumCulled = false;
    this.rungs.renderOrder = 2;
    this.scene.add(this.rungs);

    this._center = new THREE.Vector3();
    this._tangent = new THREE.Vector3();
    this._side = new THREE.Vector3();
    this._prevSide = new THREE.Vector3();
    this._cam = new THREE.Vector3();
    this._c = new THREE.Color();

    this.viewH = 9.2;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.camera.position.set(2.6, 0.2, 12);
    this.camera.lookAt(0, 0, 0);
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(w, h) {
    const aspect = w / Math.max(1, h);
    const halfH = this.viewH * 0.5;
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  _ribbon(pos, amp, side, material) {
    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3);
    const ampAttr = new THREE.BufferAttribute(amp, 1);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    ampAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('aAmp', ampAttr);
    geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    geo.setIndex(new THREE.BufferAttribute(ribbonIndices(TILES, POINTS), 1));
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    if (pos === this.posA) {
      this.posAttrA = posAttr;
      this.ampAttrA = ampAttr;
    } else {
      this.posAttrB = posAttr;
      this.ampAttrB = ampAttr;
    }
    return mesh;
  }

  frame(reactor, dt) {
    const bass = reactor.bass || 0;
    const mid = reactor.mid || 0;
    const treble = reactor.treble || 0;
    const energy = reactor.energy || 0;
    const hit = reactor.hit || 0;
    const act = reactor.activity || 0;
    const spectrum = reactor.spectrum;

    const drive = 0.6 + 0.4 * act;
    const speed = (0.22 + energy * 0.5 + hit * 0.2) * drive;
    this.spin += dt * (0.35 + treble * 1.15) * this.rotationSpeed;

    for (let t = 0; t < TILES; t++) {
      this.bases[t] += speed * dt;
      // Stack height is a whole number of pitches, so the angle survives the jump.
      if (this.bases[t] >= SPAN * 0.5) this.bases[t] -= SPAN;
    }

    const half = (this.viewH * 0.5) / (this.camera.zoom || 1);
    const radius = 1.35 + bass * 0.42 + hit * 0.22;
    this._fillCenters(spectrum, half, radius, mid, treble);
    this._writeStrand(this.centersA, this.posA, this.ampA, mid);
    this._writeStrand(this.centersB, this.posB, this.ampB, treble);
    this._writeRungs();

    const presence = 0.8 + 0.2 * act;
    this.matA.uniforms.uAct.value = presence;
    this.matB.uniforms.uAct.value = presence;
    this.matRung.uniforms.uAct.value = presence;
    this.matA.uniforms.uHit.value = hit;
    this.matB.uniforms.uHit.value = hit;
    this.matRung.uniforms.uHit.value = hit;

    this.posAttrA.needsUpdate = true;
    this.posAttrB.needsUpdate = true;
    this.ampAttrA.needsUpdate = true;
    this.ampAttrB.needsUpdate = true;
    this.rungPosAttr.needsUpdate = true;
    this.rungColAttr.needsUpdate = true;
    this.rungAmpAttr.needsUpdate = true;
  }

  _fillCenters(spectrum, half, radius, mid, treble) {
    const span = half * 1.08;
    for (let t = 0; t < TILES; t++) {
      const baseY = this.bases[t];
      for (let i = 0; i < POINTS; i++) {
        const y = baseY + (i / (POINTS - 1)) * PITCH;
        const yNorm = THREE.MathUtils.clamp(y / span * 0.5 + 0.5, 0, 1);
        const s = sampleSpectrum(spectrum, yNorm);
        const idx = t * POINTS + i;
        this.spec[idx] = s;
        this.norm[idx] = yNorm;
        const ang = (y / PITCH) * TAU + this.spin;
        const rA = radius * (1 + s * 0.14 * (0.4 + mid));
        const rB = radius * (1 + s * 0.14 * (0.4 + treble));
        const o = idx * 3;
        this.centersA[o] = Math.cos(ang) * rA;
        this.centersA[o + 1] = y;
        this.centersA[o + 2] = Math.sin(ang) * rA;
        this.centersB[o] = Math.cos(ang + Math.PI) * rB;
        this.centersB[o + 1] = y;
        this.centersB[o + 2] = Math.sin(ang + Math.PI) * rB;
      }
    }
  }

  _writeStrand(centers, pos, amps, band) {
    const prev = this._prevSide;
    for (let t = 0; t < TILES; t++) {
      prev.set(0, 0, 0);
      const base = t * POINTS;
      for (let i = 0; i < POINTS; i++) {
        const idx = base + i;
        const o = idx * 3;
        this._center.set(centers[o], centers[o + 1], centers[o + 2]);
        this._tangentAt(centers, base, i);
        this._facing(prev);
        const s = this.spec[idx];
        const w = (0.13 + s * 0.07) * (0.82 + 0.28 * band);
        const amp = (0.55 + s * 0.45) * (0.72 + 0.28 * band);
        const vi = idx * 2;
        const p = vi * 3;
        const sx = this._side.x * w;
        const sy = this._side.y * w;
        const sz = this._side.z * w;
        pos[p] = this._center.x - sx;
        pos[p + 1] = this._center.y - sy;
        pos[p + 2] = this._center.z - sz;
        pos[p + 3] = this._center.x + sx;
        pos[p + 4] = this._center.y + sy;
        pos[p + 5] = this._center.z + sz;
        amps[vi] = amp;
        amps[vi + 1] = amp;
      }
    }
  }

  _writeRungs() {
    const A = this.centersA;
    const B = this.centersB;
    const pos = this.rungPos;
    const col = this.rungCol;
    const amps = this.rungAmp;
    const c = this._c;
    let rung = 0;
    for (let t = 0; t < TILES; t++) {
      for (let r = 0; r < RUNGS; r++) {
        const pi = Math.min(POINTS - 1, Math.round(((r + 0.5) / RUNGS) * (POINTS - 1)));
        const idx = t * POINTS + pi;
        const o = idx * 3;
        const s = this.spec[idx];
        const reach = 0.62 + s * 0.38;
        const ax = A[o];
        const ay = A[o + 1];
        const az = A[o + 2];
        const bx = B[o];
        const by = B[o + 1];
        const bz = B[o + 2];
        const mx = (ax + bx) * 0.5;
        const my = (ay + by) * 0.5;
        const mz = (az + bz) * 0.5;
        const dx = (bx - ax) * 0.5 * reach;
        const dy = (by - ay) * 0.5 * reach;
        const dz = (bz - az) * 0.5 * reach;
        const thick = 0.026 + s * 0.03;
        const x0 = mx - dx;
        const y0 = my - dy;
        const z0 = mz - dz;
        const x1 = mx + dx;
        const y1 = my + dy;
        const z1 = mz + dz;
        const p = rung * 12;
        pos[p] = x0;
        pos[p + 1] = y0 - thick;
        pos[p + 2] = z0;
        pos[p + 3] = x0;
        pos[p + 4] = y0 + thick;
        pos[p + 5] = z0;
        pos[p + 6] = x1;
        pos[p + 7] = y1 - thick;
        pos[p + 8] = z1;
        pos[p + 9] = x1;
        pos[p + 10] = y1 + thick;
        pos[p + 11] = z1;

        c.copy(this.colorA).lerp(this.colorB, this.norm[idx]);
        const amp = 0.5 + s * 0.5;
        const cr = c.r;
        const cg = c.g;
        const cb = c.b;
        const cp = rung * 12;
        for (let v = 0; v < 4; v++) {
          col[cp + v * 3] = cr;
          col[cp + v * 3 + 1] = cg;
          col[cp + v * 3 + 2] = cb;
          amps[rung * 4 + v] = amp;
        }
        rung++;
      }
    }
  }

  _tangentAt(centers, base, i) {
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(POINTS - 1, i + 1);
    const o0 = (base + i0) * 3;
    const o1 = (base + i1) * 3;
    this._tangent.set(
      centers[o1] - centers[o0],
      centers[o1 + 1] - centers[o0 + 1],
      centers[o1 + 2] - centers[o0 + 2]
    );
    if (this._tangent.lengthSq() < 1e-8) this._tangent.set(0, 1, 0);
    else this._tangent.normalize();
  }

  _facing(prev) {
    this._cam.copy(this.camera.position).sub(this._center);
    this._side.crossVectors(this._tangent, this._cam);
    if (this._side.lengthSq() < 1e-8) this._side.set(1, 0, 0);
    else this._side.normalize();
    if (prev.lengthSq() > 0 && this._side.dot(prev) < 0) this._side.negate();
    prev.copy(this._side);
  }

  onPalette(p) {
    if (!this.colorA) return;
    this.colorA.copy(p.primary);
    this.colorB.copy(p.secondary);
    this.accent.copy(p.accent);
  }
}
