import * as THREE from 'three';
import { Visualizer } from './base.js';

// Q1 segments mirrored into all quadrants — kept in sync with the GLSL sigil paths.
const Q1_SEGMENTS = [
  [[0, 0], [0.26, 0.26]],
  [[0.26, 0.26], [0.58, 0.58]],
  [[0, 0], [0, 0.48]],
  [[0, 0.48], [0.48, 0]],
  [[0.48, 0], [0.58, 0.58]],
  [[0, 0.48], [0.58, 0.58]],
  [[0.58, 0.58], [0.86, 0.86]],
  [[0, 0.86], [0.86, 0.86]],
  [[0.86, 0], [0.86, 0.86]],
  [[0, 0], [0.33, 0.33]],
  [[0.33, 0.33], [0.47, 0.47]],
  [[0, 0.47], [0.47, 0]],
];

function mirrorPoint([x, y]) {
  return [
    [x, y],
    [x, -y],
    [-x, y],
    [-x, -y],
  ];
}

function expandSegments() {
  const out = [];
  for (const [a, b] of Q1_SEGMENTS) {
    const as = mirrorPoint(a);
    const bs = mirrorPoint(b);
    for (let i = 0; i < 4; i++) out.push({ a: as[i], b: bs[i] });
  }
  return out;
}

const ALL_SEGMENTS = expandSegments();
const PATH_SCALE = 0.92;

const bgVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const bgFrag = `
  precision highp float;
  varying vec2 vUv;
  uniform float uPhase;
  uniform float uEdge;
  uniform float uBeat;
  uniform float uAct;
  uniform vec2  uRes;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uColorC;

  const float LINE_W = 0.014;
  const float PATH_SCALE = 0.92;

  void evalSeg(vec2 p, vec2 a, vec2 b, inout float bestD, inout vec2 bestQ) {
    vec2 pa = p - a, ba = b - a;
    float len2 = dot(ba, ba);
    if (len2 < 1e-6) return;
    float u = clamp(dot(pa, ba) / len2, 0.0, 1.0);
    vec2 q = a + ba * u;
    float d = length(p - q);
    if (d < bestD) {
      bestD = d;
      bestQ = q;
    }
  }

  void evalSegSym(vec2 p, vec2 a, vec2 b, inout float bestD, inout vec2 bestQ) {
    evalSeg(p, a, b, bestD, bestQ);
    evalSeg(p, a * vec2(1.0, -1.0), b * vec2(1.0, -1.0), bestD, bestQ);
    evalSeg(p, a * vec2(-1.0, 1.0), b * vec2(-1.0, 1.0), bestD, bestQ);
    evalSeg(p, a * vec2(-1.0, -1.0), b * vec2(-1.0, -1.0), bestD, bestQ);
  }

  void evalDiamond(vec2 p, float r, inout float bestD, inout vec2 bestQ) {
    evalSegSym(p, vec2(0.0), vec2(0.0, r), bestD, bestQ);
    evalSegSym(p, vec2(0.0, r), vec2(r, 0.0), bestD, bestQ);
  }

  void evalRotDiamond(vec2 p, float r, inout float bestD, inout vec2 bestQ) {
    vec2 r45 = vec2(p.x * 0.70710678 - p.y * 0.70710678, p.x * 0.70710678 + p.y * 0.70710678);
    evalDiamond(r45, r, bestD, bestQ);
  }

  void evalFrame(vec2 p, float r, inout float bestD, inout vec2 bestQ) {
    evalSegSym(p, vec2(0.0, r), vec2(r, r), bestD, bestQ);
    evalSegSym(p, vec2(r, 0.0), vec2(r, r), bestD, bestQ);
    evalSeg(p, vec2(r, r), vec2(-r, r), bestD, bestQ);
    evalSeg(p, vec2(r, r), vec2(r, -r), bestD, bestQ);
    evalSeg(p, vec2(-r, -r), vec2(r, -r), bestD, bestQ);
    evalSeg(p, vec2(-r, -r), vec2(-r, r), bestD, bestQ);
  }

  void sigilPath(vec2 p, out float dist, out float pathT) {
    float bestD = 1e4;
    vec2 bestQ = vec2(0.0);

    evalSegSym(p, vec2(0.0), vec2(0.26, 0.26), bestD, bestQ);
    evalRotDiamond(p, 0.66, bestD, bestQ);
    evalRotDiamond(p, 0.30, bestD, bestQ);
    evalDiamond(p, 0.48, bestD, bestQ);
    evalDiamond(p, 0.20, bestD, bestQ);
    evalSegSym(p, vec2(0.26, 0.26), vec2(0.58, 0.58), bestD, bestQ);
    evalSegSym(p, vec2(0.0, 0.48), vec2(0.58, 0.58), bestD, bestQ);
    evalSegSym(p, vec2(0.48, 0.0), vec2(0.58, 0.58), bestD, bestQ);
    evalFrame(p, 0.86, bestD, bestQ);

    dist = bestD;
    pathT = clamp(length(bestQ) / PATH_SCALE, 0.0, 1.0);
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uRes.x / uRes.y;

    float dist, pathT;
    sigilPath(p, dist, pathT);

    float onLine = 1.0 - smoothstep(LINE_W * 0.35, LINE_W, dist);
    float r = length(p);
    vec3 stone = mix(vec3(0.05, 0.07, 0.12), vec3(0.09, 0.11, 0.18), r * 0.5);

    if (onLine < 0.001) {
      gl_FragColor = vec4(stone * (0.2 + 0.8 * uAct), 1.0);
      return;
    }

    // Lit only on line pixels behind the wave front (pathT <= uPhase).
    float behind = 1.0 - smoothstep(uPhase - 0.006, uPhase + 0.014, pathT);
    float head = smoothstep(uPhase - uEdge - 0.04, uPhase - uEdge, pathT)
               * (1.0 - smoothstep(uPhase, uPhase + 0.018, pathT));
    float filled = max(behind, head * 0.9);
    filled += uBeat * smoothstep(0.06, 0.0, abs(pathT - uPhase)) * 0.45;
    filled = clamp(filled, 0.0, 1.0) * onLine;

    float along = clamp(pathT / max(uPhase, 0.04), 0.0, 1.0);
    vec3 core = mix(uColorA, uColorB, along * 0.45);
    vec3 tail = mix(uColorB, uColorC, along);
    vec3 lineCol = mix(tail, core, filled);
    lineCol = mix(lineCol, uColorA, head * 0.65);

    vec3 groove = mix(uColorC * 0.12, uColorB * 0.18, 0.35);
    vec3 col = mix(groove, lineCol, filled);
    col += uColorA * head * onLine * 0.4;
    col += uColorB * exp(-dist * 55.0) * filled * onLine * 0.3;
    col *= 0.25 + 0.75 * uAct;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const sparkVert = `
  attribute float aAlpha;
  uniform float uBeat;
  uniform float uTreble;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha * (1.0 + uBeat * 0.35 + uTreble * 0.15);
    if (vAlpha < 0.01) {
      gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    gl_Position = vec4(position.x, position.y, 0.0, 1.0);
    gl_PointSize = 2.0 + vAlpha * 4.5;
  }
`;

const sparkFrag = `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float a = 1.0 - smoothstep(0.35, 0.5, length(d));
    vec3 col = mix(uColorB, uColorA, a);
    gl_FragColor = vec4(col, a * clamp(vAlpha, 0.0, 1.0));
  }
`;

const SPARK_COUNT = 280;
const CYCLE = 1.05;

export class GoldenSeal extends Visualizer {
  build() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.phase = 0;
    this.clock = 0;
    this._aspect = window.innerWidth / window.innerHeight;

    this.bgUniforms = {
      uPhase: { value: 0 },
      uEdge: { value: 0.07 },
      uBeat: { value: 0 },
      uAct: { value: 0 },
      uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uColorA: { value: this.palette.primary.clone() },
      uColorB: { value: this.palette.secondary.clone() },
      uColorC: { value: this.palette.accent.clone() },
    };

    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: this.bgUniforms,
        vertexShader: bgVert,
        fragmentShader: bgFrag,
        depthWrite: false,
      })
    );
    this.quad.renderOrder = 0;
    this.scene.add(this.quad);

    this.sparkAnchors = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      const seg = ALL_SEGMENTS[Math.floor(Math.random() * ALL_SEGMENTS.length)];
      this.sparkAnchors.push({ seg, u: Math.random(), seed: Math.random() });
    }

    this.sparkPositions = new Float32Array(SPARK_COUNT * 3);
    this.sparkAlphas = new Float32Array(SPARK_COUNT);

    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    sparkGeo.setAttribute('aAlpha', new THREE.BufferAttribute(this.sparkAlphas, 1));

    this.sparkUniforms = {
      uBeat: { value: 0 },
      uTreble: { value: 0 },
      uColorA: { value: this.palette.primary.clone() },
      uColorB: { value: this.palette.secondary.clone() },
    };

    this.sparks = new THREE.Points(
      sparkGeo,
      new THREE.ShaderMaterial({
        uniforms: this.sparkUniforms,
        vertexShader: sparkVert,
        fragmentShader: sparkFrag,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.sparks.renderOrder = 1;
    this.scene.add(this.sparks);

    this._posAttr = sparkGeo.getAttribute('position');
    this._alphaAttr = sparkGeo.getAttribute('aAlpha');
  }

  _updateSparks(phase, act, beat, treble) {
    const aspect = this._aspect;
    for (let i = 0; i < SPARK_COUNT; i++) {
      const { seg, u, seed } = this.sparkAnchors[i];
      const qx = seg.a[0] + (seg.b[0] - seg.a[0]) * u;
      const qy = seg.a[1] + (seg.b[1] - seg.a[1]) * u;
      const pathT = Math.hypot(qx, qy) / PATH_SCALE;
      const edge = Math.abs(pathT - phase);

      let alpha = 0;
      if (pathT <= phase + 0.015 && edge < 0.1) {
        alpha = (1 - edge / 0.1) * (0.25 + 0.75 * act);
        alpha *= 0.45 + 0.55 * Math.sin(this.clock * (4 + treble * 5) + seed * 6.28);
        if (beat > 0.35) alpha = Math.min(1, alpha + beat * 0.35);
      }

      this.sparkPositions[i * 3] = qx / aspect;
      this.sparkPositions[i * 3 + 1] = qy;
      this.sparkPositions[i * 3 + 2] = 0;
      this.sparkAlphas[i] = alpha;
    }
    this._posAttr.needsUpdate = true;
    this._alphaAttr.needsUpdate = true;
  }

  frame(reactor, dt) {
    const act = reactor.activity;

    if (reactor.beat > 0.45) this.phase = 0;
    const speed = (0.85 + reactor.energy * 1.4) * Math.max(act, 0.08);
    this.phase += (dt / CYCLE) * speed;
    if (this.phase > 1.0) this.phase = 1.0;
    if (act < 0.05) this.phase += (0 - this.phase) * dt * 2.5;

    this.clock += dt;

    const bu = this.bgUniforms;
    bu.uPhase.value = this.phase;
    bu.uEdge.value = 0.05 + reactor.bass * 0.06;
    bu.uBeat.value = reactor.beat;
    bu.uAct.value = act;

    this._updateSparks(this.phase, act, reactor.beat, reactor.treble);

    const su = this.sparkUniforms;
    su.uBeat.value = reactor.beat;
    su.uTreble.value = reactor.treble;
  }

  resize(w, h) {
    this._aspect = w / h;
    if (this.bgUniforms) this.bgUniforms.uRes.value.set(w, h);
  }

  onPalette(p) {
    if (this.bgUniforms) {
      this.bgUniforms.uColorA.value.copy(p.primary);
      this.bgUniforms.uColorB.value.copy(p.secondary);
      this.bgUniforms.uColorC.value.copy(p.accent);
    }
    if (this.sparkUniforms) {
      this.sparkUniforms.uColorA.value.copy(p.primary);
      this.sparkUniforms.uColorB.value.copy(p.secondary);
    }
  }
}
