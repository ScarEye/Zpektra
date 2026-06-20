import * as THREE from 'three';
import { Visualizer } from './base.js';

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

  float sdSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  // Closest point on segment; returns distance and path-t (0 = center end, 1 = outer end).
  void evalSeg(vec2 p, vec2 a, vec2 b, float t0, float t1, inout float bestD, inout float bestT) {
    vec2 pa = p - a, ba = b - a;
    float len2 = dot(ba, ba);
    if (len2 < 1e-6) return;
    float u = clamp(dot(pa, ba) / len2, 0.0, 1.0);
    float d = length(pa - ba * u);
    if (d < bestD) {
      bestD = d;
      bestT = mix(t0, t1, u);
    }
  }

  void evalSegSym(vec2 p, vec2 a, vec2 b, float t0, float t1, inout float bestD, inout float bestT) {
    evalSeg(p, a, b, t0, t1, bestD, bestT);
    evalSeg(p, a * vec2(1.0, -1.0), b * vec2(1.0, -1.0), t0, t1, bestD, bestT);
    evalSeg(p, a * vec2(-1.0, 1.0), b * vec2(-1.0, 1.0), t0, t1, bestD, bestT);
    evalSeg(p, a * vec2(-1.0, -1.0), b * vec2(-1.0, -1.0), t0, t1, bestD, bestT);
  }

  // Diamond |x|+|y|=r split into 4 segments per quadrant, t increasing away from center.
  void evalDiamond(vec2 p, float r, float tMid, float tOuter, inout float bestD, inout float bestT) {
    vec2 ap = abs(p);
    float s = sign(p.x * p.y + 1e-5);
    if (p.x >= 0.0 && p.y >= 0.0) {
      evalSeg(p, vec2(0.0), vec2(0.0, r), 0.0, tMid, bestD, bestT);
      evalSeg(p, vec2(0.0, r), vec2(r, 0.0), tMid, tOuter, bestD, bestT);
    }
    evalSegSym(p, vec2(0.0), vec2(0.0, r), 0.0, tMid, bestD, bestT);
    evalSegSym(p, vec2(0.0, r), vec2(r, 0.0), tMid, tOuter, bestD, bestT);
  }

  void evalRotDiamond(vec2 p, float r, float tMid, float tOuter, inout float bestD, inout float bestT) {
    vec2 r45 = vec2(p.x * 0.70710678 - p.y * 0.70710678, p.x * 0.70710678 + p.y * 0.70710678);
    evalDiamond(r45, r, tMid, tOuter, bestD, bestT);
  }

  // Square frame: each side traced from center outward (t 0.82 -> 1.0).
  void evalFrame(vec2 p, float r, inout float bestD, inout float bestT) {
    vec2 ap = abs(p);
    float t0 = 0.82;
    evalSegSym(p, vec2(0.0, r), vec2(r, r), t0, 1.0, bestD, bestT);
    evalSegSym(p, vec2(r, 0.0), vec2(r, r), t0, 1.0, bestD, bestT);
    evalSeg(p, vec2(r, r), vec2(-r, r), t0, 1.0, bestD, bestT);
    evalSeg(p, vec2(r, r), vec2(r, -r), t0, 1.0, bestD, bestT);
    evalSeg(p, vec2(-r, -r), vec2(r, -r), t0, 1.0, bestD, bestT);
    evalSeg(p, vec2(-r, -r), vec2(-r, r), t0, 1.0, bestD, bestT);
  }

  void sigilPath(vec2 p, out float dist, out float pathT) {
    float bestD = 1e4;
    float bestT = 0.0;

    // Center spokes
    evalSegSym(p, vec2(0.0), vec2(0.26, 0.26), 0.0, 0.14, bestD, bestT);

    // Inner knot diamonds (axis + 45°)
    evalRotDiamond(p, 0.66, 0.14, 0.38, bestD, bestT);
    evalRotDiamond(p, 0.30, 0.38, 0.52, bestD, bestT);
    evalDiamond(p, 0.48, 0.14, 0.38, bestD, bestT);
    evalDiamond(p, 0.20, 0.38, 0.52, bestD, bestT);

    // Corner connectors
    evalSegSym(p, vec2(0.26, 0.26), vec2(0.58, 0.58), 0.14, 0.38, bestD, bestT);
    evalSegSym(p, vec2(0.0, 0.48), vec2(0.58, 0.58), 0.38, 0.58, bestD, bestT);
    evalSegSym(p, vec2(0.48, 0.0), vec2(0.58, 0.58), 0.38, 0.58, bestD, bestT);

    // Outer square frame
    evalFrame(p, 0.86, bestD, bestT);

    dist = bestD;
    pathT = bestT;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uRes.x / uRes.y;

    float dist, pathT;
    sigilPath(p, dist, pathT);

    float onLine = smoothstep(LINE_W, LINE_W * 0.35, dist);
    if (onLine < 0.001) {
      float r = length(p);
      vec3 stone = mix(vec3(0.05, 0.07, 0.12), vec3(0.09, 0.11, 0.18), r * 0.5);
      gl_FragColor = vec4(stone * (0.2 + 0.8 * uAct), 1.0);
      return;
    }

    // Lit portion: pathT <= uPhase. Soft gradient head at the leading edge.
    float filled = smoothstep(uPhase + 0.015, uPhase - 0.004, pathT);
    float head = smoothstep(uPhase - uEdge - 0.06, uPhase - uEdge, pathT)
                 * (1.0 - smoothstep(uPhase - 0.01, uPhase + 0.02, pathT));
    filled = max(filled, head * 0.85);
    filled *= onLine;

    // Beat flash at the wave front
    filled += uBeat * onLine * smoothstep(0.07, 0.0, abs(pathT - uPhase)) * 0.6;

    // Gradient along the line: core at head, secondary mid, accent at tail
    float along = clamp(pathT / max(uPhase, 0.05), 0.0, 1.0);
    vec3 core = mix(uColorA, uColorB, along * 0.45);
    vec3 tail = mix(uColorB, uColorC, along);
    vec3 lineCol = mix(tail, core, filled);
    lineCol = mix(core, uColorA, head * 0.7);

    // Unlit groove
    vec3 groove = mix(uColorC * 0.12, uColorB * 0.18, 0.35);

    vec3 col = mix(groove, lineCol, filled);
    col += uColorA * head * onLine * 0.45;
    col += uColorA * uBeat * filled * onLine * 0.2;

    // Subtle line bloom only on lit pixels
    col += uColorB * exp(-dist * 55.0) * filled * onLine * 0.35;

    col *= 0.25 + 0.75 * uAct;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const sparkVert = `
  attribute float aSeed;
  attribute float aPathT;
  attribute float aSide;
  uniform float uClock;
  uniform float uPhase;
  uniform float uAspect;
  uniform float uBeat;
  uniform float uTreble;
  uniform float uAct;
  varying float vAlpha;

  void main() {
    float t = uClock + aSeed * 6.28;
    float pathT = aPathT + sin(t * 2.0 + aSeed * 5.0) * 0.012;

    // Hide sparkles ahead of the wave front or far behind
    float atFront = smoothstep(uPhase + 0.04, uPhase - 0.02, pathT);
    if (atFront < 0.05) {
      gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      return;
    }

    // Place sparkles near the leading edge of the fill
    float edgeDist = abs(pathT - uPhase);
    float nearEdge = smoothstep(0.12, 0.0, edgeDist);

    float ang = aSide + sin(t * 1.4 + aSeed) * 0.08;
    float rad = pathT * 0.86;
    vec2 pos = vec2(cos(ang), sin(ang)) * rad;
    pos += vec2(sin(t * 3.0 + aSeed), cos(t * 2.5)) * 0.012;
    pos.x /= uAspect;

    float twinkle = 0.4 + 0.6 * sin(t * (5.0 + uTreble * 4.0));
    vAlpha = nearEdge * twinkle * atFront * (0.3 + 0.7 * uAct);
    vAlpha += uBeat * nearEdge * 0.5;

    gl_Position = vec4(pos, 0.0, 1.0);
    gl_PointSize = (2.5 + nearEdge * 4.0 + uBeat * 4.0) * (140.0 + aSeed * 60.0);
  }
`;

const sparkFrag = `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(d));
    vec3 col = mix(uColorB, uColorA, a);
    gl_FragColor = vec4(col, a * vAlpha);
  }
`;

const SPARK_COUNT = 280;
const CYCLE = 1.05;

export class GoldenSeal extends Visualizer {
  build() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.phase = 0;
    this.clock = 0;

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

    const seeds = new Float32Array(SPARK_COUNT);
    const pathTs = new Float32Array(SPARK_COUNT);
    const sides = new Float32Array(SPARK_COUNT);
    for (let i = 0; i < SPARK_COUNT; i++) {
      seeds[i] = Math.random();
      pathTs[i] = 0.05 + Math.random() * 0.92;
      // Snap sparkles to sigil branch directions (diagonals + cardinals)
      const branch = Math.floor(Math.random() * 8);
      sides[i] = (branch / 8.0) * Math.PI * 2 + (Math.PI / 8.0);
    }

    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARK_COUNT * 3), 3));
    sparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    sparkGeo.setAttribute('aPathT', new THREE.BufferAttribute(pathTs, 1));
    sparkGeo.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));

    this.sparkUniforms = {
      uClock: { value: 0 },
      uPhase: { value: 0 },
      uAspect: { value: window.innerWidth / window.innerHeight },
      uBeat: { value: 0 },
      uTreble: { value: 0 },
      uAct: { value: 0 },
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
  }

  frame(reactor, dt) {
    const act = reactor.activity;

    // Beat-synced fill: restart from center on each beat, speed follows energy
    if (reactor.beat > 0.55) this.phase = 0;
    const speed = (0.85 + reactor.energy * 1.4) * act;
    this.phase += (dt / CYCLE) * speed;
    if (this.phase > 1.0) this.phase = 1.0;

    // Slowly bleed back to center when idle between beats
    if (act < 0.2) this.phase += (0 - this.phase) * dt * 1.5;

    this.clock += dt;

    const bu = this.bgUniforms;
    bu.uPhase.value = this.phase;
    bu.uEdge.value = 0.05 + reactor.bass * 0.06;
    bu.uBeat.value = reactor.beat;
    bu.uAct.value = act;

    const su = this.sparkUniforms;
    su.uClock.value = this.clock;
    su.uPhase.value = this.phase;
    su.uBeat.value = reactor.beat;
    su.uTreble.value = reactor.treble;
    su.uAct.value = act;
  }

  resize(w, h) {
    if (this.bgUniforms) this.bgUniforms.uRes.value.set(w, h);
    if (this.sparkUniforms) this.sparkUniforms.uAspect.value = w / h;
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
