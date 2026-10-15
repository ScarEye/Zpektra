import * as THREE from 'three';
import { Visualizer } from './base.js';

const TILES = 14;
const PITCH = 3.8;
const POINTS = 280;
const SIDES = 24;
const RUNGS = 16;
const RUNG_SIDES = 28;
const CAP_RINGS = 6;
const BODY_RINGS = 2;
const PAD = 0.025;
const SPAN = TILES * PITCH;
const TAU = Math.PI * 2;

const strandVert = `
attribute float aY;
attribute float aStrand;
attribute float aRing;
uniform float uRadius;
uniform float uSpin;
uniform float uMid;
uniform float uTreble;
uniform float uHalf;
uniform float uPitch;
uniform sampler2D uSpec;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vAmp;
varying float vNd;
varying vec3 vColor;
void main() {
  float worldY = aY + instanceMatrix[3][1];
  float yNorm = clamp(worldY / (uHalf * 1.08) * 0.5 + 0.5, 0.0, 1.0);
  float spec = texture2D(uSpec, vec2(yNorm, 0.5)).r;
  float band = mix(uMid, uTreble, aStrand);
  float rad = uRadius * (1.0 + spec * 0.14 * (0.4 + band));
  float ang = worldY / uPitch * 6.2831853 + uSpin + aStrand * 3.14159265;
  vec3 center = vec3(cos(ang) * rad, worldY, sin(ang) * rad);
  float k = 6.2831853 / uPitch;
  vec3 tangent = normalize(vec3(-sin(ang) * rad * k, 1.0, cos(ang) * rad * k));
  vec3 n1 = normalize(cross(tangent, vec3(0.0, 1.0, 0.0)));
  vec3 n2 = cross(tangent, n1);
  float thick = (0.052 + spec * 0.026) * (0.84 + 0.32 * band);
  vec3 radial = cos(aRing) * n1 + sin(aRing) * n2;
  vec3 pos = center + radial * thick;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  vec3 V = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-mv.xyz);
  vNd = abs(dot(normalize(normalMatrix * radial), V));
  vAmp = (0.55 + spec * 0.45) * (0.72 + 0.28 * band);
  float seam = smoothstep(-0.025, 0.025, aY / uPitch) * smoothstep(1.025, 0.975, aY / uPitch);
  vAmp *= seam;
  vColor = mix(uColorA, uColorB, aStrand);
}
`;

const strandFrag = `
precision highp float;
uniform vec3 uAccent;
uniform float uAct;
uniform float uHit;
varying float vAmp;
varying float vNd;
varying vec3 vColor;
void main() {
  float edge = smoothstep(0.0, 0.48, vNd);
  vec3 col = mix(vColor, uAccent, uHit * 0.35 * vAmp);
  col *= (0.42 + 0.9 * edge) * (0.62 + 0.38 * vAmp);
  float alpha = edge * uAct * (0.4 + 0.6 * vAmp);
  gl_FragColor = vec4(col, alpha);
}
`;

const rungVert = `
attribute float aY;
attribute float aSec;
attribute float aV;
attribute float aRing;
uniform float uRadius;
uniform float uSpin;
uniform float uMid;
uniform float uTreble;
uniform float uHalf;
uniform float uPitch;
uniform sampler2D uSpec;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vAmp;
varying float vNd;
varying vec3 vColor;
void main() {
  float worldY = aY + instanceMatrix[3][1];
  float yNorm = clamp(worldY / (uHalf * 1.08) * 0.5 + 0.5, 0.0, 1.0);
  float spec = texture2D(uSpec, vec2(yNorm, 0.5)).r;
  float rA = uRadius * (1.0 + spec * 0.14 * (0.4 + uMid));
  float rB = uRadius * (1.0 + spec * 0.14 * (0.4 + uTreble));
  float ang = worldY / uPitch * 6.2831853 + uSpin;
  vec3 A = vec3(cos(ang) * rA, worldY, sin(ang) * rA);
  vec3 B = vec3(-cos(ang) * rB, worldY, -sin(ang) * rB);
  float reach = 0.64 + spec * 0.36;
  vec3 axis = B - A;
  float span = max(length(axis), 0.0001);
  axis /= span;
  vec3 mid = (A + B) * 0.5;
  vec3 p0 = mid - axis * (span * 0.5 * reach);
  vec3 p1 = mid + axis * (span * 0.5 * reach);
  vec3 n1 = normalize(cross(axis, vec3(0.0, 1.0, 0.0)));
  vec3 n2 = cross(axis, n1);
  float thick = 0.02 + spec * 0.018;
  vec3 radial = cos(aRing) * n1 + sin(aRing) * n2;
  float phi = aV * 1.5707963;
  vec3 pos;
  vec3 nrm;
  if (aSec < 0.5) {
    pos = p0 - axis * cos(phi) * thick + radial * sin(phi) * thick;
    nrm = -axis * cos(phi) + radial * sin(phi);
  } else if (aSec < 1.5) {
    pos = mix(p0, p1, aV) + radial * thick;
    nrm = radial;
  } else {
    pos = p1 + axis * sin(phi) * thick + radial * cos(phi) * thick;
    nrm = axis * sin(phi) + radial * cos(phi);
  }
  radial = nrm;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  vec3 V = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-mv.xyz);
  vNd = abs(dot(normalize(normalMatrix * radial), V));
  vAmp = 0.5 + spec * 0.5;
  vColor = mix(uColorA, uColorB, yNorm);
}
`;

const rungFrag = `
precision highp float;
uniform vec3 uAccent;
uniform float uAct;
uniform float uHit;
varying float vAmp;
varying float vNd;
varying vec3 vColor;
void main() {
  float edge = smoothstep(0.0, 0.5, vNd);
  vec3 col = mix(vColor, uAccent, uHit * 0.35 * vAmp);
  col *= (0.5 + 0.7 * edge) * (0.7 + 0.4 * vAmp);
  float alpha = edge * uAct * (0.5 + 0.5 * vAmp);
  gl_FragColor = vec4(col, alpha);
}
`;

function tubeIndices(points, sides, strands) {
  const idx = new Uint32Array(strands * (points - 1) * sides * 6);
  let n = 0;
  for (let s = 0; s < strands; s++) {
    for (let i = 0; i < points - 1; i++) {
      for (let k = 0; k < sides; k++) {
        const k1 = (k + 1) % sides;
        const a = (s * points + i) * sides + k;
        const b = (s * points + i) * sides + k1;
        const c = (s * points + (i + 1)) * sides + k;
        const d = (s * points + (i + 1)) * sides + k1;
        idx[n++] = a;
        idx[n++] = c;
        idx[n++] = b;
        idx[n++] = b;
        idx[n++] = c;
        idx[n++] = d;
      }
    }
  }
  return idx;
}

function rungIndices(rungs, rings, sides) {
  const idx = new Uint32Array(rungs * (rings - 1) * sides * 6);
  let n = 0;
  for (let r = 0; r < rungs; r++) {
    for (let i = 0; i < rings - 1; i++) {
      for (let k = 0; k < sides; k++) {
        const k1 = (k + 1) % sides;
        const row = (r * rings + i) * sides;
        const a = row + k;
        const b = row + k1;
        const c = row + sides + k;
        const d = row + sides + k1;
        idx[n++] = a;
        idx[n++] = c;
        idx[n++] = b;
        idx[n++] = b;
        idx[n++] = c;
        idx[n++] = d;
      }
    }
  }
  return idx;
}

function glowMaterial(vert, frag, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
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

    this.colorA = this.palette.primary.clone();
    this.colorB = this.palette.secondary.clone();
    this.accent = this.palette.accent.clone();

    this.specData = new Uint8Array(96 * 4);
    this.specTex = new THREE.DataTexture(this.specData, 96, 1);
    this.specTex.magFilter = THREE.LinearFilter;
    this.specTex.minFilter = THREE.LinearFilter;
    this.specTex.wrapS = THREE.ClampToEdgeWrapping;
    this.specTex.flipY = false;
    this.specTex.generateMipmaps = false;
    this.specTex.colorSpace = THREE.NoColorSpace;
    this.specTex.needsUpdate = true;

    this.uniforms = {
      uRadius: { value: 1.35 },
      uSpin: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uHit: { value: 0 },
      uAct: { value: 1 },
      uHalf: { value: this.viewH ? this.viewH * 0.5 : 4.6 },
      uPitch: { value: PITCH },
      uColorA: { value: this.colorA },
      uColorB: { value: this.colorB },
      uAccent: { value: this.accent },
      uSpec: { value: this.specTex },
    };

    this.strands = new THREE.InstancedMesh(
      this._strandGeometry(),
      glowMaterial(strandVert, strandFrag, this.uniforms),
      TILES
    );
    this.rungMesh = new THREE.InstancedMesh(
      this._rungGeometry(),
      glowMaterial(rungVert, rungFrag, this.uniforms),
      TILES
    );
    this.strands.frustumCulled = false;
    this.rungMesh.frustumCulled = false;
    this.strands.renderOrder = 1;
    this.rungMesh.renderOrder = 2;
    this.strands.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rungMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.strands, this.rungMesh);

    this._m = new THREE.Matrix4();
    this._placeInstances();

    this.viewH = 9.2;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.camera.position.set(2.6, 0.2, 12);
    this.camera.lookAt(0, 0, 0);
    this.resize(window.innerWidth, window.innerHeight);
  }

  _strandGeometry() {
    const count = 2 * POINTS * SIDES;
    const position = new Float32Array(count * 3);
    const aY = new Float32Array(count);
    const aStrand = new Float32Array(count);
    const aRing = new Float32Array(count);
    let v = 0;
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < POINTS; i++) {
        const u = -PAD + (i / (POINTS - 1)) * (1 + PAD * 2);
        const y = u * PITCH;
        for (let k = 0; k < SIDES; k++) {
          aY[v] = y;
          aStrand[v] = s;
          aRing[v] = (k / SIDES) * TAU;
          v++;
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('aY', new THREE.BufferAttribute(aY, 1));
    geo.setAttribute('aStrand', new THREE.BufferAttribute(aStrand, 1));
    geo.setAttribute('aRing', new THREE.BufferAttribute(aRing, 1));
    geo.setIndex(new THREE.BufferAttribute(tubeIndices(POINTS, SIDES, 2), 1));
    return geo;
  }

  _rungGeometry() {
    const rings = CAP_RINGS + BODY_RINGS + CAP_RINGS;
    const count = RUNGS * rings * RUNG_SIDES;
    const position = new Float32Array(count * 3);
    const aY = new Float32Array(count);
    const aSec = new Float32Array(count);
    const aV = new Float32Array(count);
    const aRing = new Float32Array(count);
    let v = 0;
    const push = (y, sec, t) => {
      for (let k = 0; k < RUNG_SIDES; k++) {
        aY[v] = y;
        aSec[v] = sec;
        aV[v] = t;
        aRing[v] = (k / RUNG_SIDES) * TAU;
        v++;
      }
    };
    for (let r = 0; r < RUNGS; r++) {
      const y = ((r + 0.5) / RUNGS) * PITCH;
      for (let i = 0; i < CAP_RINGS; i++) push(y, 0, i / (CAP_RINGS - 1));
      for (let i = 0; i < BODY_RINGS; i++) push(y, 1, i / (BODY_RINGS - 1));
      for (let i = 0; i < CAP_RINGS; i++) push(y, 2, i / (CAP_RINGS - 1));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('aY', new THREE.BufferAttribute(aY, 1));
    geo.setAttribute('aSec', new THREE.BufferAttribute(aSec, 1));
    geo.setAttribute('aV', new THREE.BufferAttribute(aV, 1));
    geo.setAttribute('aRing', new THREE.BufferAttribute(aRing, 1));
    geo.setIndex(new THREE.BufferAttribute(rungIndices(RUNGS, rings, RUNG_SIDES), 1));
    return geo;
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

  _placeInstances() {
    for (let i = 0; i < TILES; i++) {
      this._m.makeTranslation(0, this.bases[i], 0);
      this.strands.setMatrixAt(i, this._m);
      this.rungMesh.setMatrixAt(i, this._m);
    }
    this.strands.instanceMatrix.needsUpdate = true;
    this.rungMesh.instanceMatrix.needsUpdate = true;
  }

  frame(reactor, dt) {
    const bass = reactor.bass || 0;
    const mid = reactor.mid || 0;
    const treble = reactor.treble || 0;
    const energy = reactor.energy || 0;
    const hit = reactor.hit || 0;
    const act = reactor.activity || 0;

    const drive = 0.6 + 0.4 * act;
    const speed = (0.22 + energy * 0.5 + hit * 0.2) * drive;
    this.spin += dt * (0.35 + treble * 1.15) * this.rotationSpeed;

    for (let i = 0; i < TILES; i++) {
      this.bases[i] += speed * dt;
      if (this.bases[i] >= SPAN * 0.5) this.bases[i] -= SPAN;
    }
    this._placeInstances();

    const spectrum = reactor.spectrum;
    const bins = spectrum ? spectrum.length : 0;
    for (let i = 0; i < 96; i++) {
      const v = bins ? spectrum[Math.min(bins - 1, Math.floor((i / 95) * (bins - 1)))] : 0;
      this.specData[i * 4] = Math.max(0, Math.min(255, Math.round(v * 255)));
    }
    this.specTex.needsUpdate = true;

    const u = this.uniforms;
    u.uRadius.value = 1.35 + bass * 0.42 + hit * 0.22;
    u.uSpin.value = this.spin;
    u.uMid.value = mid;
    u.uTreble.value = treble;
    u.uHit.value = hit;
    u.uAct.value = 0.8 + 0.2 * act;
    u.uHalf.value = (this.viewH * 0.5) / (this.camera.zoom || 1);
  }

  onPalette(p) {
    if (!this.colorA) return;
    this.colorA.copy(p.primary);
    this.colorB.copy(p.secondary);
    this.accent.copy(p.accent);
  }
}
