import * as THREE from 'three';
import { Visualizer } from './base.js';
import { BAND_NAMES } from '../audio/analyser.js';

const BAND_COUNT = BAND_NAMES.length;

const vert = `
  uniform float uClock;
  uniform float uBeat;
  uniform float uAct;
  uniform float uBands[${BAND_COUNT}];
  attribute float aPhase;
  attribute float aBandIdx;
  attribute float aSize;
  attribute float aMix;
  attribute float aSparkle;
  varying float vTwinkle;
  varying float vCross;
  varying float vMix;
  varying float vAlpha;
  varying float vBandNorm;
  varying float vSparkle;

  void main() {
    int band = int(clamp(aBandIdx, 0.0, float(${BAND_COUNT - 1}) + 0.01));
    float bandVal = uBands[band];
    float bandNorm = float(band) / float(${BAND_COUNT - 1});
    vBandNorm = bandNorm;

    float bassW = 1.0 - smoothstep(0.0, 0.28, bandNorm);
    float midW = smoothstep(0.15, 0.55, bandNorm) * (1.0 - smoothstep(0.55, 0.75, bandNorm));
    float trebleW = smoothstep(0.42, 1.0, bandNorm);

    float speed = mix(0.5, 7.0, bandNorm);
    float pulse = sin(uClock * speed + aPhase) * 0.5 + 0.5;

    float twinkle = 0.22 + pulse * 0.18;
    twinkle += bandVal * (1.6 + trebleW * 1.4);
    twinkle += pulse * (midW * 0.35 + trebleW * 0.2);
    twinkle += bassW * (bandVal * 1.1 + uBeat * 1.0);
    twinkle += trebleW * pulse * bandVal * 1.8;
    vTwinkle = twinkle;

    vCross = trebleW * (0.2 + bandVal * 1.4) + midW * bandVal * 0.3;
    vMix = aMix;
    vSparkle = aSparkle;
    vAlpha = (0.4 + twinkle * 0.6) * (0.5 + 0.5 * uAct);

    vec3 p = position;
    p += normalize(p) * (bandVal * bassW * 0.4 + uBeat * bassW * 0.2) * uAct;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float depth = max(-mv.z, 1.0);
    float sizeBoost = 0.7 + twinkle * (0.35 + bassW * 0.25 + trebleW * 0.2);
    sizeBoost += uBeat * bassW * 0.2;
    gl_PointSize = aSize * sizeBoost * (280.0 / depth);
  }
`;

const frag = `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vTwinkle;
  varying float vCross;
  varying float vMix;
  varying float vAlpha;
  varying float vBandNorm;
  varying float vSparkle;

  float thinRay(vec2 d, vec2 dir, float lengthFalloff, float widthFalloff) {
    vec2 n = vec2(-dir.y, dir.x);
    float along = abs(dot(d, dir));
    float across = abs(dot(d, n));
    return exp(-along * lengthFalloff) * exp(-across * widthFalloff);
  }

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    if (dot(d, d) > 0.32) discard;

    float core = exp(-dot(d, d) * 600.0);

    float h = thinRay(d, vec2(1.0, 0.0), 28.0, 240.0);
    float v = thinRay(d, vec2(0.0, 1.0), 28.0, 240.0);
    float rays = h + v;

    float d1 = thinRay(d, normalize(vec2(1.0, 1.0)), 32.0, 320.0);
    float d2 = thinRay(d, normalize(vec2(1.0, -1.0)), 32.0, 320.0);
    float diags = (d1 + d2) * step(0.45, vSparkle) * (0.25 + vCross * 0.75);

    float rayGain = 0.2 + vTwinkle * 0.45 + vCross * 0.35;
    float sparkle = core + rays * rayGain + diags * vTwinkle;
    if (sparkle < 0.02) discard;

    vec3 col = mix(uColorA, uColorB, vMix);
    col = mix(uColorA, col, smoothstep(0.0, 0.45, vBandNorm));
    col = mix(col, uColorB, smoothstep(0.35, 1.0, vBandNorm) * 0.65);

    vec3 shine = mix(uColorA, uColorB, 0.4);
    col = mix(col, shine, core * clamp(vTwinkle * 0.4, 0.0, 0.55));
    col *= 0.55 + vTwinkle * 0.65;

    gl_FragColor = vec4(col * sparkle, sparkle * vAlpha);
  }
`;

export class StarryNight extends Visualizer {
  build() {
    this.interactive = true;
    this.clock = 0;
    this.bandArr = new Float32Array(BAND_COUNT);
    this.scene.background = new THREE.Color(0x000000);

    const COUNT = 5600;
    const PER_BAND = Math.floor(COUNT / BAND_COUNT);
    const INNER = 6;
    const OUTER = 32;

    const positions = new Float32Array(COUNT * 3);
    const phases = new Float32Array(COUNT);
    const bandIdx = new Float32Array(COUNT);
    const sizes = new Float32Array(COUNT);
    const mixes = new Float32Array(COUNT);
    const sparkles = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const r = INNER + Math.cbrt(Math.random()) * (OUTER - INNER);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      phases[i] = Math.random() * Math.PI * 2;
      bandIdx[i] = Math.min(BAND_COUNT - 1, Math.floor(i / PER_BAND));
      sizes[i] = 0.55 + Math.random() * 0.85;
      mixes[i] = Math.random();
      sparkles[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aBandIdx', new THREE.BufferAttribute(bandIdx, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aMix', new THREE.BufferAttribute(mixes, 1));
    geo.setAttribute('aSparkle', new THREE.BufferAttribute(sparkles, 1));

    this.uniforms = {
      uClock: { value: 0 },
      uBeat: { value: 0 },
      uAct: { value: 1 },
      uBands: { value: this.bandArr },
      uColorA: { value: this.palette.primary.clone() },
      uColorB: { value: this.palette.secondary.clone() },
    };

    this.stars = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.stars);
    this.camera.position.set(0, 0, 14);
    this.camera.lookAt(0, 0, 0);
    this.camera.far = 200;
    this.camera.updateProjectionMatrix();
  }

  frame(reactor, dt) {
    this.clock += dt * (0.3 + reactor.energy * 1.6) * Math.max(reactor.activity, 0.35);

    BAND_NAMES.forEach((name, i) => {
      this.bandArr[i] = reactor.bands[name] || 0;
    });

    const u = this.uniforms;
    u.uClock.value = this.clock;
    u.uBeat.value = reactor.beat;
    u.uAct.value = reactor.activity;

    const spin = dt * (0.04 + reactor.energy * 0.18) * Math.max(reactor.activity, 0.2) * this.rotationSpeed;
    this.stars.rotation.y += spin;
    this.stars.rotation.x += spin * 0.35;
  }

  onPalette(p) {
    if (this.uniforms) {
      this.uniforms.uColorA.value.copy(p.primary);
      this.uniforms.uColorB.value.copy(p.secondary);
    }
  }
}
